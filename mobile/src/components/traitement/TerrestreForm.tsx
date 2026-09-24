import { Fragment, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { UtilisateurEquipe, Pesticide } from '@/lib/referentiel-db';
import { ProduitDraft, useTraitementCaptureStore } from '@/lib/traitement-capture-store';
import {
  computePesticideConsommeSuggere,
  deriveNomCommercial,
  messageTemperatureTropElevee,
  messageVentTropFort,
} from '@/lib/traitement-validation';
import { generateId } from '@/lib/id';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProduitSelectField } from '@/components/traitement/ProduitSelectField';
import { TimeField } from '@/components/traitement/TimeField';
import { useFormStyles } from '@/components/traitement/TraitementFormStyles';

const DIRECTIONS_VENT = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

// Saisie francophone : la virgule est le séparateur décimal attendu par l'utilisateur,
// mais JS/JSON n'utilisent que le point en interne — même paire de fonctions que
// rotations.tsx/veg.tsx/synthese.tsx/moyens.tsx (#326), pas mutualisée pour l'instant
// (cf. commentaire équivalent là-bas). Sans conversion, taper "3,2" produisait
// `Number("3,2")` = `NaN`, aussitôt réaffiché tel quel par `String(NaN)` — la valeur
// saisie semblait « disparaître », remplacée par "NaN" (#terrestre-decimales-virgule).
function parseDecimalInput(raw: string): number | null {
  if (raw === '') return null;
  const val = Number(raw.replace(',', '.'));
  return isNaN(val) ? null : val;
}

function formatDecimalDisplay(value: number | null | undefined): string {
  return value != null ? String(value).replace('.', ',') : '';
}

type TerrestreDecimalField =
  | 'vitesse_vent_ms'
  | 'temperature_c'
  | 'surface_atomiseur_ha'
  | 'surface_atomiseur_autoporte_ha'
  | 'surface_disque_rotatif_ha'
  | 'taux_mortalite_pourcent'
  | 'evaluation_efficacite_heures_apres'
  | 'stockInitialL'
  | 'pesticideRecuL';

export interface TerrestreFormProps {
  readOnly: boolean;
  chefsEquipe: UtilisateurEquipe[];
  pesticides: Pesticide[];
  produits: ProduitDraft[];
  setProduits: (updater: (prev: ProduitDraft[]) => ProduitDraft[]) => void;
  surfaceTraitee: number;
  surfaceCumulee: number;
  surfaceRestante: number;
  totalPesticideTerrestre: number;
  // « Stock Final » affiché à l'écran — intègre désormais stockInitialL en plus
  // de pesticideRecuL (migration backend 0075, #stock-initial-terrestre) ;
  // nom de prop conservé tel quel malgré le renommage du libellé affiché.
  pesticideStockRestant: number | null;
  errors: Record<string, string>;
}

