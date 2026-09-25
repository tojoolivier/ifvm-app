import {
  abregerIdentifiant,
  especeCourte,
  glypheSexe,
  libelleCategorie,
  libelleResultats,
  libelleVoirResultats,
  libelleSexe,
  libelleTypeProduit,
  etatFraicheur,
  formaterDateHeure,
  formaterDerniereSynchro,
  formaterJourMois,
  formaterNombre,
  grouperCodesStades,
  libelleEntrees,
  listerCodesStades,
  listerPesticides,
  listerStations,
  resumerReferentielLocal,
  type CodeStadeLigne,
} from '../src/lib/referentiel-consultation';

const getAllAsync = jest.fn();
const getFirstAsync = jest.fn();

jest.mock('../src/lib/referentiel-db', () => ({
  getReferentielDb: async () => ({
    getAllAsync: (...args: unknown[]) => getAllAsync(...args),
    getFirstAsync: (...args: unknown[]) => getFirstAsync(...args),
  }),
}));

beforeEach(() => {
  getAllAsync.mockReset().mockResolvedValue([]);
  getFirstAsync.mockReset().mockResolvedValue(null);
});

/** Date locale → ISO : les formateurs lisent l'heure locale, le test ne dépend donc pas du fuseau. */
const iso = (a: number, m: number, j: number, h = 12, min = 0) => new Date(a, m - 1, j, h, min).toISOString();

describe('formateurs', () => {
  it('jour/mois sur deux chiffres', () => {
    expect(formaterJourMois(iso(2026, 9, 2))).toBe('02/09');
  });

  it('date + heure d’une fiche', () => {
    expect(formaterDateHeure(iso(2026, 9, 20, 8, 12))).toBe('20/09/2026 · 08:12');
  });

  it('une date illisible ne casse pas l’écran', () => {
    expect(formaterJourMois('n’importe quoi')).toBe('—');
    expect(formaterDateHeure(null)).toBe('—');
  });

  it('dernière synchronisation : aujourd’hui, hier, sinon la date', () => {
    const maintenant = new Date(2026, 8, 22, 15, 0);
    expect(formaterDerniereSynchro(iso(2026, 9, 22, 8, 12), maintenant)).toBe('Aujourd’hui à 08:12');
    expect(formaterDerniereSynchro(iso(2026, 9, 21, 23, 5), maintenant)).toBe('Hier à 23:05');
    expect(formaterDerniereSynchro(iso(2026, 9, 3, 7, 0), maintenant)).toBe('03/09 à 07:00');
    expect(formaterDerniereSynchro(null, maintenant)).toBe('Jamais synchronisé');
  });

  it('fraîcheur : à jour sous 24 h, sinon à synchroniser, jamais si vide', () => {
    const maintenant = new Date(2026, 8, 22, 15, 0);
    expect(etatFraicheur(iso(2026, 9, 22, 8, 12), maintenant)).toBe('a_jour');
    expect(etatFraicheur(iso(2026, 9, 20, 8, 12), maintenant)).toBe('a_synchroniser');
    expect(etatFraicheur(null, maintenant)).toBe('jamais');
  });

  it('nombres avec espace des milliers et pluriel des entrées', () => {
    expect(formaterNombre(1248)).toBe('1 248');
    expect(libelleEntrees(1)).toBe('1 entrée');
    expect(libelleEntrees(86)).toBe('86 entrées');
    expect(libelleEntrees(1248)).toBe('1 248 entrées');
  });

  it('abrège un identifiant long au milieu', () => {
    expect(abregerIdentifiant('8f2c1d3e-0000-4000-8000-00000000a91d')).toBe('8f2c…a91d');
    expect(abregerIdentifiant('PA-07')).toBe('PA-07');
  });
});

