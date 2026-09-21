import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { useAsyncAction } from '@/hooks/use-async-action';
import { STATUT_VALIDE } from '@/lib/prospection-fiche-lecture';

export interface ProspectionValideeOption {
  id: string;
  n_fiche: string | null;
  n_message: string | null;
  date_prospection: string;
  validated_at: string | null;
  region: string | null;
  district: string | null;
  commune: string | null;
}

interface ProspectionValideeFieldProps {
  value: string | null;
  onChange: (id: string | null, option: ProspectionValideeOption | null) => void;
  /**
   * YYYY-MM-DD : ne propose que les prospections de cette date, et charge la liste
   * d'emblée (le vol PROSPECTION d'une fiche de vol choisit la prospection du jour de
   * ce vol). Absente : comportement historique (référence d'en-tête, toutes dates).
   */
  date?: string;
  /**
   * Statut filtré côté serveur. Par défaut `validee` (référence d'en-tête). `null` : tous
   * statuts — le jour même, une prospection n'est en général pas encore validée.
   */
  statut?: string | null;
  label?: string;
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Sélecteur de la prospection « principale » affichée en Référence d'une fiche
 * de vol (numero_fiche_prospection/numero_fiche_validation/date_validation,
 * migration 0070) — facultatif, distinct du rattachement réel de chaque vol
 * individuel (Vol.prospection_id, propre à la saisie des vols).
 *
 * Toutes les prospections validées, sans filtre « pas encore traitée »
 * (contrairement à `(traitement)/prospection-picker.tsx`) : une même
 * prospection a normalement à la fois un CRT et une fiche de vol pour la
 * même journée de traitement aérien — l'exclure ici la rendrait introuvable
 * au moment précis où elle est la plus probable.
 */
export function ProspectionValideeField({
  value,
  onChange,
  date,
  statut = STATUT_VALIDE,
  label = 'Prospection traitée (facultatif)',
}: ProspectionValideeFieldProps) {
  const token = useAuthStore((s) => s.token);
  const [prospections, setProspections] = useState<ProspectionValideeOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { run: runChargement, isRunning: isChargement } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listProspections(token!, {
            ...(statut ? { statut } : {}),
            ...(date ? { date_prospection: date } : {}),
          });
          setProspections(
            resultat.map((p) => ({
              id: p.id,
              n_fiche: p.n_fiche ?? null,
              n_message: p.n_message ?? null,
              date_prospection: p.date_prospection,
              validated_at: p.validated_at ?? null,
              region: p.region ?? null,
              district: p.district ?? null,
              commune: p.commune ?? null,
            }))
          );
          setLoaded(true);
        },
        { screen: 'prospection-validee-field', precondition: !!token }
      ),
    [runChargement, token, date, statut]
  );

  useEffect(() => {
    if (date) void charger();
  }, [date, charger]);

  const selectionnee = prospections.find((p) => p.id === value) ?? null;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      {!loaded && !isChargement && (
        <TouchableOpacity style={styles.chargerLink} onPress={charger}>
          <Text style={styles.chargerLinkText}>
            {selectionnee
              ? `${selectionnee.n_fiche ?? selectionnee.n_message ?? 'sans référence'} — changer ›`
              : date
                ? 'Choisir la fiche de prospection du jour ›'
                : 'Choisir une fiche de prospection validée ›'}
          </Text>
        </TouchableOpacity>
      )}
      {isChargement && <ActivityIndicator color={GREEN} />}

      {loaded && (
        <View style={styles.liste}>
          {value !== null && (
            <TouchableOpacity style={styles.effacerLink} onPress={() => onChange(null, null)} accessibilityRole="button">
              <Text style={styles.effacerLinkText}>Aucune prospection (effacer la référence)</Text>
            </TouchableOpacity>
          )}
          {prospections.length === 0 && (
            <Text style={styles.hint}>
              {date
                ? `Aucune fiche de prospection à la date du ${date}.`
                : 'Aucune fiche de prospection validée pour le moment.'}
            </Text>
          )}
          {prospections.map((prospection) => (
            <TouchableOpacity
              key={prospection.id}
              style={[styles.option, value === prospection.id && styles.optionSelectionnee]}
              onPress={() => onChange(prospection.id, prospection)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, value === prospection.id && styles.optionTextSelectionnee]}>
                {prospection.n_fiche ?? prospection.n_message ?? 'sans référence'} · {prospection.date_prospection.slice(0, 10)}
              </Text>
              <Text style={styles.optionSubtext}>
                {[prospection.region, prospection.district, prospection.commune].filter(Boolean).join(' · ') ||
                  'localisation non renseignée'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 11, gap: 8 },
  label: { fontSize: 9, fontWeight: '600', color: '#9a9484', textTransform: 'uppercase' },
  chargerLink: { paddingVertical: 6 },
  chargerLinkText: { fontSize: 13, fontWeight: '700', color: GREEN },
  liste: { gap: 6 },
  effacerLink: { paddingVertical: 6 },
  effacerLinkText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY, fontStyle: 'italic' },
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG, gap: 2 },
  optionSelectionnee: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  optionText: { fontSize: 13, fontWeight: '600', color: TEXT },
  optionTextSelectionnee: { color: GREEN },
  optionSubtext: { fontSize: 11, color: TEXT_SECONDARY },
  hint: { fontSize: 11.5, color: TEXT_SECONDARY, fontStyle: 'italic', paddingVertical: 6 },
});
