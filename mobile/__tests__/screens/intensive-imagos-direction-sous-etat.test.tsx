/**
 * intensive-imagos.tsx (B-Imagos) : #direction-sous-etat — la section
 * « Direction du déplacement » (visible seulement en État = Déplacement)
 * s'affiche désormais SOUS « État », plus au-dessus, dans l'ordre de rendu.
 *
 * Fichier séparé des autres scénarios de cet écran — cf. le commentaire
 * d'intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi.
 */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react-native';
import IntensiveImagosScreen from '@/app/(prospection)/intensive-imagos';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useProspectionCaptureStore } from '@/lib/prospection-capture-store';
import * as prospectionRepository from '@/lib/prospection-repository';
import * as referentielDb from '@/lib/referentiel-db';
import { STADES_PAR_DEFAUT, draftLmcOnly } from '../test-utils/intensive-imagos-fixtures';

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
  startCaptureTimer: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({ listStadesGrille: jest.fn() }));

const settle = () => act(() => jest.advanceTimersByTimeAsync(20));

describe('IntensiveImagosScreen — Direction du déplacement sous État', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });
  beforeEach(() => {
    useProspectionCaptureStore.getState().reset();
    useProspectionCaptureStore.getState().setStadesParGrille({});
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    jest.mocked(referentielDb.listStadesGrille).mockImplementation(STADES_PAR_DEFAUT);
  });

  it('affiche « Direction du déplacement » après « État » une fois Déplacement sélectionné', async () => {
    useProspectionWizardStore.setState({ draft: draftLmcOnly(), captures: [] });

    await render(<IntensiveImagosScreen />);
    await screen.findByText('Type de cible');
    await settle();

    fireEvent.press(screen.getByText('Déplacement'));
    await settle();

    // Le libellé « État » porte un enfant supplémentaire (astérisque conditionnel,
    // vide ici puisqu'aucune capture n'a été saisie) : `children` est alors un
    // tableau, à aplatir avant comparaison.
    const texte = (enfants: unknown) => (Array.isArray(enfants) ? enfants.join('') : enfants);
    const ordreTextes = screen
      .getAllByText(/^(État|Direction du déplacement)$/)
      .map((el) => texte(el.props.children));
    expect(ordreTextes).toEqual(['État', 'Direction du déplacement']);
  });
});
