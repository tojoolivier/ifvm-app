import { champsDeReference, dateLocale, formaterDateHeure, repartitionSurfaces, stationLibreDepuisZone } from '@/lib/prospection-reference';

describe('stationLibreDepuisZone', () => {
  it('prend la commune, sinon le district, sinon la région', () => {
    expect(stationLibreDepuisZone({ region: 'Toliara', district: 'Beloha', commune: 'Beloha' })).toBe('Beloha');
    expect(stationLibreDepuisZone({ region: 'Toliara', district: 'Beloha', commune: '' })).toBe('Beloha');
    expect(stationLibreDepuisZone({ region: 'Toliara', district: '', commune: '' })).toBe('Toliara');
    expect(stationLibreDepuisZone(null)).toBe('');
  });
});

const commun = {
  type: 'intensive' as const,
  surface_station: '12',
  surface_prospectee: '8,5',
  surface_infestee: '',
  station_libre: '',
  biotope: ['mesophyle' as const],
};

describe('champsDeReference', () => {
  it('intensive : surfaces en nombres, Infestée vide = 0, biotope dans `biotope`', () => {
    expect(champsDeReference(commun)).toEqual({
      surface_station: 12,
      surface_prospectee: 8.5,
      surface_infestee: 0,
      biotope: ['mesophyle'],
      type_station: [],
      station_libre: null,
    });
  });

  it('extensive : Prospectée est enregistrée dans surface_station, biotope dans `type_station`', () => {
    const res = champsDeReference({
      ...commun,
      type: 'extensive',
      surface_station: '',
      surface_prospectee: '20',
      surface_infestee: '5',
      station_libre: ' Beloha ',
      biotope: ['xerophyle', 'mesophyle'],
    });
    expect(res).toEqual({
      surface_station: 20,
      surface_prospectee: null,
      surface_infestee: 5,
      biotope: [],
      type_station: ['xerophyle', 'mesophyle'],
      station_libre: 'Beloha',
    });
  });
});

describe('dateLocale', () => {
  it('formate en YYYY-MM-DD à l’heure locale, mois et jour sur 2 chiffres', () => {
    expect(dateLocale(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05');
    expect(dateLocale(new Date(2026, 11, 25, 0, 5))).toBe('2026-12-25');
  });
});

describe('repartitionSurfaces', () => {
  it('intensive : parts de Prospectée et d’Infestée rapportées à la Station', () => {
    expect(repartitionSurfaces({ total: 12, prospectee: 8, infestee: 3 })).toEqual({ prospecteePct: 67, infesteePct: 25 });
  });

  it('borne à 0–100 % et ne divise pas par zéro (saisie incohérente ou vide)', () => {
    expect(repartitionSurfaces({ total: 10, prospectee: 20, infestee: 30 })).toEqual({ prospecteePct: 100, infesteePct: 100 });
    expect(repartitionSurfaces({ total: 0, prospectee: 0, infestee: 0 })).toEqual({ prospecteePct: 0, infesteePct: 0 });
    expect(repartitionSurfaces({ total: null, prospectee: 5, infestee: null })).toEqual({ prospecteePct: 0, infesteePct: 0 });
  });
});

describe('formaterDateHeure', () => {
  it('affiche « jj/mm/aaaa · hh:mm » à l’heure locale', () => {
    expect(formaterDateHeure(new Date(2026, 8, 25, 12, 8))).toBe('25/09/2026 · 12:08');
    expect(formaterDateHeure(new Date(2026, 0, 5, 7, 3))).toBe('05/01/2026 · 07:03');
  });
});
