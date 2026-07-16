# yGAMES — Brief de direction artistique

> Brief pour le passage design complet de l'app. Lis-le en entier avant de
> commencer. Tu as beaucoup de liberté — les contraintes listées sont les
> seules qui existent.

## Le produit

**yGAMES** est un launcher desktop privé de jeux de soirée ("petit Jackbox
entre potes") : une bande d'amis français, tous sur PC + Discord, se
connectent, ouvrent une **table**, et enchaînent des parties de jeux à info
cachée (L'Imposteur aujourd'hui, Spyfall et un quiz culture bientôt).
C'est un projet perso passion, pas un produit commercial — le public, c'est
une dizaine de potes exigeants.

**Vocabulaire établi** (à respecter dans l'UI) : on dit **table** / **la
bande** / **groupe** — jamais "lobby". Jeu d'abord : on clique un jeu, la
table s'ouvre.

## Direction créative (décisions de Lucas, le proprio)

1. **Ambiance : gaming sombre premium.** Esprit Discord/Steam : fond sombre
   élégant, finitions soignées, accents maîtrisés. Sérieux dans la forme,
   fun dans le contenu. PAS kitsch, PAS enfantin.
2. **Palette : carte blanche totale.** L'actuel (violet Discord → rose) est
   un placeholder, aucun attachement. Propose ce que TU juges le meilleur.
3. **Micro-copy : sobre et direct.** Textes courts, efficaces. Le fun vient
   du jeu, pas des blagues d'interface. (Tu peux réécrire les textes actuels
   dans ce ton — tutoiement conservé, on est entre potes.)
4. **Motion : généreux et juicy.** Transitions travaillées, cartes qui
   vivent, révélation de l'imposteur mise en scène, victoire/défaite
   dramatisées. C'est LE contraste voulu : une interface posée qui explose
   aux moments de jeu.
5. **Une ambiance par jeu.** L'app a sa DA cohérente, mais entrer dans un
   jeu = entrer dans son monde. L'Imposteur → enquête/espionnage/suspicion.
   (Les jeux futurs auront chacun le leur ; pose le principe avec celui-ci.)
6. **Branding complet.** Crée le logo yGAMES ET l'icône d'application
   (actuellement l'icône Tauri par défaut — barre des tâches, installeur,
   raccourci). `npm run tauri icon chemin/icone.png` (depuis `client/`)
   génère toutes les tailles à partir d'un PNG 1024×1024.
7. **Liberté structurelle totale + droit de proposer.** Les fonctionnalités
   et les flows sont figés (rien à ajouter/retirer fonctionnellement), mais
   tu réorganises les layouts comme tu l'entends. Et si tu as des idées de
   micro-UX (tooltips, états vides mémorables, raccourcis, sons ?), propose.

## Process imposé : direction d'abord, code ensuite

**Étape 1 — proposition de direction** : palette, typo, principes de motion,
et UNE maquette d'écran clé (l'accueil launcher) pour incarner le tout.
Format libre (HTML statique dans un dossier `design/`, par exemple).
→ Validation par Lucas. Itère si besoin.

**Étape 2 — implémentation complète** dans l'app React, écran par écran,
+ logo/icône. L'app doit rester 100 % fonctionnelle à la fin (vérifie que
`npm run build` passe dans `client/` et teste en conditions réelles).

## Inventaire des écrans et états (tout est dans `client/src/`)

| Écran / état | Fichier | Notes |
|---|---|---|
| Login (bouton Discord) | `App.tsx` | + états : en attente d'autorisation, erreur |
| Accueil launcher | `App.tsx` | grille de jeux, profil, amis (sidebar), rejoindre par code |
| Panneau amis | `FriendsPanel.tsx` | ajout par pseudo, demandes reçues (✓/✕), en ligne/hors ligne |
| Table ("On joue à quoi ?") | `LobbyScreen.tsx` | sélection de jeux, bande, invitations, chat, code copiable, host 👑 |
| Écran de reconnexion | `App.tsx` | retour dans l'app avec une table en cours : on propose, on n'impose pas |
| Jeu : L'Imposteur | `ImpostorScreen.tsx` | 3 phases : indices (mot secret, tour par tour) → vote (clic sur un joueur) → révélation (victoire/défaite). LE terrain de jeu du motion. |
| Bannière mise à jour | `UpdateBanner.tsx` | bas d'écran, discrète. Idée notée pour plus tard : progression du téléchargement visible. |
| Bannières d'invitation | `App.tsx` | un ami t'invite à sa table → rejoindre/ignorer |
| Chargement initial | `App.tsx` | actuellement un simple "Chargement…" — opportunité de splash |

États à ne pas oublier : ami hors ligne (point gris), membre déconnecté en
grâce (💤), joueur dont c'est le tour, joueur ayant voté, "bientôt" sur les
jeux non implémentés, erreurs réseau ("Reconnexion…").

## Contraintes techniques

- **Stack** : Tauri 2 + React 18 + TypeScript + Vite. CSS vanilla actuellement
  (`App.css`). Tu peux introduire des libs front légères si justifié
  (ex. framer-motion pour le motion) — pas de framework CSS lourd.
- **Fenêtre desktop** : 1100×720 par défaut, min 900×600, redimensionnable.
  Desktop uniquement, pas de responsive mobile.
- **Dark only** (app de soirée) — pas de light mode à prévoir.
- **Avatars** : photos Discord rondes (URL) avec fallback initiale sur
  dégradé. Certains "joueurs" de test n'ont pas d'avatar.
- **Ne touche pas** : `client/src-tauri/` (Rust) hors icônes, `server/`
  (logique), les events socket et la forme des données. `useSocial.ts` est
  le hook central — tu peux le lire pour comprendre les données, le modifier
  seulement si un besoin d'affichage le justifie.
- **Langue** : tout en français.

## Tester en conditions réelles

```powershell
# Terminal 1 — serveur local
cd server && .\.venv\Scripts\python.exe app.py

# Terminal 2 — l'app
cd client && npm run tauri dev

# Terminal 3+ — des faux joueurs pour peupler table et parties
cd server
.\.venv\Scripts\python.exe tools\fake_player.py Alice --join CODE
.\.venv\Scripts\python.exe tools\fake_player.py Bob --join CODE
```
Les bots rejoignent, chattent, donnent des indices et votent : tu peux voir
tous les écrans de jeu vivre sans deuxième humain. (Lucas fait tourner
l'app lui-même pour valider — donne-lui les scénarios à regarder.)

## Ce que Lucas attend de toi

Une app qu'on ouvre et qui fait dire aux potes « attends, c'est TOI qui as
fait ça ?? ». Premium au premier regard, spectaculaire quand on joue.
Surprends-le — il t'a donné carte blanche pour ça.
