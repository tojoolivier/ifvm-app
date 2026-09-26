import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { fr } from '@/locales/fr';

/**
 * Configuration i18n unique de l'app (#721) : l'app est en français, on ne suit
 * pas la langue de l'appareil. Pour ajouter le malgache : `resources.mg` + `lng`.
 * `escapeValue: false` — React échappe déjà, sinon « l'équipe » deviendrait « l&#39;équipe ».
 */
void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  initAsync: false,
});

export default i18n;
