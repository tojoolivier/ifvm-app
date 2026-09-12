/**
 * Règle métier : 4 blocs de densité indépendants — Locusta migratoria × Imagos/Larves et
 * Nomadacris × Imagos/Larves — chacun avec sa propre Densité diffuse (ind./ha) ET Densité
 * groupée (ind./m², #densite-groupee-obligatoire), toutes deux obligatoires, jamais
 * partagées entre espèce/stade.
 */
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import DensityScreen from '@/app/(prospection)/density';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';

/** Grille demandée : mutable, comme captures-screen.test.tsx. */
const params: { draftId: string; grilleIndex: string } = { draftId: 'draft-123', grilleIndex: '0' };

/** Laisse `useAsyncAction` (setIsRunning(false) après le `saveProspectionPopulation`
 * attendu) se terminer avant que le test suivant ne monte son propre écran — sinon ce
 * reliquat asynchrone s'exécute au tout début du rendu suivant et le perturbe (même
 * mécanisme que veg-screen.test.tsx). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

afterEach(cleanup);

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => params,
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn(),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

// Une densité par (espèce, catégorie) : prouve que rien n'est partagé entre les 4 blocs.
const DENSITES_EN_BASE: Record<string, { densite_diffuse: number; densite_groupee: number | null }> = {
  'LMC-imago': { densite_diffuse: 12, densite_groupee: 3 },
  'LMC-larve': { densite_diffuse: 40, densite_groupee: null },
  'NSE-imago': { densite_diffuse: 7, densite_groupee: 1 },
  'NSE-larve': { densite_diffuse: 25, densite_groupee: 9 },
};

describe('DensityScreen — 4 blocs de densité indépendants (LMC/NSE × imago/larve)', () => {
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation((_id, espece, categorie) => {
      const found = DENSITES_EN_BASE[`${espece}-${categorie}`];
      return Promise.resolve(
        found ? ({ espece, categorie, methode: null, accouplement: null, ponte: null, ...found } as any) : null
      );
    });
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: true, lmcLarve: true, nseImago: true, nseLarve: true }),
      } as any,
      captures: [],
    });
    params.grilleIndex = '0';
  });

  it.each([
    ['0', 'Locusta', 'imagos', 'LMC-imago', '12', '3', 'Accouplement  ›'],
    ['1', 'Locusta', 'larves', 'LMC-larve', '40', '', 'Captures  ›'],
    ['2', 'Nomadacris', 'imagos', 'NSE-imago', '7', '1', 'Accouplement  ›'],
    ['3', 'Nomadacris', 'larves', 'NSE-larve', '25', '9', 'Captures  ›'],
  ])(
    'grille %s (%s · %s) charge sa propre densité (%s), sans mélange avec les 3 autres blocs',
    async (grilleIndex, especeLabel, categorieLabel, _key, diffuseAttendue, groupeeAttendue, labelBouton) => {
      params.grilleIndex = grilleIndex;

      await render(<DensityScreen />);

      expect(await screen.findByText(`${especeLabel} · densités ${categorieLabel}`)).toBeVisible();
      expect(screen.getByDisplayValue(diffuseAttendue)).toBeVisible();
      if (groupeeAttendue) {
        expect(screen.getByDisplayValue(groupeeAttendue)).toBeVisible();
      }
      // Régression : le bouton affichait toujours "Accouplement ›", même sur une grille
      // larve — où la suite du parcours est en réalité "Captures" (l'accouplement ne
      // concerne que les imagos).
      expect(screen.getByText(labelBouton)).toBeVisible();
    }
  );

  it('bloque la navigation si la densité diffuse (obligatoire) est vide, sans toucher à la densité groupée', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<DensityScreen />);
    expect(await screen.findByText('Locusta · densités imagos')).toBeVisible();

    fireEvent.press(screen.getByText('Accouplement  ›'));

    expect(alertSpy).toHaveBeenCalledWith('Densité diffuse requise', expect.stringContaining('ind./ha'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(await screen.findByText('Veuillez renseigner la densité diffuse (ind./ha).')).toBeVisible();
  });

  it('enregistre la densité diffuse renseignée sous la bonne espèce/stade, sans écraser les autres blocs', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    params.grilleIndex = '2'; // Nomadacris · imagos

    await render(<DensityScreen />);
    expect(await screen.findByText('Nomadacris · densités imagos')).toBeVisible();

    // Densité diffuse est le premier des deux champs vides (diffuse puis groupée) —
    // les deux sont désormais obligatoires (#densite-groupee-obligatoire).
    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '15');
    await screen.findByDisplayValue('15');
    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '4');
    await screen.findByDisplayValue('4');
    fireEvent.press(screen.getByText('Accouplement  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ espece: 'NSE', categorie: 'imago', densite_diffuse: 15, densite_groupee: 4 })
      )
    );
  });

  it('bloque la navigation si la densité groupée (obligatoire) est vide, même avec la densité diffuse renseignée', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<DensityScreen />);
    expect(await screen.findByText('Locusta · densités imagos')).toBeVisible();

    fireEvent.changeText(screen.getAllByDisplayValue('')[0], '15');
    await screen.findByDisplayValue('15');
    fireEvent.press(screen.getByText('Accouplement  ›'));

    expect(alertSpy).toHaveBeenCalledWith('Densité groupée requise', 'La densité groupée (ind./m²) est obligatoire.');
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(await screen.findByText('La densité groupée (ind./m²) est obligatoire.')).toBeVisible();
  });
});

/**
 * #methode-supprime-visuel : « Visuel » retiré du choix proposé pour toute
 * nouvelle saisie de Méthode (Prospection Intensive) — seul « Comptage
 * direct » reste sélectionnable. Une fiche historique dont `methode` vaut
 * déjà "visuel" doit rester intacte tant que l'agent ne retouche pas ce
 * champ (aucune conversion/perte automatique).
 */
