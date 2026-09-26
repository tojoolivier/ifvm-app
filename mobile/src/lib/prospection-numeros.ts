import type { TypeWizard } from '@/lib/prospection-wizard';

/** N° de fiche : `FI-` (intensive) ou `FE-` (extensive, validation) + date sans tirets + 6 premiers caractères de l'id. */
export function generateNumeroFiche(
  draftId: string,
  dateProspection: string,
  type: TypeWizard = 'intensive'
): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 6).toUpperCase();
  const prefixe = type === 'extensive' || type === 'validation' ? 'FE' : 'FI';
  return `${prefixe}-${datePart}-${idPart}`;
}

/**
 * N° message (extensif) : date sans tirets + 4 premiers caractères de l'id + `-TERR`.
 * Le mode aérien (`-AER`) est porté par la sortie aérienne (#682), pas par cet écran.
 */
export function generateNumeroMessage(draftId: string, dateProspection: string): string {
  const datePart = dateProspection.replace(/-/g, '');
  const idPart = draftId.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `${datePart}-${idPart}-TERR`;
}
