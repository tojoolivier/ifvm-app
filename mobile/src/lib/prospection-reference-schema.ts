import { array, object, string } from 'yup';

/** Valeurs du formulaire de l'étape Référence : les surfaces restent du texte (virgule française). */
export type ReferenceValeurs = {
  /** Intensive seulement : en extensive, la « prospectée » est enregistrée dans `surface_station`. */
  surface_station: string;
  surface_prospectee: string;
  surface_infestee: string;
  /** Extensive / validation : station en saisie libre, pas de station du référentiel. */
  station_libre: string;
  biotope: string[];
};

export type ModeReference = 'intensive' | 'extensive';

export const BIOTOPES = ['xerophyle', 'mesophyle', 'hydrophyle'] as const;

/** « 8,5 » → 8.5 ; `null` si vide ou non numérique. */
export function parserHa(texte: string | undefined | null): number | null {
  const t = (texte ?? '').trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * Schéma de l'étape Référence. Contrôle l'imbrication des surfaces pendant la saisie (intensive :
 * Station ⊇ Prospectée ⊇ Infestée ; extensive : Prospectée ⊇ Infestée) : l'erreur est portée par le
 * champ le plus « petit » qui dépasse. `t` fournit les messages (`fr.ts`).
 */
export function creerReferenceSchema(mode: ModeReference, t: (cle: string) => string) {
  const e = (cle: string) => t(`prospection.reference.erreurs.${cle}`);
  const ha = (requis: string) =>
    string()
      .default('')
      .test('requis', requis, (v) => parserHa(v) !== null)
      .test('nombre', e('nombreInvalide'), (v) => !v || parserHa(v) !== null);

  const infestee = string()
    .default('0')
    .test('nombre', e('nombreInvalide'), (v) => !v || parserHa(v) !== null)
    .test('<=prospectee', e('infesteeSuperieure'), function (v) {
      const i = parserHa(v);
      const p = parserHa(this.parent.surface_prospectee);
      return i === null || p === null || i <= p;
    });

  const biotope = array(string().defined())
    .default([])
    .min(1, e('biotopeRequis'))
    .test('connus', e('biotopeRequis'), (v) => (v ?? []).every((b) => (BIOTOPES as readonly string[]).includes(b)));

  if (mode === 'extensive') {
    return object({
      station_libre: string()
        .default('')
        .test('requis', e('stationLibreRequise'), (v) => (v ?? '').trim() !== ''),
      surface_prospectee: ha(e('prospecteeRequise')),
      surface_infestee: infestee,
      biotope,
    });
  }

  return object({
    surface_station: ha(e('stationRequise')),
    surface_prospectee: ha(e('prospecteeRequise')).test('<=station', e('prospecteeSuperieure'), function (v) {
      const p = parserHa(v);
      const s = parserHa(this.parent.surface_station);
      return p === null || s === null || p <= s;
    }),
    surface_infestee: infestee,
    biotope,
  });
}
