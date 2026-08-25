/**
 * Non-régression : le « Type de capture » (Essaim / Vol clair) d'extensive-imagos.tsx
 * était porté par un seul `useState` partagé entre LMC et NSE, alors que le modèle de
 * données (`ExtensiveImagoSpeciesData.typeCapture`) le prévoyait déjà par espèce.
 * Modifier LMC écrasait donc silencieusement la valeur affichée/enregistrée pour NSE
 * (et réciproquement) dès la sauvegarde suivante — les deux espèces doivent pouvoir
 * avoir des types de capture différents et indépendants.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveImagosScreen from '@/app/(prospection)/extensive-imagos';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

/** Laisse le fetch de population (Promise.all().then(setSpeciesData(...))) se
 * résoudre avant toute interaction — sinon il écrase les choix déjà faits à l'écran. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveImagosScreen — indépendance du type de capture LMC/NSE', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
  });

  it("modifier le type de capture de NSE n'affecte pas celui de LMC (et réciproquement)", async () => {
    await render(<ExtensiveImagosScreen />);
    await screen.findByText('📊 Type de capture');
    await settle();

    // LMC (espèce active par défaut) : Essaim déjà sélectionné par défaut, on le
    // confirme explicitement — cf. étape 3 du scénario demandé.
    fireEvent.press(screen.getAllByText('Essaim')[0]);
    await settle();

    // Bascule vers NSE puis choisit Vol clair — ne doit toucher que NSE.
    fireEvent.press(screen.getByText('NSE'));
    await settle();
    fireEvent.press(screen.getAllByText('Vol clair')[0]);
    await settle();

    // Retour sur LMC : doit toujours afficher Essaim actif, pas Vol clair.
    fireEvent.press(screen.getByText('LMC'));
    await waitFor(() =>
      expect(screen.getAllByText('Essaim')[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    fireEvent.press(screen.getByText('Suivant : Larves ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    const [, nseRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[1];

    expect(lmcRow).toMatchObject({ espece: 'LMC', essaim_observe: true });
    expect(nseRow).toMatchObject({ espece: 'NSE', essaim_observe: false });
  });

  it('restaure le type de capture propre à chaque espèce depuis les lignes déjà enregistrées', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({ espece: 'LMC', categorie: 'imago', essaim_observe: true, captures_nombre: 0 } as any)
        : ({ espece: 'NSE', categorie: 'imago', essaim_observe: false, captures_nombre: 0 } as any)
    );

    await render(<ExtensiveImagosScreen />);
    await settle();

    // LMC actif par défaut : doit restaurer Essaim.
    await waitFor(() =>
      expect(screen.getAllByText('Essaim')[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    fireEvent.press(screen.getByText('NSE'));
    await waitFor(() =>
      expect(screen.getAllByText('Vol clair')[0].props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );
  });
});