describe('resumerReferentielLocal', () => {
  it('compte chaque table, date sa dernière mise à jour et rend la dernière synchro', async () => {
    getFirstAsync.mockImplementation(async (sql: string) => {
      if (sql.includes('referentiel_sync_meta')) return { derniere: '2026-09-22T05:12:00.000Z' };
      if (sql.includes('FROM pesticide')) return { n: 42, maj: '2026-09-20T05:12:00.000Z' };
      if (sql.includes('FROM equipe_membre')) return { n: 61, maj: null };
      return { n: 0, maj: null };
    });

    const resume = await resumerReferentielLocal();

    expect(resume.derniereSynchro).toBe('2026-09-22T05:12:00.000Z');
    expect(resume.tables.find((t) => t.table === 'pesticide')).toEqual({
      table: 'pesticide',
      lignes: 42,
      majLe: '2026-09-20T05:12:00.000Z',
    });
    expect(resume.tables.find((t) => t.table === 'equipe_membre')?.majLe).toBeNull();
    expect(resume.tables).toHaveLength(13);
    expect(resume.totalLignes).toBe(42 + 61);
  });

  it('n’interroge pas updated_at sur equipe_membre (colonne absente)', async () => {
    await resumerReferentielLocal();
    const sqlMembres = getFirstAsync.mock.calls.map((c) => c[0] as string).find((s) => s.includes('equipe_membre'));
    expect(sqlMembres).not.toContain('updated_at');
  });
});

