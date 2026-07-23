/* ============================================================
   Les notes de version, embarquées dans l'app.

   Elles VOYAGENT AVEC LE BUILD : les notes de la v0.12.0 sont dans
   le binaire de la v0.12.0. Pas de serveur à interroger, donc pas
   de note qui parle d'une fonctionnalité que l'app n'a pas encore.

   À chaque release : ajouter une entrée EN HAUT de la liste, avec
   la version exactement telle qu'elle est dans tauri.conf.json.
   ============================================================ */

export type ReleaseNote = {
  version: string;
  date: string; // AAAA-MM-JJ
  title: string;
  /** Le gros morceau de la version, en une phrase. */
  headline?: string;
  sections: { kind: "new" | "fix" | "tweak"; items: string[] }[];
};

export const KIND_LABEL: Record<ReleaseNote["sections"][0]["kind"], string> = {
  new: "Nouveau",
  tweak: "Amélioré",
  fix: "Corrigé",
};

export const CHANGELOG: ReleaseNote[] = [
  {
    version: "0.13.0",
    date: "2026-07-23",
    title: "Skribbl",
    headline:
      "Dessine, fais deviner — le jeu de crayon en soirée, avec pot de peinture et 24 couleurs.",
    sections: [
      {
        kind: "new",
        items: [
          "Skribbl : chacun son tour, un joueur dessine un mot secret et les autres tapent leurs propositions. Plus tu trouves vite, plus tu marques — et le dessinateur aussi.",
          "Outils de dessin : crayon, pot de peinture, gomme, quatre épaisseurs et une palette de 24 couleurs.",
          "Des lettres du mot se dévoilent au fil du temps, et un « tu brûles » privé quand tu approches.",
          "Réglages depuis la table : nombre de manches, temps par dessin, difficulté des mots (banque de 230 mots).",
        ],
      },
      {
        kind: "tweak",
        items: [
          "Un lien de téléchargement à jour se trouve toujours sur la page des versions du projet.",
        ],
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-07-22",
    title: "STAIRS, profil refondu et historique détaillé",
    headline:
      "Un nouveau jeu d'arcade, jouable seul ou en course entre potes, et un profil qui raconte enfin tes parties.",
    sections: [
      {
        kind: "new",
        items: [
          "STAIRS : grimpe une tour infinie, une marche = un point. Le chrono se resserre à chaque étage, et passé la marche 40 des zones maudites inversent les contrôles.",
          "STAIRS en course : depuis une table, tout le monde grimpe en même temps et voit l'altitude des autres monter en direct.",
          "Trois classements STAIRS : du jour, de la semaine, et all-time.",
          "Des gemmes à ramasser pendant les runs — elles serviront bientôt à quelque chose.",
          "Le profil devient une vraie vitrine : panoplie équipée, stats par jeu, et l'historique de tes parties.",
          "Chaque ligne d'historique se déplie sur le détail de la partie : le mot et les votes de L'Imposteur, le classement du Quiz, tes propositions sur les défis du jour.",
          "Les notes de version, que tu es en train de lire.",
        ],
      },
      {
        kind: "tweak",
        items: [
          "La barre des potes survole l'app au lieu de la redimensionner à chaque passage de souris.",
          "Les infobulles ne sont plus celles de Windows — elles suivent enfin la charte.",
          "Depuis le profil d'un pote, tu peux l'inviter directement à ta table.",
        ],
      },
      {
        kind: "fix",
        items: [
          "La page du Mot du jour, dont la mise en page était cassée par de vieux styles.",
          "Le classement du Quiz gère correctement les ex æquo.",
        ],
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-07-22",
    title: "Défis du jour",
    headline: "Deux jeux solo quotidiens, à comparer avec la bande.",
    sections: [
      {
        kind: "new",
        items: [
          "Le Mot du jour : cinq lettres, six essais.",
          "Wikidle : un article Wikipédia entièrement masqué à deviner mot par mot. Proposer « le » révèle aussi « la », « les » et « l' ».",
          "Un puzzle identique pour tout le monde chaque jour, avec classement entre amis et séries de victoires.",
          "Le Quiz Culture a enfin son illustration sur l'accueil.",
        ],
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-19",
    title: "Le Quiz s'étoffe",
    sections: [
      {
        kind: "new",
        items: [
          "Drapeaux à reconnaître, bruits d'animaux, langues étrangères à identifier.",
          "Frise chronologique : place la date au bon endroit.",
          "Petit Bac : une lettre au hasard, six catégories.",
          "Répartition des catégories équilibrée pour éviter les parties monothématiques.",
        ],
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-19",
    title: "Profils et trophées",
    sections: [
      {
        kind: "new",
        items: [
          "Statistiques de partie, trophées à débloquer et historique.",
          "Cliquer sur un pote ouvre son profil.",
        ],
      },
    ],
  },
  {
    version: "0.8.0",
    date: "2026-07-18",
    title: "Quiz Culture",
    sections: [
      {
        kind: "new",
        items: [
          "Le Quiz Culture, avec correction par l'hôte façon plateau télé.",
          "Les réponses se dévoilent joueur par joueur, et le classement remonte du dernier au premier.",
          "En cas de doute, l'hôte ouvre un vote de la table — mais tranche toujours lui-même.",
          "Des bots de test, ajoutables depuis l'app.",
        ],
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-07-18",
    title: "Refonte visuelle complète",
    sections: [
      {
        kind: "new",
        items: [
          "Nouvelle direction artistique sur tous les écrans.",
          "Sons et micro-interactions.",
          "Cosmétiques : titres, bordures d'avatar et effets de victoire.",
        ],
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-07-16",
    title: "Premier jeu jouable",
    sections: [
      {
        kind: "new",
        items: [
          "L'Imposteur : tout le monde reçoit un mot, sauf un. Indices, votes, révélation.",
        ],
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-07-16",
    title: "La bande",
    sections: [
      {
        kind: "new",
        items: [
          "Liste d'amis, présence en temps réel, invitations.",
          "Tables persistantes avec code de partage et chat.",
        ],
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-07-16",
    title: "Les fondations",
    sections: [
      {
        kind: "new",
        items: [
          "Connexion par Discord et mises à jour automatiques.",
        ],
      },
    ],
  },
];

export const LATEST = CHANGELOG[0];
