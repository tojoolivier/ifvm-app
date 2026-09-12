/** Fixtures partagées entre les fichiers de test intensive-imagos-*.test.tsx — un
 * fichier par scénario (cf. leur en-tête pour le pourquoi de cette séparation). */

export const STADES_PAR_DEFAUT = (_espece: string, categorie: string, sexe: string | null) => {
  if (categorie === 'larve') return Promise.resolve(['L1', 'L2', 'L3'].map((code) => ({ code, libelle: code })));
  const codes = sexe === 'F' ? ['A1', 'A2', 'A3'] : ['A1', 'A234', 'A5'];
  return Promise.resolve(codes.map((code) => ({ code, libelle: code })));
};

export function draftLmcOnly() {
  return {
    id: 'draft-123',
    type_prospection: 'intensive',
    especes: JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: false, nseLarve: false }),
    grilles_completees: null,
    capture_started_at: '2026-08-25T08:00:00.000Z',
  } as any;
}

export function draftLmcAndNseImago() {
  return {
    id: 'draft-123',
    type_prospection: 'intensive',
    especes: JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: true, nseLarve: false }),
    grilles_completees: null,
    capture_started_at: '2026-08-25T08:00:00.000Z',
  } as any;
}

export function draftLmcImagoAndLarve() {
  return {
    id: 'draft-123',
    type_prospection: 'intensive',
    especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false }),
    grilles_completees: null,
    capture_started_at: '2026-08-25T08:00:00.000Z',
  } as any;
}
