/**
 * Efficacité (migration backend 0058, fiche CRT papier section "Traitement") :
 * taux de mortalité, délai d'évaluation et méthode. Aérien uniquement sur cet
 * écran « Moyens & protection » (moyens.tsx) — premiers champs de la fiche,
 * avant même le matériel de protection (#efficacite-moyens-protection).
 * Le Terrestre l'a saisie ici un temps, mais est reparti sur l'écran Équipe
 * (#efficacite-equipe-terrestre, cf. traitement-terrestre-decimales-virgule.test.tsx
 * pour sa couverture décimale côté Équipe) — le bloc « Efficacité absente »
 * ci-dessous vérifie juste qu'elle a bien disparu de cet écran-ci pour lui.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import MoyensScreen from '@/app/(traitement)/moyens';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementMoyens: jest.fn().mockResolvedValue({}),
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
}));


function draft(overrides: Record<string, unknown> = {}) {
  return {
    id: 'trait-1',
    type_traitement: 'AERIEN',
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
  jest.mocked(traitementRepository.updateTraitementMoyens).mockClear().mockResolvedValue({} as any);
  jest.mocked(traitementRepository.updateTraitementAerienEfficacite).mockClear().mockResolvedValue({} as any);
});

/** Laisse un vrai tick s'écouler entre deux interactions — même prudence
 * qu'ailleurs dans ce module. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('MoyensScreen — Efficacité en premier champ (Aérien)', () => {
  it('affiche Efficacité avant le matériel de protection', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        type_traitement: 'AERIEN',
        aerien: {
          taux_mortalite_pourcent: null,
          evaluation_efficacite_heures_apres: null,
          methode_evaluation_efficacite: null,
        },
      })
    );

    await render(<MoyensScreen />);
    await screen.findByText('Efficacité');
    expect(screen.getByText('Taux de mortalité (%)')).toBeVisible();
    expect(screen.getByText('Évalué après traitement (heures)')).toBeVisible();
    expect(screen.getByText("Méthode d'évaluation")).toBeVisible();

    // "Efficacité" doit précéder le titre de l'écran suivant dans le rendu
    // (matériel de protection) — première section de la fiche, cf. demande.
    const rendered = JSON.stringify(screen.toJSON());
    expect(rendered.indexOf('Efficacité')).toBeLessThan(
      rendered.indexOf("Nombre de personnes équipées de chaque matériel")
    );
  });
});

describe('MoyensScreen (Terrestre) — Efficacité absente (#efficacite-equipe-terrestre)', () => {
  it("n'affiche plus Efficacité, saisie désormais sur l'écran Équipe", async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        type_traitement: 'TERRESTRE',
        terrestre: {
          taux_mortalite_pourcent: 87.5,
          evaluation_efficacite_heures_apres: 6,
          methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
        },
      })
    );

    await render(<MoyensScreen />);
    await waitFor(() => expect(screen.getByText('Moyens & protection')).toBeVisible());

    expect(screen.queryByText('Efficacité')).toBeNull();
    expect(screen.queryByText('Taux de mortalité (%)')).toBeNull();
    expect(screen.queryByText('Évalué après traitement (heures)')).toBeNull();
    expect(screen.queryByText("Méthode d'évaluation")).toBeNull();
  });
});

describe('MoyensScreen (Aérien) — efficacité (taux de mortalité)', () => {
  it('saisit et enregistre le taux de mortalité, le délai et la méthode', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        type_traitement: 'AERIEN',
        aerien: {
          taux_mortalite_pourcent: null,
          evaluation_efficacite_heures_apres: null,
          methode_evaluation_efficacite: null,
        },
      })
    );

    await render(<MoyensScreen />);
    await screen.findByText('Efficacité');

    fireEvent.changeText(screen.getByTestId('taux-mortalite-input'), '92');
    await settle();
    fireEvent.changeText(screen.getByTestId('evaluation-efficacite-heures-input'), '24');
    await settle();
    fireEvent.press(screen.getByText('Estimation visuelle'));
    await settle();
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() =>
      expect(traitementRepository.updateTraitementAerienEfficacite).toHaveBeenCalledWith('trait-1', {
        tauxMortalitePourcent: 92,
        evaluationEfficaciteHeuresApres: 24,
        methodeEvaluationEfficacite: 'ESTIMATION_VISUELLE',
      })
    );
  });

  it('restaure une évaluation déjà enregistrée', async () => {
    jest.mocked(traitementRepository.getTraitement).mockResolvedValue(
      draft({
        type_traitement: 'AERIEN',
        aerien: {
          taux_mortalite_pourcent: 87.5,
          evaluation_efficacite_heures_apres: 6,
          methode_evaluation_efficacite: 'COMPTAGES_PRE_POST',
        },
      })
    );

    await render(<MoyensScreen />);

    expect(await screen.findByDisplayValue('87,5')).toBeVisible();
    expect(screen.getByDisplayValue('6')).toBeVisible();
    expect(screen.getByText('Comptages pré/post-traitement').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ color: '#fff' })])
    );
  });
});
