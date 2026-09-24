/**
 * Choix Terrestre/Aérien — deux points d'entrée :
 * - depuis `type-chooser.tsx` (pas de `draftId`) : crée un nouveau brouillon extensif.
 * - depuis `extensive-signalement.tsx` (« Vérifier un signalement », `draftId` déjà
 *   présent) : le brouillon existe déjà (type_prospection = 'validation', champs de
 *   signalement déjà enregistrés) — ce choix doit fixer son `mode_extensif` sans en
 *   recréer un second (sinon les champs de signalement saisis seraient perdus).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveModeChooserScreen from '@/app/(prospection)/extensive-mode-chooser';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockReplace = jest.fn();
let mockParams: Record<string, string> = {};

/** Laisse le re-rendu déclenché par un premier `fireEvent.press` se poser avant
 * le suivant — sinon le second press (ex. « Continuer ») retrouve le bouton
 * encore désactivé sur l'arbre précédent (cf. convention `extensive-imagos-screen.test.tsx`). */
const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: mockReplace, canGoBack: () => true }),
  useLocalSearchParams: () => mockParams,
}));

jest.mock('@/lib/prospection-accueil', () => ({
  startNewProspection: jest.fn(),
}));

jest.mock('@/lib/prospection-repository', () => ({
  setProspectionModeExtensif: jest.fn(),
  getProspection: jest.fn().mockResolvedValue({ id: 'draft-999' }),
  listAllProspectionCaptures: jest.fn().mockResolvedValue([]),
}));

describe('ExtensiveModeChooserScreen', () => {
  beforeEach(() => {
    mockParams = {};
    mockReplace.mockClear();
    jest.mocked(startNewProspection).mockClear();
    jest.mocked(prospectionRepository.setProspectionModeExtensif).mockClear();
    useAuthStore.setState({ token: 'tok-1', user: { id: 'u1' } as any, isAuthenticated: true });
  });

  it('sans draftId (entrée normale) : crée un nouveau brouillon extensif au mode choisi', async () => {
    jest.mocked(startNewProspection).mockResolvedValue({ id: 'nouveau-draft' } as any);

    await render(<ExtensiveModeChooserScreen />);

    fireEvent.press(screen.getByText('Prospection Terrestre'));
    await settle();
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() =>
      expect(startNewProspection).toHaveBeenCalledWith(
        expect.objectContaining({ typeProspection: 'extensive', modeExtensif: 'terrestre' })
      )
    );
    expect(prospectionRepository.setProspectionModeExtensif).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(prospection)/extensive-reference',
        params: { draftId: 'nouveau-draft' },
      })
    );
  });

  it('avec draftId (depuis « Vérifier un signalement ») : fixe le mode sur le brouillon existant, n’en crée pas un second', async () => {
    mockParams = { draftId: 'draft-validation-1' };
    jest.mocked(prospectionRepository.setProspectionModeExtensif).mockResolvedValue({ id: 'draft-validation-1' } as any);

    await render(<ExtensiveModeChooserScreen />);

    fireEvent.press(screen.getByText('Prospection Aérienne'));
    await settle();
    fireEvent.press(screen.getByText('Continuer'));

    await waitFor(() =>
      expect(prospectionRepository.setProspectionModeExtensif).toHaveBeenCalledWith('draft-validation-1', 'aerien', null)
    );
    expect(startNewProspection).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/(prospection)/extensive-reference',
        params: { draftId: 'draft-validation-1' },
      })
    );
  });

  it('bouton Continuer désactivé tant qu’aucun mode n’est choisi', async () => {
    await render(<ExtensiveModeChooserScreen />);

    fireEvent.press(screen.getByText('Continuer'));

    expect(startNewProspection).not.toHaveBeenCalled();
    expect(prospectionRepository.setProspectionModeExtensif).not.toHaveBeenCalled();
  });
});
