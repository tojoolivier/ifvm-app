import { PreconditionError } from '../src/lib/errors';
import {
  type ProspectionRead,
  type SaisieProspection,
  appliquerRetourServeur,
  creerRevalidation,
  enregistrerBrouillon,
  enregistrerDepuisServeur,
  getFiche,
  listerARevalider,
  listerBrouillons,
  listerDisponiblesPourTraitement,
  listerEnAttenteEnvoi,
  marquerProspectionEnEchec,
  soumettreFiche,
  supprimerBrouillon,
} from '../src/lib/prospection-db';
import { creerBaseMemoire } from './test-utils/base-sqlite-memoire';

let base: Awaited<ReturnType<typeof creerBaseMemoire>>;

jest.mock('../src/lib/db', () => ({ getDb: () => base }));

const saisie = (surcharge: Partial<SaisieProspection> = {}): SaisieProspection => ({
  type_prospection: 'extensive',
  campagne_id: 'camp-1',
  equipe_id: 'eq-1',
  n_fiche: 'F-12',
  n_message: 'M-12',
  date_prospection: '2026-09-01',
  biotope: [],
  type_station: [],
  avertissements: [],
  populations: [{ espece: 'CMI', categorie: 'imago', type_cible: 'essaim' } as never],
  captures: [{ espece: 'CMI', categorie: 'imago', phase: 'solitaire', stade: 'imago', effectif: 3 } as never],
  infestations: [],
  operations_aeriennes: [],
  ...surcharge,
});

/** Amène une fiche à l'état « validée par le serveur » à la date donnée. */
async function fabriquerValidee(surcharge: Partial<SaisieProspection>, validatedAt: string): Promise<string> {
  const id = await enregistrerBrouillon(saisie(surcharge));
  await soumettreFiche(id);
  await appliquerRetourServeur(id, { statut: 'validee', validated_at: validatedAt });
  return id;
}

beforeEach(async () => {
  base = await creerBaseMemoire();
});

describe('brouillon', () => {
  it('se crée puis se relit à l’identique, listes comprises', async () => {
    const id = await enregistrerBrouillon(saisie());
    const relue = await getFiche(id);

    expect(relue?.fiche).toMatchObject({ id, statut: 'brouillon', n_fiche: 'F-12', revalide_de_id: null });
    expect(relue?.fiche.populations).toHaveLength(1);
    expect(relue?.fiche.captures[0]).toMatchObject({ espece: 'CMI', effectif: 3 });
    expect(relue?.statut_sync).toBe('local');
  });

  it('se reprend : même id, listes remplacées, date de création conservée', async () => {
    const id = await enregistrerBrouillon(saisie());
    const avant = await getFiche(id);

    await enregistrerBrouillon({ ...saisie({ observations: 'reprise', captures: [] }), id });
    const apres = await getFiche(id);

    expect(apres?.fiche.observations).toBe('reprise');
    expect(apres?.fiche.captures).toEqual([]);
    expect(apres?.created_at).toBe(avant?.created_at);
    expect(await listerBrouillons()).toHaveLength(1);
  });

  it('crée le brouillon sous l’identifiant fourni quand on le demande (id connu avant la 1re sauvegarde)', async () => {
    const id = await enregistrerBrouillon({ ...saisie({ n_fiche: 'FI-20260925-ABCDEF' }), id: 'id-choisi' }, { creation: true });

    expect(id).toBe('id-choisi');
    expect((await getFiche('id-choisi'))?.fiche).toMatchObject({ statut: 'brouillon', n_fiche: 'FI-20260925-ABCDEF' });
  });

  it('refuse de reprendre un identifiant inconnu', async () => {
    await expect(enregistrerBrouillon({ ...saisie(), id: 'inconnu' })).rejects.toBeInstanceOf(PreconditionError);
  });

  it('se supprime avec ses listes ; une fiche soumise ne se supprime ni ne se modifie plus', async () => {
    const brouillon = await enregistrerBrouillon(saisie());
    await supprimerBrouillon(brouillon);
    expect(await getFiche(brouillon)).toBeNull();
    expect(await base.getAllAsync('SELECT * FROM prospection_capture')).toHaveLength(0);

    const soumise = await enregistrerBrouillon(saisie());
    await soumettreFiche(soumise);
    await expect(supprimerBrouillon(soumise)).rejects.toBeInstanceOf(PreconditionError);
    await expect(enregistrerBrouillon({ ...saisie(), id: soumise })).rejects.toBeInstanceOf(PreconditionError);
  });
});

describe('file d’envoi', () => {
  it('ne contient que les fiches soumises non encore acceptées', async () => {
    await enregistrerBrouillon(saisie({ n_fiche: 'brouillon' }));
    const soumise = await enregistrerBrouillon(saisie({ n_fiche: 'soumise' }));
    await soumettreFiche(soumise);
    const partie = await enregistrerBrouillon(saisie({ n_fiche: 'partie' }));
    await soumettreFiche(partie);
    await appliquerRetourServeur(partie, { statut: 'en_attente', validated_at: null });
    const refusee = await enregistrerBrouillon(saisie({ n_fiche: 'refusee' }));
    await soumettreFiche(refusee);
    await marquerProspectionEnEchec(refusee);

    const file = await listerEnAttenteEnvoi();

    expect(file.map((f) => f.fiche.n_fiche)).toEqual(['soumise']);
    expect(file[0].fiche.statut).toBe('en_attente');
  });

  it('reporte statut et validated_at renvoyés par le serveur', async () => {
    const id = await fabriquerValidee({}, '2026-09-10T08:00:00Z');
    const fiche = await getFiche(id);

    expect(fiche).toMatchObject({ statut_sync: 'synced', validated_at: '2026-09-10T08:00:00Z' });
    expect(fiche?.fiche.statut).toBe('validee');
    expect(await listerEnAttenteEnvoi()).toHaveLength(0);
  });

  it('« disponible pour traitement » hors ligne = statut validee uniquement', async () => {
    await enregistrerBrouillon(saisie());
    const validee = await fabriquerValidee({ n_fiche: 'V' }, '2026-09-10T08:00:00Z');

    expect((await listerDisponiblesPourTraitement()).map((f) => f.id)).toEqual([validee]);
  });
});

