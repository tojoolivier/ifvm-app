import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import type { components } from '@/lib/api-schema.generated';
import { useAsyncAction } from '@/hooks/use-async-action';

type TraitementRead = components['schemas']['TraitementRead'];

interface TraitementAerienDuJourFieldProps {
  /** YYYY-MM-DD : la date du vol — seuls les traitements aériens de ce jour sont proposés. */
  date: string;
  traitement: TraitementRead | null;
  rotationId: string | null;
  onTraitementChange: (traitement: TraitementRead | null) => void;
  onRotationChange: (rotationId: string | null) => void;
  /**
   * Rotations à ne pas proposer : celles qui ont déjà un vol du même type sur cette
   * fiche (`uq_vol_rotation_type` : une rotation = une mise en place + une application).
   */
  rotationsIndisponibles?: string[];
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Rattachement d'un vol MEP/APPLICATION (fiche de vol) : on choisit le traitement aérien
 * de la date du vol, puis sa cuve. Un vol pointe une **rotation** (une cuve) du traitement,
 * jamais le traitement lui-même — c'est pourquoi le choix se fait en deux temps.
 *
 * En ligne uniquement : les ids de rotation locaux ne sont pas ceux du serveur (la synchro
 * d'un traitement recrée ses rotations), seul `TraitementRead.aerien.rotations[].id` est
 * référençable par un vol.
 */
export function TraitementAerienDuJourField({
  date,
  traitement,
  rotationId,
  onTraitementChange,
  onRotationChange,
  rotationsIndisponibles = [],
}: TraitementAerienDuJourFieldProps) {
  const token = useAuthStore((s) => s.token);
  const [traitements, setTraitements] = useState<TraitementRead[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { run: runChargement, isRunning: isChargement } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listTraitements(token!, {
            type_traitement: 'AERIEN',
            date_traitement: date,
          });
          setTraitements(resultat.filter((t) => t.aerien != null));
          setLoaded(true);
        },
        { screen: 'traitement-aerien-du-jour-field', precondition: !!token, context: { date } }
      ),
    [runChargement, token, date]
  );

  useEffect(() => {
    void charger();
  }, [charger]);

  const rotations = traitement?.aerien?.rotations ?? [];

  return (
    <View style={styles.card}>
      <Text style={styles.label}>Fiche de traitement du jour</Text>

      {isChargement && <ActivityIndicator color={GREEN} />}

      {loaded && traitements.length === 0 && (
        <Text style={styles.hint}>Aucun traitement aérien à la date du {date}.</Text>
      )}

      {loaded && traitements.length > 0 && (
        <View style={styles.liste}>
          {traitements.map((t) => {
            const choisi = traitement?.id === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                style={[styles.option, choisi && styles.optionSelectionnee]}
                onPress={() => {
                  onTraitementChange(t);
                  onRotationChange(null);
                }}
                accessibilityRole="button"
              >
                <Text style={[styles.optionText, choisi && styles.optionTextSelectionnee]}>
                  {t.numero_fiche ?? 'sans n°'} · {t.localite}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {traitement && (
        <View style={styles.liste}>
          <Text style={styles.sousLabel}>Cuve (rotation)</Text>
          {rotations.length === 0 && (
            <Text style={styles.hint}>Aucune rotation saisie sur ce traitement.</Text>
          )}
          <View style={styles.chipsRow}>
            {rotations.map((rotation) => {
              const indisponible = rotationsIndisponibles.includes(rotation.id);
              const choisie = rotationId === rotation.id;
              return (
                <TouchableOpacity
                  key={rotation.id}
                  style={[
                    styles.chip,
                    choisie && styles.chipSelectionne,
                    indisponible && styles.chipIndisponible,
                  ]}
                  disabled={indisponible}
                  onPress={() => onRotationChange(rotation.id)}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: indisponible }}
                >
                  <Text style={[styles.chipText, choisie && styles.chipTextSelectionne]}>
                    Cuve {rotation.numero_cuve} · {rotation.nom_commercial ?? 'produit inconnu'}
                    {indisponible ? ' (déjà prise)' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, gap: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  sousLabel: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  liste: { gap: 6 },
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG },
  optionSelectionnee: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  optionText: { fontSize: 13, fontWeight: '600', color: TEXT },
  optionTextSelectionnee: { color: GREEN },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: BORDER, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10 },
  chipSelectionne: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  chipIndisponible: { opacity: 0.45 },
  chipText: { fontSize: 11.5, fontWeight: '600', color: TEXT_SECONDARY },
  chipTextSelectionne: { color: GREEN },
  hint: { fontSize: 11.5, color: TEXT_SECONDARY, fontStyle: 'italic', paddingVertical: 6 },
});