describe('listerPesticides', () => {
  const base = { recherche: '', statut: 'tous', type: null, matiereActive: null, tri: 'nom', inclureInactifs: true } as const;

  it('sans filtre : aucun paramètre, tri par nom', async () => {
    await listerPesticides(base);
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('ORDER BY nom COLLATE NOCASE');
    expect(sql).not.toContain('WHERE');
    expect(params).toEqual([]);
  });

  it('la recherche porte sur le nom, le code et la matière active', async () => {
    await listerPesticides({ ...base, recherche: 'feni' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('nom LIKE ?');
    expect(sql).toContain('code LIKE ?');
    expect(sql).toContain('matiere_active LIKE ?');
    expect(params).toEqual(['%feni%', '%feni%', '%feni%']);
  });

  it('les jokers LIKE saisis sont échappés', async () => {
    await listerPesticides({ ...base, recherche: '50%_x' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain("ESCAPE '\\'");
    expect(params[0]).toBe('%50\\%\\_x%');
  });

  it('cache les inactifs quand « Afficher les entrées inactives » est éteint', async () => {
    await listerPesticides({ ...base, inclureInactifs: false });
    expect(getAllAsync.mock.calls[0][0]).toContain('actif = 1');
  });

  it('« Inactifs » ne garde que les inactifs', async () => {
    await listerPesticides({ ...base, statut: 'inactifs' });
    expect(getAllAsync.mock.calls[0][0]).toContain('actif = 0');
  });

  it('filtre par type de produit et matière active, tri par code', async () => {
    await listerPesticides({ ...base, type: 'insecticide', matiereActive: 'Fipronil', tri: 'code' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('type_produit = ?');
    expect(sql).toContain('matiere_active = ?');
    expect(sql).toContain('ORDER BY code');
    expect(params).toEqual(['insecticide', 'Fipronil']);
  });

  it('convertit actif en booléen', async () => {
    getAllAsync.mockResolvedValue([{ id: '1', nom: 'A', actif: 1 }, { id: '2', nom: 'B', actif: 0 }]);
    const lignes = await listerPesticides(base);
    expect(lignes.map((l) => l.actif)).toEqual([true, false]);
  });
});

describe('listerStations', () => {
  it('joint le poste acridien et cherche aussi sur la commune', async () => {
    await listerStations({ recherche: 'ihosy', statut: 'tous', region: null, tri: 'nom' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('LEFT JOIN poste_acridien');
    expect(sql).toContain('s.commune LIKE ?');
    expect(params).toEqual(['%ihosy%', '%ihosy%', '%ihosy%', '%ihosy%']);
  });

  it('filtre par région et par statut', async () => {
    await listerStations({ recherche: '', statut: 'actifs', region: 'Ihorombe', tri: 'code' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('s.actif = 1');
    expect(sql).toContain('s.region = ?');
    expect(sql).toContain('ORDER BY s.code');
    expect(params).toEqual(['Ihorombe']);
  });
});

describe('listerCodesStades', () => {
  const base = { recherche: '', sexe: 'tous', espece: null, categorie: 'toutes' } as const;

  it('un sexe choisi garde aussi les stades sans sexe (larves)', async () => {
    await listerCodesStades({ ...base, sexe: 'F' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('(sexe IS NULL OR sexe = ?)');
    expect(params).toEqual(['F']);
  });

  it('« Non sexé » ne garde que les stades sans sexe', async () => {
    await listerCodesStades({ ...base, sexe: 'non_sexe' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('sexe IS NULL');
    expect(sql).not.toContain('sexe = ?');
    expect(params).toEqual([]);
  });

  it('une espèce choisie garde aussi les stades « toutes espèces »', async () => {
    await listerCodesStades({ ...base, espece: 'Nomadacris septemfasciata' });
    const [sql, params] = getAllAsync.mock.calls[0];
    expect(sql).toContain('(espece IS NULL OR espece = ?)');
    expect(params).toEqual(['Nomadacris septemfasciata']);
  });

  it('filtre par catégorie', async () => {
    await listerCodesStades({ ...base, categorie: 'larve' });
    expect(getAllAsync.mock.calls[0][1]).toEqual(['larve']);
  });
});

describe('grouperCodesStades', () => {
  const ligne = (p: Partial<CodeStadeLigne>): CodeStadeLigne => ({
    id: p.code ?? 'x',
    code: 'x',
    libelle: 'x',
    categorie: 'imago',
    sexe: null,
    espece: null,
    ordre: 0,
    actif: true,
    updated_at: '',
    ...p,
  });

  it('regroupe par catégorie et sexe, imago avant larve, femelle avant mâle', () => {
    const groupes = grouperCodesStades([
      ligne({ code: 'L1', categorie: 'larve', ordre: 10 }),
      ligne({ code: 'B1', categorie: 'imago', sexe: 'M', ordre: 2 }),
      ligne({ code: 'A2', categorie: 'imago', sexe: 'F', ordre: 1 }),
      ligne({ code: 'A1', categorie: 'imago', sexe: 'F', ordre: 0 }),
    ]);

    expect(groupes.map((g) => g.titre)).toEqual(['IMAGO · FEMELLE', 'IMAGO · MÂLE', 'LARVE']);
    expect(groupes[0].lignes.map((l) => l.code)).toEqual(['A1', 'A2']);
  });

  it('une catégorie inconnue ne disparaît pas', () => {
    const groupes = grouperCodesStades([ligne({ code: 'Z', categorie: null })]);
    expect(groupes).toHaveLength(1);
    expect(groupes[0].titre).toBe('AUTRES');
  });
});

describe('libellés', () => {
  it('type de produit : connu, inconnu, absent', () => {
    expect(libelleTypeProduit('produit_choc')).toBe('Produit de choc');
    expect(libelleTypeProduit('produit_barriere')).toBe('Produit barrière');
    expect(libelleTypeProduit('bio_pesticide')).toBe('Bio pesticide');
    expect(libelleTypeProduit(null)).toBe('—');
  });

  it('sexe : glyphe et libellé, « non sexé » par défaut', () => {
    expect(glypheSexe('F')).toBe('♀');
    expect(glypheSexe('M')).toBe('♂');
    expect(glypheSexe(null)).toBeNull();
    expect(libelleSexe('F')).toBe('Femelle ♀');
    expect(libelleSexe(null)).toBe('Non sexé');
  });

  it('catégorie et espèce', () => {
    expect(libelleCategorie('imago')).toBe('Imago');
    expect(especeCourte('Nomadacris septemfasciata')).toBe('Nomadacris');
    expect(especeCourte(null)).toBe('Toutes espèces');
  });
});

describe('résultats', () => {
  it('accorde le compteur et le bouton', () => {
    expect(libelleResultats(38)).toBe('38 RÉSULTATS');
    expect(libelleResultats(1)).toBe('1 RÉSULTAT');
    expect(libelleResultats(0)).toBe('0 RÉSULTAT');
    expect(libelleVoirResultats(38)).toBe('Voir les 38 résultats');
    expect(libelleVoirResultats(1)).toBe('Voir le résultat');
    expect(libelleVoirResultats(0)).toBe('Aucun résultat');
  });
});
