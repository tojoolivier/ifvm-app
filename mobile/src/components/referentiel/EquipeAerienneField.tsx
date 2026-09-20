import { useCallback, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient } from '@/lib/api-client';
import type { components } from '@/lib/api-schema.generated';
import { useAsyncAction } from '@/hooks/use-async-action';

// Contrat OpenAPI, pas une redéclaration à la main (CLAUDE.md « Contrat API mobile ↔
// backend ») : un champ ajouté/renommé côté EquipeAerienneRead/AeronefRead doit casser
// la compilation ici, pas disparaître silencieusement à l'exécution.
export type EquipeAerienneOption = components['schemas']['EquipeAerienneRead'];

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

  // Ne dépend que de `token` : stable pendant toute la session, donc la closure que
  // `useFocusEffect` capture ci-dessous ne se fige jamais sur une valeur périmée de
  // `value`/`onChange` (#stale-closure-equipe-aerienne-field — un chef de base qui
  // choisissait une équipe puis revenait sur l'écran se la voyait silencieusement
  // réimposée, base et stand compris, par l'ancienne closure du tout premier rendu).
  const charger = useCallback(
    () =>
      runChargement(
        async () => {
          const resultat = await apiClient.listEquipesAeriennes(token!);
          setEquipes(resultat);
          setLoaded(true);
        },
        { screen: 'equipe-aerienne-field', precondition: !!token }
      ),
    [runChargement, token]
  );

  useFocusEffect(useCallback(() => void charger(), [charger]));

  // Présélection de l'équipe du chef connecté, une fois la liste chargée — dans un
  // effet séparé (pas dans `charger`) pour ne jamais agir sur un `value`/`onChange`
  // capturés au moment du fetch : si l'utilisateur a déjà choisi une équipe entre-temps
  // (`value !== null`), on ne touche à rien.
  useEffect(() => {
    if (value !== null) return;
    const sienne = equipes.find((o) => o.chef_de_base_id === utilisateurId);
    if (sienne) onChange(sienne.id, sienne);
  }, [equipes, value, utilisateurId, onChange]);

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
