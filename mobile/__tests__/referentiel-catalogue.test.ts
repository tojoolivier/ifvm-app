import { REFERENTIEL_TABLES } from '../src/lib/referentiel-schema.generated';
import { CONFIGS_GENERIQUES } from '../src/lib/referentiel-generique';
import { routeFiche } from '../src/lib/referentiel-catalogue';
import { CATALOGUE, entreesCatalogue, filtrerCatalogue, libelleCourtEntite } from '../src/lib/referentiel-catalogue';

// Le catalogue ne touche pas la base : `referentiel-generique` l'importe seulement pour ses configurations.
jest.mock('../src/lib/referentiel-db', () => ({ getReferentielDb: jest.fn() }));

describe('catalogue des référentiels', () => {
  it('couvre chacune des 13 tables du cache, une seule fois', () => {
    const tables = entreesCatalogue().map((e) => e.table).sort();
    expect(tables).toEqual([...REFERENTIEL_TABLES].sort());
  });

  it('suit les cinq sections de la maquette, dans l’ordre', () => {
    expect(CATALOGUE.map((s) => s.titre)).toEqual(['TERRAIN', 'PRODUITS', 'STADES & CAMPAGNES', 'AÉRIEN', 'ÉQUIPES']);
  });

  it('chaque table s’ouvre : trois écrans dessinés, dix génériques', () => {
    const dediees = ['/(app)/referentiel-stations', '/(app)/referentiel-pesticides', '/(app)/referentiel-codes-stades'];
    const entrees = entreesCatalogue();
    expect(entrees.filter((e) => dediees.includes(e.route)).map((e) => e.table).sort()).toEqual([
      'code_stade',
      'pesticide',
      'station_fixe',
    ]);
    for (const e of entrees.filter((x) => !dediees.includes(x.route))) {
      expect(e.route).toBe(`/(app)/referentiel-liste?table=${e.table}`);
    }
  });

  it('les tables génériques du catalogue sont exactement celles que sait lire referentiel-generique', () => {
    const generiques = entreesCatalogue().filter((e) => e.route.startsWith('/(app)/referentiel-liste')).map((e) => e.table);
    expect(generiques.sort()).toEqual(Object.keys(CONFIGS_GENERIQUES).sort());
  });

  it('la recherche filtre les lignes sans tenir compte des accents ni de la casse', () => {
    const sections = filtrerCatalogue('aeron');
    expect(sections.flatMap((s) => s.entrees.map((e) => e.libelle)).sort()).toEqual(['Affectations aéronef', 'Aéronefs']);
  });

  it('une section sans résultat disparaît', () => {
    expect(filtrerCatalogue('pesticide').map((s) => s.titre)).toEqual(['PRODUITS']);
    expect(filtrerCatalogue('zzz')).toEqual([]);
  });

  it('sans recherche, tout est rendu', () => {
    expect(filtrerCatalogue('  ')).toBe(CATALOGUE);
  });

  it('donne le nom court d’une entité pour la liste des tables restantes', () => {
    expect(libelleCourtEntite('equipe_membres')).toBe('membres');
    expect(libelleCourtEntite('utilisateurs_equipe')).toBe('utilisateurs');
  });

  it('la fiche d’une entrée s’ouvre sur son écran dédié, sinon sur la fiche générique', () => {
    expect(routeFiche('pesticide', 'p1')).toEqual({ pathname: '/(app)/referentiel-pesticide', params: { id: 'p1' } });
    expect(routeFiche('station_fixe', 's1')).toEqual({ pathname: '/(app)/referentiel-station', params: { id: 's1' } });
    expect(routeFiche('code_stade', 'c1')).toEqual({ pathname: '/(app)/referentiel-code-stade', params: { id: 'c1' } });
    expect(routeFiche('culture', 'x')).toEqual({ pathname: '/(app)/referentiel-fiche', params: { table: 'culture', cle: 'x' } });
  });
});
