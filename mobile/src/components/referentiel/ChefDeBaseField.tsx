import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import { useAsyncAction } from '@/hooks/use-async-action';

export interface ChefDeBaseOption {
  id: string;
  nom: string;
  prenom: string;
  sigle: string | null;
}

interface ChefDeBaseFieldProps {
  value: string | null;
  onChange: (id: string, option: ChefDeBaseOption) => void;
  label?: string;
}

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';

/**
 * Sélecteur de chef de base (#fiche-vol-creation-mobile) — `chef_de_base_id`
 * est une FK qui doit préexister (issue #319) : contrairement à
 * `BaseAerienneField`/`StandRemplissageField`, pas de formulaire de création
 * ici, seulement la liste (`GET /users/chefs-de-base`, ouvert à tout
 * utilisateur authentifié).
 */
export function ChefDeBaseField({ value, onChange, label = 'Chef de base' }: ChefDeBaseFieldProps) {
  const token = useAuthStore((s) => s.token);
  const [chefs, setChefs] = useState<ChefDeBaseOption[]>([]);
  const [loaded, setLoaded] = useState(false);

  const { run: runChargement, isRunning: isChargement } = useAsyncAction();

  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listChefsDeBase(token!);
          setChefs(resultat.map((c) => ({ id: c.id, nom: c.nom, prenom: c.prenom, sigle: c.sigle ?? null })));
          setLoaded(true);
        },
        { screen: 'chef-de-base-field', precondition: !!token }
      ),
    [runChargement, token]
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

      {loaded && (
        <View style={styles.liste}>
          {chefs.length === 0 && <Text style={styles.vide}>Aucun chef de base actif.</Text>}
          {chefs.map((chef) => (
            <TouchableOpacity
              key={chef.id}
              style={[styles.option, value === chef.id && styles.optionSelectionnee]}
              onPress={() => onChange(chef.id, chef)}
              accessibilityRole="button"
            >
              <Text style={[styles.optionText, value === chef.id && styles.optionTextSelectionnee]}>
                {chef.prenom} {chef.nom}
                {chef.sigle ? ` (${chef.sigle})` : ''}
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
  vide: { fontSize: 12.5, color: TEXT_SECONDARY, fontStyle: 'italic' },
  option: { borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 8, backgroundColor: BG },
  optionSelectionnee: { borderColor: GREEN, backgroundColor: '#eaf3ec' },
  optionText: { fontSize: 13, fontWeight: '600', color: TEXT },
  optionTextSelectionnee: { color: GREEN },
});
