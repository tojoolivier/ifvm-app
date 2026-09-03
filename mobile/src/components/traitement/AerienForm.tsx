import { Fragment } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { UtilisateurEquipe, Pesticide } from '@/lib/referentiel-db';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { computeNbRotations, computeTotalPesticideAerien, deriveNomCommercial } from '@/lib/traitement-validation';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProduitSelectField } from '@/components/traitement/ProduitSelectField';
import { TimeField } from '@/components/traitement/TimeField';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  pesticides: Pesticide[];
  surfaceRestante: number | null;
  pesticideStockRestant: number | null;
  error?: string;
}

/** Branche aérienne de l'écran C (Traitement), extraite de traitement.tsx — #91. */
export function AerienForm({
  readOnly,
  chefsDeBase,
  pesticides,
  surfaceRestante,
  pesticideStockRestant,
  error,
}: AerienFormProps) {
  const store = useTraitementCaptureStore();
  const nbRotations = computeNbRotations(store.aerien.rotations);
  const totalPesticideAerien = computeTotalPesticideAerien(store.aerien.rotations);

  return (
    <Fragment>
      <Text style={styles.label}>Pilote *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom du pilote"
        value={store.aerien.pilote ?? ''}
        onChangeText={(v) => store.updateAerien({ pilote: v })}
      />
      <Text style={styles.label}>Mécanicien *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom du mécanicien"
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
      <Text style={styles.label}>Consultant international</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom du consultant (facultatif)"
        value={store.aerien.consultantInternational ?? ''}
        onChangeText={(v) => store.updateAerien({ consultantInternational: v })}
      />
      <Text style={styles.label}>Immatriculation aéronef</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Ex. 5R-ABC"
        value={store.aerien.immatriculationAeronef ?? ''}
        onChangeText={(v) => store.updateAerien({ immatriculationAeronef: v })}
      />

      <Text style={styles.label}>Surface traitée (ha)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.aerien.surfaceTraiteeHa != null ? String(store.aerien.surfaceTraiteeHa) : ''}
        onChangeText={(v) => store.updateAerien({ surfaceTraiteeHa: v ? Number(v) : null })}
      />
      {surfaceRestante != null && (
        <Card variant="derivee">
          <Text style={styles.label}>Surface restante (ha)</Text>
          <Text style={styles.derivedValue}>{surfaceRestante}</Text>
        </Card>
      )}

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
          <Text style={styles.label}>N° cuve *</Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Ex. C1"
            value={rotation.numero_cuve ?? ''}
            onChangeText={(v) => store.updateRotation(rotation.localId, { numero_cuve: v })}
          />
          <Text style={styles.label}>Quantité (l) *</Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="0"
            keyboardType="numeric"
            value={rotation.quantite_l != null ? String(rotation.quantite_l) : ''}
            onChangeText={(v) => store.updateRotation(rotation.localId, { quantite_l: v ? Number(v) : null })}
          />
          <Text style={styles.label}>Produit / matières actives *</Text>
          <ProduitSelectField
            pesticides={pesticides}
            selectedId={rotation.produit_id}
            readOnly={readOnly}
            onSelect={(p) =>
              store.updateRotation(rotation.localId, {
                produit_id: p.id,
                nom_commercial: deriveNomCommercial(p.nom),
              })
            }
          />
          <Card variant="derivee">
            <Text style={styles.label}>Nom commercial</Text>
            <Text style={styles.derivedValue}>{rotation.nom_commercial || '—'}</Text>
          </Card>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Heure début *</Text>
              <TimeField
                editable={!readOnly}
                value={rotation.heure_debut ?? null}
                onChange={(v) => store.updateRotation(rotation.localId, { heure_debut: v })}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Heure fin *</Text>
              <TimeField
                editable={!readOnly}
                value={rotation.heure_fin ?? null}
                onChange={(v) => store.updateRotation(rotation.localId, { heure_fin: v })}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Température début (°C) *</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.temperature_debut_c != null ? String(rotation.temperature_debut_c) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_debut_c: v ? Number(v) : null })}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Température fin (°C) *</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.temperature_fin_c != null ? String(rotation.temperature_fin_c) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { temperature_fin_c: v ? Number(v) : null })}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text style={styles.label}>Vitesse du vent début (m/s) *</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.vent_debut_ms != null ? String(rotation.vent_debut_ms) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { vent_debut_ms: v ? Number(v) : null })}
              />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.label}>Vitesse du vent fin (m/s) *</Text>
              <TextInput
                editable={!readOnly}
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={rotation.vent_fin_ms != null ? String(rotation.vent_fin_ms) : ''}
                onChangeText={(v) => store.updateRotation(rotation.localId, { vent_fin_ms: v ? Number(v) : null })}
              />
            </View>
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

      <Text style={styles.label}>Pesticide reçu (l)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.aerien.pesticideRecuL != null ? String(store.aerien.pesticideRecuL) : ''}
        onChangeText={(v) => store.updateAerien({ pesticideRecuL: v ? Number(v) : null })}
      />
      {pesticideStockRestant != null && (
        <Card variant="derivee">
          <Text style={styles.label}>Reste en stock (l)</Text>
          <Text style={styles.derivedValue}>{pesticideStockRestant}</Text>
        </Card>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
    </Fragment>
  );
}
