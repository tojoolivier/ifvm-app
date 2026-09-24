import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useAsyncAction } from '@/hooks/use-async-action';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/lib/auth-store';
import { peutGererParcAeronefs } from '@/lib/equipe-aerienne-access';
import { lireVolumeCuve, validerNouvelAeronef } from '@/lib/equipe-regles';
import { surRefusAfficher } from '@/lib/erreur-serveur';
import { pullReferentiel } from '@/lib/referentiel-sync';

/**
 * Ajout d'un appareil au parc, sans équipe (#642 / #621) : immatriculation, société, volume de
 * cuve. Administrateur seulement ; en ligne uniquement — l'unicité de l'immatriculation se joue
 * sur le serveur, dont le 409 remonte en message lisible par `useAsyncAction`.
 */
export default function AeronefNouveauScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.user?.role);
  const { run, isRunning } = useAsyncAction();
  const [immatriculation, setImmatriculation] = useState('');
  const [societe, setSociete] = useState('');
  const [volumeCuveL, setVolumeCuveL] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);

  const ajouter = () => {
    const trouvees = validerNouvelAeronef({ immatriculation, societe, volumeCuveL });
    setErreurs(trouvees);
    if (trouvees.length > 0) return;
    void run(
      () =>
        surRefusAfficher(
          async () => {
            await apiClient.createAeronef(token as string, {
              immatriculation: immatriculation.trim().toUpperCase(),
              societe: societe.trim(),
              volume_cuve_l: lireVolumeCuve(volumeCuveL),
            });
            // L'appareil n'existe localement qu'après le prochain pull : on le fait tout de suite.
            await pullReferentiel(token as string);
            router.back();
          },
          (message) => setErreurs([message])
        ),
      { screen: 'aeronef-nouveau', precondition: !!token, preconditionMessage: 'Session expirée — reconnectez-vous.' }
    );
  };

  if (!peutGererParcAeronefs(role)) {
    return (
      <View style={styles.racine}>
        <EquipeHeader titre="Nouvel appareil" variante="formulaire" onRetour={() => router.back()} />
        <ThemedText style={styles.refus}>Réservé à l’administrateur.</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Nouvel appareil" variante="formulaire" onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {erreurs.length > 0 && (
          <View style={styles.erreurs} accessibilityRole="alert">
            {erreurs.map((e) => (
              <ThemedText key={e} style={styles.erreur}>
                • {e}
              </ThemedText>
            ))}
          </View>
        )}
        <ThemedText style={styles.etiquette}>IMMATRICULATION *</ThemedText>
        <TextInput
          style={styles.saisie}
          value={immatriculation}
          onChangeText={setImmatriculation}
          autoCapitalize="characters"
          placeholder="Ex. 5R-MJK"
          placeholderTextColor={EQ.etiquette}
          accessibilityLabel="Immatriculation"
        />
        <ThemedText style={styles.etiquette}>SOCIÉTÉ *</ThemedText>
        <TextInput
          style={styles.saisie}
          value={societe}
          onChangeText={setSociete}
          placeholder="Société propriétaire"
          placeholderTextColor={EQ.etiquette}
          accessibilityLabel="Société"
        />
        <ThemedText style={styles.etiquette}>VOLUME DE CUVE (L) *</ThemedText>
        <TextInput
          style={styles.saisie}
          value={volumeCuveL}
          onChangeText={setVolumeCuveL}
          keyboardType="decimal-pad"
          placeholder="Ex. 1200"
          placeholderTextColor={EQ.etiquette}
          accessibilityLabel="Volume de cuve en litres"
        />
        <ThemedText style={styles.note}>Nécessite le réseau. L’appareil n’est affecté à aucune équipe à la création.</ThemedText>
      </ScrollView>
      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={ajouter}
          disabled={isRunning}
          accessibilityRole="button"
        >
          <ThemedText style={styles.ctaTexte}>Ajouter l’appareil</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  refus: { padding: 16, fontSize: 13, color: EQ.attenue },
  etiquette: { marginTop: 8, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  saisie: { height: 40, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, fontSize: 13, fontWeight: '700', color: EQ.encre },
  note: { marginTop: 4, padding: 8, borderRadius: 9, backgroundColor: EQ.fond, fontSize: 10, fontWeight: '500', color: EQ.etiquette },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
