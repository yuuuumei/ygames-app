# yGAMES-app

Launcher de jeux desktop entre potes (à distance, sur PC).
Réécriture greenfield de yGAMES → app Tauri + backend Python.

**État : Phase 0 — le contrat de jeu.** (rien de réseau/UI encore)

## Idée d'architecture

Le serveur est **autoritatif** : il détient toute la vérité du jeu et
n'envoie à chaque joueur que ce qu'il a le droit de voir. Le client
n'est qu'une télécommande. Tout jeu se branche via un **contrat**
commun, donc en ajouter un ne touche jamais le cœur.

```
core/
  contract.py   Game (ABC) + Player, Event, GameMeta, Option, GameContext
  runner.py     GameRunner — pilote une partie, agnostique du jeu
  registry.py   registre des jeux (@register)
games/
  impostor/     L'Imposteur — jeu de référence (le patron)
demo_impostor.py  partie complète jouée dans le terminal
```

## Lancer la démo

```bash
python demo_impostor.py
```

Affiche une partie entière + ce que voit **chaque** joueur (preuve de
l'info cachée : l'imposteur a un mot différent, sans le savoir).

## Ajouter un jeu (tout l'intérêt du contrat)

1. Créer `games/<jeu>/game.py` avec une classe `@register` qui hérite
   de `Game` et remplit : `setup`, `on_action`, `public_view`,
   `is_over`, `result` (+ hooks `on_disconnect`/`on_reconnect`).
2. C'est tout. **Aucune modif du `core/`.** Le launcher le voit
   automatiquement via le registre.

## Les 5 méthodes du contrat

| Méthode | Rôle |
|---|---|
| `setup(players, config)` | construit l'état initial |
| `on_action(player_id, action)` | traite un coup, retourne des events |
| `public_view(player_id)` | **filtre l'info cachée** — l'état complet ne sort jamais |
| `is_over()` | partie finie ? |
| `result()` | gagnants / révélations |

## Stack cible

- Backend : Python 3.11 + Flask + Flask-SocketIO (transport repris de l'ancien yGAMES), Railway
- Client : Tauri + React (shell : login Discord, friendlist, lobby)
- Auth : Discord OAuth (`client_secret` côté serveur uniquement)
- Distribution : GitHub Releases + auto-updater Tauri
