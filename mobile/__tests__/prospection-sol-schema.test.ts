import { champsDeSol, creerSolSchema, valeursDeSol } from '@/lib/prospection-sol-schema';

describe('valeursDeSol (reprise d’un brouillon)', () => {
  it('relit humidite[] et texture[] dans le JSON sol, et les dégâts dans la colonne degats_cultures', () => {
    const v = valeursDeSol({ sol: { humidite: ['5_12cm', '12_30cm'], texture: ['argileuse', 'sable_grossier'], solNu: 20 }, degats_cultures: 'nuls' });
    expect(v).toEqual({ humidite: ['5_12cm', '12_30cm'], texture: ['argileuse', 'sable_grossier'], degats: 'nuls' });
  });

  it('fiche vierge : rien de coché, aucun dégât', () => {
    expect(valeursDeSol({})).toEqual({ humidite: [], texture: [], degats: null });
  });

  it('ignore les codes inconnus (JSON libre côté serveur)', () => {
    const v = valeursDeSol({ sol: { humidite: ['surface', 'profond'], texture: 'limoneuse' } });
    expect(v).toEqual({ humidite: ['surface'], texture: [], degats: null });
  });
});

describe('champsDeSol (enregistrement)', () => {
  const brouillon = { sol: { solNu: 20, humidite: ['surface'], texture: ['bloc'], autre: 'gardé' }, degats_cultures: null };

  it('réécrit humidite et texture dans sol en gardant solNu et le reste du JSON, dégâts dans leur colonne', () => {
    const champs = champsDeSol(brouillon, { humidite: ['5_12cm'], texture: ['argileuse', 'limoneuse'], degats: 'forts' });
    expect(champs).toEqual({
      sol: { solNu: 20, humidite: ['5_12cm'], texture: ['argileuse', 'limoneuse'], autre: 'gardé' },
      degats_cultures: 'forts',
    });
  });

  it('aucun dégât choisi : null', () => {
    expect(champsDeSol({ sol: null }, { humidite: ['surface'], texture: ['bloc'], degats: null })).toEqual({
      sol: { humidite: ['surface'], texture: ['bloc'] },
      degats_cultures: null,
    });
  });
});

describe('creerSolSchema', () => {
  const schema = creerSolSchema((cle) => cle);
  const erreurs = async (v: object) => {
    try {
      await schema.validate({ humidite: [], texture: [], degats: null, ...v }, { abortEarly: false });
      return [];
    } catch (e) {
      return (e as { errors: string[] }).errors;
    }
  };

  it('humidité et texture sont obligatoires : au moins un choix chacune', async () => {
    expect(await erreurs({})).toEqual(['prospection.sol.erreurs.humidite', 'prospection.sol.erreurs.texture']);
    expect(await erreurs({ humidite: ['surface'] })).toEqual(['prospection.sol.erreurs.texture']);
    expect(await erreurs({ texture: ['bloc'] })).toEqual(['prospection.sol.erreurs.humidite']);
  });

  it('valide dès qu’il y a un choix d’humidité et de texture ; les dégâts restent facultatifs', async () => {
    expect(await erreurs({ humidite: ['surface', '0_5cm'], texture: ['bloc'] })).toEqual([]);
  });
});
