import { apiClient, Campagne } from './api-client';
import { generateId } from './id';
import {
  createDraftProspection,
  countUnsyncedProspections,
  listDraftProspections,
  listRecentProspections,
  DraftProspection,
  TypeProspection,
} from './prospection-repository';

export interface AccueilViewModel {
  unsyncedCount: number;
  activeDraft: DraftProspection | null;
  recent: DraftProspection[];
}

/** Charge les données de l'écran Accueil depuis le store local — aucune dépendance réseau. */
export async function loadAccueilData(): Promise<AccueilViewModel> {
  const [drafts, recent, unsyncedCount] = await Promise.all([
    listDraftProspections(),
    listRecentProspections(),
    countUnsyncedProspections(),
  ]);

  return {
    unsyncedCount,
    activeDraft: drafts[0] ?? null,
    recent,
  };
}

/** Choisit la campagne en cours parmi les campagnes connues (règle : une seule campagne à la fois). */
export function pickCurrentCampagneId(
  campagnes: Campagne[],
  today: Date = new Date()
): string | null {
  if (campagnes.length === 0) return null;

  const iso = today.toISOString().slice(0, 10);
  const enCours = campagnes.filter(
    (c) => c.start_date <= iso && (!c.end_date || c.end_date >= iso)
  );
  const pool = enCours.length > 0 ? enCours : campagnes;

  return [...pool].sort((a, b) => b.start_date.localeCompare(a.start_date))[0].id;
}

/** Initialise une fiche brouillon vide en local et la lie à la campagne en cours. */
export async function startNewProspection(params: {
  token: string;
  prospecteurId: string;
  typeProspection?: TypeProspection;
}): Promise<DraftProspection> {
  const campagnes = await apiClient.getCampagnes(params.token);
  const campagneId = pickCurrentCampagneId(campagnes);
  if (!campagneId) {
    throw new Error('Aucune campagne en cours — impossible de démarrer une nouvelle fiche');
  }

  return createDraftProspection({
    id: generateId(),
    typeProspection: params.typeProspection ?? 'intensive',
    campagneId,
    prospecteurId: params.prospecteurId,
    dateProspection: new Date().toISOString().slice(0, 10),
  });
}
