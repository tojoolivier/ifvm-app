/**
 * Repousse (strate, Végétation & Sol) : "% Repousse" (saisie décimale libre)
 * remplacé par "Repousse" avec un choix exclusif Présence/Absence — la fiche
 * papier n'attend qu'une constatation binaire à cet endroit, pas une valeur
 * mesurée (#repousse-presence-absence).
 *
 * Fichier séparé de veg-screen.test.tsx — cf. le commentaire de
 * veg-screen-germination-phenologie.test.tsx pour le pourquoi (contention
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

describe('VegetationScreen — Repousse : Présence/Absence', () => {
  afterEach(cleanup);
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionVegetation).mockClear();
  });

  it('propose Présence/Absence, pas un champ de saisie décimale', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', vegetation: null, sol: null } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    await waitFor(() => expect(screen.getByText('Repousse')).toBeVisible());

    expect(screen.queryByText('% Repousse')).toBeNull();
    expect(screen.getByText('Présence')).toBeVisible();
    expect(screen.getByText('Absence')).toBeVisible();
  });

  it('enregistre le choix Présence/Absence (dernier choix exclusif)', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        // recouvrement (90) + solNu (10) = 100% : répartition valide (#278), pour
        // que "Continuer" atteigne bien l'enregistrement.
        vegetation: JSON.stringify({ strates: { arboree: { recouvrement: 90 } } }),
        sol: JSON.stringify({ humidite: ['surface'], texture: ['limoneuse'], solNu: 10 }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    await screen.findByText('Repousse');

    // Exclusif : choisir Absence puis Présence doit faire gagner le dernier choix.
    fireEvent.press(screen.getByText('Absence'));
    fireEvent.press(screen.getByText('Présence'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalled());
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionVegetation).mock.calls[0];
    const vegetation = JSON.parse(payload.vegetation);
    expect(vegetation.strates.arboree.repousse).toBe(true);
  });

  it('restaure une strate déjà enregistrée avec repousse = Absence', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        vegetation: JSON.stringify({ strates: { arboree: { recouvrement: 90, repousse: false } } }),
        sol: JSON.stringify({ humidite: ['surface'], texture: ['limoneuse'], solNu: 10 }),
      } as any,
      captures: [],
    });

    await render(<VegetationScreen />);
    fireEvent.press(await screen.findByText('Strate arborée'));
    fireEvent.press(screen.getByText('Continuer  ›'));

    await waitFor(() => expect(prospectionRepository.updateProspectionVegetation).toHaveBeenCalled());
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionVegetation).mock.calls[0];
    const vegetation = JSON.parse(payload.vegetation);
    expect(vegetation.strates.arboree.repousse).toBe(false);
  });
});
