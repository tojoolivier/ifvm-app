import { useTraitementCaptureStore } from '../src/lib/traitement-capture-store';

const initialState = useTraitementCaptureStore.getState();

beforeEach(() => {
  useTraitementCaptureStore.setState(initialState, true);
});

describe('useTraitementCaptureStore — état initial', () => {
  it("démarre à l'écran de référence, hors vue de validation", () => {
    const state = useTraitementCaptureStore.getState();
    expect(state.screen).toBe('reference');
    expect(state.isValidationView).toBe(false);
  });

  it('démarre sans type de traitement choisi', () => {
    expect(useTraitementCaptureStore.getState().typeTraitement).toBeNull();
  });

  it('démarre avec des sections vides', () => {
    const state = useTraitementCaptureStore.getState();
    expect(state.ref).toEqual({});
    expect(state.aerien).toEqual({ rotations: [] });
    expect(state.terrestre).toEqual({ produits: [] });
    expect(state.env).toEqual({});
    expect(state.imp).toEqual({});
    expect(state.observations).toBeNull();
    expect(state.signed).toEqual({});
    expect(state.stamps).toEqual({});
  });
});

describe('navigation dans l\'assistant', () => {
  it('setScreen change l\'écran courant', () => {
    useTraitementCaptureStore.getState().setScreen('aerien');
    expect(useTraitementCaptureStore.getState().screen).toBe('aerien');
  });

  it('setValidationView bascule la vue de validation', () => {
    useTraitementCaptureStore.getState().setValidationView(true);
    expect(useTraitementCaptureStore.getState().isValidationView).toBe(true);
  });
});

describe('updateRef', () => {
  it('fusionne les champs de référence saisis sans effacer les autres', () => {
    const { updateRef } = useTraitementCaptureStore.getState();
    updateRef({ localite: 'Ambositra' });
    updateRef({ region: "Amoron'i Mania" });

    expect(useTraitementCaptureStore.getState().ref).toEqual({
      localite: 'Ambositra',
      region: "Amoron'i Mania",
    });
  });
});

describe('section aérien', () => {
  it('updateAerien fusionne pilote/mécanicien/chef de base', () => {
    useTraitementCaptureStore.getState().updateAerien({ pilote: 'Jean Dupont' });
    useTraitementCaptureStore.getState().updateAerien({ mecanicien: 'Marc Rakoto' });

    const { aerien } = useTraitementCaptureStore.getState();
    expect(aerien.pilote).toBe('Jean Dupont');
    expect(aerien.mecanicien).toBe('Marc Rakoto');
  });

  it('addRotation ajoute une rotation locale avec un id généré', () => {
    useTraitementCaptureStore.getState().addRotation({ numero_cuve: 'C1', produit_id: 'p1', quantite_l: 10 });

    const { aerien } = useTraitementCaptureStore.getState();
    expect(aerien.rotations).toHaveLength(1);
    expect(aerien.rotations[0].numero_cuve).toBe('C1');
    expect(typeof aerien.rotations[0].localId).toBe('string');
  });

  it('updateRotation modifie la rotation ciblée par localId', () => {
    const store = useTraitementCaptureStore.getState();
    store.addRotation({ numero_cuve: 'C1', quantite_l: 10 });
    const localId = useTraitementCaptureStore.getState().aerien.rotations[0].localId;

    store.updateRotation(localId, { quantite_l: 15 });

    expect(useTraitementCaptureStore.getState().aerien.rotations[0].quantite_l).toBe(15);
  });

  it('addRotation/updateRotation portent nom_commercial (#produit-nom-commercial)', () => {
    const store = useTraitementCaptureStore.getState();
    store.addRotation({ produit_id: 'p1', nom_commercial: 'Fyfanon' });
    const localId = useTraitementCaptureStore.getState().aerien.rotations[0].localId;
    expect(useTraitementCaptureStore.getState().aerien.rotations[0].nom_commercial).toBe('Fyfanon');

    store.updateRotation(localId, { produit_id: 'p2', nom_commercial: 'Nurelle' });

    expect(useTraitementCaptureStore.getState().aerien.rotations[0].nom_commercial).toBe('Nurelle');
  });

  it('removeRotation retire la rotation ciblée', () => {
    const store = useTraitementCaptureStore.getState();
    store.addRotation({ numero_cuve: 'C1' });
    const localId = useTraitementCaptureStore.getState().aerien.rotations[0].localId;

    store.removeRotation(localId);

    expect(useTraitementCaptureStore.getState().aerien.rotations).toHaveLength(0);
  });
});

