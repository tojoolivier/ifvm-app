/**
 * Textes de l'app en français (langue par défaut). Ajouter une langue = ajouter
 * un fichier de même forme (ex. `mg.ts`) et l'enregistrer dans `lib/i18n.ts`.
 * Les clés sont typées : une clé inconnue ne compile pas.
 */
export const fr = {
  ui: {
    retour: 'Retour',
    fermer: 'Fermer',
    ilManque: 'Il manque : {{champs}}',
    etape: 'Étape {{etape}} sur {{total}}',
    stepper: {
      diminuer: 'Diminuer {{label}}',
      augmenter: 'Augmenter {{label}}',
    },
    statTile: '{{libelle}} : {{valeur}}',
    timeline: {
      type: { Vol: 'Vol', Poser: 'Poser', Base: 'Base' },
      resume: '{{type}} {{heure}} : {{titre}}',
      resumeDetail: '{{type}} {{heure}} : {{titre}}, {{detail}}',
    },
  },
} as const;

export type Traductions = typeof fr;
