import type { components } from '@/lib/api-schema.generated';
import type { ProspectionCreate, SaisieProspection } from '@/lib/prospection-db';
import { parserHa, type ReferenceValeurs } from '@/lib/prospection-reference-schema';
import type { ZoneAdministrative } from '@/lib/geo-administratif';

type Biotope = components['schemas']['Biotope'];
type TypeStation = components['schemas']['TypeStation'];

/** Station libre pré-remplie : commune, sinon district, sinon région (« » si le géocodage a échoué). */
export function stationLibreDepuisZone(zone: ZoneAdministrative | null): string {
  return zone?.commune || zone?.district || zone?.region || '';
}

export type SaisieReference = Omit<ReferenceValeurs, 'biotope'> & {
  type: 'intensive' | 'extensive' | 'validation';
  biotope: (Biotope & TypeStation)[];
};

/**
 * Champs de la fiche écrits par l'étape Référence. Sans station du référentiel (extensive, validation),
 * la surface « Prospectée » est enregistrée dans `surface_station` et le biotope dans `type_station`.
 */
export function champsDeReference(s: SaisieReference) {
  const extensif = s.type !== 'intensive';
  return {
    surface_station: extensif ? parserHa(s.surface_prospectee) : parserHa(s.surface_station),
    surface_prospectee: extensif ? null : parserHa(s.surface_prospectee),
    surface_infestee: parserHa(s.surface_infestee) ?? 0,
    biotope: extensif ? [] : s.biotope,
    type_station: extensif ? s.biotope : [],
    station_libre: extensif ? s.station_libre.trim() || null : null,
  };
}

/** `YYYY-MM-DD` à l'heure locale de l'appareil (pas UTC : à Madagascar, UTC+3, le jour changerait 3 h trop tôt). */
export function dateLocale(d: Date): string {
  const deuxChiffres = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${deuxChiffres(d.getMonth() + 1)}-${deuxChiffres(d.getDate())}`;
}

/** Valeurs du formulaire d'après une fiche enregistrée : l'inverse de `champsDeReference`. */
export function valeursDeReference(f: {
  type_prospection: string;
  surface_station?: number | null;
  surface_prospectee?: number | null;
  surface_infestee?: number | null;
  station_libre?: string | null;
  biotope: string[];
  type_station: string[];
}): ReferenceValeurs {
  const extensif = f.type_prospection !== 'intensive';
  const texte = (n?: number | null) => (n == null ? '' : String(n).replace('.', ','));
  return {
    surface_station: extensif ? '' : texte(f.surface_station),
    surface_prospectee: extensif ? texte(f.surface_station) : texte(f.surface_prospectee),
    surface_infestee: texte(f.surface_infestee ?? 0),
    station_libre: f.station_libre ?? '',
    biotope: extensif ? f.type_station : f.biotope,
  };
}

/** Parts (0–100 %) de Prospectée et d'Infestée rapportées à `total` (Station ; en extensive, la Prospectée elle-même). */
export function repartitionSurfaces(s: { total: number | null; prospectee: number | null; infestee: number | null }) {
  const part = (n: number | null) =>
    !s.total || n == null ? 0 : Math.min(100, Math.max(0, Math.round((n / s.total) * 100)));
  return { prospecteePct: part(s.prospectee), infesteePct: part(s.infestee) };
}

/** « 25/09/2026 · 12:08 », à l'heure locale de l'appareil. */
export function formaterDateHeure(d: Date): string {
  const deux = (n: number) => String(n).padStart(2, '0');
  return `${deux(d.getDate())}/${deux(d.getMonth() + 1)}/${d.getFullYear()} · ${deux(d.getHours())}:${deux(d.getMinutes())}`;
}

export interface PositionSaisie {
  latitude: number;
  longitude: number;
  altitude: number | null;
}

/**
 * Fiche complète écrite par l'étape Référence : reprend le brouillon existant (listes, champs des autres
 * étapes) et n'y remplace que ce que cet écran gère.
 */
export function construireSaisieReference(p: {
  brouillon?: ProspectionCreate & { id: string };
  id: string;
  type: SaisieReference['type'];
  campagneId: string;
  equipeId: string;
  dateProspection: string;
  numeroFiche: string;
  numeroMessage: string;
  stationId: string | null;
  paCode: string | null;
  zone: ZoneAdministrative | null;
  position: PositionSaisie | null;
  valeurs: ReferenceValeurs;
}): SaisieProspection {
  const { brouillon: b } = p;
  return {
    ...b,
    id: p.id,
    type_prospection: p.type,
    campagne_id: p.campagneId,
    equipe_id: p.equipeId,
    date_prospection: p.dateProspection,
    n_fiche: p.numeroFiche,
    n_message: p.type === 'extensive' ? p.numeroMessage : null,
    station_id: p.stationId,
    pa_code: p.paCode,
    region: p.zone?.region ?? null,
    district: p.zone?.district ?? null,
    commune: p.zone?.commune ?? null,
    latitude: p.position?.latitude ?? null,
    longitude: p.position?.longitude ?? null,
    altitude: p.position?.altitude ?? null,
    avertissements: b?.avertissements ?? [],
    populations: b?.populations ?? [],
    captures: b?.captures ?? [],
    infestations: b?.infestations ?? [],
    operations_aeriennes: b?.operations_aeriennes ?? [],
    ...champsDeReference({ ...p.valeurs, type: p.type, biotope: p.valeurs.biotope as SaisieReference['biotope'] }),
  };
}
