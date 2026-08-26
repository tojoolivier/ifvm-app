import {
  PRECISION_GPS_CIBLE_M,
  PRECISION_GPS_SEUIL_BLOQUANT_M,
} from '../src/lib/gps-precision';

describe('seuils de précision GPS', () => {
  it('vise une précision atteignable en extérieur dégagé par un fix GNSS', () => {
    expect(PRECISION_GPS_CIBLE_M).toBe(15);
  });

  it('bloque au-delà de la taille d\'une tache larvaire', () => {
    expect(PRECISION_GPS_SEUIL_BLOQUANT_M).toBe(50);
  });

  it('garde la cible strictement sous le seuil bloquant', () => {
    expect(PRECISION_GPS_CIBLE_M).toBeLessThan(PRECISION_GPS_SEUIL_BLOQUANT_M);
  });
});
