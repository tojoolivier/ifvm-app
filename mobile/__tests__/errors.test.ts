import {
  AppError,
  NetworkError,
  AuthError,
  LocalReadError,
  LocalWriteError,
  ReferentialError,
  PermissionError,
  PreconditionError,
  isTypedError,
  assertPresent,
} from '../src/lib/errors';

const CLASSES = [
  NetworkError,
  AuthError,
  LocalReadError,
  LocalWriteError,
  ReferentialError,
  PermissionError,
  PreconditionError,
];

describe('jeu fermé d’erreurs typées — ADR-012 décision 2', () => {
  it('compte exactement 7 classes', () => {
    expect(CLASSES).toHaveLength(7);
  });

  it.each(CLASSES)('%p est reconnue comme typée et porte son nom', (Cls) => {
    const e = new Cls('message métier');

    expect(e).toBeInstanceOf(AppError);
    expect(e).toBeInstanceOf(Error);
    expect(isTypedError(e)).toBe(true);
    expect(e.message).toBe('message métier');
    expect(e.name).toBe(Cls.name);
  });

  it('les classes sont mutuellement discriminables par instanceof', () => {
    // Le mécanisme de décision des frontières : chaque classe ne doit matcher
    // qu'elle-même, sans quoi la matrice de traitement s'effondre.
    for (const Cls of CLASSES) {
      const e = new Cls('x');
      const autres = CLASSES.filter((C) => C !== Cls);
      for (const Autre of autres) {
        expect(e).not.toBeInstanceOf(Autre);
      }
    }
  });

  it('conserve la cause d’origine', () => {
    const origine = new Error('SQLITE_BUSY: database is locked');
    const e = new LocalWriteError("Impossible d'enregistrer.", { cause: origine });

    expect((e as { cause?: unknown }).cause).toBe(origine);
  });

  it('sans cause, ne fabrique pas de cause fantôme', () => {
    const e = new NetworkError('Connexion impossible.');

    expect('cause' in e ? (e as { cause?: unknown }).cause : undefined).toBeUndefined();
  });
});

describe('isTypedError — ce qui n’est pas typé est un bug', () => {
  it('rejette une Error nue', () => {
    expect(isTypedError(new Error('boom'))).toBe(false);
  });

  it('rejette une erreur enveloppée, la classe étant dans `cause`', () => {
    // Le piège de ADR-012 décision 8 : RN et Expo enveloppent les rejets de
    // promesse dans `new Error(…, { cause })`. Vue de l'extérieur, l'enveloppe
    // n'est PAS typée — il faut lire `.cause`.
    const enveloppe = new Error('Uncaught (in promise, id: 3)', {
      cause: new NetworkError('Connexion impossible.'),
    });

    expect(isTypedError(enveloppe)).toBe(false);
    expect(isTypedError((enveloppe as { cause?: unknown }).cause)).toBe(true);
  });

  it.each([null, undefined, 'chaîne', 42, {}, []])('rejette %p', (valeur) => {
    expect(isTypedError(valeur)).toBe(false);
  });
});

describe('assertPresent — la précondition remplace le guard-clause muet', () => {
  it('laisse passer une valeur présente', () => {
    expect(() => assertPresent('abc', 'Brouillon introuvable.')).not.toThrow();
    expect(() => assertPresent(0, 'zéro est une valeur.')).not.toThrow();
    expect(() => assertPresent('', 'la chaîne vide aussi.')).not.toThrow();
    expect(() => assertPresent(false, 'false aussi.')).not.toThrow();
  });

  it.each([null, undefined])('lève PreconditionError sur %p', (valeur) => {
    expect(() => assertPresent(valeur, 'Brouillon introuvable — reprenez la fiche.')).toThrow(
      PreconditionError
    );
  });

  it('affiche le message du site d’appel verbatim', () => {
    // Seule classe du jeu dont le message est destiné tel quel à l'agent.
    try {
      assertPresent(null, 'Brouillon introuvable — reprenez la fiche.');
      throw new Error('aurait dû lever');
    } catch (e) {
      expect(e).toBeInstanceOf(PreconditionError);
      expect((e as Error).message).toBe('Brouillon introuvable — reprenez la fiche.');
    }
  });

  it('rétrécit le type pour TypeScript', () => {
    const draftId: string | null = 'p-1' as string | null;
    assertPresent(draftId, 'Brouillon introuvable.');
    // Si `asserts value is T` ne fonctionnait pas, la ligne suivante
    // ne compilerait pas (`draftId` resterait `string | null`).
    expect(draftId.length).toBe(3);
  });
});
