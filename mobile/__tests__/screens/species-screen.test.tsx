/**
 * Non-régression #201 : en réouvrant une fiche intensive déjà enregistrée, les
 * espèces/stades déjà cochés sur « Qu'avez-vous observé ? » doivent réapparaître
 * sélectionnés — sinon l'agent croit que rien ne se sélectionne.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import SpeciesScreen from '@/app/(prospection)/species';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ draftId: 'draft-123' }),
}));

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionEspeces: jest.fn(),
}));

describe('SpeciesScreen', () => {
  it('restaure la sélection d’espèces déjà enregistrée (#201)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: false, nseLarve: true }),
      } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);

    expect(await screen.findByText('2 grille(s)')).toBeVisible();
  });

  it('part d’une sélection vide sur une fiche neuve', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-neuf', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);

    expect(await screen.findByText('0 grille(s)')).toBeVisible();
  });

  it('met le brouillon en mémoire à jour avec la sélection enregistrée (#201)', async () => {
    // Sans cela, l'écran de capture lit l'ancienne valeur d'`especes` — vide sur une
    // fiche neuve — et annonce « aucune grille à saisir ».
    const enregistre = {
      id: 'draft-123',
      type_prospection: 'intensive',
      especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
    };
    jest.mocked(prospectionRepository.updateProspectionEspeces).mockResolvedValue(enregistre as any);

    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);
    // Deux cartes portent « Larves » (Locusta, Nomadacris) : on coche celle de Locusta.
    fireEvent.press((await screen.findAllByText('Larves'))[0]);
    // Le compteur confirme que la case a bien basculé avant de continuer.
    expect(await screen.findByText('1 grille(s)')).toBeVisible();
    fireEvent.press(screen.getByText('Captures  ›'));

    await waitFor(() =>
      expect(useProspectionWizardStore.getState().draft?.especes).toBe(enregistre.especes)
    );
  });

  /**
   * #especes-nom-scientifique-italique : convention de nomenclature — le nom
   * scientifique complet (genre + espèce + sous-espèce) doit être rendu en
   * italique réel (`fontStyle: 'italic'`, mécanisme du framework), pas
   * seulement l'épithète comme avant ce correctif, et jamais via des
   * caractères Unicode simulant l'italique.
   */
  it('affiche les deux noms scientifiques complets, en italique réelle (fontStyle)', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);

    const locusta = await screen.findByText('Locusta migratoria capito');
    const nomadacris = await screen.findByText('Nomadacris septemfasciata');

    for (const noeud of [locusta, nomadacris]) {
      expect(noeud.props.style).toEqual(expect.objectContaining({ fontStyle: 'italic' }));
    }
  });

  it('part vers intensive-larves quand la seule grille sélectionnée est une larve', async () => {
    // Régression : `firstScreen` ne testait que `grilles[0]?.categorie === 'imago'` —
    // sélectionner uniquement une larve doit envoyer directement vers l'écran C-Larves
    // (intensive-larves.tsx), pas vers B-Imagos qui n'aurait aucune grille à afficher.
    mockPush.mockClear();
    jest.mocked(prospectionRepository.updateProspectionEspeces).mockResolvedValue({
      id: 'draft-123',
      especes: JSON.stringify({ lmcImago: false, lmcLarve: true, nseImago: false, nseLarve: false }),
    } as any);

    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);
    fireEvent.press((await screen.findAllByText('Larves'))[0]);
    expect(await screen.findByText('1 grille(s)')).toBeVisible();
    fireEvent.press(screen.getByText('Captures  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(prospection)/intensive-larves', params: { draftId: 'draft-123' } })
      )
    );
  });

  it('part vers intensive-imagos dès qu’un imago est sélectionné (même avec une larve aussi cochée)', async () => {
    mockPush.mockClear();
    jest.mocked(prospectionRepository.updateProspectionEspeces).mockResolvedValue({
      id: 'draft-123',
      especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: false, nseLarve: false }),
    } as any);

    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', especes: null } as any,
      captures: [],
    });

    await render(<SpeciesScreen />);
    fireEvent.press((await screen.findAllByText('Imagos'))[0]);
    fireEvent.press((await screen.findAllByText('Larves'))[0]);
    expect(await screen.findByText('2 grille(s)')).toBeVisible();
    fireEvent.press(screen.getByText('Captures  ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(prospection)/intensive-imagos', params: { draftId: 'draft-123' } })
      )
    );
  });
});