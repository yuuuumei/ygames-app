/** URL du serveur yGAMES, selon le contexte de build.
 *  Doit rester alignée avec SERVER_URL côté Rust (src-tauri/src/auth.rs). */
export const SERVER_URL = import.meta.env.DEV
  ? "http://127.0.0.1:8787"
  : "https://ygames-server-production.up.railway.app";
