/**
 * Non-régression #201 : une cible aérienne (vol clair / dense / très dense) n'a pas de champ
 * « densité moyenne » — sa saisie passe par le questionnaire de classification et
 * l'heure d'observation. Elle était donc jugée « vide » et jamais enregistrée : à la
 * réouverture de la fiche, la partie comportement/infestation n'affichait plus rien.
 */
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import InfestationScreen from '@/app/(prospection)/infestation';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  listAllProspectionInfestations: jest.fn().mockResolvedValue([]),
  saveProspectionInfestation: jest.fn().mockResolvedValue(undefined),
  deleteProspectionInfestation: jest.fn().mockResolvedValue(undefined),
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
    jest.mocked(prospectionRepository.deleteProspectionInfestation).mockClear();
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
    // "essaim" a disparu de type_cible (0031) : Dense/Très dense sont désormais des
    // cibles à part entière, au même niveau que Vol clair.
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

  it('la section Infestation est facultative : "Continuer" passe au slide suivant sans aucune cible sélectionnée', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    await render(<InfestationScreen />);
    expect(await screen.findByText('Aucun type sélectionné')).toBeVisible();
    // Sans sélection, il n'y a rien à configurer dans l'onglet Comportement : le bouton
    // dit directement "Continuer" et ne fait pas transiter par cet onglet vide.
    expect(screen.getByText('Continuer  ›')).toBeVisible();

    fireEvent.press(screen.getByText('Continuer  ›'));
    await settle();

    // Ni bloqué par "Sélection requise", ni par aucune autre alerte de validation.
    expect(alertSpy).not.toHaveBeenCalled();
    // Rien à enregistrer : aucune ligne n'a été ni sauvegardée ni supprimée.
    expect(prospectionRepository.saveProspectionInfestation).not.toHaveBeenCalled();
    expect(prospectionRepository.deleteProspectionInfestation).not.toHaveBeenCalled();
  });

  it('désélectionner une cible déjà enregistrée la supprime réellement de la base (et pas seulement de l’écran)', async () => {
    jest.mocked(prospectionRepository.listAllProspectionInfestations).mockResolvedValue([
      { type_cible: 'vol_clair', comportement: 'repos' } as any,
    ]);

    await render(<InfestationScreen />);
    // La cible restaurée apparaît cochée (✓) — un nouvel appui la désélectionne.
    fireEvent.press(await screen.findByText('Vol clair'));
    await settle();

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(prospectionRepository.deleteProspectionInfestation).toHaveBeenCalledWith('draft-123', 'vol_clair')
    );
    expect(prospectionRepository.saveProspectionInfestation).not.toHaveBeenCalled();
  });
});
