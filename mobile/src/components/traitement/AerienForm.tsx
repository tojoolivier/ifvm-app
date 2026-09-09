import { Fragment } from 'react';
import { View, Text, TextInput } from 'react-native';
import { UtilisateurEquipe } from '@/lib/referentiel-db';
import { DraftTraitementRow } from '@/lib/traitement-repository';
import { useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import { Chip } from '@/components/traitement/Chip';
import { DateField } from '@/components/traitement/DateField';
import { formStyles as styles } from '@/components/traitement/TraitementFormStyles';

export interface AerienFormProps {
  readOnly: boolean;
  chefsDeBase: UtilisateurEquipe[];
  // Chaînage de reprise (migration backend 0050) — mirroir de TerrestreFormProps.
  reprenables: DraftTraitementRow[];
  errors: Record<string, string>;
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
 * Base principale/stand/base secondaire redeviennent elles aussi du texte libre
 * (migration backend 0054, #traitement-aerien-base-texte-libre — même retour en
 * arrière, ticket 4 cette fois) : base principale obligatoire, stand et base
 * secondaire facultatifs, aucune dépendance au référentiel `lieu_aerien` (qui
 * reste utilisé par la prospection extensive aérienne, inchangée). Chef de
 * base/pilote/mécanicien doivent être deux-à-deux distincts (comparaison par
 * nom, plus par id), validé par `validateAerienEquipe` (traitement-validation.ts)
 * avant de continuer — le consultant reste facultatif et exempté de cette règle.
 */
export function AerienForm({
  readOnly,
  chefsDeBase,
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
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom de la base principale"
        value={store.aerien.basePrincipale ?? ''}
        onChangeText={(v) => store.updateAerien({ basePrincipale: v })}
      />

      {/* Date d'installation (migration backend 0056,
          #stand-base-secondaire-date-installation) — facultative et indépendante
          du texte libre du Stand/de la Base secondaire lui-même : chacune des 4
          combinaisons (renseigné/vide croisé) est acceptée. Aucun champ
          équivalent pour Base principale, hors périmètre de cette demande. */}
      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Stand</Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Nom du stand (facultatif)"
            value={store.aerien.stand ?? ''}
            onChangeText={(v) => store.updateAerien({ stand: v || null })}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Date d’installation</Text>
          <DateField
            editable={!readOnly}
            value={store.aerien.standDateInstallation ?? null}
            onChange={(v) => store.updateAerien({ standDateInstallation: v })}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex1}>
          <Text style={styles.label}>Base secondaire</Text>
          <TextInput
            editable={!readOnly}
            style={styles.input}
            placeholder="Nom de la base secondaire (facultatif)"
            value={store.aerien.baseSecondaire ?? ''}
            onChangeText={(v) => store.updateAerien({ baseSecondaire: v || null })}
          />
        </View>
        <View style={styles.flex1}>
          <Text style={styles.label}>Date d’installation</Text>
          <DateField
            editable={!readOnly}
            value={store.aerien.baseSecondaireDateInstallation ?? null}
            onChange={(v) => store.updateAerien({ baseSecondaireDateInstallation: v })}
          />
        </View>
      </View>

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
