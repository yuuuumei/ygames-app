# Brief — Écran « Mon profil » (vitrine joueur)

Fais-moi une maquette **HTML+CSS autonome** (un seul fichier, aucune dépendance
externe, polices système en fallback) de l'écran **Profil** de yGAMES.

## Le produit

yGAMES est un launcher de jeux de soirée entre potes (type Jackbox privé), en
app desktop. On se connecte via Discord, on rejoint une table, on joue à
L'Imposteur, au Quiz culture, et à des défis quotidiens solo.

## Ce que doit être cette page

**Une vitrine, pas un panneau de réglages.** C'est la page qu'un joueur ouvre
pour se la raconter, et surtout **celle que les autres voient quand ils cliquent
sur son avatar**. Elle doit donner envie de jouer plus pour la remplir.

La même maquette sert deux cas :
- **mon profil** → bouton « Personnaliser » visible ;
- **le profil d'un pote** → pas de bouton « Personnaliser », mais un bouton
  « Inviter à ma table ». Montre les deux variantes.

## Structure demandée

### 1. En-tête vitrine (toujours visible, au-dessus des onglets)

- Grand avatar, avec la **bordure cosmétique équipée** (anneau décoratif, c'est
  un objet à débloquer — soigne-le, c'est le truc dont les gens sont fiers).
- Pseudo en grand + **titre équipé** en dessous (ex. « Menteur professionnel »),
  affiché comme une distinction, pas comme un sous-titre neutre.
- Pastille de présence (en ligne / hors ligne).
- « Membre depuis mars 2026 ».
- Une **couleur signature** choisie par le joueur : elle doit teinter
  discrètement l'en-tête (halo, filet, dégradé) pour que deux profils ne se
  ressemblent pas.
- 3–4 chiffres clés en gros : parties jouées, victoires, % de victoires,
  parties hébergées.

### 2. Onglets

Deux onglets seulement : **Profil** et **Historique**. L'onglet actif doit être
franchement lisible. À droite de la barre d'onglets, le bouton
**« Personnaliser »** (secondaire, discret mais trouvable — il mène à l'écran
de customisation qui existe déjà).

### 3. Onglet « Profil »

- **Par jeu** : une carte par jeu (L'Imposteur, Quiz culture) avec parties
  jouées, victoires, ratio. Prévois le cas « jamais joué » (carte grisée,
  incitation à essayer).
- **Faits d'armes** : stats de niche qui racontent une histoire —
  « parties en imposteur », « victoires en imposteur », « votes corrects »,
  « victoires sans indice », « pire série de mauvais votes ». Traite-les comme
  des trophées à afficher, pas comme un tableau de chiffres.
- **Vitrine des cosmétiques** : ce qui est équipé (titre / bordure / effet de
  victoire), plus un aperçu du reste débloqué et un compteur « 7 / 24 débloqués ».
  Prévois un état verrouillé (silhouette + condition de déblocage).

### 4. Onglet « Historique »

Les 15 dernières parties, en liste chronologique :
- icône du jeu, nom du jeu ;
- **victoire / défaite** très lisible d'un coup d'œil ;
- une ligne de contexte (« Imposteur démasqué au 3e tour », « 4e sur 6 ») ;
- date relative (« il y a 2 h », « hier », « 12 juil. »).

Prévois l'**état vide** : « Aucune partie pour l'instant ».

## Design system à respecter

Fond très sombre, interface dense mais aérée, angles arrondis, beaucoup de
contraste sur les chiffres.

```
--void:#050609  --base:#0e1016  --surface:#12151d  --card:#1a1e29  --elevated:#212635  --panel:#0b0d13
--txt:#eef1f8   --txt-2:#98a1b6 --txt-3:#5f6982
--line:rgba(255,255,255,.05)    --line-2:rgba(255,255,255,.1)
--accent:#7c6cff  --accent-2:#22d3ee  --online:#43d17a  --gold:#ffc24b  --danger:#ff4d5e
--signature: linear-gradient(135deg,#7c6cff,#22d3ee)
--r-chip:8px  --r-card:12px  --r-panel:16px
--ease: cubic-bezier(.2,.8,.2,1)   --spring: cubic-bezier(.34,1.56,.64,1)
```

Polices : **Space Grotesk** (titres), **Manrope** (interface),
**JetBrains Mono** (chiffres, dates, ratios — tout ce qui est chiffré passe en
mono, c'est la signature de l'app).

## Contraintes

- Fenêtre desktop, ~1180 × 810 px de zone utile. Pas de scroll horizontal.
- Le contenu des onglets scrolle ; l'en-tête vitrine et les onglets restent en place.
- Utilise du faux contenu crédible et **francophone** (pseudos de potes, pas de
  « John Doe »).
- Transitions courtes (150–280 ms). Rien qui clignote.
- Un seul fichier HTML, CSS inline dans `<style>`. Pas de JS obligatoire, mais
  si tu en mets pour changer d'onglet, garde-le minimal et inline.
- Montre les **deux variantes** (mon profil / profil d'un pote) l'une sous
  l'autre dans la page, séparées par un titre de section.
