/**
 * Renommage ORPAD → Germination (le libellé UI change, la donnée reste stockée sous
 * la clé `orpad` pour ne pas invalider les fiches déjà synchronisées) + 4 nouveaux
 * champs phénologiques par strate (Feuille/Fleur/Fruit/Sec), mêmes 3 valeurs
 * Néant/Rare/Beaucoup que Germination.
 *
 * Fichier séparé de veg-screen.test.tsx — cf. le commentaire de
 * intensive-imagos-densites-obligatoires.test.tsx pour le pourquoi (contention
 * observée sur plusieurs montages de cet écran dans un même fichier).
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import VegetationScreen from '@/app/(prospection)/veg';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionVegetation: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  getProspection: jest.fn().mockResolvedValue(null),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

describe('VegetationScreen — Germination (ex-ORPAD) et nouveaux champs phénologiques', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionVegetation).mockClear();
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', vegetation: null, sol: null } as any,
      captures: [],
    });
  });

  it('affiche Germination/Feuille/Fleur/Fruit/Sec (jamais "ORPAD") avec Néant/Rare/Beaucoup chacun', async () => {
    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));

    for (const label of ['Germination', 'Feuille', 'Fleur', 'Fruit', 'Sec']) {
      expect(await screen.findByText(label)).toBeVisible();
    }
    expect(screen.queryByText('ORPAD')).toBeNull();

    // 5 champs × 3 valeurs = 15 chips Néant/Rare/Beaucoup.
    expect(screen.getAllByText('Néant')).toHaveLength(5);
    expect(screen.getAllByText('Rare')).toHaveLength(5);
    expect(screen.getAllByText('Beaucoup')).toHaveLength(5);
  });

  it('enregistre Germination et les 4 nouveaux champs indépendamment les uns des autres', async () => {
    // Recouvrement (100%) déjà à 100% (répartition #278 valide) et humidité/texture
    // déjà renseignées : seuls les champs phénologiques sont sous test ici.
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({ strates: { arboree: { recouvrement: 100 } } }),
        sol: JSON.stringify({ humidite: 'surface', texture: ['limoneuse'], solNu: 0 }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    await screen.findByText('Germination');

    // Un "Rare" par section (Germination, Feuille, Fleur, Fruit, Sec, dans cet
    // ordre) : le 1er "Rare" est celui de Germination, le 2e celui de Feuille, etc.
    fireEvent.press(screen.getAllByText('Rare')[0]);
    fireEvent.press(screen.getAllByText('Beaucoup')[1]);

    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalled());
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionVegetation).mock.calls[0];
    const vegetation = JSON.parse(payload.vegetation);
    expect(vegetation.strates.arboree).toMatchObject({
      orpad: ['Rare'],
      feuille: ['Beaucoup'],
      fleur: [],
      fruit: [],
      sec: [],
    });
  });
});
