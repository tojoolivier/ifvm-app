/** i18n (#721) : textes du socle UI issus de `locales/fr.ts`, sans échappement HTML. */
import i18n from '@/lib/i18n';
import { fr } from '@/locales/fr';

describe('i18n', () => {
  it('est en français par défaut', () => {
    expect(i18n.language).toBe('fr');
    expect(i18n.t('ui.retour')).toBe(fr.ui.retour);
  });

  it('interpole sans échapper les apostrophes', () => {
    expect(i18n.t('ui.stepper.augmenter', { label: "Taux d'infestation" })).toBe("Augmenter Taux d'infestation");
  });
});
