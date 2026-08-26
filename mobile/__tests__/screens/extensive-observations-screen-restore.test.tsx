/**
 * Non-régression — harmonisation Extensive/Intensive : mêmes `useState(draft?.x)`
 * d'initialisation qu'`extensive-reference.tsx`, sans restauration si `draft` n'est
 * hydraté qu'après le montage de l'écran. Un « Continuer » à ce moment-là écrasait
 * dégâts/verdure/hauteur/pluie/intensité déjà enregistrés par les valeurs par défaut.
 */
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import ExtensiveObservationsScreen from '@/app/(prospection)/extensive-observations';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import * as prospectionRepository from '@/lib/prospection-repository';

jest.mock('expo-router', () =>
  require('../test-utils/mock-expo-router').expoRouterMock({ params: { draftId: 'draft-123' } })
);

jest.mock('@/lib/prospection-repository', () => ({
  updateProspectionExtensiveObservations: jest.fn().mockResolvedValue({
    id: 'draft-123',
    degats_cultures_pourcent: 30,
    verdure_strate: 'forte',
    hauteur_herbe_cm: 45,
    derniere_pluie: '2026-08-20',
    intensite_pluie: 'forte',
  }),
}));

describe('ExtensiveObservationsScreen — restauration après hydratation tardive du draft', () => {
  beforeEach(() => {
    jest.mocked(prospectionRepository.updateProspectionExtensiveObservations).mockClear();
    useProspectionWizardStore.setState({ draft: null, captures: [] });
  });

  it("restaure dégâts/verdure/hauteur/pluie/intensité quand le draft n'est disponible qu'après le montage", async () => {
    await render(<ExtensiveObservationsScreen />);

    // 45 cm affichés/saisis en mètres (0,45 m) — la colonne reste en cm (partagée avec
    // l'intensif), seule l'unité à l'écran change.
    expect(screen.queryByDisplayValue('0.45')).toBeNull();

    await act(async () => {
      useProspectionWizardStore.setState({
        draft: {
          id: 'draft-123',
          type_prospection: 'extensive',
          degats_cultures_pourcent: 30,
          verdure_strate: 'forte',
          hauteur_herbe_cm: 45,
          derniere_pluie: '2026-08-20',
          intensite_pluie: 'forte',
        } as any,
        captures: [],
      });
    });

    await waitFor(() => expect(screen.getByDisplayValue('30')).toBeVisible());
    expect(screen.getByDisplayValue('0.45')).toBeVisible();
    // « Forte » apparaît deux fois (Verdure et Intensité) : les deux doivent être actives.
    for (const active of screen.getAllByText('Forte')) {
      expect(active.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ color: '#fff' })]));
    }

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          degatsCulturesPourcent: 30,
          verdureStrate: 'forte',
          hauteurHerbeCm: 45,
          dernierePluie: '2026-08-20',
          intensitePluie: 'forte',
        })
      )
    );
  });

  it("H STR HERB : une saisie décimale en mètres (1,25 m) est convertie et enregistrée en centimètres (125 cm)", async () => {
    useProspectionWizardStore.setState({ draft: { id: 'draft-123', type_prospection: 'extensive' } as any, captures: [] });

    await render(<ExtensiveObservationsScreen />);
    await screen.findByText('H Str Herb (m)');

    fireEvent.changeText(screen.getByDisplayValue(''), '1.25');
    expect(await screen.findByDisplayValue('1.25')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ hauteurHerbeCm: 125 })
      )
    );
  });

  /**
   * Non-régression explicite (#228) : « H STR HERB (m) » doit rester préaffiché et
   * modifiable sans effacer le reste de la fiche — reproduit exactement le scénario
   * donné par l'utilisateur (1.25 m → 1.50 m après modification, ni arrondi ni entier).
   */
  it('modification d’une fiche existante : H STR HERB préaffiché à 1.25 m, modifié à 1.50 m sans effacer les autres champs déjà enregistrés', async () => {
    useProspectionWizardStore.setState({
      draft: {
        id: 'draft-123',
        type_prospection: 'extensive',
        degats_cultures_pourcent: 30,
        verdure_strate: 'forte',
        hauteur_herbe_cm: 125,
        derniere_pluie: '2026-08-20',
        intensite_pluie: 'forte',
      } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    // Préaffiché avec la valeur enregistrée, convertie en mètres — jamais 0/vide/arrondie à l'entier.
    expect(await screen.findByDisplayValue('1.25')).toBeVisible();

    fireEvent.changeText(screen.getByDisplayValue('1.25'), '1.5');
    expect(await screen.findByDisplayValue('1.5')).toBeVisible();

    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({
          // Nouvelle valeur bien enregistrée…
          hauteurHerbeCm: 150,
          // …et tous les autres champs déjà présents avant la modification survivent tels quels.
          degatsCulturesPourcent: 30,
          verdureStrate: 'forte',
          dernierePluie: '2026-08-20',
          intensitePluie: 'forte',
        })
      )
    );
  });

  /**
   * La fiche Signalement (type_prospection = 'validation') passe par exactement le
   * même écran/mêmes fonctions que l'Extensive — cf. `getProspectionEditRoute` dans
   * `fiche-routing.ts`, qui route les deux vers `extensive-reference`. Ce test le
   * vérifie explicitement : rien dans cet écran ne dépend de `type_prospection`, donc
   * le même round-trip s'applique aux fiches Signalement.
   */
  it('fiche Signalement (validation) : même préaffichage et même round-trip de H STR HERB que l’Extensive', async () => {
    useProspectionWizardStore.setState({
      draft: { id: 'draft-123', type_prospection: 'validation', hauteur_herbe_cm: 125 } as any,
      captures: [],
    });

    await render(<ExtensiveObservationsScreen />);
    expect(await screen.findByDisplayValue('1.25')).toBeVisible();

    fireEvent.changeText(screen.getByDisplayValue('1.25'), '1.5');
    expect(await screen.findByDisplayValue('1.5')).toBeVisible();
    fireEvent.press(screen.getByText('Suivant : Récapitulatif ›'));

    await waitFor(() =>
      expect(prospectionRepository.updateProspectionExtensiveObservations).toHaveBeenCalledWith(
        'draft-123',
        expect.objectContaining({ hauteurHerbeCm: 150 })
      )
    );
  });
});
