/**
 * #surface-traitee-et-protegee : sur la fiche de traitement, un champ « Surface traitée et
 * protégée (ha) » (carte en lecture seule) suit « Surface traitée » et vaut toujours la même
 * chose — Terrestre (écran Équipe) et Aérien (écran Pesticides & rotations).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import TraitementScreen from '@/app/(traitement)/traitement';
import RotationsScreen from '@/app/(traitement)/rotations';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import * as traitementRepository from '@/lib/traitement-repository';

let mockRouteParams: Record<string, string> = { traitementId: 'trait-1' };

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => mockRouteParams,
}));

jest.mock('@/lib/traitement-repository', () => ({
  getTraitement: jest.fn(),
  updateTraitementAerien: jest.fn().mockResolvedValue({}),
  updateTraitementTerrestre: jest.fn().mockResolvedValue({}),
  addProduitUtilise: jest.fn().mockResolvedValue({}),
  deleteAllProduitsForTraitementTerrestre: jest.fn().mockResolvedValue(undefined),
  addRotation: jest.fn().mockResolvedValue({}),
  deleteAllRotationsForTraitementAerien: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienPesticideRecu: jest.fn().mockResolvedValue({}),
  updateTraitementAerienSurfaceRestante: jest.fn().mockResolvedValue(undefined),
  updateTraitementAerienEfficacite: jest.fn().mockResolvedValue({}),
  listReprenableTraitements: jest.fn().mockResolvedValue([]),
}));

jest.mock('@/lib/referentiel-db', () => ({
  listUtilisateursByRole: jest.fn().mockResolvedValue([]),
  listPesticides: jest.fn().mockResolvedValue([]),
}));

const RESET = {
  screen: 'reference' as const,
  isValidationView: false,
  ref: {},
  aerien: { rotations: [] },
  terrestre: { produits: [] },
  env: {},
  imp: {},
  observations: null,
  signed: {},
  stamps: {},
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

beforeEach(() => {
  mockRouteParams = { traitementId: 'trait-1' };
});

describe('Terrestre (écran Équipe) — « Surface traitée et protégée (ha) »', () => {
  it('apparaît sous « Traitée (ha) » et reprend sa valeur', async () => {
    useTraitementCaptureStore.setState({ ...RESET, typeTraitement: 'TERRESTRE' } as any);
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'TERRESTRE',
      cible: { surface_infestee_ha: 100 },
      terrestre: {
        chef_equipe_id: 'chef-1',
        heure_debut: '06:00',
        heure_fin: '09:00',
        vitesse_vent_ms: 2,
        temperature_c: 26,
        reprise_traitement: false,
        surface_atomiseur_ha: null,
        surface_disque_rotatif_ha: null,
        surface_atomiseur_autoporte_ha: null,
        surface_restante_abandonnee: null,
        motif_surface_restante_abandonnee: null,
        produits: [],
      },
    } as any);

    await render(<TraitementScreen />);
    await waitFor(() => expect(useTraitementCaptureStore.getState().terrestre.chefEquipeId).toBe('chef-1'));

    expect(screen.getByText('Traitée (ha)')).toBeVisible();
    expect(screen.getByText('Surface traitée et protégée (ha)')).toBeVisible();
    // Ordre : « Traitée » juste avant « Traitée et protégée ».
    const rendu = JSON.stringify(screen.toJSON());
    expect(rendu.indexOf('Traitée (ha)')).toBeLessThan(rendu.indexOf('Surface traitée et protégée (ha)'));

    // Atomiseur à dos (index 2 des champs « 0 ») : 12,5 ha → « Traitée », « Traitée et protégée »
    // et « Cumulée » (pas de reprise) affichent toutes 12.5.
    fireEvent.changeText(screen.getAllByPlaceholderText('0')[2], '12,5');
    await settle();
    await waitFor(() => expect(screen.getAllByText('12.5')).toHaveLength(3));
  });
});

describe('Aérien (écran Pesticides & rotations) — « Surface traitée et protégée (ha) »', () => {
  it('apparaît sous « Surface traitée (ha) » et reprend sa valeur', async () => {
    useTraitementCaptureStore.setState({
      ...RESET,
      typeTraitement: 'AERIEN',
      aerien: {
        rotations: [
          {
            localId: 'r1',
            produit_id: 'p1',
            quantite: 10,
            unite: 'L',
            surface_ha: 12.5,
            heure_debut: '06:00',
            heure_ouverture_vanne: '06:05',
            heure_fermeture_vanne: '06:20',
            heure_fin: '06:30',
            temperature_debut_c: 25,
            temperature_fin_c: 26,
            vent_debut_ms: 2,
            vent_fin_ms: 3,
          },
        ],
      },
    } as any);
    jest.mocked(traitementRepository.getTraitement).mockReset().mockResolvedValue({
      id: 'trait-1',
      type_traitement: 'AERIEN',
      cible: { surface_infestee_ha: 100 },
      aerien: { surface_restante_abandonnee: false, pesticide_recu_l: null, rotations: [] },
    } as any);

    await render(<RotationsScreen />);
    await screen.findByTestId('rotation-numero-cuve-0');
    await settle();

    expect(screen.getByText('Surface traitée (ha)')).toBeVisible();
    expect(screen.getByText('Surface traitée et protégée (ha)')).toBeVisible();
    const rendu = JSON.stringify(screen.toJSON());
    expect(rendu.indexOf('"Surface traitée (ha)"')).toBeLessThan(rendu.indexOf('Surface traitée et protégée (ha)'));
    // Surface traitée = somme des surfaces de rotation (12.5) : reprise dans la nouvelle carte.
    expect(screen.getAllByText('12.5').length).toBeGreaterThanOrEqual(2);
  });
});
