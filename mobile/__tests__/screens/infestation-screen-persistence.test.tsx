/**
 * Non-régression #201 : une cible aérienne (vol clair / dense / très dense) n'a pas de champ
 * « densité moyenne » — sa saisie passe par le questionnaire de classification et
 * l'heure d'observation. Elle était donc jugée « vide » et jamais enregistrée : à la
 * réouverture de la fiche, la partie comportement/infestation n'affichait plus rien.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InfestationScreen from '@/app/(prospection)/infestation';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  saveProspectionInfestation: jest.fn().mockResolvedValue(undefined),
  getProspection: jest.fn().mockResolvedValue(null),
  // Ajouté par le parcours « stade dominant auto » : l'écran lit désormais les
  // captures déjà saisies au montage.
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
  getDerniereDensiteMemeSite: jest.fn().mockResolvedValue(null),
  updateProspectionAvertissements: jest.fn().mockResolvedValue(undefined),
}));

/** Laisse React appliquer les `setState` déclenchés par le geste précédent. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('InfestationScreen — persistance des cibles sélectionnées', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.saveProspectionInfestation).mockClear();
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValue([]);
  });

  it('enregistre un vol clair renseigné sans densité moyenne (#201)', async () => {
    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Vol clair'));
    await settle();
    fireEvent.press(screen.getByText('Comportement  ›'));
    await settle();

    // « Déplacement » (et non « Repos ») : la règle #4 n'affiche la boussole du
    // déplacement qu'en déplacement, or la direction reste obligatoire pour une
    // cible aérienne (validateComportementDirection).
    fireEvent.press(screen.getByText('Déplacement'));
    await settle();
    // Direction obligatoire pour une cible aérienne : la boussole renseigne de/vers.
    fireEvent.press(screen.getAllByText('NE')[0]);
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionInfestation).toHaveBeenCalledWith(
        'draft-123',
        'vol_clair',
        expect.objectContaining({
          type_cible: 'vol_clair',
          comportement: 'deplacement',
          densite_moy: null,
        })
      )
    );
  });

  it('restaure la cible aérienne enregistrée à la réouverture de la fiche (#201)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValue([
      // « essaim » a été reclassé en Dense / Très dense par la migration 0031.
      { type_cible: 'dense', comportement: 'deplacement', heure_observation: '09:30' } as any,
    ]);

    await render(<InfestationScreen />);

    fireEvent.press(await screen.findByText('Comportement  ›'));
    await settle();

    expect(await screen.findByText('09:30')).toBeVisible();
    expect(screen.getByText(/Comportement · Dense/)).toBeVisible();
  });
});
