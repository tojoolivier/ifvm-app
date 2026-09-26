import { apiClient } from '../src/lib/api-client';
import {
  enregistrerBrouillon,
  getFiche,
  listerEnAttenteEnvoi,
  soumettreFiche,
} from '../src/lib/prospection-db';
import { synchroniserProspections } from '../src/lib/prospection-sync';
import { creerBaseMemoire } from './test-utils/base-sqlite-memoire';

let base: Awaited<ReturnType<typeof creerBaseMemoire>>;

jest.mock('../src/lib/db', () => ({ getDb: () => base }));
jest.mock('../src/lib/storage', () => ({
  storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() },
}));
jest.mock('../src/lib/api-client', () => ({
  apiClient: { createProspection: jest.fn() },
  statutHttpDe: (error: unknown) => (error as { status?: number } | null)?.status ?? null,
  versionServeurDe: () => null,
}));

async function ficheSoumise(surcharge: object = {}): Promise<string> {
  const id = await enregistrerBrouillon({
    type_prospection: 'extensive',
    campagne_id: 'camp-1',
    equipe_id: 'eq-1',
    n_fiche: 'F-1',
    date_prospection: '2026-09-01',
    biotope: [],
    type_station: [],
    avertissements: [],
    populations: [],
    captures: [],
    infestations: [],
    operations_aeriennes: [],
    ...surcharge,
  });
  await soumettreFiche(id);
  return id;
}

beforeEach(async () => {
  jest.resetAllMocks();
  base = await creerBaseMemoire();
});

describe('synchroniserProspections', () => {
  it('envoie le corps avec l’id client, revalide_de_id compris, et reporte la réponse du serveur', async () => {
    const id = await ficheSoumise({ revalide_de_id: 'origine-1' });
    jest.mocked(apiClient.createProspection).mockResolvedValue({
      id,
      statut: 'validee',
      validated_at: '2026-09-20T08:00:00Z',
    });

    const resume = await synchroniserProspections('jeton');

    expect(resume.reussies).toEqual([id]);
    expect(apiClient.createProspection).toHaveBeenCalledWith(
      'jeton',
      expect.objectContaining({ id, statut: 'en_attente', revalide_de_id: 'origine-1' })
    );
    expect(await getFiche(id)).toMatchObject({ statut_sync: 'synced', validated_at: '2026-09-20T08:00:00Z' });
    expect((await getFiche(id))?.fiche.statut).toBe('validee');
  });

  it('hors ligne : la fiche reste dans la file, puis le rejeu réutilise le même id (idempotent)', async () => {
    const id = await ficheSoumise();
    jest.mocked(apiClient.createProspection).mockRejectedValueOnce(Object.assign(new Error('réseau'), {}));

    const premier = await synchroniserProspections('jeton');
    expect(premier.reussies).toEqual([]);
    expect(await listerEnAttenteEnvoi()).toHaveLength(1);

    jest.mocked(apiClient.createProspection).mockResolvedValue({ id, statut: 'en_attente', validated_at: null });
    await synchroniserProspections('jeton');
    await synchroniserProspections('jeton');

    const ids = jest.mocked(apiClient.createProspection).mock.calls.map(([, corps]) => corps.id);
    expect(ids).toEqual([id, id]); // un 2e envoi n'a pas lieu : la fiche est sortie de la file
    expect(await listerEnAttenteEnvoi()).toHaveLength(0);
  });

  it('refus 4xx : la fiche sort de la file en échec', async () => {
    const id = await ficheSoumise();
    jest.mocked(apiClient.createProspection).mockRejectedValue(Object.assign(new Error('invalide'), { status: 422 }));

    const resume = await synchroniserProspections('jeton');

    expect(resume.echouees[0]).toMatchObject({ id, sort: 'echec' });
    expect((await getFiche(id))?.statut_sync).toBe('echec');
    expect(await listerEnAttenteEnvoi()).toHaveLength(0);
  });

  it('acquitte le vol de la prospection avec elle', async () => {
    await base.runAsync(
      `INSERT INTO vol (id, categorie, origine, equipe_id, aeronef_id, date_vol, heure_debut, heure_fin, statut_sync, cree_le)
       VALUES ('vol-1', 'prospection', 'prospection', 'eq-1', 'ae-1', '2026-09-01', '06:00', '07:00', 'local', 'x')`
    );
    const id = await ficheSoumise({ vol_id: 'vol-1' });
    jest.mocked(apiClient.createProspection).mockResolvedValue({ id, statut: 'en_attente', validated_at: null });

    await synchroniserProspections('jeton');

    expect(await base.getFirstAsync('SELECT statut_sync FROM vol WHERE id = ?', ['vol-1'])).toEqual({ statut_sync: 'synced' });
  });
});
