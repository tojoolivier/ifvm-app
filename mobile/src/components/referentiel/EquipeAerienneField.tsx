import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { useAsyncAction } from '@/hooks/use-async-action';

export interface EquipeAerienneOption {
  id: string;
  nom: string;
  chef_de_base_id: string;
  pilote: string | null;
  mecanicien: string | null;
  consultant_international: string | null;
  aeronef: { immatriculation: string; societe: string; volume_cuve_l: number } | null;
}

interface EquipeAerienneFieldProps {
  value: string | null;
  onChange: (id: string, option: EquipeAerienneOption) => void;
  label?: string;
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Sélecteur de l'équipe aérienne d'une fiche de vol. Choisir l'équipe est le premier
 * geste : le chef de base, le pilote, le mécanicien, l'immatriculation et la société de
 * l'hélicoptère s'en déduisent, et seuls les lieux (base, stand) de cette équipe sont
 * ensuite proposés.
 *
 * Un chef de base a une seule équipe, la sienne (`chef_de_base_id` UNIQUE) : elle est
 * présélectionnée dès le chargement plutôt que de lui demander de la retrouver.
 *
 * En ligne uniquement, comme tous les référentiels de la fiche de vol.
 */
export function EquipeAerienneField({ value, onChange, label = 'Équipe aérienne' }: EquipeAerienneFieldProps) {
  const token = useAuthStore((s) => s.token);
  const utilisateurId = useAuthStore((s) => s.user?.id);
  const [equipes, setEquipes] = useState<EquipeAerienneOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { run: runChargement, isRunning: isChargement } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listEquipesAeriennes(token!);
          const options: EquipeAerienneOption[] = resultat.map((e) => ({
            id: e.id,
            nom: e.nom,
            chef_de_base_id: e.chef_de_base_id,
            pilote: e.pilote ?? null,
            mecanicien: e.mecanicien ?? null,
            consultant_international: e.consultant_international ?? null,
            aeronef: e.aeronef ?? null,
          }));
          setEquipes(options);
          setLoaded(true);
          const sienne = options.find((o) => o.chef_de_base_id === utilisateurId);
          if (sienne && value === null) onChange(sienne.id, sienne);
        },
        { screen: 'equipe-aerienne-field', precondition: !!token }
      ),
    [runChargement, token, utilisateurId, value, onChange]
  );

  useFocusEffect(
    useCallback(() => {
      void charger();
      // Chargement à l'ouverture de l'écran uniquement : `charger` change à chaque
      // sélection (dépend de `value`), il ne doit pas relancer le réseau à chaque tap.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  return (
    <View style={styles.card}>
      <Text style={styles.label}>{label}</Text>

      {!loaded && !isChargement && (
        <TouchableOpacity style={styles.chargerLink} onPress={charger}>
          <Text style={styles.chargerLinkText}>Charger la liste ›</Text>
        </TouchableOpacity>
      )}
      {isChargement && <ActivityIndicator color={GREEN} />}

      {loaded && equipes.length === 0 && (
        <Text style={styles.hint}>
          Aucune équipe aérienne — créez-en une depuis Référentiels aériens.
        </Text>
      )}
      {loaded && equipes.length > 0 && (
        <View style={styles.liste}>
          {equipes.map((equipe) => (
            <TouchableOpacity
              key={equipe.id}
              style={[styles.option, value === equipe.id && styles.optionSelectionnee]}
              onPress={() => onChange(equipe.id, equipe)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, value === equipe.id && styles.optionTextSelectionnee]}>
                {equipe.nom}
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
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG },
  optionSelectionnee: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  optionText: { fontSize: 13, fontWeight: '600', color: TEXT },
  optionTextSelectionnee: { color: GREEN },
  hint: { fontSize: 11.5, color: TEXT_SECONDARY, fontStyle: 'italic', paddingVertical: 6 },
});
