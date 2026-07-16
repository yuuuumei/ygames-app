//! Authentification Discord — côté client.
//!
//! Le flow complet :
//! 1. On ouvre un mini serveur HTTP local (loopback) sur un des ports réservés.
//! 2. On ouvre le navigateur par défaut sur la page d'autorisation Discord.
//! 3. Discord redirige le navigateur vers http://127.0.0.1:PORT/callback?code=...
//!    → notre mini serveur capte ce `code` (et vérifie le `state` anti-CSRF).
//! 4. On envoie le code à NOTRE serveur Flask, qui l'échange contre l'identité
//!    Discord (lui seul possède le client_secret) et nous rend un token de
//!    session maison.
//! 5. On range ce token dans le keychain Windows (Credential Manager).

use keyring::Entry;
use rand::distributions::Alphanumeric;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::time::{Duration, Instant};
use tauri_plugin_opener::OpenerExt;

/// En dev (`npm run tauri dev`) : le Flask local.
#[cfg(debug_assertions)]
const SERVER_URL: &str = "http://127.0.0.1:8787";
/// En release (builds distribués aux potes) : le serveur Railway.
#[cfg(not(debug_assertions))]
const SERVER_URL: &str = "https://ygames-server-production.up.railway.app";
const DISCORD_CLIENT_ID: &str = "1527351493899059331";
/// Les 3 ports enregistrés comme redirect URIs sur le portail Discord.
const LOOPBACK_PORTS: [u16; 3] = [53682, 53683, 53684];
/// Temps max laissé à l'utilisateur pour autoriser dans le navigateur.
const LOGIN_TIMEOUT: Duration = Duration::from_secs(180);

const KEYRING_SERVICE: &str = "yGAMES";
const KEYRING_ACCOUNT: &str = "session-token";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct User {
    pub id: i64,
    pub discord_id: String,
    pub username: String,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct AuthResponse {
    token: String,
    user: User,
}

#[derive(Deserialize)]
struct MeResponse {
    user: User,
}

// ---------------------------------------------------------------- keychain

fn keyring_entry() -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, KEYRING_ACCOUNT).map_err(|e| format!("keychain: {e}"))
}

fn store_token(token: &str) -> Result<(), String> {
    keyring_entry()?
        .set_password(token)
        .map_err(|e| format!("keychain (écriture): {e}"))
}

fn read_token() -> Option<String> {
    keyring_entry().ok()?.get_password().ok()
}

fn clear_token() {
    if let Ok(entry) = keyring_entry() {
        let _ = entry.delete_credential();
    }
}

// ------------------------------------------------------- serveur loopback

/// Page affichée dans le navigateur une fois le code capté.
const SUCCESS_PAGE: &str = "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">\
<title>yGAMES</title></head>\
<body style=\"background:#14121c;color:#e8e6f0;font-family:sans-serif;\
display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">\
<div style=\"text-align:center\"><h1>Connecté ✅</h1>\
<p>Tu peux fermer cet onglet et retourner sur yGAMES.</p></div></body></html>";

const ERROR_PAGE: &str = "<!doctype html><html lang=\"fr\"><head><meta charset=\"utf-8\">\
<title>yGAMES</title></head>\
<body style=\"background:#14121c;color:#e8e6f0;font-family:sans-serif;\
display:flex;align-items:center;justify-content:center;height:100vh;margin:0\">\
<div style=\"text-align:center\"><h1>Échec de la connexion ❌</h1>\
<p>Retourne sur yGAMES et réessaie.</p></div></body></html>";

fn html_response(body: &str, status: u16) -> tiny_http::Response<std::io::Cursor<Vec<u8>>> {
    tiny_http::Response::from_string(body)
        .with_status_code(status)
        .with_header(
            tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"text/html; charset=utf-8"[..])
                .unwrap(),
        )
}

/// Extrait un paramètre de query string (?a=1&b=2) sans dépendance externe.
fn query_param(url: &str, name: &str) -> Option<String> {
    let query = url.split_once('?')?.1;
    for pair in query.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            if k == name {
                return Some(v.to_string());
            }
        }
    }
    None
}

