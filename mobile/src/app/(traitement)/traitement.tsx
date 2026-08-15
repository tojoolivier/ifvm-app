import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  getTraitement,
  updateTraitementAerien,
  updateTraitementTerrestre,
  addRotation,
  addProduitUtilise,
  listReprenableTraitements,
  DraftTraitementRow,
} from '@/lib/traitement-repository';
import { listUtilisateursByRole, listPesticides, Pesticide, UtilisateurEquipe } from '@/lib/referentiel-db';
import { useTraitementCaptureStore, ProduitDraft } from '@/lib/traitement-capture-store';
import { generateId } from '@/lib/id';
import {
  computeNbRotations,
  computeTotalPesticideAerien,
  computeTotalPesticideTerrestre,
  computeSurfaceTraitee,
  computeSurfaceCumulee,
  computeSurfaceRestante,
  validateTerrestreConditions,
} from '@/lib/traitement-validation';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const DIRECTIONS_VENT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export default function TraitementScreen() {
  const router = useRouter();
  const { traitementId, isValidationView, origineId } =
    useLocalSearchParams<{ traitementId: string; isValidationView?: string; origineId?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';

  const typeTraitement = store.typeTraitement;
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);
  const [chefsEquipe, setChefsEquipe] = useState<UtilisateurEquipe[]>([]);
  const [agentsEncadreurs, setAgentsEncadreurs] = useState<UtilisateurEquipe[]>([]);
  const [pesticides, setPesticides] = useState<Pesticide[]>([]);
  const [reprenables, setReprenables] = useState<DraftTraitementRow[]>([]);
  const [surfaceInfesteeHa, setSurfaceInfesteeHa] = useState<number | null>(null);
  const [origineCumuleeHa, setOrigineCumuleeHa] = useState<number | null>(null);
  // Le store (Lot 1, non modifiable) n'expose pas de updateProduit — seulement
  // addProduit/removeProduit — donc l'édition des produits utilisés (terrestre)
  // est portée par un état local immuable propre à cet écran.
  const [produits, setProduits] = useState<ProduitDraft[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId).then((draft) => {
      if (!draft) return;
      store.setTypeTraitement(draft.type_traitement);
      setSurfaceInfesteeHa(draft.cible?.surface_infestee_ha ?? null);
      if (draft.type_traitement === 'AERIEN' && draft.aerien) {
        store.updateAerien({
          pilote: draft.aerien.pilote || null,
          mecanicien: draft.aerien.mecanicien || null,
          chefDeBaseId: draft.aerien.chef_de_base_id || null,
          consultantInternational: draft.aerien.consultant_international,
        });
        if (store.aerien.rotations.length === 0) {
          for (const r of draft.aerien.rotations) {
            store.addRotation({
              numero_cuve: r.numero_cuve,
              produit_id: r.produit_id,
              quantite_l: r.quantite_l,
              temperature_debut_c: r.temperature_debut_c,
              temperature_fin_c: r.temperature_fin_c,
              vent_debut_ms: r.vent_debut_ms,
              vent_fin_ms: r.vent_fin_ms,
            });
          }
        }
        if (store.aerien.rotations.length === 0 && draft.aerien.rotations.length === 0) {
          store.addRotation({});
        }
      }
      if (draft.type_traitement === 'TERRESTRE' && draft.terrestre) {
        store.updateTerrestre({
          chefEquipeId: draft.terrestre.chef_equipe_id || null,
          agentEncadreurId: draft.terrestre.agent_encadreur_id,
          consultantInternational: draft.terrestre.consultant_international,
          heureDebut: draft.terrestre.heure_debut,
          heureFin: draft.terrestre.heure_fin,
          vitesse_vent_ms: draft.terrestre.vitesse_vent_ms,
          direction_vent: draft.terrestre.direction_vent,
          temperature_c: draft.terrestre.temperature_c,
          repriseTraitement: draft.terrestre.reprise_traitement ?? false,
          traitementOrigineId: draft.terrestre.traitement_origine_id,
          surface_atomiseur_ha: draft.terrestre.surface_atomiseur_ha,
          surface_disque_rotatif_ha: draft.terrestre.surface_disque_rotatif_ha,
          surface_ulvamast_ha: draft.terrestre.surface_ulvamast_ha,
          surfaceRestanteAbandonnee: draft.terrestre.surface_restante_abandonnee,
          motifSurfaceRestanteAbandonnee: draft.terrestre.motif_surface_restante_abandonnee,
          essence_litres: draft.terrestre.essence_litres,
          nb_piles: draft.terrestre.nb_piles,
        });
        // Présélection reprise : uniquement sur une fiche fraîchement amorcée
        // depuis "Zones à reprendre" (draft.terrestre.reprise_traitement pas
        // encore renseigné) — n'écrase jamais un choix déjà enregistré.
        if (origineId && !draft.terrestre.reprise_traitement && !draft.terrestre.traitement_origine_id) {
          store.updateTerrestre({ repriseTraitement: true, traitementOrigineId: origineId });
        }
        if (produits.length === 0) {
          setProduits(
            draft.terrestre.produits.length > 0
              ? draft.terrestre.produits.map((p) => ({ localId: generateId(), produit_id: p.produit_id, quantite_l: p.quantite_l }))
              : [{ localId: generateId() }]
          );
        }
      }
    });
    listPesticides().then(setPesticides).catch(() => {});
    listReprenableTraitements().then(setReprenables).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  useEffect(() => {
    listUtilisateursByRole('chef_de_base').then(setChefsDeBase).catch(() => {});
    listUtilisateursByRole('chef_equipe').then(setChefsEquipe).catch(() => {});
    listUtilisateursByRole('agent_encadreur').then(setAgentsEncadreurs).catch(() => {});
  }, []);

  useEffect(() => {
    const origineId = store.terrestre.traitementOrigineId;
    let cancelled = false;
    (async () => {
      const value =
        store.terrestre.repriseTraitement && origineId
          ? ((await getTraitement(origineId))?.terrestre?.surface_cumulee_ha ?? null)
          : null;
      if (!cancelled) setOrigineCumuleeHa(value);
    })();
    return () => {
      cancelled = true;
    };
  }, [store.terrestre.repriseTraitement, store.terrestre.traitementOrigineId]);

  const nbRotations = computeNbRotations(store.aerien.rotations);
  const totalPesticideAerien = computeTotalPesticideAerien(store.aerien.rotations);
  const totalPesticideTerrestre = computeTotalPesticideTerrestre(produits);
  const surfaceTraitee = computeSurfaceTraitee(store.terrestre);
  const surfaceCumulee = computeSurfaceCumulee(surfaceTraitee, store.terrestre.repriseTraitement, origineCumuleeHa);
  const surfaceRestante = computeSurfaceRestante(surfaceInfesteeHa, surfaceCumulee);

  const handleContinuer = async () => {
    if (!traitementId) return;

    if (typeTraitement === 'AERIEN') {
      if (!store.aerien.pilote || !store.aerien.mecanicien || !store.aerien.chefDeBaseId) {
        setErrors({ aerien: 'Pilote, mécanicien et chef de base sont obligatoires' });
        return;
      }
      setIsSaving(true);
      await updateTraitementAerien(traitementId, {
        pilote: store.aerien.pilote,
        mecanicien: store.aerien.mecanicien,
        chefDeBaseId: store.aerien.chefDeBaseId,
        consultantInternational: store.aerien.consultantInternational,
      });
      for (const r of store.aerien.rotations) {
        await addRotation(traitementId, {
          numero_cuve: r.numero_cuve,
          produit_id: r.produit_id,
          quantite_l: r.quantite_l,
          temperature_debut_c: r.temperature_debut_c,
          temperature_fin_c: r.temperature_fin_c,
          vent_debut_ms: r.vent_debut_ms,
          vent_fin_ms: r.vent_fin_ms,
        });
      }
      setIsSaving(false);
    } else {
      const conditionErrors = validateTerrestreConditions({
        heureDebut: store.terrestre.heureDebut ?? null,
        heureFin: store.terrestre.heureFin ?? null,
        repriseTraitement: store.terrestre.repriseTraitement ?? false,
        traitementOrigineId: store.terrestre.traitementOrigineId ?? null,
        surfaceRestanteHa: surfaceRestante,
        surfaceRestanteAbandonnee: store.terrestre.surfaceRestanteAbandonnee ?? null,
        motifSurfaceRestanteAbandonnee: store.terrestre.motifSurfaceRestanteAbandonnee ?? null,
      });
      if (!store.terrestre.chefEquipeId || conditionErrors.length > 0) {
        const byField: Record<string, string> = {};
        if (!store.terrestre.chefEquipeId) byField.chefEquipeId = "Le chef d'équipe est obligatoire";
        for (const e of conditionErrors) byField[e.field] = e.message;
        setErrors(byField);
        return;
      }
      setIsSaving(true);
      await updateTraitementTerrestre(traitementId, {
        chefEquipeId: store.terrestre.chefEquipeId,
        agentEncadreurId: store.terrestre.agentEncadreurId,
        consultantInternational: store.terrestre.consultantInternational,
        heureDebut: store.terrestre.heureDebut,
        heureFin: store.terrestre.heureFin,
        vitesse_vent_ms: store.terrestre.vitesse_vent_ms,
        direction_vent: store.terrestre.direction_vent,
        temperature_c: store.terrestre.temperature_c,
        repriseTraitement: store.terrestre.repriseTraitement,
        traitementOrigineId: store.terrestre.traitementOrigineId,
        surface_atomiseur_ha: store.terrestre.surface_atomiseur_ha,
        surface_disque_rotatif_ha: store.terrestre.surface_disque_rotatif_ha,
        surface_ulvamast_ha: store.terrestre.surface_ulvamast_ha,
        surfaceRestanteAbandonnee: store.terrestre.surfaceRestanteAbandonnee,
        motifSurfaceRestanteAbandonnee: store.terrestre.motifSurfaceRestanteAbandonnee,
        essence_litres: store.terrestre.essence_litres,
        nb_piles: store.terrestre.nb_piles,
      });
      for (const p of produits) {
        await addProduitUtilise(traitementId, { produit_id: p.produit_id, quantite_l: p.quantite_l });
      }
      setIsSaving(false);
    }

    router.push({ pathname: '/(traitement)/moyens' as any, params: { traitementId, isValidationView } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={2} />
        <Text style={styles.title}>Traitement</Text>

        {typeTraitement === 'AERIEN' && (
          <>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Pilote*"
              value={store.aerien.pilote ?? ''}
              onChangeText={(v) => store.updateAerien({ pilote: v })}
            />
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Mécanicien*"
              value={store.aerien.mecanicien ?? ''}
              onChangeText={(v) => store.updateAerien({ mecanicien: v })}
            />
            <Text style={styles.label}>Chef de base*</Text>
            <View style={styles.chipRow}>
              {chefsDeBase.map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.prenom} ${c.nom}`}
                  selected={store.aerien.chefDeBaseId === c.id}
                  onPress={() => !readOnly && store.updateAerien({ chefDeBaseId: c.id })}
                />
              ))}
            </View>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Consultant international"
              value={store.aerien.consultantInternational ?? ''}
              onChangeText={(v) => store.updateAerien({ consultantInternational: v })}
            />

            {store.aerien.rotations.map((rotation, index) => (
              <Card key={rotation.localId} style={styles.rotationCard}>
                <View style={styles.rotationHeader}>
                  <Text style={styles.rotationTitle}>Rotation {index + 1}</Text>
                  {store.aerien.rotations.length > 1 && !readOnly && (
                    <TouchableOpacity onPress={() => store.removeRotation(rotation.localId)}>
                      <Text style={styles.removeButton}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <TextInput
                  editable={!readOnly}
                  style={styles.input}
                  placeholder="N° cuve*"
                  value={rotation.numero_cuve ?? ''}
                  onChangeText={(v) => store.updateRotation(rotation.localId, { numero_cuve: v })}
                />
                <TextInput
                  editable={!readOnly}
                  style={styles.input}
                  placeholder="Quantité (l)*"
                  keyboardType="numeric"
                  value={rotation.quantite_l != null ? String(rotation.quantite_l) : ''}
                  onChangeText={(v) => store.updateRotation(rotation.localId, { quantite_l: v ? Number(v) : null })}
                />
                <View style={styles.chipRow}>
                  {pesticides.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.nom}
                      selected={rotation.produit_id === p.id}
                      onPress={() => !readOnly && store.updateRotation(rotation.localId, { produit_id: p.id })}
                    />
                  ))}
                </View>
                <View style={styles.row}>
                  <TextInput
                    editable={!readOnly}
                    style={[styles.input, styles.flex1]}
                    placeholder="T° début*"
                    keyboardType="numeric"
                    value={rotation.temperature_debut_c != null ? String(rotation.temperature_debut_c) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_debut_c: v ? Number(v) : null })}
                  />
                  <TextInput
                    editable={!readOnly}
                    style={[styles.input, styles.flex1]}
                    placeholder="T° fin*"
                    keyboardType="numeric"
                    value={rotation.temperature_fin_c != null ? String(rotation.temperature_fin_c) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_fin_c: v ? Number(v) : null })}
                  />
                </View>
                <View style={styles.row}>
                  <TextInput
                    editable={!readOnly}
                    style={[styles.input, styles.flex1]}
                    placeholder="Vent début*"
                    keyboardType="numeric"
                    value={rotation.vent_debut_ms != null ? String(rotation.vent_debut_ms) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { vent_debut_ms: v ? Number(v) : null })}
                  />
                  <TextInput
                    editable={!readOnly}
                    style={[styles.input, styles.flex1]}
                    placeholder="Vent fin*"
                    keyboardType="numeric"
                    value={rotation.vent_fin_ms != null ? String(rotation.vent_fin_ms) : ''}
                    onChangeText={(v) => store.updateRotation(rotation.localId, { vent_fin_ms: v ? Number(v) : null })}
                  />
                </View>
              </Card>
            ))}
            {!readOnly && (
              <TouchableOpacity style={styles.addButton} onPress={() => store.addRotation({})}>
                <Text style={styles.addButtonText}>+ Ajouter une rotation</Text>
              </TouchableOpacity>
            )}

            <Card variant="derivee">
              <Text style={styles.label}>Nb rotations</Text>
              <Text style={styles.derivedValue}>{nbRotations}</Text>
            </Card>
            <Card variant="derivee">
              <Text style={styles.label}>Total pesticide (l)</Text>
              <Text style={styles.derivedValue}>{totalPesticideAerien}</Text>
            </Card>
            {errors.aerien && <Text style={styles.error}>{errors.aerien}</Text>}
          </>
        )}

        {typeTraitement === 'TERRESTRE' && (
          <>
            <Text style={styles.label}>Chef d&apos;équipe / zone*</Text>
            <View style={styles.chipRow}>
              {chefsEquipe.map((c) => (
                <Chip
                  key={c.id}
                  label={`${c.prenom} ${c.nom}`}
                  selected={store.terrestre.chefEquipeId === c.id}
                  onPress={() => !readOnly && store.updateTerrestre({ chefEquipeId: c.id })}
                />
              ))}
            </View>
            {errors.chefEquipeId && <Text style={styles.error}>{errors.chefEquipeId}</Text>}

            <Text style={styles.label}>Agent encadreur</Text>
            <View style={styles.chipRow}>
              {agentsEncadreurs.map((a) => (
                <Chip
                  key={a.id}
                  label={`${a.prenom} ${a.nom}`}
                  selected={store.terrestre.agentEncadreurId === a.id}
                  onPress={() =>
                    !readOnly &&
                    store.updateTerrestre({ agentEncadreurId: store.terrestre.agentEncadreurId === a.id ? null : a.id })
                  }
                />
              ))}
            </View>
            <Card variant="avertissement">
              <Text style={styles.warningText}>⚠ L&apos;agent encadreur ne signe jamais</Text>
            </Card>

            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Consultant international"
              value={store.terrestre.consultantInternational ?? ''}
              onChangeText={(v) => store.updateTerrestre({ consultantInternational: v })}
            />

            <View style={styles.row}>
              <TextInput
                editable={!readOnly}
                style={[styles.input, styles.flex1]}
                placeholder="Heure début*"
                value={store.terrestre.heureDebut ?? ''}
                onChangeText={(v) => store.updateTerrestre({ heureDebut: v })}
              />
              <TextInput
                editable={!readOnly}
                style={[styles.input, styles.flex1]}
                placeholder="Heure fin*"
                value={store.terrestre.heureFin ?? ''}
                onChangeText={(v) => store.updateTerrestre({ heureFin: v })}
              />
            </View>
            {errors.heureFin && <Text style={styles.error}>{errors.heureFin}</Text>}

            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Vitesse du vent (m/s)*"
              keyboardType="numeric"
              value={store.terrestre.vitesse_vent_ms != null ? String(store.terrestre.vitesse_vent_ms) : ''}
              onChangeText={(v) => store.updateTerrestre({ vitesse_vent_ms: v ? Number(v) : null })}
            />
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Température (°C)*"
              keyboardType="numeric"
              value={store.terrestre.temperature_c != null ? String(store.terrestre.temperature_c) : ''}
              onChangeText={(v) => store.updateTerrestre({ temperature_c: v ? Number(v) : null })}
            />
            <Text style={styles.label}>Direction du vent</Text>
            <View style={styles.chipRow}>
              {DIRECTIONS_VENT.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={store.terrestre.direction_vent === d}
                  onPress={() => !readOnly && store.updateTerrestre({ direction_vent: d })}
                />
              ))}
            </View>

            <Text style={styles.label}>Reprise de traitement</Text>
            <View style={styles.chipRow}>
              <Chip label="Non" selected={!store.terrestre.repriseTraitement} onPress={() => !readOnly && store.updateTerrestre({ repriseTraitement: false, traitementOrigineId: null })} />
              <Chip label="Oui" selected={!!store.terrestre.repriseTraitement} onPress={() => !readOnly && store.updateTerrestre({ repriseTraitement: true })} />
            </View>
            {store.terrestre.repriseTraitement && (
              <View style={styles.chipRow}>
                {reprenables.map((r) => (
                  <Chip
                    key={r.id}
                    label={r.numero_fiche ?? r.id.slice(0, 8)}
                    selected={store.terrestre.traitementOrigineId === r.id}
                    onPress={() => !readOnly && store.updateTerrestre({ traitementOrigineId: r.id })}
                  />
                ))}
              </View>
            )}
            {errors.traitementOrigineId && <Text style={styles.error}>{errors.traitementOrigineId}</Text>}

            <Text style={styles.label}>Moyens & surfaces (ha)</Text>
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Atomiseur"
              keyboardType="numeric"
              value={store.terrestre.surface_atomiseur_ha != null ? String(store.terrestre.surface_atomiseur_ha) : ''}
              onChangeText={(v) => store.updateTerrestre({ surface_atomiseur_ha: v ? Number(v) : null })}
            />
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Disque rotatif"
              keyboardType="numeric"
              value={store.terrestre.surface_disque_rotatif_ha != null ? String(store.terrestre.surface_disque_rotatif_ha) : ''}
              onChangeText={(v) => store.updateTerrestre({ surface_disque_rotatif_ha: v ? Number(v) : null })}
            />
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="ULVAmast"
              keyboardType="numeric"
              value={store.terrestre.surface_ulvamast_ha != null ? String(store.terrestre.surface_ulvamast_ha) : ''}
              onChangeText={(v) => store.updateTerrestre({ surface_ulvamast_ha: v ? Number(v) : null })}
            />

            <Card variant="derivee">
              <Text style={styles.label}>Traitée (ha)</Text>
              <Text style={styles.derivedValue}>{surfaceTraitee}</Text>
            </Card>
            <Card variant="derivee">
              <Text style={styles.label}>Cumulée (ha)</Text>
              <Text style={styles.derivedValue}>{surfaceCumulee}</Text>
            </Card>
            <Card style={surfaceRestante > 0 ? styles.restanteCard : undefined} variant="derivee">
              <Text style={styles.label}>Restante (ha)</Text>
              <Text style={styles.derivedValue}>{surfaceRestante}</Text>
            </Card>

            {surfaceRestante > 0 && (
              <>
                <Text style={styles.label}>Surface restante abandonnée ?</Text>
                <View style={styles.chipRow}>
                  <Chip
                    label={store.terrestre.surfaceRestanteAbandonnee === null || store.terrestre.surfaceRestanteAbandonnee === undefined ? 'À trancher' : 'Non'}
                    selected={store.terrestre.surfaceRestanteAbandonnee === false}
                    onPress={() => !readOnly && store.updateTerrestre({ surfaceRestanteAbandonnee: false })}
                  />
                  <Chip
                    label="Oui"
                    selected={store.terrestre.surfaceRestanteAbandonnee === true}
                    onPress={() => !readOnly && store.updateTerrestre({ surfaceRestanteAbandonnee: true })}
                  />
                </View>
                {errors.surfaceRestanteAbandonnee && <Text style={styles.error}>{errors.surfaceRestanteAbandonnee}</Text>}
                {store.terrestre.surfaceRestanteAbandonnee && (
                  <TextInput
                    editable={!readOnly}
                    style={styles.input}
                    placeholder="Motif d'abandon*"
                    value={store.terrestre.motifSurfaceRestanteAbandonnee ?? ''}
                    onChangeText={(v) => store.updateTerrestre({ motifSurfaceRestanteAbandonnee: v })}
                  />
                )}
                {errors.motifSurfaceRestanteAbandonnee && <Text style={styles.error}>{errors.motifSurfaceRestanteAbandonnee}</Text>}
              </>
            )}

            <Text style={styles.label}>Produits utilisés</Text>
            {produits.map((produit, index) => (
              <Card key={produit.localId} style={styles.rotationCard}>
                <View style={styles.rotationHeader}>
                  <Text style={styles.rotationTitle}>Produit {index + 1}</Text>
                  {produits.length > 1 && !readOnly && (
                    <TouchableOpacity onPress={() => setProduits((prev) => prev.filter((p) => p.localId !== produit.localId))}>
                      <Text style={styles.removeButton}>×</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <View style={styles.chipRow}>
                  {pesticides.map((p) => (
                    <Chip
                      key={p.id}
                      label={p.nom}
                      selected={produit.produit_id === p.id}
                      onPress={() =>
                        !readOnly &&
                        setProduits((prev) => prev.map((x) => (x.localId === produit.localId ? { ...x, produit_id: p.id } : x)))
                      }
                    />
                  ))}
                </View>
                <TextInput
                  editable={!readOnly}
                  style={styles.input}
                  placeholder="Quantité (l)"
                  keyboardType="numeric"
                  value={produit.quantite_l != null ? String(produit.quantite_l) : ''}
                  onChangeText={(v) =>
                    setProduits((prev) =>
                      prev.map((x) => (x.localId === produit.localId ? { ...x, quantite_l: v ? Number(v) : null } : x))
                    )
                  }
                />
              </Card>
            ))}
            {!readOnly && (
              <TouchableOpacity
                style={styles.addButton}
                onPress={() => setProduits((prev) => [...prev, { localId: generateId() }])}
              >
                <Text style={styles.addButtonText}>+ Ajouter un produit</Text>
              </TouchableOpacity>
            )}
            <Card variant="derivee">
              <Text style={styles.label}>Total pesticide (l)</Text>
              <Text style={styles.derivedValue}>{totalPesticideTerrestre}</Text>
            </Card>

            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Essence (l)"
              keyboardType="numeric"
              value={store.terrestre.essence_litres != null ? String(store.terrestre.essence_litres) : ''}
              onChangeText={(v) => store.updateTerrestre({ essence_litres: v ? Number(v) : null })}
            />
            <TextInput
              editable={!readOnly}
              style={styles.input}
              placeholder="Nombre de piles"
              keyboardType="numeric"
              value={store.terrestre.nb_piles != null ? String(store.terrestre.nb_piles) : ''}
              onChangeText={(v) => store.updateTerrestre({ nb_piles: v ? Number(v) : null })}
            />
          </>
        )}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  row: { flexDirection: 'row', gap: 8 },
  flex1: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
  warningText: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.corps, color: traitementColors.avertissementTexte },
  rotationCard: { gap: 8 },
  rotationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rotationTitle: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  removeButton: { fontFamily: traitementFonts.uiBold, fontSize: 18, color: traitementColors.danger, padding: 6 },
  addButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.chip,
  },
  addButtonText: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal, fontSize: traitementTypeSizes.corps },
  derivedValue: { fontFamily: traitementFonts.monoBold, fontSize: traitementTypeSizes.valeurDerivee, color: traitementColors.vertPrincipal },
  restanteCard: { backgroundColor: traitementColors.avertissementTexte },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});
