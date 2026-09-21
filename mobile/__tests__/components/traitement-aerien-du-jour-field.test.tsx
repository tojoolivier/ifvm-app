/**
 * TraitementAerienDuJourField (#fiche-vol-vols-du-jour) — rattachement d'un vol
 * MEP/APPLICATION : le traitement aérien de la date du vol, puis sa cuve (rotation). Un vol
 * pointe une rotation, jamais le traitement lui-même.
 */
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TraitementAerienDuJourField } from '@/components/referentiel/TraitementAerienDuJourField';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';

jest.mock('@/lib/api-client', () => ({
  apiClient: {
    listTraitements: jest.fn(),
  },
}));

const TRAITEMENT = {
  id: 't-1',
  numero_fiche: 'CRT-042',
  localite: 'Betioky',
  type_traitement: 'AERIEN',
  date_traitement: '2026-09-21',
  aerien: {
    rotations: [
      { id: 'r-1', numero: 1, numero_cuve: '1', nom_commercial: 'Fyfanon' },
      { id: 'r-2', numero: 2, numero_cuve: '2', nom_commercial: 'Adonis' },
    ],
    blocs: [],
  },
};

describe('TraitementAerienDuJourField', () => {
  beforeEach(() => {
    useAuthStore.setState({ token: 'token-test' } as any);
    jest.mocked(apiClient.listTraitements).mockReset().mockResolvedValue([TRAITEMENT] as any);
  });

  it('liste les traitements aériens de la date du vol et remonte le choix (cuve remise à zéro)', async () => {
    const onTraitementChange = jest.fn();
    const onRotationChange = jest.fn();
    await render(
      <TraitementAerienDuJourField
        date="2026-09-21"
        traitement={null}
        rotationId={null}
        onTraitementChange={onTraitementChange}
        onRotationChange={onRotationChange}
      />
    );

    await screen.findByText('CRT-042 · Betioky');
    expect(apiClient.listTraitements).toHaveBeenCalledWith('token-test', {
      type_traitement: 'AERIEN',
      date_traitement: '2026-09-21',
    });

    await fireEvent.press(screen.getByText('CRT-042 · Betioky'));
    expect(onTraitementChange).toHaveBeenCalledWith(TRAITEMENT);
    expect(onRotationChange).toHaveBeenCalledWith(null);
  });

  it('propose les cuves du traitement choisi, en grisant celles déjà prises pour ce type de vol', async () => {
    const onRotationChange = jest.fn();
    await render(
      <TraitementAerienDuJourField
        date="2026-09-21"
        traitement={TRAITEMENT as any}
        rotationId={null}
        onTraitementChange={jest.fn()}
        onRotationChange={onRotationChange}
        rotationsIndisponibles={['r-1']}
      />
    );

    await screen.findByText('Cuve 2 · Adonis');
    expect(screen.getByText('Cuve 1 · Fyfanon (déjà prise)')).toBeTruthy();

    await fireEvent.press(screen.getByText('Cuve 1 · Fyfanon (déjà prise)'));
    expect(onRotationChange).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Cuve 2 · Adonis'));
    expect(onRotationChange).toHaveBeenCalledWith('r-2');
  });

  it("signale qu'aucun traitement aérien n'existe à cette date", async () => {
    jest.mocked(apiClient.listTraitements).mockResolvedValue([]);
    await render(
      <TraitementAerienDuJourField
        date="2026-09-21"
        traitement={null}
        rotationId={null}
        onTraitementChange={jest.fn()}
        onRotationChange={jest.fn()}
      />
    );

    await screen.findByText('Aucun traitement aérien à la date du 2026-09-21.');
  });
});
