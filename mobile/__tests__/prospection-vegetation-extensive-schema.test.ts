import {
  champsDeVegetationExtensive,
  creerVegetationExtensiveSchema,
  RACCOURCIS_VERDISSEMENT,
  valeursDeVegetationExtensive,
} from '@/lib/prospection-vegetation-extensive-schema';

describe('valeursDeVegetationExtensive (reprise d’un brouillon)', () => {
  it('relit hauteur (cm, virgule française), verdissement et dégâts des colonnes existantes', () => {
    const v = valeursDeVegetationExtensive({ hauteur_herbe_cm: 40.5, verdissement_pourcent: 60, degats_cultures: 'faibles' });
    expect(v).toEqual({ hauteurCm: '40,5', verdissement: '60', degats: 'faibles' });
  });

  it('fiche vierge : champs vides, aucun dégât choisi', () => {
    expect(valeursDeVegetationExtensive({})).toEqual({ hauteurCm: '', verdissement: '', degats: null });
  });
});

describe('champsDeVegetationExtensive (enregistrement)', () => {
  it('convertit les textes en nombres (virgule française) et garde le choix de dégâts', () => {
    expect(champsDeVegetationExtensive({ hauteurCm: '40,5', verdissement: '60', degats: 'forts' })).toEqual({
      hauteur_herbe_cm: 40.5,
      verdissement_pourcent: 60,
      degats_cultures: 'forts',
    });
  });

  it('champ vide ou aucun choix : null (pas de 0 inventé)', () => {
    expect(champsDeVegetationExtensive({ hauteurCm: '', verdissement: ' ', degats: null })).toEqual({
      hauteur_herbe_cm: null,
      verdissement_pourcent: null,
      degats_cultures: null,
    });
  });
});

describe('RACCOURCIS_VERDISSEMENT', () => {
  it('maquette 02a : 0, 25, 50, 75, 100 %', () => {
    expect(RACCOURCIS_VERDISSEMENT).toEqual([0, 25, 50, 75, 100]);
  });
});

describe('creerVegetationExtensiveSchema', () => {
  const schema = creerVegetationExtensiveSchema((cle) => cle);
  const erreurs = async (v: object) => {
    try {
      await schema.validate({ hauteurCm: '', verdissement: '', degats: null, ...v }, { abortEarly: false });
      return [];
    } catch (e) {
      return (e as { errors: string[] }).errors;
    }
  };

  it('tout est facultatif : une fiche vierge est valide', async () => {
    expect(await erreurs({})).toEqual([]);
  });

  it('accepte hauteur ≥ 0 (virgule) et verdissement de 0 à 100', async () => {
    expect(await erreurs({ hauteurCm: '0', verdissement: '100' })).toEqual([]);
    expect(await erreurs({ hauteurCm: '12,5', verdissement: '0' })).toEqual([]);
  });

  it('refuse une hauteur négative ou non numérique, un verdissement hors 0–100', async () => {
    expect(await erreurs({ hauteurCm: '-1' })).toEqual(['prospection.vegetation.extensive.erreurs.hauteur']);
    expect(await erreurs({ hauteurCm: 'abc' })).toEqual(['prospection.vegetation.extensive.erreurs.hauteur']);
    expect(await erreurs({ verdissement: '101' })).toEqual(['prospection.vegetation.erreurs.verdissement']);
  });
});
