/**
 * Végétation du traitement (Strate herbeuse, Recouvrement) — pré-remplie depuis
 * la fiche de prospection liée (intensive ou extensive, `hauteur_herbe_cm`/
 * `verdissement_pourcent` sont des champs communs aux deux), modifiable
 * ensuite. Strate arborée n'a pas d'équivalent sur la prospection : reste en
 * saisie manuelle, jamais pré-remplie. Côté Terrestre (moyens.tsx) — cf.
 * traitement-synthese-vegetation-prefill.test.tsx pour l'Aérien (synthese.tsx).
 */
import { render, screen, waitFor } from '@testing-library/react-native';
import MoyensScreen from '@/app/(traitement)/moyens';
import * as traitementRepository from '@/lib/traitement-repository';
import * as prospectionRepository from '@/lib/prospection-repository';
import { traitementFonts } from '@/components/traitement/tokens';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspection: jest.fn(),
}));

function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    prospection_id: 'prosp-1',
    type_traitement: 'TERRESTRE',
    kit_combinaison: 0,
    kit_gants: 0,
    kit_lunettes: 0,
    kit_masques: 0,
    kit_botte: 0,
    zones_exposees: null,
    hauteur_strate_herbeuse_m: null,
    hauteur_strate_arboree_m: null,
    recouvrement_percent: null,
    ...overrides,
  } as any;
}

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
  jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue(draft());
  jest.mocked(prospectionRepository.getProspection).mockReset();
});

describe('MoyensScreen — végétation pré-remplie depuis la prospection liée', () => {
  it('pré-remplit Strate herbeuse (cm -> m) et Recouvrement, jamais Strate arborée', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: 150,
      verdissement_pourcent: 75,
    } as any);

    await render(<MoyensScreen />);
    await screen.findByText('Végétation');

    await waitFor(() => expect(screen.getByDisplayValue('1,5')).toBeVisible());
    expect(screen.getByDisplayValue('75')).toBeVisible();
    // Strate arborée n'a pas de source sur la prospection : reste vide.
    expect(screen.getByPlaceholderText('Ex. 2,5')).toHaveProp('value', '');
  });

  it("n'écrase jamais une valeur déjà enregistrée (fiche reprise)", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({ hauteur_strate_herbeuse_m: 2, recouvrement_percent: 40 })
    );
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: 150,
      verdissement_pourcent: 75,
    } as any);

    await render(<MoyensScreen />);
    await screen.findByText('Végétation');

    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalledWith('prosp-1'));
    expect(screen.getByDisplayValue('2')).toBeVisible();
    expect(screen.getByDisplayValue('40')).toBeVisible();
    expect(screen.queryByDisplayValue('1,5')).toBeNull();
  });

  it('laisse les champs vides (saisie manuelle) quand la prospection liée ne les a pas renseignés', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: null,
      verdissement_pourcent: null,
    } as any);

    await render(<MoyensScreen />);
    await screen.findByText('Végétation');

    await waitFor(() => expect(prospectionRepository.getProspection).toHaveBeenCalledWith('prosp-1'));
    expect(screen.getByPlaceholderText('Ex. 1,5')).toHaveProp('value', '');
    expect(screen.getByPlaceholderText('Ex. 80')).toHaveProp('value', '');
  });

  /** Demande explicite : le titre de section « Végétation » doit être centré,
   * agrandi et en gras (même famille de police que les valeurs « vedette » de
   * l'écran Cibles, traitementFonts.uiBold) — plus visible que « Zones
   * exposées », qui a reçu le même semi-gras que tous les titres de champ de
   * ce module (demande générale de lisibilité), mais pas l'agrandissement
   * supplémentaire propre à Végétation. */
  it('affiche le titre « Végétation » centré, agrandi et en gras, davantage que « Zones exposées »', async () => {
    jest.mocked(prospectionRepository.getProspection).mockResolvedValue({
      id: 'prosp-1',
      hauteur_herbe_cm: null,
      verdissement_pourcent: null,
    } as any);

    await render(<MoyensScreen />);

    const titre = await screen.findByText('Végétation');
    expect(titre.props.style).toEqual(
      expect.objectContaining({ textAlign: 'center', fontFamily: traitementFonts.uiBold })
    );
    const zonesExposees = screen.getByText('Zones exposées');
    expect(zonesExposees.props.style).toEqual(
      expect.objectContaining({ fontFamily: traitementFonts.uiSemiBold })
    );
    expect(titre.props.style.fontSize).toBeGreaterThan(zonesExposees.props.style.fontSize);
  });
});
