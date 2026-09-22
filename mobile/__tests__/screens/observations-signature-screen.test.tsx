/**
 * Prospection Intensive — dernier slide « Observations » : le champ « Photo »
 * (jamais câblé — aucune capture, aucune persistance) est remplacé par un
 * champ « Signature » qui affiche automatiquement le nom de l'utilisateur
 * connecté (jamais ressaisi) et capture un tracé numérique
 * (`SignaturePad`) avec VALIDER/MODIFIER — même mécanique que
 * extensive-observations.tsx (`signature_visa_*`, colonnes historiquement
 * mortes pour l'Intensif, cf. migration 0082).
 *
 * Fichier séparé de `observations-screen.test.tsx` (restauration des champs
 * pluie/dégâts/ennemis/observation) : même précaution que les suites
 * extensive-observations-*, un seul sujet par fichier.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ObservationsScreen from '@/app/(prospection)/observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAuthStore } from '@/lib/auth-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionObservations: jest.fn().mockResolvedValue({ id: 'draft-123' }),
}));

/**
 * `SignaturePad` s'appuie sur `PanResponder` (gestes tactiles bruts) — hors de
 * portée d'une simulation RNTL fidèle. Même remplacement que les suites
 * extensive-observations-*-signatures-screen.test.tsx : un bouton pressable
 * simule un tracé complet en un geste, en respectant le contrat réel
 * (`value`/`onChange`/`readOnly`/`testID`).
 */
jest.mock('@/components/traitement/SignaturePad', () => {
  const React = require('react');
  const { Text, TouchableOpacity } = require('react-native');
  function SignaturePad({ value, onChange, readOnly, testID }: any) {
    if (readOnly) {
      return <Text testID={testID}>{`trace:${value}`}</Text>;
    }
    return (
      <TouchableOpacity testID={testID} onPress={() => onChange('M0 0 L1 1')}>
        <Text>dessiner</Text>
      </TouchableOpacity>
    );
  }
  return { SignaturePad };
});

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ObservationsScreen — Signature (remplace Photo)', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionObservations).mockClear().mockResolvedValue({ id: 'draft-123' } as any);
    useAuthStore.setState({ user: { id: 'u1', nom: 'Rakoto', prenom: 'Jean', email: 'j@x.mg', role: 'prospecteur', actif: true } as any });
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'intensive', degats_cultures: 'moyens' } as any,
      captures: [],
    });
  });

  it("n'affiche plus le champ Photo", async () => {
    await render(<ObservationsScreen />);
    await screen.findByText('Signature');
    expect(screen.queryByText('Photo')).toBeNull();
    expect(screen.queryByText('+ Photo')).toBeNull();
  });

  it("affiche automatiquement le nom de l'utilisateur connecté, jamais un champ à saisir", async () => {
    await render(<ObservationsScreen />);
    expect(await screen.findByText('Jean Rakoto')).toBeVisible();
  });

  it('VALIDER est désactivé tant qu’aucun tracé n’a été dessiné', async () => {
    await render(<ObservationsScreen />);
    await screen.findByTestId('signature-pad-visa');

    fireEvent.press(screen.getByText('VALIDER'));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(prospectionRepository.updateProspectionObservations).not.toHaveBeenCalled();
  });

  it('VALIDER persiste immédiatement la signature (nom auto + tracé + horodatage), puis bascule en lecture seule avec MODIFIER', async () => {
    await render(<ObservationsScreen />);
    fireEvent.press(await screen.findByTestId('signature-pad-visa'));
    await settle();
    fireEvent.press(screen.getByText('VALIDER'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureVisaNom: 'Jean Rakoto',
          signatureVisaImage: 'M0 0 L1 1',
        })
      )
    );
    const [, payload] = jest.mocked(prospectionRepository.updateProspectionObservations).mock.calls[0];
    expect(payload.signatureVisaHorodatage).not.toBeNull();

    expect(await screen.findByText('MODIFIER')).toBeVisible();
    expect(screen.getByTestId('signature-pad-visa')).toHaveTextContent('trace:M0 0 L1 1');
    expect(screen.queryByText('VALIDER')).toBeNull();
  });

  it('MODIFIER repart d’un tracé vierge sans perdre la signature déjà validée tant que VALIDER n’est pas repressé', async () => {
    await render(<ObservationsScreen />);
    fireEvent.press(await screen.findByTestId('signature-pad-visa'));
    await settle();
    fireEvent.press(screen.getByText('VALIDER'));
    await screen.findByText('MODIFIER');

    fireEvent.press(screen.getByText('MODIFIER'));

    // Retour en édition : le pavé repart vierge (non en lecture seule).
    await waitFor(() => expect(screen.getByText('dessiner')).toBeVisible());
    expect(screen.getByText('VALIDER')).toBeTruthy();
  });

  it('restaure une signature déjà enregistrée pour cette fiche (lecture seule + MODIFIER) dès le montage', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        degats_cultures: 'moyens',
        signature_visa_nom: 'Jean Rakoto',
        signature_visa_horodatage: '2026-09-20T08:00:00.000Z',
        signature_visa_image: 'M5 5 L6 6',
      } as any,
      captures: [],
    });

    await render(<ObservationsScreen />);

    expect(await screen.findByText('MODIFIER')).toBeVisible();
    expect(screen.getByTestId('signature-pad-visa')).toHaveTextContent('trace:M5 5 L6 6');
    expect(screen.queryByText('VALIDER')).toBeNull();
  });

  it('« Vérifier & enregistrer » renvoie la signature déjà validée sans la ressaisir', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'intensive',
        degats_cultures: 'moyens',
        signature_visa_nom: 'Jean Rakoto',
        signature_visa_horodatage: '2026-09-20T08:00:00.000Z',
        signature_visa_image: 'M5 5 L6 6',
      } as any,
      captures: [],
    });

    await render(<ObservationsScreen />);
    await screen.findByText('MODIFIER');

    fireEvent.press(screen.getByText('Vérifier & enregistrer ✓'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          signatureVisaNom: 'Jean Rakoto',
          signatureVisaHorodatage: '2026-09-20T08:00:00.000Z',
          signatureVisaImage: 'M5 5 L6 6',
        })
      )
    );
  });
});
