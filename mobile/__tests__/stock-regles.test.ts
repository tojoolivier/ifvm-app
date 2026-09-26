import {
  calculerSoldes,
  formaterQuantite,
  formaterVariation,
  validerMouvement,
  type MouvementSaisi,
} from '../src/lib/stock-regles';

const SITE = 'site-1';
const AUTRE = 'site-2';
const FENI = 'pest-feni';
const DELTA = 'pest-delta';

const appro: MouvementSaisi = {
  type: 'approvisionnement',
  pesticideId: FENI,
  siteId: SITE,
  siteDestinationId: null,
  quantite: '200',
  unite: 'L',
};

describe('validerMouvement', () => {
  it('accepte un approvisionnement complet', () => {
    expect(validerMouvement(appro)).toEqual([]);
  });

  it('exige produit, site et quantité strictement positive', () => {
    const erreurs = validerMouvement({ ...appro, pesticideId: null, siteId: null, quantite: '0' });
    expect(erreurs).toEqual(
      expect.arrayContaining([
        'Choisissez un produit.',
        'Choisissez le site.',
        'La quantité doit être supérieure à zéro.',
      ])
    );
  });

  it('refuse une quantité vide ou non numérique', () => {
    expect(validerMouvement({ ...appro, quantite: '' })).toHaveLength(1);
    expect(validerMouvement({ ...appro, quantite: 'abc' })).toHaveLength(1);
  });

  it('accepte la virgule décimale', () => {
    expect(validerMouvement({ ...appro, quantite: '12,5' })).toEqual([]);
  });

  it('exige un site destination pour un transfert', () => {
    const transfert = { ...appro, type: 'transfert' as const };
    expect(validerMouvement(transfert)).toContain('Choisissez le site de destination.');
    expect(validerMouvement({ ...transfert, siteDestinationId: AUTRE })).toEqual([]);
  });

  it('refuse un transfert vers le même site', () => {
    const erreurs = validerMouvement({ ...appro, type: 'transfert', siteDestinationId: SITE });
    expect(erreurs).toContain('La destination doit être un autre site.');
  });

  it('ignore la destination pour un approvisionnement', () => {
    expect(validerMouvement({ ...appro, siteDestinationId: AUTRE })).toEqual([]);
  });
});

describe('calculerSoldes', () => {
  const serveur = [
    { site_id: SITE, pesticide_id: FENI, unite: 'L', quantite: 450 },
    { site_id: SITE, pesticide_id: DELTA, unite: 'kg', quantite: 85 },
    { site_id: AUTRE, pesticide_id: FENI, unite: 'L', quantite: 10 },
  ];

  it('ne renvoie que les lignes du site demandé, une par (produit, unité)', () => {
    const lignes = calculerSoldes(serveur, [], SITE);
    expect(lignes.map((l) => [l.pesticideId, l.unite, l.affiche])).toEqual([
      [FENI, 'L', 450],
      [DELTA, 'kg', 85],
    ]);
  });

  it('ajoute les approvisionnements en attente au solde affiché sans toucher au solde serveur', () => {
    const [feni] = calculerSoldes(
      serveur,
      [{ type: 'approvisionnement', pesticide_id: FENI, site_id: SITE, site_destination_id: null, quantite: 200, unite: 'L' }],
      SITE
    );
    expect(feni).toMatchObject({ serveur: 450, enAttente: 200, affiche: 650 });
  });

  it('retire un transfert sortant du site source et le crédite au site destination', () => {
    const transfert = {
      type: 'transfert' as const,
      pesticide_id: FENI,
      site_id: SITE,
      site_destination_id: AUTRE,
      quantite: 30,
      unite: 'L' as const,
    };
    expect(calculerSoldes(serveur, [transfert], SITE)[0]).toMatchObject({ enAttente: -30, affiche: 420 });
    expect(calculerSoldes(serveur, [transfert], AUTRE)[0]).toMatchObject({ enAttente: 30, affiche: 40 });
  });

  it('ne mélange jamais L et kg pour un même produit : deux lignes', () => {
    const lignes = calculerSoldes(
      [
        { site_id: SITE, pesticide_id: FENI, unite: 'L', quantite: 10 },
        { site_id: SITE, pesticide_id: FENI, unite: 'kg', quantite: 5 },
      ],
      [],
      SITE
    );
    expect(lignes).toHaveLength(2);
    expect(lignes.map((l) => l.unite).sort()).toEqual(['L', 'kg']);
  });

  it('crée une ligne pour un mouvement en attente sans solde serveur connu', () => {
    const lignes = calculerSoldes(
      [],
      [{ type: 'approvisionnement', pesticide_id: DELTA, site_id: SITE, site_destination_id: null, quantite: 40, unite: 'kg' }],
      SITE
    );
    expect(lignes).toEqual([
      { siteId: SITE, pesticideId: DELTA, unite: 'kg', serveur: 0, enAttente: 40, affiche: 40 },
    ]);
  });
});

describe('formatage', () => {
  it('affiche les entiers sans décimale et garde la virgule française', () => {
    expect(formaterQuantite(450)).toBe('450');
    expect(formaterQuantite(12.5)).toBe('12,5');
  });

  it('préfixe la variation de son signe', () => {
    expect(formaterVariation(200, 'L')).toBe('+200 L');
    expect(formaterVariation(-15, 'L')).toBe('-15 L');
  });
});
