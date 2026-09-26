/** Nouvel appareil (#642) : un refus 409 du serveur s'affiche tel quel (#673). */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AeronefNouveauScreen from '@/app/(app)/aeronef-nouveau';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { NetworkError } from '@/lib/errors';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('@/lib/referentiel-sync', () => ({ pullReferentiel: jest.fn() }));
jest.mock('@/lib/storage', () => ({ storage: { getItem: jest.fn(), setItem: jest.fn(), deleteItem: jest.fn() } }));
jest.mock('@/lib/api-client', () => ({
  ...jest.requireActual('@/lib/api-client'),
  apiClient: { createAeronef: jest.fn() },
}));

function refus409(message: string) {
  const erreur = new NetworkError(message);
  (erreur as unknown as { status: number }).status = 409;
  return erreur;
}

beforeEach(() => {
  useAuthStore.setState({ token: 'jeton', user: { id: 'u-1', role: 'admin' } } as any);
});

describe('AeronefNouveauScreen', () => {
  it('affiche le message du serveur quand l’immatriculation est déjà prise', async () => {
    jest.mocked(apiClient.createAeronef).mockRejectedValue(refus409('immatriculation déjà utilisée'));
    await render(<AeronefNouveauScreen />);

    await fireEvent.changeText(screen.getByLabelText('Immatriculation'), '5R-MJK');
    await fireEvent.changeText(screen.getByLabelText('Société'), 'Air Mada');
    await fireEvent.changeText(screen.getByLabelText('Volume de cuve en litres'), '1200');
    await fireEvent.press(screen.getByText('Ajouter l’appareil'));

    await waitFor(() => expect(screen.getByText('• immatriculation déjà utilisée')).toBeVisible());
  });

  it('refuse l’accès à un non-administrateur', async () => {
    useAuthStore.setState({ token: 'jeton', user: { id: 'u-1', role: 'pilote' } } as any);
    await render(<AeronefNouveauScreen />);

    expect(screen.getByText('Réservé à l’administrateur.')).toBeVisible();
  });
});
