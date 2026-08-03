import { shouldTriggerAutoSync } from '../src/lib/referentiel-auto-sync';

describe('shouldTriggerAutoSync', () => {
  it('triggers when connectivity returns after being offline', () => {
    expect(shouldTriggerAutoSync({ wasConnected: false, isConnected: true })).toBe(true);
  });

  it('does not trigger when already connected (no transition)', () => {
    expect(shouldTriggerAutoSync({ wasConnected: true, isConnected: true })).toBe(false);
  });

  it('does not trigger when going offline', () => {
    expect(shouldTriggerAutoSync({ wasConnected: true, isConnected: false })).toBe(false);
  });

  it('does not trigger when remaining offline', () => {
    expect(shouldTriggerAutoSync({ wasConnected: false, isConnected: false })).toBe(false);
  });

  it('triggers on first known state if already connected (initial mount)', () => {
    expect(shouldTriggerAutoSync({ wasConnected: null, isConnected: true })).toBe(true);
  });

  it('does not trigger on first known state if offline (initial mount)', () => {
    expect(shouldTriggerAutoSync({ wasConnected: null, isConnected: false })).toBe(false);
  });
});
