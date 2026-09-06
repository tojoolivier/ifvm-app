import { Fragment } from 'react';
import { View, Text, TextInput } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { LieuAerien, UtilisateurEquipe } from '@/lib/referentiel-db';
import { DraftTraitementRow } from '@/lib/traitement-repository';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { Chip } from '@/components/traitement/Chip';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  lieuxAeriens: LieuAerien[];
  // Chaînage de reprise (migration backend 0050) — mirroir de TerrestreFormProps.
  reprenables: DraftTraitementRow[];
  errors: Record<string, string>;
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
 * Pilote/mécanicien/consultant international sont redevenus du texte libre
 * (migration backend 0048 — retour en arrière après livraison de la sélection
 * référentiel, ticket 5) : pilote/mécanicien obligatoires, consultant facultatif.
 * Base principale/stand/base secondaire restent sélectionnées dans le référentiel
 * `lieu_aerien` (ticket 4), inchangé. Chef de base/pilote/mécanicien doivent être
 * deux-à-deux distincts (comparaison par nom, plus par id), validé par
 * `validateAerienEquipe` (traitement-validation.ts) avant de continuer — le
 * consultant reste facultatif et exempté de cette règle.
 */
export function AerienForm({
  readOnly,
  chefsDeBase,
  lieuxAeriens,
  reprenables,
  errors,
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
      <Text style={styles.label}>Consultant</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom du consultant (facultatif)"
        value={store.aerien.consultantInternational ?? ''}
        onChangeText={(v) => store.updateAerien({ consultantInternational: v || null })}
      />
      {errors.aerien && <Text style={styles.error}>{errors.aerien}</Text>}

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

      {/* Chaînage de reprise (migration backend 0050) — mirroir exact du bloc
          équivalent dans TerrestreForm. */}
      <Text style={styles.label}>Reprise de traitement</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Non"
          selected={!store.aerien.repriseTraitement}
          onPress={() => !readOnly && store.updateAerien({ repriseTraitement: false, traitementOrigineId: null })}
        />
        <Chip label="Oui" selected={!!store.aerien.repriseTraitement} onPress={() => !readOnly && store.updateAerien({ repriseTraitement: true })} />
      </View>
      {store.aerien.repriseTraitement && (
        <View style={styles.chipRow}>
          {reprenables.map((r) => (
            <Chip
              key={r.id}
              label={r.numero_fiche ?? r.id.slice(0, 8)}
              selected={store.aerien.traitementOrigineId === r.id}
              onPress={() => !readOnly && store.updateAerien({ traitementOrigineId: r.id })}
            />
          ))}
        </View>
      )}
      {errors.traitementOrigineId && <Text style={styles.error}>{errors.traitementOrigineId}</Text>}
    </Fragment>
  );
}
