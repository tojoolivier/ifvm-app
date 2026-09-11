/**
 * Surface infestée (ha) : une fiche doit toujours en avoir une, valeur unique
 * commune à LMC et NSE (une observation de terrain ne porte que sur une seule
 * espèce à la fois, cf. CONTEXT.md — aucune ventilation par espèce n'existe
 * pour ce champ). Obligatoire pour toute fiche non intensive (extensive comme
 * validation, seules à passer par extensive-reference.tsx).
 *
 * Fichier séparé (un seul montage d'écran par fichier) — même mise en garde
 * que extensive-reference-screen-restore.test.tsx (fuite de la chaîne de
 * promesses GPS entre tests d'un même fichier).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import ExtensiveReferenceScreen from '@/app/(prospection)/extensive-reference';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveReference: jest.fn().mockResolvedValue({ id: 'draft-123' }),
  listOperationsAeriennes: jest.fn().mockResolvedValue([]),
  saveOperationsAeriennes: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('@/lib/location', () => ({
  getCurrentPosition: jest.fn().mockResolvedValue({ latitude: -18.9, longitude: 47.5, altitude: null, accuracy: 5, timestamp: Date.now() }),
}));

describe('ExtensiveReferenceScreen — surface infestée obligatoire', () => {
  beforeEach(() => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'extensive', date_prospection: '2026-08-25' } as any,
      captures: [],
    });
  });

  it('bloque « Suivant » avec un message si la surface infestée est vide', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await render(<ExtensiveReferenceScreen />);
    await waitFor(() => expect(screen.getByText('Suivant : Imagos ›')).toBeVisible());

    fireEvent.press(screen.getByText('Suivant : Imagos ›'));

    expect(alertSpy).toHaveBeenCalledWith('Surface infestée requise', expect.any(String));
    expect(prospectionRepository.updateProspectionExtensiveReference).not.toHaveBeenCalled();
  });
});
