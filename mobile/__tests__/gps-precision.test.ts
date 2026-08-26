import {
  PRECISION_GPS_CIBLE_M,
  PRECISION_GPS_SEUIL_ALERTE_M,
} from '../src/lib/gps-precision';

describe('seuils de précision GPS', () => {
  it('vise une précision atteignable en extérieur dégagé par un fix GNSS', () => {
    expect(PRECISION_GPS_CIBLE_M).toBe(15);
  });

  it('alerte au-delà de 100 m sans jamais empêcher l\'enregistrement', () => {
    expect(PRECISION_GPS_SEUIL_ALERTE_M).toBe(100);
  });

  it('garde la cible strictement sous le seuil d\'alerte', () => {
    expect(PRECISION_GPS_CIBLE_M).toBeLessThan(PRECISION_GPS_SEUIL_ALERTE_M);
  });
});
