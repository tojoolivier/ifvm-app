import { Fragment } from 'react';
import { View, Text, TextInput } from 'react-native';
import { UtilisateurEquipe } from '@/lib/referentiel-db';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { Chip } from '@/components/traitement/Chip';
import { UtilisateurSelectField } from '@/components/traitement/UtilisateurSelectField';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  pilotes: UtilisateurEquipe[];
  mecaniciens: UtilisateurEquipe[];
  consultants: UtilisateurEquipe[];
  onPilotesChange: (utilisateurs: UtilisateurEquipe[]) => void;
  onMecaniciensChange: (utilisateurs: UtilisateurEquipe[]) => void;
  onConsultantsChange: (utilisateurs: UtilisateurEquipe[]) => void;
  error?: string;
}

/**
 * Branche aérienne de l'écran C (Équipe), extraite de traitement.tsx — #91.
 *
 * Ne porte plus les rotations/pesticides embarqués (migration 0047, #Ticket 7) :
 * déplacés vers le nouvel écran dédié « Pesticides & rotations »
 * (app/(traitement)/rotations.tsx), inséré juste après celui-ci dans le flux aérien —
 * y compris « Surface traitée (ha) », devenue une valeur dérivée des rotations plutôt
 * qu'une saisie directe, et donc affichée là-bas plutôt qu'ici.
 *
 * Pilote/mécanicien/consultant international sont désormais sélectionnés parmi les
 * utilisateurs du référentiel (avec création à la volée) via `UtilisateurSelectField`,
 * plutôt que saisis en texte libre — cf. migration backend 0047 (pilote_id/mecanicien_id/
 * consultant_id, FK vers `utilisateur`).
 */
export function AerienForm({
  readOnly,
  chefsDeBase,
  pilotes,
  mecaniciens,
  consultants,
  onPilotesChange,
  onMecaniciensChange,
  onConsultantsChange,
  error,
}: AerienFormProps) {
  const store = useTraitementCaptureStore();

  return (
    <Fragment>
      <Text style={styles.label}>Pilote *</Text>
      <UtilisateurSelectField
        utilisateurs={pilotes}
        selectedId={store.aerien.piloteId}
        onSelect={(piloteId) => store.updateAerien({ piloteId })}
        onUtilisateursChange={onPilotesChange}
        role="pilote"
        readOnly={readOnly}
      />
      <Text style={styles.label}>Mécanicien *</Text>
      <UtilisateurSelectField
        utilisateurs={mecaniciens}
        selectedId={store.aerien.mecanicienId}
        onSelect={(mecanicienId) => store.updateAerien({ mecanicienId })}
        onUtilisateursChange={onMecaniciensChange}
        role="mecanicien"
        readOnly={readOnly}
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
      <UtilisateurSelectField
        utilisateurs={consultants}
        selectedId={store.aerien.consultantId}
        onSelect={(consultantId) => store.updateAerien({ consultantId })}
        onUtilisateursChange={onConsultantsChange}
        role="consultant_international"
        facultatif
        readOnly={readOnly}
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