/** Branche terrestre de l'écran C (Traitement), extraite de traitement.tsx — #91. */
export function TerrestreForm({
  readOnly,
  chefsEquipe,
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
  const styles = useFormStyles();
  // Unité pour toute la section « Produits utilisés » (#produits-unite-l-kg) —
  // un seul choix pour toute la fiche, gouverne les 5 libellés ci-dessous.
  const unite = store.terrestre.pesticideUnite ?? 'L';
  // Texte brut en cours de saisie pour les champs décimaux libres de cet écran —
  // permet de taper un séparateur décimal ou un zéro de fin ("3," / "3,2") sans que
  // le champ ne se reformate à chaque frappe (cf. `formatDecimalDisplay` sinon
  // appelé sur une valeur encore inexploitable). Un objet pour les champs
  // `store.terrestre`, un autre indexé par produit (`localId`) pour la quantité.
  const [decimalDrafts, setDecimalDrafts] = useState<Partial<Record<TerrestreDecimalField, string>>>({});
  const [produitDrafts, setProduitDrafts] = useState<Record<string, string>>({});

  // Pré-remplit « Pesticides consommés » selon le mode de traitement et l'unité
  // choisie (#pesticide-consomme-suggere-mode-traitement) — sur chaque produit
  // de la liste, mais jamais d'écrasement d'une valeur saisie à la main : on
  // ne retouche que les produits vides, ou dont la valeur actuelle est encore
  // exactement celle qu'on y a nous-même posée précédemment (`autoFillRef`).
  // Recalcule/efface aussi la suggestion périmée si l'agent change ensuite le
  // mode ou l'unité (ex. Barrière -> kg, sans formule) : sans ce suivi, une
  // valeur posée au montage sous une combinaison (mode, unité) resterait
  // affichée telle quelle après un changement, silencieusement fausse.
  const autoFillRef = useRef<Record<string, number>>({});
  useEffect(() => {
    if (readOnly) return;
    const suggestion = computePesticideConsommeSuggere(store.ref.modeTraitement, unite, surfaceCumulee);
    setProduits((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        const posePar_nous = autoFillRef.current[p.localId];
        const modifiableParNous = p.quantite_l == null || posePar_nous === p.quantite_l;
        if (!modifiableParNous) return p;
        if (suggestion === null) {
          if (posePar_nous !== undefined) delete autoFillRef.current[p.localId];
          if (p.quantite_l != null) {
            changed = true;
            return { ...p, quantite_l: null };
          }
          return p;
        }
        if (p.quantite_l === suggestion) return p;
        autoFillRef.current[p.localId] = suggestion;
        changed = true;
        return { ...p, quantite_l: suggestion };
      });
      return changed ? next : prev;
    });
  }, [readOnly, store.ref.modeTraitement, unite, surfaceCumulee, produits.length, setProduits]);

  const getDecimalDraft = (field: TerrestreDecimalField): string | undefined => decimalDrafts[field];

  const handleDecimalChange = (field: TerrestreDecimalField, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setDecimalDrafts((current) => ({ ...current, [field]: raw }));
    if (raw === '') {
      store.updateTerrestre({ [field]: null });
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    store.updateTerrestre({ [field]: val });
  };

  const clearDecimalDraft = (field: TerrestreDecimalField) => {
    setDecimalDrafts((current) => {
      if (current[field] === undefined) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  const getProduitDraft = (localId: string): string | undefined => produitDrafts[localId];

  const handleProduitQuantiteChange = (localId: string, raw: string) => {
    if (raw !== '' && !/^\d*[.,]?\d*$/.test(raw)) return;
    setProduitDrafts((current) => ({ ...current, [localId]: raw }));
    if (raw === '') {
      setProduits((prev) => prev.map((x) => (x.localId === localId ? { ...x, quantite_l: null } : x)));
      return;
    }
    if (raw.endsWith('.') || raw.endsWith(',')) return;
    const val = parseDecimalInput(raw);
    if (val === null) return;
    setProduits((prev) => prev.map((x) => (x.localId === localId ? { ...x, quantite_l: val } : x)));
  };

  const clearProduitDraft = (localId: string) => {
    setProduitDrafts((current) => {
      if (current[localId] === undefined) return current;
      const next = { ...current };
      delete next[localId];
      return next;
    });
  };

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
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="Nom de l'agent encadreur (facultatif)"
        value={store.terrestre.agentEncadreur ?? ''}
        onChangeText={(v) => store.updateTerrestre({ agentEncadreur: v })}
      />
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

      <Text style={styles.sectionTitle}>Condition de traitement</Text>
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
        keyboardType="decimal-pad"
        value={getDecimalDraft('vitesse_vent_ms') ?? formatDecimalDisplay(store.terrestre.vitesse_vent_ms)}
        onChangeText={(v) => handleDecimalChange('vitesse_vent_ms', v)}
        onBlur={() => clearDecimalDraft('vitesse_vent_ms')}
      />
      {/* #alerte-meteo-vent-temperature : avertissement en direct dès que la valeur
          dépasse le seuil ; « Continuer » reste refusé tant qu'elle n'est pas corrigée. */}
      {(messageVentTropFort(store.terrestre.vitesse_vent_ms) ?? errors.vitesseVentMs) && (
        <Text style={styles.error}>{messageVentTropFort(store.terrestre.vitesse_vent_ms) ?? errors.vitesseVentMs}</Text>
      )}
      <Text style={styles.label}>Température (°C) *</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={getDecimalDraft('temperature_c') ?? formatDecimalDisplay(store.terrestre.temperature_c)}
        onChangeText={(v) => handleDecimalChange('temperature_c', v)}
        onBlur={() => clearDecimalDraft('temperature_c')}
      />
      {(messageTemperatureTropElevee(store.terrestre.temperature_c) ?? errors.temperatureC) && (
        <Text style={styles.error}>
          {messageTemperatureTropElevee(store.terrestre.temperature_c) ?? errors.temperatureC}
        </Text>
      )}
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

      <Text style={styles.sectionTitle}>Traitement</Text>
      <Text style={styles.label}>Atomiseur à dos</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={getDecimalDraft('surface_atomiseur_ha') ?? formatDecimalDisplay(store.terrestre.surface_atomiseur_ha)}
        onChangeText={(v) => handleDecimalChange('surface_atomiseur_ha', v)}
        onBlur={() => clearDecimalDraft('surface_atomiseur_ha')}
      />
      <Text style={styles.label}>Atomiseur autoporté</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={
          getDecimalDraft('surface_atomiseur_autoporte_ha') ??
          formatDecimalDisplay(store.terrestre.surface_atomiseur_autoporte_ha)
        }
        onChangeText={(v) => handleDecimalChange('surface_atomiseur_autoporte_ha', v)}
        onBlur={() => clearDecimalDraft('surface_atomiseur_autoporte_ha')}
      />
      <Text style={styles.label}>Disque rotatif</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={getDecimalDraft('surface_disque_rotatif_ha') ?? formatDecimalDisplay(store.terrestre.surface_disque_rotatif_ha)}
        onChangeText={(v) => handleDecimalChange('surface_disque_rotatif_ha', v)}
        onBlur={() => clearDecimalDraft('surface_disque_rotatif_ha')}
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

      <Text style={styles.sectionTitle}>Efficacité</Text>
      <Text style={styles.label}>Taux de mortalité (%)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={
          getDecimalDraft('taux_mortalite_pourcent') ?? formatDecimalDisplay(store.terrestre.taux_mortalite_pourcent)
        }
        onChangeText={(v) => handleDecimalChange('taux_mortalite_pourcent', v)}
        onBlur={() => clearDecimalDraft('taux_mortalite_pourcent')}
      />
      <Text style={styles.label}>Évalué après traitement (heures)</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={
          getDecimalDraft('evaluation_efficacite_heures_apres') ??
          formatDecimalDisplay(store.terrestre.evaluation_efficacite_heures_apres)
        }
        onChangeText={(v) => handleDecimalChange('evaluation_efficacite_heures_apres', v)}
        onBlur={() => clearDecimalDraft('evaluation_efficacite_heures_apres')}
      />
      <Text style={styles.label}>Méthode d&apos;évaluation</Text>
      <View style={styles.chipRow}>
        <Chip
          label="Estimation visuelle"
          selected={store.terrestre.methode_evaluation_efficacite === 'ESTIMATION_VISUELLE'}
          onPress={() => !readOnly && store.updateTerrestre({ methode_evaluation_efficacite: 'ESTIMATION_VISUELLE' })}
        />
        <Chip
          label="Comptages pré/post-traitement"
          selected={store.terrestre.methode_evaluation_efficacite === 'COMPTAGES_PRE_POST'}
          onPress={() => !readOnly && store.updateTerrestre({ methode_evaluation_efficacite: 'COMPTAGES_PRE_POST' })}
        />
      </View>

      <Text style={styles.sectionTitle}>Produits utilisés</Text>
      <Text style={styles.label}>Unité</Text>
      <View style={styles.chipRow}>
        <Chip label="Litres (L)" selected={unite === 'L'} onPress={() => !readOnly && store.updateTerrestre({ pesticideUnite: 'L' })} />
        <Chip label="Kilos (kg)" selected={unite === 'kg'} onPress={() => !readOnly && store.updateTerrestre({ pesticideUnite: 'kg' })} />
      </View>
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
          <ProduitSelectField
            pesticides={pesticides}
            selectedId={produit.produit_id}
            readOnly={readOnly}
            onSelect={(p) =>
              setProduits((prev) =>
                prev.map((x) =>
                  x.localId === produit.localId
                    ? { ...x, produit_id: p.id, nom_commercial: deriveNomCommercial(p.nom) }
                    : x
                )
              )
            }
          />
          <Card variant="derivee">
            <Text style={styles.label}>Nom commercial</Text>
            <Text style={styles.derivedValue}>{produit.nom_commercial || '—'}</Text>
          </Card>
          <Text style={styles.label}>{`Pesticides consommés (${unite})`}</Text>
          <TextInput
            testID={`produit-quantite-input-${index}`}
            editable={!readOnly}
            style={styles.input}
            placeholder="0"
            keyboardType="decimal-pad"
            value={getProduitDraft(produit.localId) ?? formatDecimalDisplay(produit.quantite_l)}
            onChangeText={(v) => handleProduitQuantiteChange(produit.localId, v)}
            onBlur={() => clearProduitDraft(produit.localId)}
          />
        </Card>
      ))}
      {!readOnly && (
        <TouchableOpacity style={styles.addButton} onPress={() => setProduits((prev) => [...prev, { localId: generateId() }])}>
          <Text style={styles.addButtonText}>+ Ajouter un produit</Text>
        </TouchableOpacity>
      )}
      <Card variant="derivee">
        <Text style={styles.label}>{`Total pesticide (${unite})`}</Text>
        <Text style={styles.derivedValue}>{totalPesticideTerrestre}</Text>
      </Card>

      <Text style={styles.label}>{`Stock initial (${unite})`}</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={getDecimalDraft('stockInitialL') ?? formatDecimalDisplay(store.terrestre.stockInitialL)}
        onChangeText={(v) => handleDecimalChange('stockInitialL', v)}
        onBlur={() => clearDecimalDraft('stockInitialL')}
      />
      <Text style={styles.label}>{`Approvisionnement (${unite})`}</Text>
      <TextInput
        editable={!readOnly}
        style={styles.input}
        placeholder="0"
        keyboardType="decimal-pad"
        value={getDecimalDraft('pesticideRecuL') ?? formatDecimalDisplay(store.terrestre.pesticideRecuL)}
        onChangeText={(v) => handleDecimalChange('pesticideRecuL', v)}
        onBlur={() => clearDecimalDraft('pesticideRecuL')}
      />
      {pesticideStockRestant != null && (
        <Card variant="derivee">
          <Text style={styles.label}>{`Stock Final (${unite})`}</Text>
          <Text style={styles.derivedValue}>{pesticideStockRestant}</Text>
        </Card>
      )}
    </Fragment>
  );
}
