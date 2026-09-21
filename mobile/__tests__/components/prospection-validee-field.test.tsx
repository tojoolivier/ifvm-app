/**
 * ProspectionValideeField — deux usages :
 * - référence d'en-tête d'une fiche de vol (comportement historique : prospections
 *   validées, toutes dates, chargées au tap) ;
 * - prospection du jour d'un vol PROSPECTION (#fiche-vol-vols-du-jour) : filtrée sur la
 *   date du vol, tous statuts, chargée d'emblée.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ProspectionValideeField } from '@/components/referentiel/ProspectionValideeField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listProspections: jest.fn(),
  },
}));

const PROSPECTION_DU_JOUR = {
  id: 'p-1',
  n_fiche: 'F-001',
  n_message: null,
  date_prospection: '2026-09-21',
  validated_at: null,
  region: 'Atsimo-Andrefana',
  district: 'Betioky',
  commune: 'Ankazomanga',
};

describe('ProspectionValideeField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listProspections).mockReset().mockResolvedValue([PROSPECTION_DU_JOUR] as any);
  });

  it("mode historique : ne charge qu'au tap, uniquement les prospections validées", async () => {
    await render(<ProspectionValideeField value={null} onChange={jest.fn()} />);

    expect(apiClient.listProspections).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByText('Choisir une fiche de prospection validée ›'));

    await screen.findByText(/F-001/);
    expect(apiClient.listProspections).toHaveBeenCalledWith('token-test', { statut: 'validee' });
  });

  it('mode « du jour » : charge d’emblée les prospections de la date, tous statuts, et remonte le choix', async () => {
    const onChange = jest.fn();
    await render(
      <ProspectionValideeField value={null} onChange={onChange} date="2026-09-21" statut={null} label="Fiche de prospection du jour" />
    );

    await screen.findByText(/F-001/);
    expect(apiClient.listProspections).toHaveBeenCalledWith('token-test', { date_prospection: '2026-09-21' });
    expect(screen.getByText('Fiche de prospection du jour')).toBeTruthy();

    await fireEvent.press(screen.getByText(/F-001/));
    expect(onChange).toHaveBeenCalledWith('p-1', expect.objectContaining({ id: 'p-1', n_fiche: 'F-001' }));
  });

  it('mode « du jour » : indique clairement qu’aucune prospection n’existe à cette date', async () => {
    jest.mocked(apiClient.listProspections).mockResolvedValue([]);
    await render(<ProspectionValideeField value={null} onChange={jest.fn()} date="2026-09-21" statut={null} />);

    await waitFor(() => expect(screen.getByText('Aucune fiche de prospection à la date du 2026-09-21.')).toBeTruthy());
  });
});
