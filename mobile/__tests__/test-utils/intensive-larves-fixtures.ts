/** Fixtures partagées entre les fichiers de test intensive-larves-*.test.tsx — un
 * fichier par scénario (cf. leur en-tête pour le pourquoi de cette séparation). */

export const STADES_PAR_DEFAUT = (_espece: string, categorie: string) => {
  if (categorie === 'larve') return Promise.resolve(['L1', 'L2', 'L3'].map((code) => ({ code, libelle: code })));
  return Promise.resolve([]);
};

export function draftLmcLarveOnly() {
  return {
    id: 'draft-123',
    type_prospection: 'intensive',
    especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
    grilles_completees: null,
    capture_started_at: '2026-08-25T08:00:00.000Z',
  } as any;
}

export function draftLmcAndNseLarve() {
  return {
    id: 'draft-123',
    type_prospection: 'intensive',
    especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: true }),
    grilles_completees: null,
    capture_started_at: '2026-08-25T08:00:00.000Z',
  } as any;
}
