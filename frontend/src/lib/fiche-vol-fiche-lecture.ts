// Logique pure de synthèse pour la vue imprimable A4 de la fiche de vol
// (#fiche-vol-impression), même patron que prospection-fiche-lecture.ts (#19) :
// aucun nouvel appel API, tout est dérivé de la fiche déjà chargée par
// FicheVolDetailPage.

import { TYPE_VOL_LABELS } from './fiche-vol'

export interface BlocDetail {
  numero: number
  nom: string
  localite: string | null
  surface_theorique_ha: number | null
  surface_protegee_ha: number | null
  surface_traitee_ha: number | null
  largeur_andain_m: number | null
  interpasse_m: number | null
  hauteur_vol_min_m: number | null
  hauteur_vol_max_m: number | null
  observation: string | null
  espece: string | null
  // Indicateur global au traitement (porté par `cible`, pas par bloc) — présent sur
  // chaque bloc d'un même traitement, jamais une donnée propre au bloc individuel.
  vols_clairs_essaims: string | null
}

export interface VolImprimableInput {
  id: string
  numero: number
  type_vol: string
  numero_cuve: string | null
  bloc: BlocDetail | null
}

export interface LigneBlocViewModel {
  volId: string
  volNumero: number
  typeVolLabel: string
  numeroCuve: string
  blocNumero: number
  blocNom: string
  localite: string
  espece: string
  surfaceTheoriqueHa: string
  surfaceProtegeeHa: string
  surfaceTraiteeHa: string
  largeurAndainM: string
  interpasseM: string
  hauteurVol: string
  observation: string
}

/**
 * Une ligne par vol dont la rotation est rattachée à un bloc — un vol sans rotation
 * (convoyage) ou dont la rotation n'a pas encore de bloc n'apparaît pas dans ce
 * tableau (pas de ligne à trous, cf. #fiche-vol-impression).
 */
export function buildLignesBlocs(vols: VolImprimableInput[]): LigneBlocViewModel[] {
  return vols
    .filter((v): v is VolImprimableInput & { bloc: BlocDetail } => v.bloc !== null)
    .map((v) => ({
      volId: v.id,
      volNumero: v.numero,
      typeVolLabel: TYPE_VOL_LABELS[v.type_vol] ?? v.type_vol,
      numeroCuve: v.numero_cuve ?? '—',
      blocNumero: v.bloc.numero,
      blocNom: v.bloc.nom,
      localite: v.bloc.localite ?? '—',
      espece: v.bloc.espece ?? '—',
      surfaceTheoriqueHa: formatHectares(v.bloc.surface_theorique_ha),
      surfaceProtegeeHa: formatHectares(v.bloc.surface_protegee_ha),
      surfaceTraiteeHa: formatHectares(v.bloc.surface_traitee_ha),
      largeurAndainM: formatMetres(v.bloc.largeur_andain_m),
      interpasseM: formatMetres(v.bloc.interpasse_m),
      hauteurVol: formatHauteurVol(v.bloc.hauteur_vol_min_m, v.bloc.hauteur_vol_max_m),
      observation: v.bloc.observation ?? '—',
    }))
}

function formatHectares(valeur: number | null): string {
  return valeur != null ? `${valeur} ha` : '—'
}

function formatMetres(valeur: number | null): string {
  return valeur != null ? `${valeur} m` : '—'
}

function formatHauteurVol(min: number | null, max: number | null): string {
  if (min == null && max == null) return '—'
  if (min != null && max != null) return `${min}–${max} m`
  return `${min ?? max} m`
}

/**
 * `Cible.vols_clairs_essaims` est un indicateur global au traitement, jamais détaillé
 * par bloc (aucune colonne de ce grain n'existe en base) — une seule valeur pour toute
 * la fiche, prise sur le premier bloc qui la porte plutôt que répétée par ligne.
 */
export function essaimsIndicateur(vols: VolImprimableInput[]): string | null {
  return vols.find((v) => v.bloc?.vols_clairs_essaims)?.bloc?.vols_clairs_essaims ?? null
}
