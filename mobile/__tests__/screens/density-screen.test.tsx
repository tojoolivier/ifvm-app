import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import DensityScreen from '@/app/(prospection)/density';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.setTimeout(60000);

const params: { draftId: string; grilleIndex: string } = { draftId: 'draft-123', grilleIndex: '0' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => params,
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn(),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

const DENSITES_EN_BASE: Record<string, { densite_diffuse: number; densite_groupee: number | null }> = {
  'LMC-imago': { densite_diffuse: 12, densite_groupee: 3 },
  'LMC-larve': { densite_diffuse: 40, densite_groupee: null },
  'NSE-imago': { densite_diffuse: 7, densite_groupee: 1 },
  'NSE-larve': { densite_diffuse: 25, densite_groupee: 9 },
};

beforeEach(() => {
  jest.clearAllMocks();
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

afterEach(async () => {
  await act(async () => {
    useProspectionCaptureStore.getState().reset();
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });
});

describe('DensityScreen — 4 blocs de densité indépendants (LMC/NSE × imago/larve)', () => {
  it.each([
    ['0', 'Locusta', 'imagos', 'LMC-imago', '12', '3', 'Accouplement  ›'],
    ['1', 'Locusta', 'larves', 'LMC-larve', '40', '', 'Captures  ›'],
    ['2', 'Nomadacris', 'imagos', 'NSE-imago', '7', '1', 'Accouplement  ›'],
    ['3', 'Nomadacris', 'larves', 'NSE-larve', '25', '9', 'Captures  ›'],
  ])(
    'grille %s (%s · %s) charge sa propre densité (%s), sans mélange avec les 3 autres blocs',
    async (grilleIndex, especeLabel, categorieLabel, _key, diffuseAttendue, groupeeAttendue, labelBouton) => {
      params.grilleIndex = grilleIndex;

      await act(async () => {
        await render(<DensityScreen />);
      });

      expect(await screen.findByText(`${especeLabel} · densités ${categorieLabel}`)).toBeVisible();
      expect(screen.getByDisplayValue(diffuseAttendue)).toBeVisible();
      if (groupeeAttendue) {
        expect(screen.getByDisplayValue(groupeeAttendue)).toBeVisible();
      }
      expect(screen.getByText(labelBouton)).toBeVisible();
    }
  );

  it('bloque la navigation si la densité diffuse (obligatoire) est vide, sans toucher à la densité groupée', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => {
      await render(<DensityScreen />);
    });

    expect(await screen.findByText('Locusta · densités imagos')).toBeVisible();

    await act(async () => {
      fireEvent.press(screen.getByText('Accouplement  ›'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Densité diffuse requise', expect.stringContaining('D/ha'));
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(await screen.findByText('Veuillez renseigner la densité diffuse (D/ha).')).toBeVisible();
  });

  it('enregistre la densité diffuse renseignée sous la bonne espèce/stade, sans écraser les autres blocs', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    params.grilleIndex = '2';

    await act(async () => {
      await render(<DensityScreen />);
    });

    expect(await screen.findByText('Nomadacris · densités imagos')).toBeVisible();

    await act(async () => {
      const inputs = screen.getAllByDisplayValue('');
      fireEvent.changeText(inputs[0], '15');
      fireEvent.changeText(inputs[1], '4');
      fireEvent.press(screen.getByText('Accouplement  ›'));
    });

    await waitFor(() => {
      expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ espece: 'NSE', categorie: 'imago', densite_diffuse: 15, densite_groupee: 4 })
      );
    }, { timeout: 5000 });
  }, 60000);

  it('bloque la navigation si la densité groupée (obligatoire) est vide, même avec la densité diffuse renseignée', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null as any);
    const alertSpy = jest.spyOn(Alert, 'alert');

    await act(async () => {
      await render(<DensityScreen />);
    });

    expect(await screen.findByText('Locusta · densités imagos')).toBeVisible();

    await act(async () => {
      const inputs = screen.getAllByDisplayValue('');
      fireEvent.changeText(inputs[0], '15');
      fireEvent.press(screen.getByText('Accouplement  ›'));
    });

    expect(alertSpy).toHaveBeenCalledWith('Densité groupée requise', 'La densité groupée (/m²) est obligatoire.');
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
    expect(await screen.findByText('La densité groupée (/m²) est obligatoire.')).toBeVisible();
  });
});