describe('section terrestre', () => {
  it('updateTerrestre fusionne les champs saisis', () => {
    useTraitementCaptureStore.getState().updateTerrestre({ chefEquipeId: 'chef-1' });
    useTraitementCaptureStore.getState().updateTerrestre({ vitesse_vent_ms: 2.5 });

    const { terrestre } = useTraitementCaptureStore.getState();
    expect(terrestre.chefEquipeId).toBe('chef-1');
    expect(terrestre.vitesse_vent_ms).toBe(2.5);
  });

  it('addProduit ajoute un produit local avec un id généré', () => {
    useTraitementCaptureStore.getState().addProduit({ produit_id: 'p1', quantite_l: 5 });

    const { terrestre } = useTraitementCaptureStore.getState();
    expect(terrestre.produits).toHaveLength(1);
    expect(terrestre.produits[0].produit_id).toBe('p1');
    expect(typeof terrestre.produits[0].localId).toBe('string');
  });

  it('addProduit porte nom_commercial (#produit-nom-commercial)', () => {
    useTraitementCaptureStore.getState().addProduit({ produit_id: 'p1', nom_commercial: 'Fyfanon' });

    expect(useTraitementCaptureStore.getState().terrestre.produits[0].nom_commercial).toBe('Fyfanon');
  });

  it('removeProduit retire le produit ciblé', () => {
    const store = useTraitementCaptureStore.getState();
    store.addProduit({ produit_id: 'p1' });
    const localId = useTraitementCaptureStore.getState().terrestre.produits[0].localId;

    store.removeProduit(localId);

    expect(useTraitementCaptureStore.getState().terrestre.produits).toHaveLength(0);
  });
});

describe('environnement, impact, observations', () => {
  it('updateEnv fusionne les champs environnementaux', () => {
    useTraitementCaptureStore.getState().updateEnv({ recouvrement_percent: 60 });
    expect(useTraitementCaptureStore.getState().env.recouvrement_percent).toBe(60);
  });

  it('updateImp fusionne les champs d\'impact', () => {
    useTraitementCaptureStore.getState().updateImp({ empoisonnement: true, mortalite: false });
    expect(useTraitementCaptureStore.getState().imp).toEqual({ empoisonnement: true, mortalite: false });
  });

  it('setObservations remplace le texte libre', () => {
    useTraitementCaptureStore.getState().setObservations('RAS');
    expect(useTraitementCaptureStore.getState().observations).toBe('RAS');
  });
});

describe('signatures', () => {
  it('setSigned enregistre le nom du signataire pour un rôle', () => {
    useTraitementCaptureStore.getState().setSigned('PILOTE', 'Jean Dupont');
    expect(useTraitementCaptureStore.getState().signed.PILOTE).toBe('Jean Dupont');
  });

  it('setStamp enregistre un horodatage local pour un rôle', () => {
    useTraitementCaptureStore.getState().setStamp('PILOTE', '2026-08-12T10:00:00.000Z');
    expect(useTraitementCaptureStore.getState().stamps.PILOTE).toBe('2026-08-12T10:00:00.000Z');
  });
});

describe('reset', () => {
  it('réinitialise entièrement le brouillon en cours', () => {
    const store = useTraitementCaptureStore.getState();
    store.setScreen('terrestre');
    store.updateRef({ localite: 'Ambositra' });
    store.addRotation({ numero_cuve: 'C1' });

    store.reset();

    const state = useTraitementCaptureStore.getState();
    expect(state.screen).toBe('reference');
    expect(state.ref).toEqual({});
    expect(state.aerien.rotations).toHaveLength(0);
  });

  it('efface le type de traitement choisi, pour éviter qu\'il ne fuite vers la fiche suivante', () => {
    const store = useTraitementCaptureStore.getState();
    store.setTypeTraitement('AERIEN');

    store.reset();

    expect(useTraitementCaptureStore.getState().typeTraitement).toBeNull();
  });
});
