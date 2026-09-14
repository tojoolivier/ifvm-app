/**
 * Fiche de Vol — B. Équipe (#fiche-vol). Pilote, chef de base et mécanicien
 * sont tous en saisie libre (décision produit du 2026-09-14, migration
 * backend 0064 pour chef de base) ; Consultant FAO reste facultatif.
 * Dernier slide construit pour l'instant : « Enregistrer » sauvegarde puis
 * revient à l'accueil, faute d'un slide C encore construit.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import FicheVolEquipeScreen from '@/app/(fiche-vol)/equipe';
import * as ficheVolRepository from '@/lib/fiche-vol-repository';

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockReplace = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack, replace: mockReplace }),
  useLocalSearchParams: () => ({ draftId: 'draft-123' }),
}));

jest.mock('@/lib/fiche-vol-repository', () => ({
  getFicheVol: jest.fn(),
  updateFicheVolEquipe: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

const DRAFT_VIDE = {
  id: 'draft-123',
  pilote: null,
  chef_de_base: null,
  consultant_international: null,
  mecanicien: null,
};

beforeEach(() => {
  mockPush.mockClear();
  mockBack.mockClear();
  mockReplace.mockClear();
  jest.mocked(ficheVolRepository.updateFicheVolEquipe).mockClear().mockResolvedValue({ id: 'draft-123' } as any);
});

describe('FicheVolEquipeScreen — saisie et restauration', () => {
  it('restaure les valeurs déjà enregistrées', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue({
      ...DRAFT_VIDE,
      pilote: 'Rakoto A.',
      chef_de_base: 'Rasoa C.',
      consultant_international: 'Dupont M.',
      mecanicien: 'Randria B.',
    } as any);

    await render(<FicheVolEquipeScreen />);

    expect(await screen.findByDisplayValue('Rakoto A.')).toBeVisible();
    expect(screen.getByDisplayValue('Rasoa C.')).toBeVisible();
    expect(screen.getByDisplayValue('Dupont M.')).toBeVisible();
    expect(screen.getByDisplayValue('Randria B.')).toBeVisible();
  });

  it('enregistre Pilote/Chef de Base/Mécanicien et navigue vers l’accueil', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue(DRAFT_VIDE as any);

    await render(<FicheVolEquipeScreen />);
    await waitFor(() => expect(screen.getByText('Enregistrer ✓')).toBeVisible());

    fireEvent.changeText(screen.getByPlaceholderText('Nom du pilote'), 'Rakoto A.');
    expect(await screen.findByDisplayValue('Rakoto A.')).toBeVisible();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du chef de base'), 'Rasoa C.');
    expect(await screen.findByDisplayValue('Rasoa C.')).toBeVisible();
    fireEvent.changeText(screen.getByPlaceholderText('Nom du mécanicien'), 'Randria B.');
    expect(await screen.findByDisplayValue('Randria B.')).toBeVisible();
    fireEvent.press(screen.getByText('Enregistrer ✓'));

    await waitFor(() =>
      expect(ficheVolRepository.updateFicheVolEquipe).toHaveBeenCalledWith('draft-123', {
        pilote: 'Rakoto A.',
        chefDeBase: 'Rasoa C.',
        consultantInternational: null,
        mecanicien: 'Randria B.',
      })
    );
    expect(mockReplace).toHaveBeenCalledWith('/(app)');
  });

  it('Consultant FAO facultatif : accepte un enregistrement sans le renseigner', async () => {
    jest.mocked(ficheVolRepository.getFicheVol).mockResolvedValue(DRAFT_VIDE as any);

    await render(<FicheVolEquipeScreen />);
    await waitFor(() => expect(screen.getByText('Enregistrer ✓')).toBeVisible());

    fireEvent.press(screen.getByText('Enregistrer ✓'));

    await waitFor(() =>
      expect(ficheVolRepository.updateFicheVolEquipe).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ consultantInternational: null })
      )
    );
  });
});
