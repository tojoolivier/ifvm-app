import { creerOutbox } from '../src/lib/outbox';

function baseEspion() {
  const runAsync = jest.fn().mockResolvedValue(undefined);
  return { runAsync, base: () => Promise.resolve({ runAsync } as never) };
}

describe('outbox', () => {
  it('marque une saisie synchronisée ou en échec par son id', async () => {
    const { runAsync, base } = baseEspion();
    const outbox = creerOutbox({ table: 'vol', base });

    await outbox.marquerSynchronise('v1');
    await outbox.marquerEnEchec('v2');

    expect(runAsync).toHaveBeenNthCalledWith(1, "UPDATE vol SET statut_sync = 'synced' WHERE id = ?", ['v1']);
    expect(runAsync).toHaveBeenNthCalledWith(2, "UPDATE vol SET statut_sync = 'echec' WHERE id = ?", ['v2']);
  });

  it('rafraîchit updated_at quand la table le porte', async () => {
    const { runAsync, base } = baseEspion();

    await creerOutbox({ table: 'prospection', base, horodate: true }).marquerEnEchec('p1');

    expect(runAsync).toHaveBeenCalledWith(
      "UPDATE prospection SET statut_sync = 'echec', updated_at = ? WHERE id = ?",
      [expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/), 'p1']
    );
  });

  it('ouvre la base à chaque écriture, pas à la création', async () => {
    const base = jest.fn().mockResolvedValue({ runAsync: jest.fn() });
    const outbox = creerOutbox({ table: 'vol', base });
    expect(base).not.toHaveBeenCalled();

    await outbox.marquerSynchronise('v1');

    expect(base).toHaveBeenCalledTimes(1);
  });
});
