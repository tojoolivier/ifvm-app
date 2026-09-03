import { Fragment } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { UtilisateurEquipe, Pesticide } from '@/lib/referentiel-db';
import { DraftTraitementRow } from '@/lib/traitement-repository';
import { ProduitDraft, useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { deriveNomCommercial } from '@/lib/traitement-validation';
import { generateId } from '@/lib/id';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { TimeField } from '@/components/traitement/TimeField';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

const DIRECTIONS_VENT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

export interface TerrestreFormProps {
  readOnly: boolean;
  chefsEquipe: UtilisateurEquipe[];
  agentsEncadreurs: UtilisateurEquipe[];
  reprenables: DraftTraitementRow[];
  pesticides: Pesticide[];
  produits: ProduitDraft[];
  setProduits: (updater: (prev: ProduitDraft[]) => ProduitDraft[]) => void;
  surfaceTraitee: number;
  surfaceCumulee: number;
  surfaceRestante: number;
  totalPesticideTerrestre: number;
  pesticideStockRestant: number | null;
  errors: Record<string, string>;
}

/** Branche terrestre de l'écran C (Traitement), extraite de traitement.tsx — #91. */
export function TerrestreForm({
  readOnly,
  chefsEquipe,
  agentsEncadreurs,
  reprenables,
  pesticides,
  produits,
  setProduits,
  surfaceTraitee,
  surfaceCumulee,
  surfaceRestante,
  totalPesticideTerrestre,
  pesticideStockRestant,
  errors,
}: TerrestreFormProps) {
  const store = useTraitementCaptureStore();

  return (
    <Fragment>
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

      <Text style={styles.label}>Consultant international</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom du consultant (facultatif)"
        value={store.terrestre.consultantInternational ?? ''}
        onChangeText={(v) => store.updateTerrestre({ consultantInternational: v })}
      />

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Heure début*</Text>
          <TimeField
            editable={!readOnly}
            value={store.terrestre.heureDebut ?? null}
            onChange={(v) => store.updateTerrestre({ heureDebut: v })}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Heure fin*</Text>
          <TimeField
            editable={!readOnly}
            value={store.terrestre.heureFin ?? null}
            onChange={(v) => store.updateTerrestre({ heureFin: v })}
          />
        </View>
      </View>
      {errors.heureFin && <Text style={styles.error}>{errors.heureFin}</Text>}

      <Text style={styles.label}>Vitesse du vent (m/s) *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.vitesse_vent_ms != null ? String(store.terrestre.vitesse_vent_ms) : ''}
        onChangeText={(v) => store.updateTerrestre({ vitesse_vent_ms: v ? Number(v) : null })}
      />
      <Text style={styles.label}>Température (°C) *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
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
        <Chip
          label="Non"
          selected={!store.terrestre.repriseTraitement}
          onPress={() => !readOnly && store.updateTerrestre({ repriseTraitement: false, traitementOrigineId: null })}
        />
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

      <Text style={styles.label}>Moyens &amp; surfaces (ha)</Text>
      <Text style={styles.label}>Atomiseur</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.surface_atomiseur_ha != null ? String(store.terrestre.surface_atomiseur_ha) : ''}
        onChangeText={(v) => store.updateTerrestre({ surface_atomiseur_ha: v ? Number(v) : null })}
      />
      <Text style={styles.label}>Disque rotatif</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.surface_disque_rotatif_ha != null ? String(store.terrestre.surface_disque_rotatif_ha) : ''}
        onChangeText={(v) => store.updateTerrestre({ surface_disque_rotatif_ha: v ? Number(v) : null })}
      />
      <Text style={styles.label}>ULVAmast</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
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
        <Fragment>
          <Text style={styles.label}>Surface restante abandonnée ?</Text>
          <View style={styles.chipRow}>
            <Chip
              label={
                store.terrestre.surfaceRestanteAbandonnee === null || store.terrestre.surfaceRestanteAbandonnee === undefined
                  ? 'À trancher'
                  : 'Non'
              }
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
            <Fragment>
              <Text style={styles.label}>Motif d&apos;abandon *</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="Ex. Zone inaccessible (crue)"
                value={store.terrestre.motifSurfaceRestanteAbandonnee ?? ''}
                onChangeText={(v) => store.updateTerrestre({ motifSurfaceRestanteAbandonnee: v })}
              />
            </Fragment>
          )}
          {errors.motifSurfaceRestanteAbandonnee && <Text style={styles.error}>{errors.motifSurfaceRestanteAbandonnee}</Text>}
        </Fragment>
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
          <Text style={styles.label}>Produit / matières actives</Text>
          <View style={styles.chipRow}>
            {pesticides.map((p) => (
              <Chip
                key={p.id}
                label={p.nom}
                selected={produit.produit_id === p.id}
                onPress={() =>
                  !readOnly &&
                  setProduits((prev) =>
                    prev.map((x) =>
                      x.localId === produit.localId
                        ? { ...x, produit_id: p.id, nom_commercial: deriveNomCommercial(p.nom) }
                        : x
                    )
                  )
                }
              />
            ))}
          </View>
          <Card variant="derivee">
            <Text style={styles.label}>Nom commercial</Text>
            <Text style={styles.derivedValue}>{produit.nom_commercial || '—'}</Text>
          </Card>
          <Text style={styles.label}>Quantité (l)</Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="0"
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
        <TouchableOpacity style={styles.addButton} onPress={() => setProduits((prev) => [...prev, { localId: generateId() }])}>
          <Text style={styles.addButtonText}>+ Ajouter un produit</Text>
        </TouchableOpacity>
      )}
      <Card variant="derivee">
        <Text style={styles.label}>Total pesticide (l)</Text>
        <Text style={styles.derivedValue}>{totalPesticideTerrestre}</Text>
      </Card>

      <Text style={styles.label}>Pesticide reçu (l)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.pesticideRecuL != null ? String(store.terrestre.pesticideRecuL) : ''}
        onChangeText={(v) => store.updateTerrestre({ pesticideRecuL: v ? Number(v) : null })}
      />
      {pesticideStockRestant != null && (
        <Card variant="derivee">
          <Text style={styles.label}>Reste en stock (l)</Text>
          <Text style={styles.derivedValue}>{pesticideStockRestant}</Text>
        </Card>
      )}

      <Text style={styles.label}>Essence (l)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.essence_litres != null ? String(store.terrestre.essence_litres) : ''}
        onChangeText={(v) => store.updateTerrestre({ essence_litres: v ? Number(v) : null })}
      />
      <Text style={styles.label}>Nombre de piles</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.terrestre.nb_piles != null ? String(store.terrestre.nb_piles) : ''}
        onChangeText={(v) => store.updateTerrestre({ nb_piles: v ? Number(v) : null })}
      />
    </Fragment>
  );
}
