import { apiClient, Campagne, ProspectionRead } from './api-client';
import { generateId } from './id';
import { STATUT_VALIDE } from './prospection-fiche-lecture';
import {
  createDraftProspection,
  countUnsyncedProspections,
  deleteProspection as deleteLocalProspection,
  listDraftProspections,
  listRecentProspections,
  DraftProspection,
  TypeProspection,
} from './prospection-repository';

export interface AccueilViewModel {
  unsyncedCount: number;
  activeDraft: DraftProspection | null;
  recent: DraftProspection[];
  validated: ProspectionRead[];
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
    validated: [],
  };
}

/**
 * Récupère les fiches au statut Validé du prospecteur courant depuis le serveur (#16) —
 * seul endroit où le statut final "Validé" existe, l'app locale ne connaît que jusqu'à
 * "en_attente". Échec silencieux hors-ligne (liste vide), cohérent avec l'offline-first.
 */
export async function loadValidatedProspections(
  token: string,
  prospecteurId: string
): Promise<ProspectionRead[]> {
  try {
    return await apiClient.listProspections(token, { 
      statut: STATUT_VALIDE, 
      prospecteur_id: prospecteurId 
    });
  } catch {
    return [];
  }
}

/** Supprime une fiche brouillon en local. Refuse toute fiche déjà complétée (elle n'existe alors que côté serveur, où le backend applique la même règle). */
export async function deleteDraftProspection(draft: DraftProspection): Promise<void> {
  if (draft.statut !== 'brouillon') {
    throw new Error('Seules les fiches en brouillon peuvent être supprimées.');
  }
  await deleteLocalProspection(draft.id);
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

  if (pool.length === 0) return null;

  return [...pool].sort((a, b) => b.start_date.localeCompare(a.start_date))[0].id;
}

/** Initialise une fiche brouillon vide en local et la lie à la campagne en cours. */
export async function startNewProspection(params: {
  token: string;
  prospecteurId: string;
  typeProspection?: TypeProspection;
  signalementSource?: string | null;
  signalementDate?: string | null;
  signalementDescription?: string | null;
}): Promise<DraftProspection> {
  console.log('[startNewProspection] ===== DEBUT =====');
  console.log('[startNewProspection] token:', params.token?.substring(0, 30) + '...');
  console.log('[startNewProspection] prospecteurId:', params.prospecteurId);
  console.log('[startNewProspection] typeProspection:', params.typeProspection);

  try {
    console.log('[startNewProspection] Appel à apiClient.getCampagnes()...');
    const campagnes = await apiClient.getCampagnes(params.token);
    console.log('[startNewProspection] Campagnes récupérées:', campagnes.length);
    console.log('[startNewProspection] Campagnes:', JSON.stringify(campagnes, null, 2));

    if (campagnes.length === 0) {
      console.error('[startNewProspection] ❌ Aucune campagne trouvée dans la base !');
      throw new Error('Aucune campagne disponible. Veuillez contacter l\'administrateur.');
    }

    const campagneId = pickCurrentCampagneId(campagnes);
    console.log('[startNewProspection] campagneId après pickCurrentCampagneId:', campagneId);

    // Si aucune campagne en cours, prendre la première disponible
    let selectedCampagneId = campagneId;
    if (!selectedCampagneId && campagnes.length > 0) {
      selectedCampagneId = campagnes[0].id;
      console.log('[startNewProspection] Aucune campagne en cours, utilisation de la première:', selectedCampagneId);
    }

    if (!selectedCampagneId) {
      console.error('[startNewProspection] ❌ Impossible de sélectionner une campagne');
      throw new Error('Aucune campagne disponible. Veuillez contacter l\'administrateur.');
    }

    console.log('[startNewProspection] ✅ Campagne sélectionnée:', selectedCampagneId);

    const draft = await createDraftProspection({
      id: generateId(),
      typeProspection: params.typeProspection ?? 'intensive',
      campagneId: selectedCampagneId,
      prospecteurId: params.prospecteurId,
      dateProspection: new Date().toISOString().slice(0, 10),
      region: null,
      district: null,
      commune: null,
      za: null,
      pa_code: null,
      signalementSource: params.signalementSource ?? null,
      signalementDate: params.signalementDate ?? null,
      signalementDescription: params.signalementDescription ?? null,
    });

    console.log('[startNewProspection] ✅ Brouillon créé:', draft.id);
    console.log('[startNewProspection] ===== FIN =====');
    return draft;

  } catch (error) {
    console.error('[startNewProspection] ❌ Erreur:', error);
    throw error;
  }
}