describe('revalidation', () => {
  const maintenant = new Date('2026-09-20T12:00:00Z');

  it('liste les fiches validées depuis plus de 5 jours, jamais l’intensive ni les récentes', async () => {
    const perimee = await fabriquerValidee({ n_fiche: 'P' }, '2026-09-10T08:00:00Z');
    await fabriquerValidee({ n_fiche: 'recente' }, '2026-09-18T08:00:00Z');
    await fabriquerValidee({ n_fiche: 'intensive', type_prospection: 'intensive' }, '2026-09-01T08:00:00Z');

    expect((await listerARevalider(maintenant)).map((f) => f.id)).toEqual([perimee]);
  });

  it('exclut une fiche déjà traitée', async () => {
    const id = await fabriquerValidee({}, '2026-09-10T08:00:00Z');
    await base.runAsync(
      `INSERT INTO traitement (id, prospection_id, type_traitement, statut, created_at, updated_at) VALUES ('t1', ?, 'terrestre', 'brouillon', 'x', 'x')`,
      [id]
    );

    expect(await listerARevalider(maintenant)).toHaveLength(0);
  });

  it('clone l’origine en brouillon « -bis », date du jour, sans validated_at ni vol', async () => {
    const origine = await fabriquerValidee({ vol_id: 'vol-9' }, '2026-09-10T08:00:00Z');

    const revalidation = await creerRevalidation(origine, maintenant);
    const fiche = await getFiche(revalidation);

    expect(revalidation).not.toBe(origine);
    expect(fiche?.fiche).toMatchObject({
      statut: 'brouillon',
      revalide_de_id: origine,
      n_fiche: 'F-12-bis',
      n_message: 'M-12-bis',
      date_prospection: '2026-09-20',
      vol_id: null,
    });
    expect(fiche?.validated_at).toBeNull();
    expect(fiche?.fiche.populations).toHaveLength(1);
    expect(fiche?.fiche.captures).toHaveLength(1);
  });

  it('reprend le brouillon jumeau au lieu d’échouer sur l’unicité', async () => {
    const origine = await fabriquerValidee({}, '2026-09-10T08:00:00Z');
    const premiere = await creerRevalidation(origine, maintenant);

    expect(await creerRevalidation(origine, maintenant)).toBe(premiere);
  });

  it('un brouillon de revalidation ne retire pas l’origine de la liste ; une revalidation confirmée, si', async () => {
    const origine = await fabriquerValidee({}, '2026-09-10T08:00:00Z');
    const revalidation = await creerRevalidation(origine, maintenant);
    expect((await listerARevalider(maintenant)).map((f) => f.id)).toEqual([origine]);

    await soumettreFiche(revalidation);
    expect(await listerARevalider(maintenant)).toHaveLength(0);
    await expect(creerRevalidation(origine, maintenant)).rejects.toBeInstanceOf(PreconditionError);
  });

  it('refuse de cloner une fiche absente de l’appareil', async () => {
    await expect(creerRevalidation('absente', maintenant)).rejects.toBeInstanceOf(PreconditionError);
  });
});

describe('fiche lue en ligne', () => {
  const lue = {
    id: 'srv-1',
    type_prospection: 'extensive',
    campagne_id: 'camp-1',
    equipe_id: 'eq-1',
    prospecteur_id: 'u-2',
    date_prospection: '2026-09-01',
    n_fiche: 'F-1',
    statut: 'validee',
    statut_sync: 'synced',
    validated_at: '2026-09-02T08:00:00Z',
    created_at: 'x',
    updated_at: 'x',
    biotope: [],
    type_station: [],
    avertissements: [],
    populations: [{ id: 'p1', espece: 'CMI', categorie: 'imago' }],
    captures: [],
    infestations: [],
    operations_aeriennes: [{ id: 'o1', numero: 1, duree_minutes: 30, type_operation: 'vol', debut_heure: '06:00', fin_heure: '06:30' }],
  } as unknown as ProspectionRead;

  it('se matérialise localement sans champs de lecture, et se clone sans les renvoyer', async () => {
    expect(await enregistrerDepuisServeur(lue)).toBe(true);

    const fiche = await getFiche('srv-1');
    expect(fiche).toMatchObject({ statut_sync: 'synced', validated_at: '2026-09-02T08:00:00Z' });
    expect(fiche?.fiche.populations[0]).not.toHaveProperty('id');
    expect(fiche?.fiche.operations_aeriennes[0]).not.toHaveProperty('numero');
    expect(fiche?.fiche).not.toHaveProperty('prospecteur_id');

    const clone = await creerRevalidation('srv-1', new Date('2026-09-20T00:00:00Z'));
    expect((await getFiche(clone))?.fiche.revalide_de_id).toBe('srv-1');
  });

  it('n’écrase jamais une fiche déjà locale', async () => {
    await enregistrerDepuisServeur(lue);
    await base.runAsync("UPDATE prospection SET corps = json_set(corps, '$.observations', 'locale') WHERE id = 'srv-1'");

    expect(await enregistrerDepuisServeur(lue)).toBe(false);
    expect((await getFiche('srv-1'))?.fiche.observations).toBe('locale');
  });
});
