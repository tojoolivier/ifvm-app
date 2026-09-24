import fs from 'fs';
import path from 'path';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { genererModule, verifierFraicheur } = require('../scripts/referentiel-schema');

const SOURCE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'lib', 'api-schema.generated.ts'),
  'utf8'
);
const COMMITE = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'lib', 'referentiel-schema.generated.ts'),
  'utf8'
);

/** Ajoute un champ requis au schéma Pydantic de l'aéronef dans un contrat simulé. */
function contratAvecChampEnPlus(nom: string): string {
  return SOURCE.replace(
    /(AeronefSyncRead: \{[\s\S]*?\n {12}deleted_at\?: string \| null;\n)/,
    `$1            /** Nouveau */\n            ${nom}: string;\n`
  );
}

describe('générateur du DDL du référentiel (#675)', () => {
  it('le module committé correspond au contrat actuel', () => {
    expect(verifierFraicheur(SOURCE, COMMITE)).toBeNull();
  });

  it('mappe les types du contrat et la nullabilité depuis `required`', () => {
    expect(COMMITE).toMatch(/altitude REAL,\n/); // number | null
    expect(COMMITE).toMatch(/latitude REAL NOT NULL/);
    expect(COMMITE).toMatch(/actif INTEGER NOT NULL/); // boolean
    expect(COMMITE).toMatch(/updated_at TEXT NOT NULL/); // date-time
    expect(COMMITE).toMatch(/equipe_aerienne_id TEXT,\n/); // optionnel
  });

  it("n'inclut pas deleted_at (purgé au pull) et garde la couche locale déclarée", () => {
    expect(COMMITE).not.toContain('deleted_at');
    expect(COMMITE).toContain("statut_sync TEXT NOT NULL DEFAULT 'synced'");
    expect(COMMITE).toContain('CREATE INDEX IF NOT EXISTS ix_site_aerien_equipe_id');
    expect(COMMITE).toContain('PRIMARY KEY (equipe_id, user_id)');
  });

  it('un champ du contrat non couvert fait échouer le check tant que le DDL n’est pas régénéré', () => {
    const contrat = contratAvecChampEnPlus('nouveau_champ');

    const probleme = verifierFraicheur(contrat, COMMITE);

    expect(probleme).toContain('nouveau_champ TEXT NOT NULL');
    expect(genererModule(contrat)).toContain('nouveau_champ TEXT NOT NULL');
  });

  it('un schéma *SyncRead ni miroité ni ignoré fait échouer la génération', () => {
    const contrat = SOURCE.replace(
      '        AeronefSyncRead: {',
      '        HangarSyncRead: {\n            id: string;\n        };\n        AeronefSyncRead: {'
    );

    expect(() => genererModule(contrat)).toThrow(/HangarSyncRead/);
  });

  it('un champ omis qui a disparu du contrat fait échouer la génération', () => {
    const contrat = SOURCE.replace(
      /(EquipeMembreSyncRead: \{[\s\S]*?)\n {12}created_at: string;/,
      '$1'
    );

    expect(() => genererModule(contrat)).toThrow(/created_at/);
  });

  it('un type sans correspondance SQLite est refusé plutôt que deviné', () => {
    const contrat = contratAvecChampEnPlus('bizarre').replace('bizarre: string;', 'bizarre: Date;');

    expect(() => genererModule(contrat)).toThrow(/Date/);
  });
});