describe('DensityScreen — Méthode : "Visuel" retiré, seul "Comptage direct" proposé', () => {
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        especes: JSON.stringify({ lmcImago: true, lmcLarve: false, nseImago: false, nseLarve: false }),
      } as any,
      captures: [],
    });
    params.grilleIndex = '0';
  });

  it('ne propose plus « Visuel », seul « Comptage direct » est affiché', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);

    await render(<DensityScreen />);
    expect(await screen.findByText('Locusta · densités imagos')).toBeVisible();

    expect(screen.queryByText('Visuel')).toBeNull();
    expect(screen.getByText('Comptage direct')).toBeVisible();
  });

  it('sélectionne « Comptage direct » et l’enregistre', async () => {
    // Densités déjà valides (mock) : seule l'interaction sur le chip Méthode
    // est sous test ici — la saisie interactive des densités est déjà
    // couverte par les tests dédiés à leur caractère obligatoire ci-dessus.
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue({
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 10,
      densite_groupee: 2,
      methode: null,
      accouplement: null,
      ponte: null,
    } as any);

    await render(<DensityScreen />);
    await screen.findByText('Locusta · densités imagos');

    fireEvent.press(screen.getByText('Comptage direct'));
    await waitFor(() =>
      expect(screen.getByText('Comptage direct').props.style).toEqual(
        expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
      )
    );

    fireEvent.press(screen.getByText('Accouplement  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ methode: 'comptage_direct' })
      )
    );
    await settle();
  });

  it('une fiche historique avec methode "visuel" n’affiche aucun chip actif, mais conserve la valeur si l’agent ne la retouche pas', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue({
      espece: 'LMC',
      categorie: 'imago',
      densite_diffuse: 12,
      densite_groupee: 3,
      methode: 'visuel',
      accouplement: null,
      ponte: null,
    } as any);

    await render(<DensityScreen />);
    await screen.findByText('Locusta · densités imagos');

    // Aucun chip ne doit apparaître sélectionné : "Visuel" n'existe plus, et
    // "Comptage direct" ne correspond pas à la valeur enregistrée.
    expect(screen.queryByText('Visuel')).toBeNull();
    expect(screen.getByText('Comptage direct').props.style).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );

    // L'agent ne touche pas Méthode et enregistre : la valeur historique "visuel"
    // repart telle quelle, jamais convertie ou effacée automatiquement.
    fireEvent.press(screen.getByText('Accouplement  ›'));

    await waitFor(() =>
      expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ methode: 'visuel' })
      )
    );
    await settle();
  });
});
