import { expurger } from '../src/lib/log-redaction';

const JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIiwiZXhwIjo0MTAyNDQ0ODAwfQ.SIGNATURE_ACCESS';

describe('expurgation par nom de clé — ADR-012 décision 6', () => {
  it.each([
    'access_token',
    'refresh_token',
    'token',
    'password',
    'new_password',
    'authorization',
    'api_key',
    'secret',
  ])('masque la clé %s', (cle) => {
    const sortie = expurger({ [cle]: 'valeur-secrète' }) as Record<string, string>;

    expect(sortie[cle]).not.toContain('valeur-secrète');
    expect(sortie[cle]).toMatch(/^\[redacted:[0-9a-f]{4}\]$/);
  });

  it('ignore la casse et les séparateurs', () => {
    const sortie = expurger({ 'Access-Token': 'x', APIKEY: 'y' }) as Record<string, string>;

    expect(sortie['Access-Token']).toMatch(/^\[redacted:/);
    expect(sortie.APIKEY).toMatch(/^\[redacted:/);
  });

  it('descend dans les objets imbriqués et les tableaux', () => {
    const sortie = expurger({
      requete: { entetes: [{ authorization: 'Bearer abc' }] },
    }) as { requete: { entetes: { authorization: string }[] } };

    expect(sortie.requete.entetes[0].authorization).toMatch(/^\[redacted:/);
  });
});

describe('expurgation par forme de valeur — le second filet', () => {
  it('masque un JWT quel que soit le nom de sa clé', () => {
    // Le filet qui rattrape ce que la liste ne connaît pas encore : un champ
    // `session_key` ajouté demain côté backend passerait le filtre par nom.
    const sortie = expurger({ session_key: JWT, otp: JWT }) as Record<string, string>;

    expect(sortie.session_key).toMatch(/^\[redacted:/);
    expect(sortie.otp).toMatch(/^\[redacted:/);
  });

  it('masque un JWT trouvé dans un tableau', () => {
    const sortie = expurger({ liste: [JWT] }) as { liste: string[] };

    expect(sortie.liste[0]).toMatch(/^\[redacted:/);
  });

  it('ne masque pas une chaîne ordinaire commençant par eyJ', () => {
    // `FORME_JWT` exige la structure à points, pas seulement le préfixe.
    const sortie = expurger({ note: 'eyJ était le début de mon test' }) as { note: string };

    expect(sortie.note).toBe('eyJ était le début de mon test');
  });
});

describe('ce qui doit PASSER — le périmètre est « ce qui authentifie »', () => {
  it('laisse les données métier intactes', () => {
    // Un jeton authentifie, une coordonnée décrit. Le GPS, l'identité et le
    // contenu des fiches sont la charge utile du diagnostic.
    const sortie = expurger({
      latitude: -18.8792,
      longitude: 47.5079,
      prospecteur_id: 'PRO-0412',
      nom: 'Rakoto',
      n_fiche: 'PRO-2026-0142',
    });

    expect(sortie).toEqual({
      latitude: -18.8792,
      longitude: 47.5079,
      prospecteur_id: 'PRO-0412',
      nom: 'Rakoto',
      n_fiche: 'PRO-2026-0142',
    });
  });
});

describe('robustesse — une ligne tronquée vaut mieux qu’un logger qui boucle', () => {
  it('coupe les cycles', () => {
    const a: Record<string, unknown> = { nom: 'a' };
    a.moi = a;

    expect(() => expurger(a)).not.toThrow();
    expect(JSON.stringify(expurger(a))).toContain('[cycle]');
  });

  it('coupe au-delà de la profondeur maximale', () => {
    let profond: Record<string, unknown> = { fond: 'atteint' };
    for (let i = 0; i < 15; i++) profond = { niveau: profond };

    expect(JSON.stringify(expurger(profond))).toContain('[profondeur max]');
  });

  it('réduit une Error à ce qui diagnostique', () => {
    const sortie = expurger({ err: new TypeError('boom') }) as {
      err: { name: string; message: string; stack?: string };
    };

    expect(sortie.err.name).toBe('TypeError');
    expect(sortie.err.message).toBe('boom');
  });

  it.each([null, undefined, 0, '', false])('laisse passer la primitive %p', (v) => {
    expect(expurger(v)).toBe(v);
  });
});
