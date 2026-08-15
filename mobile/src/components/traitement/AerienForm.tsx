import { Fragment } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { UtilisateurEquipe, Pesticide } from '@/lib/referentiel-db';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { computeNbRotations, computeTotalPesticideAerien } from '@/lib/traitement-validation';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  pesticides: Pesticide[];
  error?: string;
}

/** Branche aérienne de l'écran C (Traitement), extraite de traitement.tsx — #91. */
export function AerienForm({ readOnly, chefsDeBase, pesticides, error }: AerienFormProps) {
  const store = useTraitementCaptureStore();
  const nbRotations = computeNbRotations(store.aerien.rotations);
  const totalPesticideAerien = computeTotalPesticideAerien(store.aerien.rotations);

  return (
    <Fragment>
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
      {error && <Text style={styles.error}>{error}</Text>}
    </Fragment>
  );
}
