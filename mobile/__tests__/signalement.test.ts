/**
 * Parcours de signalement et export — ADR-012 décision 7, issue #176.
 *
 * Ces tests protègent trois décisions, pas seulement du code :
 *
 * 1. **L'en-tête est la première ligne**, pour que le support lise tout le
 *    contexte d'un `head -1`.
 * 2. **Une troncature ne se fait jamais en silence** : elle est comptée dans
 *    l'en-tête. Un rapport amputé sans le dire serait exactement la famille de
 *    bugs qu'ADR-012 éradique.
 * 3. **`flush()` précède la lecture** : les lignes de l'incident sont encore
 *    dans l'anneau mémoire au moment où l'agent appuie sur « Signaler ».
 */
import { LocalWriteError } from '@/lib/errors';
import type { LogLine } from '@/lib/logger';
import {
  construireRapport,
  envoyerSignalement,
  LONGUEUR_MAX_COMMENTAIRE,
  nomDuFichier,
  octetsUtf8,
  PLAFOND_OCTETS,
  type BaseEntete,
  type Entete,
  type SignalementDeps,
} from '@/lib/signalement';

function ligne(n: number, extra: Partial<LogLine> = {}): LogLine {
  return {
    at: `2026-08-25T10:00:${String(n).padStart(2, '0')}.000Z`,
    cid: 'ABC123',
    level: 'info',
    event: `evenement-${n}`,
    ...extra,
  };
}

const BASE: BaseEntete = {
  generatedAt: '2026-08-25T10:30:00.000Z',
  correlationId: 'ABC123',
  app: { version: '1.0.0', build: '42', runtime: '56.0.0' },
  appareil: { marque: 'Samsung', modele: 'SM-A047F', os: 'Android', osVersion: '13' },
  agent: { id: '7', nom: 'Rakoto', prenom: 'Jean', role: 'prospecteur' },
  commentaire: null,
};

function lireEntete(rapport: string): Entete {
  return JSON.parse(rapport.split('\n')[0]) as Entete;
}

function lireCorps(rapport: string): LogLine[] {
  return rapport
    .split('\n')
    .slice(1)
    .filter((l) => l !== '')
    .map((l) => JSON.parse(l) as LogLine);
}

describe('octetsUtf8', () => {
  // Hermes ne garantit pas `TextEncoder` ; le plafond est une contrainte
  // physique (WhatsApp, 2G rurale) et ne peut pas dépendre d'un global absent.
  it('compte les octets, pas les unités de code', () => {
    expect(octetsUtf8('abc')).toBe(3);
    expect(octetsUtf8('éà')).toBe(4);
    expect(octetsUtf8('€')).toBe(3);
    expect(octetsUtf8('🦗')).toBe(4);
  });
});

