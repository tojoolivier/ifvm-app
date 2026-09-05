import { Fragment } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LieuAerien, UtilisateurEquipe } from '@/lib/referentiel-db';
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
  lieuxAeriens: LieuAerien[];
  onPilotesChange: (utilisateurs: UtilisateurEquipe[]) => void;
  onMecaniciensChange: (utilisateurs: UtilisateurEquipe[]) => void;
  onConsultantsChange: (utilisateurs: UtilisateurEquipe[]) => void;
  error?: string;
}

/**
 * Type de lieu du référentiel `lieu_aerien` -> le champ qu'il alimente sur cet
 * écran. Contrairement au sélecteur BASE de la prospection extensive aérienne
 * (une seule FK, tous les types confondus), le traitement porte trois FK
 * distinctes — chacune filtrée sur le type de lieu qui lui correspond.
 */
const HINT_VIDE: Record<string, string> = {
  principale: 'Aucune base principale disponible — à créer depuis l’administration web (Référentiels → Lieux aériens).',
  stand: 'Aucun stand disponible — à créer depuis l’administration web (Référentiels → Lieux aériens).',
  secondaire: 'Aucune base secondaire disponible — à créer depuis l’administration web (Référentiels → Lieux aériens).',
};

function LieuPicker({
  typeLieu,
  lieuxAeriens,
  selectedId,
  onSelect,
  readOnly,
  facultatif,
}: {
  typeLieu: 'principale' | 'stand' | 'secondaire';
  lieuxAeriens: LieuAerien[];
  selectedId: string | null | undefined;
  onSelect: (id: string | null) => void;
  readOnly: boolean;
  facultatif?: boolean;
}) {
  const options = lieuxAeriens.filter((lieu) => lieu.type_lieu === typeLieu);
  if (options.length === 0) {
    return <Text style={styles.error}>{HINT_VIDE[typeLieu]}</Text>;
  }
  return (
    <View style={styles.pickerBox}>
      <Picker
        enabled={!readOnly}
        selectedValue={selectedId ?? ''}
        onValueChange={(value) => onSelect(value === '' ? null : String(value))}
        style={styles.picker}
      >
        {facultatif && <Picker.Item label="— Aucun —" value="" />}
        {options.map((lieu) => (
          <Picker.Item key={lieu.id} label={lieu.nom} value={lieu.id} />
        ))}
      </Picker>
    </View>
  );
}

/**
 * Branche aérienne de l'écran C (Équipe), extraite de traitement.tsx — #91.
 *
 * Ne porte plus les rotations/pesticides embarqués (migration 0047, #Ticket 7) ni
 * le pesticide reçu (#equipe-slide-aerien) : déplacés vers l'écran dédié
 * « Traitement » (app/(traitement)/rotations.tsx), inséré juste après celui-ci
 * dans le flux aérien — y compris « Surface traitée (ha) », devenue une valeur
 * dérivée des rotations plutôt qu'une saisie directe, et donc affichée là-bas
 * plutôt qu'ici.
 *
 * Pilote/mécanicien/consultant international sont sélectionnés parmi les
 * utilisateurs du référentiel (avec création à la volée) via `UtilisateurSelectField`
 * (ticket 5), et base principale/stand/base secondaire parmi le référentiel
 * `lieu_aerien` (ticket 4) — jamais de champ texte libre lorsque le référentiel
 * correspondant existe. Chef de base/pilote/mécanicien doivent être deux-à-deux
 * distincts, validé par `validateAerienEquipe` (traitement-validation.ts) avant de
 * continuer — le consultant reste facultatif et exempté de cette règle.
 */
export function AerienForm({
  readOnly,
  chefsDeBase,
  pilotes,
  mecaniciens,
  consultants,
  lieuxAeriens,
  onPilotesChange,
  onMecaniciensChange,
  onConsultantsChange,
  error,
}: AerienFormProps) {
  const store = useTraitementCaptureStore();

  return (
    <Fragment>
      <Text style={styles.label}>Chef de base *</Text>
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
      <Text style={styles.label}>Consultant</Text>
      <UtilisateurSelectField
        utilisateurs={consultants}
        selectedId={store.aerien.consultantId}
        onSelect={(consultantId) => store.updateAerien({ consultantId })}
        onUtilisateursChange={onConsultantsChange}
        role="consultant_international"
        facultatif
        readOnly={readOnly}
      />
      {error && <Text style={styles.error}>{error}</Text>}

      <Text style={styles.label}>Immatriculation aéronef *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Ex. 5R-ABC"
        value={store.aerien.immatriculationAeronef ?? ''}
        onChangeText={(v) => store.updateAerien({ immatriculationAeronef: v })}
      />

      <Text style={styles.label}>Base principale *</Text>
      <LieuPicker
        typeLieu="principale"
        lieuxAeriens={lieuxAeriens}
        selectedId={store.aerien.lieuBasePrincipaleId}
        onSelect={(id) => store.updateAerien({ lieuBasePrincipaleId: id })}
        readOnly={readOnly}
      />

      <Text style={styles.label}>Stand</Text>
      <LieuPicker
        typeLieu="stand"
        lieuxAeriens={lieuxAeriens}
        selectedId={store.aerien.lieuStandId}
        onSelect={(id) => store.updateAerien({ lieuStandId: id })}
        readOnly={readOnly}
        facultatif
      />

      <Text style={styles.label}>Base secondaire</Text>
      <LieuPicker
        typeLieu="secondaire"
        lieuxAeriens={lieuxAeriens}
        selectedId={store.aerien.lieuBaseSecondaireId}
        onSelect={(id) => store.updateAerien({ lieuBaseSecondaireId: id })}
        readOnly={readOnly}
        facultatif
      />
    </Fragment>
  );
}
