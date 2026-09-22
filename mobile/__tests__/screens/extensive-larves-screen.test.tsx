/**
 * Non-régression : « Suivant » sur extensive-larves.tsx routait directement vers
 * extensive-recap.tsx, sautant entièrement extensive-observations.tsx — un écran par
 * ailleurs déjà écrit (et déjà attendu par le récapitulatif, bloc « D · Observations »)
 * mais qu'aucune navigation ne rendait atteignable.
 *
 * Non-régression : cet écran avait sa propre liste de stades locale (L1-L8 pour LMC,
 * en désaccord avec `stadesLarvairesFor` — la source canonique, L1-L5 pour LMC) — LMC
 * ne va jamais au-delà de L5.
 */
import { Alert } from 'react-native';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import ExtensiveLarvesScreen from '@/app/(prospection)/extensive-larves';
import * as prospectionRepository from '@/lib/prospection-repository';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
  useLocalSearchParams: () => ({ draftId: 'draft-123' }),
}));

jest.mock('@/lib/prospection-repository', () => ({
  getProspectionPopulation: jest.fn().mockResolvedValue(null),
  saveProspectionPopulation: jest.fn().mockResolvedValue(undefined),
}));

const settle = () => new Promise((resolve) => setTimeout(resolve, 20));

describe('ExtensiveLarvesScreen', () => {
  afterEach(cleanup);
  beforeEach(() => {
    mockPush.mockClear();
    jest.mocked(prospectionRepository.saveProspectionPopulation).mockClear();
    jest.mocked(prospectionRepository.getProspectionPopulation).mockResolvedValue(null);
    // #confirmation-espece-sans-donnee : la plupart de ces scénarios ne renseignent
    // qu'une espèce (LMC), ce qui est précisément leur objet — pas celui de ce
    // fichier de test. Confirme automatiquement le modal d'avertissement pour
    // laisser les scénarios se dérouler comme avant son introduction ; les tests
    // dédiés au modal lui-même vivent dans leur propre fichier.
    jest.spyOn(Alert, 'alert').mockImplementation((_titre, _message, boutons) => {
      boutons?.find((b) => b.text === 'Continuer')?.onPress?.();
    });
  });

  it('« Suivant » route vers extensive-observations, pas directement vers le récapitulatif', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Observations');

    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({ pathname: '/(prospection)/extensive-observations', params: { draftId: 'draft-123' } })
      )
    );
  });

  it("LMC ne propose que L1 à L5 — L6/L7/L8 n'apparaissent plus", async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Stades');

    for (const stade of ['L1', 'L2', 'L3', 'L4', 'L5']) {
      expect(screen.getByText(stade)).toBeVisible();
    }
    expect(screen.queryByText('L6')).toBeNull();
    expect(screen.queryByText('L7')).toBeNull();
    expect(screen.queryByText('L8')).toBeNull();
  });

  it('NSE conserve ses propres stades (L1 à L7), inchangés', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📊 Stades');
    fireEvent.press(screen.getByText('NSE'));
    await settle();

    for (const stade of ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7']) {
      expect(screen.getByText(stade)).toBeVisible();
    }
    expect(screen.queryByText('L8')).toBeNull();
  });

  it('Surface contaminée (ha) se sauvegarde avec une valeur décimale et se restaure', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('Surface contaminée (ha)');
    await settle();

    fireEvent.changeText(screen.getByTestId('surface-contaminee-input'), '12.75');
    await settle();
    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', surface_contaminee_ha: 12.75 });
  });

  /**
   * Non-régression (#228) : contrairement aux imagos (cf. extensive-imagos-screen.test.tsx),
   * le détail des stades larvaires EST réellement persisté (`densites_larve`) — rouvrir une
   * fiche existante avec captures > 0 doit donc immédiatement repasser « cohérent » sans
   * ressaisie, « Suivant » ne doit jamais être bloqué par une donnée déjà enregistrée.
   */
  it('réouverture d’une fiche existante : Nombre de captures et stades déjà enregistrés restent cohérents, « Suivant » fonctionne sans ressaisie', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({
            espece: 'LMC',
            categorie: 'larve',
            captures_nombre: 25,
            captures_sol: 25,
            captures_trans: 0,
            captures_greg: 0,
            densites_larve: JSON.stringify({ L1: 25, L2: 0, L3: 0, L4: 0, L5: 0 }),
            // #densite-diffuse-obligatoire / #densite-groupee-obligatoire : déjà
            // enregistrées, comme le reste de cette ligne — ne doivent pas non plus
            // bloquer « Suivant » à la réouverture.
            densite_diffuse: 5,
            densite_groupee: 3,
          } as any)
        : ({ espece: 'NSE', categorie: 'larve', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveLarvesScreen />);
    expect(await screen.findByDisplayValue('25')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', captures_nombre: 25 });
  });

  /** #densite-diffuse-obligatoire retiré (demande explicite du 2026-09-14) :
   * même garde que sur extensive-imagos.tsx — « Suivant » n'est plus bloqué
   * par l'absence de densité diffuse. Phases/stades déjà cohérents dans la
   * fixture pour isoler cette seule règle. */
  it('laisse passer « Suivant » sans densité diffuse même avec des captures', async () => {
    jest.mocked(prospectionRepository.getProspectionPopulation).mockImplementation(async (_id, espece) =>
      espece === 'LMC'
        ? ({
            espece: 'LMC',
            categorie: 'larve',
            captures_nombre: 10,
            captures_sol: 10,
            captures_trans: 0,
            captures_greg: 0,
            densites_larve: JSON.stringify({ L1: 10, L2: 0, L3: 0, L4: 0, L5: 0 }),
            densite_groupee: 2,
          } as any)
        : ({ espece: 'NSE', categorie: 'larve', captures_nombre: 0 } as any)
    );

    await render(<ExtensiveLarvesScreen />);
    expect(await screen.findByDisplayValue('10')).toBeVisible();
    await settle();

    fireEvent.press(screen.getByText('Suivant : Observations ›'));
    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    expect(screen.queryByText('La densité diffuse (ind./ha) est obligatoire.')).toBeNull();
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({ espece: 'LMC', densite_diffuse: null, densite_groupee: 2 });
  });

  /**
   * Parcours interactif complet, fiche neuve (#nombre-de-capture-fiable), symétrique
   * du test équivalent d'extensive-imagos.tsx : taper le « Nombre total de captures »
   * puis distribuer phases ET stades via les compteurs +/- (contrairement aux imagos,
   * les stades sont bien persistés pour les larves — les deux répartitions sont donc
   * exigées ici, cf. isConsistent = isPhasesConsistent && isStadesConsistent).
   */
  it('saisie interactive : taper 5 dans « Nombre total de captures » puis distribuer phases et stades sauvegarde captures_nombre = 5', async () => {
    await render(<ExtensiveLarvesScreen />);
    await screen.findByText('📝 Nombre total de captures');
    await settle();

    fireEvent.changeText(screen.getByDisplayValue('0'), '5');
    await settle();

    // Les compteurs +/- des phases et des stades sont visibles sans activation
    // préalable (contrairement aux imagos) : « + » Solitaire (phase, index 0) et
    // « + » L1 (premier stade, juste après les 3 phases, index 3).
    for (let i = 0; i < 5; i++) {
      fireEvent.press(screen.getAllByText('+')[0]);
       
      await settle();
    }
    for (let i = 0; i < 5; i++) {
      fireEvent.press(screen.getAllByText('+')[3]);
       
      await settle();
    }
    expect(screen.getAllByText('5 ✅').length).toBeGreaterThan(0);

    // Facultatives désormais, mais renseignées ici pour couvrir le cas nominal.
    const densiteInputs = screen.getAllByDisplayValue('');
    fireEvent.changeText(densiteInputs[0], '4');
    fireEvent.changeText(densiteInputs[1], '2');
    await settle();

    fireEvent.press(screen.getByText('Suivant : Observations ›'));

    await waitFor(() => expect(prospectionRepository.saveProspectionPopulation).toHaveBeenCalledTimes(2));
    const [, lmcRow] = jest.mocked(prospectionRepository.saveProspectionPopulation).mock.calls[0];
    expect(lmcRow).toMatchObject({
      espece: 'LMC',
      captures_nombre: 5,
      captures_sol: 5,
      captures_trans: 0,
      captures_greg: 0,
      densite_diffuse: 4,
      densite_groupee: 2,
    });
    expect(JSON.parse(lmcRow.densites_larve as string)).toMatchObject({ L1: 5 });
  });
});
