import { Fragment } from 'react';
import { View, Text, TextInput } from 'react-native';
import { UtilisateurEquipe } from '@/lib/referentiel-db';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { Chip } from '@/components/traitement/Chip';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  error?: string;
}

/**
 * Branche aérienne de l'écran C (Équipe), extraite de traitement.tsx — #91.
 *
 * Ne porte plus les rotations/pesticides embarqués (migration 0046, #Ticket 7) :
 * déplacés vers le nouvel écran dédié « Pesticides & rotations »
 * (app/(traitement)/rotations.tsx), inséré juste après celui-ci dans le flux aérien —
 * y compris « Surface traitée (ha) », devenue une valeur dérivée des rotations plutôt
 * qu'une saisie directe, et donc affichée là-bas plutôt qu'ici.
 */
export function AerienForm({ readOnly, chefsDeBase, error }: AerienFormProps) {
  const store = useTraitementCaptureStore();

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

      <Text style={styles.label}>Pesticide reçu (l)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="numeric"
        value={store.aerien.pesticideRecuL != null ? String(store.aerien.pesticideRecuL) : ''}
        onChangeText={(v) => store.updateAerien({ pesticideRecuL: v ? Number(v) : null })}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </Fragment>
  );
}
