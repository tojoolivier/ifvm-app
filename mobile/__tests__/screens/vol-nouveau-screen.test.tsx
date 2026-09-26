/** Écran « Nouveau vol » : convoyage / divers uniquement (#644, Figma 81:487). */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import VolNouveauScreen from '@/app/(app)/vol-nouveau';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { listAeronefsEquipe } from '@/lib/equipe-db';
import { getEquipeLocale } from '@/lib/referentiel-db';
import { creerVolAutonome } from '@/lib/vol-db';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, push: jest.fn() }) }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/referentiel-db', () => ({ getEquipeLocale: jest.fn() }));
jest.mock('@/lib/equipe-db', () => ({ listAeronefsEquipe: jest.fn(), aujourdhuiIso: () => '2026-09-23' }));
jest.mock('@/lib/vol-db', () => ({ creerVolAutonome: jest.fn() }));
jest.mock('@/lib/site-aerien-envoi', () => ({ envoyerSitesSiEnLigne: jest.fn() }));
jest.mock('@/components/TimeField', () => {
  const { TextInput } = jest.requireActual('react-native');
  return {
    TimeField: ({ value, onChange }: { value: string | null; onChange: (v: string) => void }) => (
      <TextInput testID="time-input" value={value ?? ''} onChangeText={onChange} />
    ),
  };
});
jest.mock('@/components/DateField', () => {
  const { Text } = jest.requireActual('react-native');
  return { DateField: ({ value }: { value: string }) => <Text>{value}</Text> };
});

beforeEach(() => {
  mockBack.mockReset();
  useEquipeTravailStore.setState({ equipeId: 'eq-1', isInitialized: true });
  jest.mocked(getEquipeLocale).mockResolvedValue({ id: 'eq-1', nom: 'Équipe Sud', type: 'aerien' } as any);
  jest.mocked(listAeronefsEquipe).mockResolvedValue([{ id: 'ae-1', immatriculation: '5R-MHR', societe: 'Cessna' }]);
  jest.mocked(creerVolAutonome).mockReset().mockResolvedValue('vol-1');
});

describe('VolNouveauScreen', () => {
  it('ne propose que Convoyage et Divers', async () => {
    await render(<VolNouveauScreen />);

    expect(screen.getByText('Convoyage')).toBeVisible();
    expect(screen.getByText('Divers')).toBeVisible();
    expect(screen.queryByText('Application')).toBeNull();
  });

  it('reprend l’équipe et l’aéronef de l’équipe de travail', async () => {
    await render(<VolNouveauScreen />);

    expect(await screen.findByText('Équipe Sud')).toBeVisible();
    expect(await screen.findByText('5R-MHR')).toBeVisible();
  });

  it('un convoyage vide liste motif, lieux et heures manquants sans rien enregistrer', async () => {
    await render(<VolNouveauScreen />);
    await screen.findByText('5R-MHR');

    await fireEvent.press(screen.getByTestId('vol-enregistrer'));

    expect(screen.getByText('• Le motif est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Le lieu de départ est obligatoire.')).toBeVisible();
    expect(screen.getByText('• Le lieu d’arrivée est obligatoire.')).toBeVisible();
    expect(creerVolAutonome).not.toHaveBeenCalled();
  });

  it('Divers masque les lieux : seul le motif est demandé', async () => {
    await render(<VolNouveauScreen />);
    await screen.findByText('5R-MHR');

    await fireEvent.press(screen.getByTestId('vol-categorie-divers'));

    expect(screen.queryByTestId('vol-lieu-depart')).toBeNull();
    await fireEvent.press(screen.getByTestId('vol-enregistrer'));
    expect(screen.getByText('• Le motif est obligatoire.')).toBeVisible();
    expect(screen.queryByText('• Le lieu de départ est obligatoire.')).toBeNull();
  });

  it('enregistre un convoyage complet puis revient', async () => {
    await render(<VolNouveauScreen />);
    await screen.findByText('5R-MHR');

    const heures = screen.getAllByTestId('time-input');
    await fireEvent.changeText(heures[0], '10:00');
    await fireEvent.changeText(heures[1], '11:30');
    await fireEvent.changeText(screen.getByTestId('vol-lieu-depart'), 'Antsirabe');
    await fireEvent.changeText(screen.getByTestId('vol-lieu-arrivee'), 'Isoanala');
    await fireEvent.changeText(screen.getByTestId('vol-motif'), 'Transfert aéronef');
    await fireEvent.press(screen.getByTestId('vol-enregistrer'));

    await waitFor(() =>
      expect(creerVolAutonome).toHaveBeenCalledWith(
        expect.objectContaining({
          categorie: 'convoyage',
          equipeId: 'eq-1',
          aeronefId: 'ae-1',
          debut: '10:00',
          fin: '11:30',
          lieuDepart: 'Antsirabe',
          lieuArrivee: 'Isoanala',
          motif: 'Transfert aéronef',
        })
      )
    );
    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('refuse une équipe de travail terrestre', async () => {
    jest.mocked(getEquipeLocale).mockResolvedValue({ id: 'eq-1', nom: 'Équipe Nord', type: 'terrestre' } as any);
    await render(<VolNouveauScreen />);
    await screen.findByText('Équipe Nord');

    await fireEvent.press(screen.getByTestId('vol-enregistrer'));

    expect(
      screen.getByText('• Un vol se mène avec une équipe aérienne : changez d’équipe de travail dans Paramètres.')
    ).toBeVisible();
  });
});
