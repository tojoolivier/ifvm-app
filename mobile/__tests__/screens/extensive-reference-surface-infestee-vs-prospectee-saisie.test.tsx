/**
 * #surface-infestee-inferieure-prospectee : sur la fiche Extensive ET la
 * Vérification de signalement (même écran), la « Surface infestée » doit être
 * inférieure ou égale à la « Surface prospectée » SAISIE sur cet écran — champ
 * stocké dans `surface_station` (colonne historique), distinct de la
 * `surface_prospectee` héritée d'une revalidation déjà contrôlée ailleurs
 * (cf. extensive-reference-surface-infestee-superieure-prospectee.test.tsx).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({
    id: 'draft-123',
    type_prospection: 'extensive',
    date_prospection: '2026-08-25',
  }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

const MESSAGE = /surface infestée \(8 ha\) doit être inférieure ou égale à la surface prospectée \(5 ha\)/;

/** Un vrai tick entre deux gestes consécutifs : sans lui, le second s'exécute sur une
 * fermeture React pas encore réconciliée et corrompt les tests suivants (même
 * leçon que extensive-reference-screen-restore.test.tsx). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

async function ouvrir(typeProspection: 'extensive' | 'validation') {
  useProspectionWizardStore.setState({
    draft: { id: 'draft-123', type_prospection: typeProspection, date_prospection: '2026-08-25' } as any,
    captures: [],
  });
  await render(<ExtensiveReferenceScreen />);
  await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());
}

async function saisir(prospectee: string, infestee: string) {
  if (prospectee) {
    fireEvent.changeText(screen.getByTestId('extensive-surface-prospectee-input'), prospectee);
    await settle();
  }
  if (infestee) {
    fireEvent.changeText(screen.getByTestId('extensive-surface-infestee-input'), infestee);
    await settle();
  }
  fireEvent.press(screen.getByText('Xerophyle'));
  await screen.findByText('Xerophyle ✓');
  await settle();
}

beforeEach(() => {
  jest.mocked(prospectionRepository.updateProspectionExtensiveReference).mockClear();
});

afterEach(() => {
  cleanup();
});

describe.each(['extensive', 'validation'] as const)(
  'ExtensiveReferenceScreen (%s) — surface infestée <= surface prospectée saisie',
  (typeProspection) => {
    it('avertit en direct et bloque « Suivant » quand l’infestée dépasse la prospectée', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await ouvrir(typeProspection);
      await saisir('5', '8');

      expect(await screen.findByText(MESSAGE)).toBeVisible();
      fireEvent.press(screen.getByText('Suivant : Imagos ›'));

      await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Surface infestée invalide', expect.stringMatching(MESSAGE)));
      expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
    });

    it('laisse passer quand l’infestée est égale à la prospectée', async () => {
      // Le spy est partagé entre les tests du fichier : sans remise à zéro, l'appel du
      // premier test (blocage) serait encore compté ici.
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      alertSpy.mockClear();
      await ouvrir(typeProspection);
      await saisir('5', '5');

      expect(screen.queryByText(/doit être inférieure ou égale/)).toBeNull();
      fireEvent.press(screen.getByText('Suivant : Imagos ›'));

      await waitFor(() =>
        expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
          'draft-123',
          expect.objectContaining({ surfaceStation: 5, surfaceInfestee: 5 })
        )
      );
      expect(alertSpy).not.toHaveBeenCalledWith('Surface infestée invalide', expect.any(String));
    });

    it('n’empêche rien tant que la surface prospectée n’est pas saisie (rien à comparer)', async () => {
      await ouvrir(typeProspection);
      await saisir('', '8');

      expect(screen.queryByText(/doit être inférieure ou égale/)).toBeNull();
      fireEvent.press(screen.getByText('Suivant : Imagos ›'));

      await waitFor(() => expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalled());
    });

    it('débloque « Suivant » dès que la valeur est corrigée', async () => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
      await ouvrir(typeProspection);
      await saisir('5', '8');
      await screen.findByText(MESSAGE);

      fireEvent.changeText(screen.getByTestId('extensive-surface-infestee-input'), '4');
      await settle();
      await waitFor(() => expect(screen.queryByText(/doit être inférieure ou égale/)).toBeNull());
      fireEvent.press(screen.getByText('Suivant : Imagos ›'));

      await waitFor(() =>
        expect(prospectionRepository.updateProspectionExtensiveReference).toHaveBeenCalledWith(
          'draft-123',
          expect.objectContaining({ surfaceInfestee: 4 })
        )
      );
    });
  }
);
