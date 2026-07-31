import { GpsPosition } from './location';
import { updateProspectionReference, DraftProspection } from './prospection-repository';

export interface SurfaceInputs {
  surfStation: number | null;
  surfProspectee: number | null;
  surfInfestee: number | null;
}

export interface ReferenceInputs {
  region: string | null;
  district: string | null;
  commune: string | null;
  za: string | null;
  pa_code: string | null;
}

/** Valide la contrainte métier `infestée <= prospectée <= station` (ADR-006). */
export function validateSurfaces({ surfStation, surfProspectee, surfInfestee }: SurfaceInputs): boolean {
  if (surfStation == null || surfProspectee == null || surfInfestee == null) return false;
  if (surfStation < 0 || surfProspectee < 0 || surfInfestee < 0) return false;
  return surfInfestee <= surfProspectee && surfProspectee <= surfStation;
}

/** Numéro de fiche déterministe (même valeur à chaque reprise du brouillon). */
export function generateNumeroFiche(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 6).toUpperCase();
  return `FI-${datePart}-${idPart}`;
}

/** Persiste la position GPS et les surfaces saisies sur la fiche brouillon locale. */
export async function saveReference(params: {
  draftId: string;
  position: GpsPosition;
  surfaces: SurfaceInputs;
  numeroFiche: string;
  references: ReferenceInputs;
}): Promise<DraftProspection> {
  const { surfStation, surfProspectee, surfInfestee } = params.surfaces;
  if (!validateSurfaces(params.surfaces) || surfStation == null || surfProspectee == null || surfInfestee == null) {
    throw new Error('Surfaces invalides : infestée <= prospectée <= station');
  }

  return updateProspectionReference(params.draftId, {
    latitude: params.position.latitude,
    longitude: params.position.longitude,
    altitude: params.position.altitude,
    surfStation,
    surfProspectee,
    surfInfestee,
    nFiche: params.numeroFiche,
    region: params.references.region,
    district: params.references.district,
    commune: params.references.commune,
    za: params.references.za,
    pa_code: params.references.pa_code,
  });
}