/// Attend (bloquant) que Discord redirige le navigateur vers /callback.
/// Renvoie le `code` OAuth après avoir vérifié le `state`.
fn wait_for_callback(server: tiny_http::Server, expected_state: &str) -> Result<String, String> {
    let deadline = Instant::now() + LOGIN_TIMEOUT;
    loop {
        let remaining = deadline
            .checked_duration_since(Instant::now())
            .ok_or("délai dépassé — connexion annulée")?;

        let request = match server.recv_timeout(remaining) {
            Ok(Some(req)) => req,
            Ok(None) => return Err("délai dépassé — connexion annulée".into()),
            Err(e) => return Err(format!("serveur loopback: {e}")),
        };

        let url = request.url().to_string();
        if !url.starts_with("/callback") {
            // favicon.ico et autres bruits du navigateur : on ignore et on continue.
            let _ = request.respond(html_response("", 404));
            continue;
        }

        // L'utilisateur a cliqué "Annuler" sur l'écran Discord.
        if query_param(&url, "error").is_some() {
            let _ = request.respond(html_response(ERROR_PAGE, 200));
            return Err("connexion refusée dans le navigateur".into());
        }

        let state = query_param(&url, "state").unwrap_or_default();
        let code = query_param(&url, "code");

        if state != expected_state {
            let _ = request.respond(html_response(ERROR_PAGE, 400));
            return Err("state invalide (tentative de CSRF ?)".into());
        }
        match code {
            Some(code) if !code.is_empty() => {
                let _ = request.respond(html_response(SUCCESS_PAGE, 200));
                return Ok(code);
            }
            _ => {
                let _ = request.respond(html_response(ERROR_PAGE, 400));
                return Err("réponse Discord sans code".into());
            }
        }
    }
}

// ------------------------------------------------------------- commandes

/// Lance le flow complet de connexion Discord.
#[tauri::command]
pub async fn login_discord(app: tauri::AppHandle) -> Result<User, String> {
    // 1. Un port loopback libre parmi ceux enregistrés chez Discord.
    let (server, port) = LOOPBACK_PORTS
        .iter()
        .find_map(|&p| {
            tiny_http::Server::http(("127.0.0.1", p))
                .ok()
                .map(|s| (s, p))
        })
        .ok_or("aucun port loopback disponible (53682-53684)")?;

    let redirect_uri = format!("http://127.0.0.1:{port}/callback");

    // 2. state aléatoire anti-CSRF.
    let state: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    // 3. Ouverture du navigateur sur l'écran d'autorisation Discord.
    let authorize_url = format!(
        "https://discord.com/oauth2/authorize?client_id={DISCORD_CLIENT_ID}\
         &response_type=code&scope=identify&redirect_uri={}&state={state}",
        urlencoding::encode(&redirect_uri),
    );
    app.opener()
        .open_url(&authorize_url, None::<&str>)
        .map_err(|e| format!("impossible d'ouvrir le navigateur: {e}"))?;

    // 4. Attente du retour de Discord (dans un thread bloquant dédié).
    let expected_state = state.clone();
    let code =
        tauri::async_runtime::spawn_blocking(move || wait_for_callback(server, &expected_state))
            .await
            .map_err(|e| format!("thread loopback: {e}"))??;

    // 5. Échange du code via NOTRE serveur (le secret ne quitte jamais Flask).
    let resp = reqwest::Client::new()
        .post(format!("{SERVER_URL}/auth/discord"))
        .json(&serde_json::json!({ "code": code, "redirect_uri": redirect_uri }))
        .send()
        .await
        .map_err(|_| "serveur yGAMES injoignable — il tourne ?".to_string())?;

    if !resp.status().is_success() {
        return Err(format!("le serveur a refusé le code ({})", resp.status()));
    }
    let auth: AuthResponse = resp
        .json()
        .await
        .map_err(|e| format!("réponse serveur illisible: {e}"))?;

    // 6. Le token de session part dans le Credential Manager Windows.
    store_token(&auth.token)?;

    Ok(auth.user)
}

/// Auto-login au démarrage : token du keychain → /auth/me.
/// Renvoie None si pas de token ou session expirée (→ écran de login).
#[tauri::command]
pub async fn get_session() -> Result<Option<User>, String> {
    let Some(token) = read_token() else {
        return Ok(None);
    };

    let resp = reqwest::Client::new()
        .get(format!("{SERVER_URL}/auth/me"))
        .bearer_auth(&token)
        .send()
        .await
        .map_err(|_| "serveur yGAMES injoignable — il tourne ?".to_string())?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        clear_token(); // session morte côté serveur : on nettoie le keychain
        return Ok(None);
    }
    if !resp.status().is_success() {
        return Err(format!("erreur serveur ({})", resp.status()));
    }

    let me: MeResponse = resp
        .json()
        .await
        .map_err(|e| format!("réponse serveur illisible: {e}"))?;
    Ok(Some(me.user))
}

/// Déconnexion : invalide la session côté serveur puis nettoie le keychain.
#[tauri::command]
pub async fn logout() -> Result<(), String> {
    if let Some(token) = read_token() {
        // Même si le serveur est injoignable, on déconnecte localement.
        let _ = reqwest::Client::new()
            .post(format!("{SERVER_URL}/auth/logout"))
            .bearer_auth(&token)
            .send()
            .await;
    }
    clear_token();
    Ok(())
}
