/**
 * Non-régression : cet écran ne lisait jamais `draft` au montage (pluie, dégâts,
 * ennemis naturels, observation libre repartaient tous de zéro à chaque remontage).
 * Un simple retour en arrière puis "Vérifier & enregistrer" écrasait alors les
 * données déjà enregistrées par des valeurs vides — cf. la demande "PERTE ou OUBLI
 * de données après modification, navigation, vérification ou nouvel enregistrement".
 *
 * Même exigence côté #201 : en réouvrant une fiche intensive déjà enregistrée
 * (brouillon en attente de synchro ou déjà synchronisée), les observations
 * précédemment saisies ne doivent pas disparaître.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ObservationsScreen from '@/app/(prospection)/observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionObservations: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn().mockResolvedValue(null),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

describe('ObservationsScreen — restauration des données déjà enregistrées', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionObservations).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        degats_cultures: 'moyens',
        ennemis_naturels: 'Oiseaux, Fourmis, Belettes',
        derniere_pluie: '2026-08-20',
        intensite_pluie: 'moyenne',
        observations: 'RAS, végétation sèche.',
      } as any,
      captures: [],
    });
  });

  it('affiche les dégâts, ennemis (dont "Autre") et l’observation déjà enregistrés dès le montage', async () => {
    await render(<ObservationsScreen />);

    await waitFor(() => expect(screen.getByText('Moyens').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    ));
    expect(screen.getByText('Oiseaux').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
    // "Belettes" n'est pas un preset ENNEMIS_OPTIONS : atterrit dans le champ "Autre",
    // qui doit s'afficher automatiquement (showAutre) sans action de l'utilisateur.
    expect(screen.getByDisplayValue('Belettes')).toBeVisible();
    expect(screen.getByDisplayValue('RAS, végétation sèche.')).toBeVisible();
  });

  it('ne remplace pas les données déjà enregistrées par du vide en ré-enregistrant sans y toucher', async () => {
    await render(<ObservationsScreen />);
    await waitFor(() => expect(screen.getByDisplayValue('RAS, végétation sèche.')).toBeVisible());

    fireEvent.press(screen.getByText('Vérifier & enregistrer ✓'));

    await waitFor(() => expect(prospectionRepository.updateProspectionObservations).toHaveBeenCalled());
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionObservations).mock.calls[0];

    expect(payload).toMatchObject({
      degatsCultures: 'moyens',
      observations: 'RAS, végétation sèche.',
      dernierePluie: '2026-08-20',
      intensitePluie: 'moyenne',
    });
    expect(payload.ennemisNaturels).toContain('Oiseaux');
    expect(payload.ennemisNaturels).toContain('Fourmis');
    expect(payload.ennemisNaturels).toContain('Belettes');
  });

  it('recharge et réenregistre les observations déjà enregistrées lors de la réouverture d’une fiche (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        derniere_pluie: '2026-08-10',
        intensite_pluie: 'forte',
        degats_cultures: 'moyens',
        ennemis_naturels: 'Oiseaux, chacals errants',
        observations: 'Vol observé au lever du jour.',
      } as any,
      captures: [],
    });

    await render(<ObservationsScreen />);

    expect(await screen.findByDisplayValue('Vol observé au lever du jour.')).toBeVisible();
    // « Autre » ennemi non listé dans les presets : le champ libre doit s'afficher pré-rempli.
    expect(await screen.findByDisplayValue('chacals errants')).toBeVisible();

    fireEvent.press(screen.getByText('Vérifier & enregistrer ✓'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          degatsCultures: 'moyens',
          ennemisNaturels: 'Oiseaux, chacals errants',
          observations: 'Vol observé au lever du jour.',
          dernierePluie: '2026-08-10',
          intensitePluie: 'forte',
        })
      )
    );
  });
});
