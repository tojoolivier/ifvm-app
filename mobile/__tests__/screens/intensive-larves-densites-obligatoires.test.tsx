/**
 * intensive-larves.tsx (C-Larves) : la densité groupée reste obligatoire (héritée
 * de density.tsx) même une fois fusionnée dans le nouvel écran.
 *
 * Fichier séparé des autres scénarios de cet écran — même précaution que côté
 * intensive-imagos (cf. intensive-imagos-densites-obligatoires.test.tsx) : un
 * artefact de cet environnement de test corrompt le rendu d'un montage suivant
 * dans le même fichier ; Jest isole complètement l'état d'un fichier à l'autre.
 */
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveLarvesScreen from '@/app/(prospection)/intensive-larves';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcLarveOnly } from '../test-utils/intensive-larves-fixtures';

const params: { draftId: string } = { draftId: 'draft-123' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => params,
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
  markGrilleCompleted: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  saveProspectionCaptures: jest.fn().mockResolvedValue(undefined),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('IntensiveLarvesScreen — densités obligatoires', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT as any);
  });

  it('bloque « Infestation » tant que la densité groupée (obligatoire) manque', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcLarveOnly(), captures: [] });
    const alertSpy = jest.spyOn(Alert, 'alert');

    await render(<IntensiveLarvesScreen />);
    await screen.findByText('Densité diffuse (ind./ha) *');
    await settle();

    fireEvent.changeText(screen.getByTestId('densite-diffuse-input'), '40');
    await settle();
    fireEvent.press(screen.getByText('Infestation  ›'));

    expect(alertSpy).toHaveBeenCalledWith('Densité groupée requise', 'La densité groupée (ind./m²) est obligatoire.');
    expect(prospectionRepository.saveProspectionPopulation).not.toHaveBeenCalled();
  });
});
