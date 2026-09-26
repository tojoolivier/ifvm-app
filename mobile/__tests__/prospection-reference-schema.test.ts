import { erreursDuSchema } from '@/lib/form-errors';
import { creerReferenceSchema, parserHa } from '@/lib/prospection-reference-schema';

const schema = creerReferenceSchema('intensive', (cle) => cle);
const schemaExtensif = creerReferenceSchema('extensive', (cle) => cle);
const valide = { surface_station: '12', surface_prospectee: '8', surface_infestee: '0', biotope: ['mesophyle'] };

describe('parserHa', () => {
  it('accepte la virgule française et rejette le non numérique', () => {
    expect(parserHa('8,5')).toBe(8.5);
    expect(parserHa('12')).toBe(12);
    expect(parserHa('')).toBeNull();
    expect(parserHa('abc')).toBeNull();
  });
});

describe('creerReferenceSchema', () => {
  it('accepte la saisie de la maquette (12 ⊇ 8 ⊇ 0, Mésophyle)', () => {
    expect(erreursDuSchema(schema, valide)).toEqual({});
  });

  it('exige Station, Prospectée et Biotope, mais pas Infestée', () => {
    const erreurs = erreursDuSchema(schema, { surface_station: '', surface_prospectee: '', surface_infestee: '', biotope: [] });
    expect(Object.keys(erreurs).sort()).toEqual(['biotope', 'surface_prospectee', 'surface_station']);
  });

  it('refuse Prospectée > Station sur le champ Prospectée', () => {
    const erreurs = erreursDuSchema(schema, { ...valide, surface_prospectee: '13' });
    expect(erreurs).toEqual({ surface_prospectee: 'prospection.reference.erreurs.prospecteeSuperieure' });
  });

  it('refuse Infestée > Prospectée sur le champ Infestée', () => {
    const erreurs = erreursDuSchema(schema, { ...valide, surface_infestee: '9' });
    expect(erreurs).toEqual({ surface_infestee: 'prospection.reference.erreurs.infesteeSuperieure' });
  });

  it('accepte les égalités (Infestée = Prospectée = Station)', () => {
    expect(erreursDuSchema(schema, { ...valide, surface_prospectee: '12', surface_infestee: '12' })).toEqual({});
  });
});

describe('biotope multiple', () => {
  it('accepte plusieurs biotopes, en refuse zéro ou un inconnu', () => {
    expect(erreursDuSchema(schema, { ...valide, biotope: ['xerophyle', 'mesophyle'] })).toEqual({});
    expect(Object.keys(erreursDuSchema(schema, { ...valide, biotope: [] }))).toEqual(['biotope']);
    expect(Object.keys(erreursDuSchema(schema, { ...valide, biotope: ['savane'] }))).toEqual(['biotope']);
  });
});

describe('variante extensive', () => {
  const ext = { station_libre: 'Beloha', surface_prospectee: '20', surface_infestee: '5', biotope: ['xerophyle'] };

  it('accepte la saisie de la maquette 01b sans surface Station', () => {
    expect(erreursDuSchema(schemaExtensif, ext)).toEqual({});
  });

  it('exige la station libre', () => {
    expect(erreursDuSchema(schemaExtensif, { ...ext, station_libre: '  ' })).toEqual({
      station_libre: 'prospection.reference.erreurs.stationLibreRequise',
    });
  });

  it('refuse Infestée > Prospectée', () => {
    expect(erreursDuSchema(schemaExtensif, { ...ext, surface_infestee: '21' })).toEqual({
      surface_infestee: 'prospection.reference.erreurs.infesteeSuperieure',
    });
  });
});
