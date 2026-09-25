import { REFERENTIEL_TABLES } from '../src/lib/referentiel-schema.generated';
import { CATALOGUE, entreesCatalogue, filtrerCatalogue, libelleCourtEntite } from '../src/lib/referentiel-catalogue';

describe('catalogue des référentiels', () => {
  it('couvre chacune des 13 tables du cache, une seule fois', () => {
    const tables = entreesCatalogue().map((e) => e.table).sort();
    expect(tables).toEqual([...REFERENTIEL_TABLES].sort());
  });

  it('suit les cinq sections de la maquette, dans l’ordre', () => {
    expect(CATALOGUE.map((s) => s.titre)).toEqual(['TERRAIN', 'PRODUITS', 'STADES & CAMPAGNES', 'AÉRIEN', 'ÉQUIPES']);
  });

  it('seules les listes dessinées (pesticides, stations, codes stades) s’ouvrent', () => {
    const ouvrables = entreesCatalogue().filter((e) => e.route).map((e) => e.table).sort();
    expect(ouvrables).toEqual(['code_stade', 'pesticide', 'station_fixe']);
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
});