describe('construireRapport', () => {
  it('met l’en-tête en première ligne, et c’est du JSON', () => {
    const rapport = construireRapport({ base: BASE, lignes: [ligne(1), ligne(2)] });

    const entete = lireEntete(rapport);
    expect(entete.type).toBe('entete');
    expect(entete.correlationId).toBe('ABC123');
    expect(entete.app.version).toBe('1.0.0');
    expect(entete.appareil.modele).toBe('SM-A047F');
    expect(entete.agent?.nom).toBe('Rakoto');
  });

  it('produit du .jsonl valide : un objet par ligne', () => {
    const rapport = construireRapport({ base: BASE, lignes: [ligne(1), ligne(2), ligne(3)] });

    const lignes = rapport.split('\n').filter((l) => l !== '');
    expect(lignes).toHaveLength(4);
    for (const l of lignes) expect(() => JSON.parse(l)).not.toThrow();
  });

  it('garde l’ordre chronologique du journal', () => {
    const rapport = construireRapport({ base: BASE, lignes: [ligne(1), ligne(2), ligne(3)] });

    expect(lireCorps(rapport).map((l) => l.event)).toEqual([
      'evenement-1',
      'evenement-2',
      'evenement-3',
    ]);
  });

  it('annonce zéro troncature quand tout tient', () => {
    const rapport = construireRapport({ base: BASE, lignes: [ligne(1), ligne(2)] });

    const entete = lireEntete(rapport);
    expect(entete.lignes).toBe(2);
    expect(entete.tronquees).toBe(0);
  });

  it('accepte un journal vide — un rapport sans ligne reste un rapport', () => {
    const rapport = construireRapport({ base: BASE, lignes: [] });

    expect(lireEntete(rapport).lignes).toBe(0);
    expect(lireCorps(rapport)).toEqual([]);
  });

  it('porte le commentaire de l’agent', () => {
    const rapport = construireRapport({
      base: { ...BASE, commentaire: 'L’écran reste blanc après « Enregistrer ».' },
      lignes: [],
    });

    expect(lireEntete(rapport).commentaire).toBe('L’écran reste blanc après « Enregistrer ».');
  });

  describe('plafond', () => {
    const lignes = Array.from({ length: 50 }, (_, i) => ligne(i));

    it('ne dépasse jamais le plafond', () => {
      const rapport = construireRapport({ base: BASE, lignes, plafondOctets: 600 });

      expect(octetsUtf8(rapport)).toBeLessThanOrEqual(600);
    });

    it('garde les plus récentes — celles qui entourent l’incident', () => {
      const rapport = construireRapport({ base: BASE, lignes, plafondOctets: 600 });

      const corps = lireCorps(rapport);
      expect(corps.length).toBeGreaterThan(0);
      expect(corps[corps.length - 1].event).toBe('evenement-49');
    });

    it('compte les écartées dans l’en-tête plutôt que de les perdre en silence', () => {
      const rapport = construireRapport({ base: BASE, lignes, plafondOctets: 600 });

      const entete = lireEntete(rapport);
      const corps = lireCorps(rapport);
      expect(entete.lignes).toBe(corps.length);
      expect(entete.tronquees).toBe(50 - corps.length);
      expect(entete.tronquees).toBeGreaterThan(0);
    });

    it('reste lisible même quand l’en-tête seul remplit le plafond', () => {
      const rapport = construireRapport({ base: BASE, lignes, plafondOctets: 10 });

      expect(lireEntete(rapport).tronquees).toBe(50);
      expect(lireCorps(rapport)).toEqual([]);
    });

    it('vaut ~1 Mo par défaut : le fichier part sur WhatsApp en 2G', () => {
      expect(PLAFOND_OCTETS).toBe(1_000_000);
    });

    // Le plafond en octets n'est pas le seul endroit où des lignes se perdent :
    // `lireSession` en jette déjà en SQL, au-delà de `PLAFOND_LIGNES`. Sans
    // `totalSession`, l'en-tête déclarerait « 0 écartée » sur un rapport amputé
    // de 20 000 lignes — le silence même que la décision 7 supprime.
    it('compte aussi les lignes jetées en amont, avant même d’arriver ici', () => {
      const rapport = construireRapport({
        base: BASE,
        lignes: [ligne(1), ligne(2)],
        totalSession: 7000,
      });

      const entete = lireEntete(rapport);
      expect(entete.lignes).toBe(2);
      expect(entete.tronquees).toBe(6998);
    });

    it('borne le commentaire, sinon l’en-tête seul peut crever le plafond', () => {
      const rapport = construireRapport({
        base: { ...BASE, commentaire: 'a'.repeat(50_000) },
        lignes: [ligne(1)],
      });

      expect(octetsUtf8(rapport)).toBeLessThanOrEqual(PLAFOND_OCTETS);
      expect(lireEntete(rapport).commentaire).toHaveLength(LONGUEUR_MAX_COMMENTAIRE);
      // Le corps survit : c'est bien le commentaire qui cède, pas le journal.
      expect(lireCorps(rapport)).toHaveLength(1);
    });
  });

  // L'expurgation est posée à l'écriture, dans `sink()` — mais l'en-tête, lui,
  // n'est jamais passé par `sink()`. Il est le seul texte du rapport qui
  // n'aurait aucun filtre si on ne le repassait pas ici.
  it('expurge l’en-tête, seul contenu qui n’est pas passé par sink()', () => {
    const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.signature';
    const rapport = construireRapport({ base: { ...BASE, commentaire: jwt }, lignes: [] });

    expect(rapport).not.toContain(jwt);
    expect(lireEntete(rapport).commentaire).toMatch(/^\[redacted:/);
  });
});

describe('nomDuFichier', () => {
  it('nomme le fichier par l’horodatage et le correlationId', () => {
    expect(nomDuFichier(new Date('2026-08-25T10:30:00.000Z'), 'ABC123')).toBe(
      'ifvm-signalement-2026-08-25T10-30-00-ABC123.jsonl'
    );
  });
});

describe('envoyerSignalement', () => {
  function deps(surcharge: Partial<SignalementDeps> = {}) {
    return {
      flush: jest.fn(async () => {}),
      lireSession: jest.fn(async () => ({ lignes: [ligne(1), ligne(2)], total: 2 })),
      correlationId: () => 'ABC123',
      app: () => BASE.app,
      appareil: () => BASE.appareil,
      agent: () => BASE.agent,
      maintenant: () => new Date('2026-08-25T10:30:00.000Z'),
      ecrire: jest.fn(async () => 'file:///cache/rapport.jsonl'),
      partager: jest.fn(async () => {}),
      ...surcharge,
    } satisfies SignalementDeps;
  }

  it('vide l’anneau AVANT de lire : l’incident vient d’arriver', async () => {
    const ordre: string[] = [];
    const d = deps({
      flush: jest.fn(async () => {
        ordre.push('flush');
      }),
      lireSession: jest.fn(async () => {
        ordre.push('lire');
        return { lignes: [ligne(1)], total: 1 };
      }),
    });

    await envoyerSignalement({ commentaire: null }, d);

    expect(ordre).toEqual(['flush', 'lire']);
  });

  it('ne lit que la session courante', async () => {
    const d = deps();

    await envoyerSignalement({ commentaire: null }, d);

    expect(d.lireSession).toHaveBeenCalledWith('ABC123');
  });

  it('écrit le rapport puis le partage', async () => {
    const d = deps();

    await envoyerSignalement({ commentaire: 'ça bloque' }, d);

    const [nom, contenu] = (d.ecrire as jest.Mock).mock.calls[0];
    expect(nom).toBe('ifvm-signalement-2026-08-25T10-30-00-ABC123.jsonl');
    expect(lireEntete(contenu as string).commentaire).toBe('ça bloque');
    expect(d.partager).toHaveBeenCalledWith('file:///cache/rapport.jsonl');
  });

  it('traite un commentaire vide comme « sans commentaire »', async () => {
    const d = deps();

    await envoyerSignalement({ commentaire: '   ' }, d);

    expect(
      lireEntete((d.ecrire as jest.Mock).mock.calls[0][1] as string).commentaire
    ).toBeNull();
  });

  // Le signalement est le dernier recours de l'agent : s'il échoue, il doit
  // échouer bruyamment, avec une classe que la couche d'affichage sait traduire.
  it('reporte les lignes jetées par SQLite jusque dans l’en-tête', async () => {
    const d = deps({
      lireSession: jest.fn(async () => ({ lignes: [ligne(1)], total: 12_000 })),
    });

    await envoyerSignalement({ commentaire: null }, d);

    expect(lireEntete((d.ecrire as jest.Mock).mock.calls[0][1] as string).tronquees).toBe(11_999);
  });

  it('type l’échec d’écriture en LocalWriteError', async () => {
    const d = deps({
      ecrire: jest.fn(async () => {
        throw new Error('ENOSPC');
      }),
    });

    await expect(envoyerSignalement({ commentaire: null }, d)).rejects.toBeInstanceOf(
      LocalWriteError
    );
  });

  it('un flush cassé n’empêche pas le signalement — il resterait vide sinon', async () => {
    const d = deps({
      flush: jest.fn(async () => {
        throw new Error('SQLITE_BUSY');
      }),
    });

    await expect(envoyerSignalement({ commentaire: null }, d)).resolves.toBeUndefined();
    expect(d.partager).toHaveBeenCalled();
  });
});
