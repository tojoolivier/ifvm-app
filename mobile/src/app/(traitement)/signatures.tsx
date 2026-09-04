import { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement } from '@/lib/traitement-repository';
import { useTraitementCaptureStore, SignatureRole } from '@/lib/traitement-capture-store';
import { computeSignatureMatrix } from '@/lib/traitement-validation';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { Card } from '@/components/traitement/Card';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const ROLE_LABELS: Record<SignatureRole, string> = {
  PILOTE: 'Pilote',
  MECANICIEN: 'Mécanicien',
  CHEF_DE_BASE: 'Chef de base',
  CHEF_EQUIPE: "Chef d'équipe",
  CONSULTANT_INTERNATIONAL: 'Consultant international',
};

export default function SignaturesScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';

  const typeTraitement = store.typeTraitement;
  const [agentEncadreurRenseigne, setAgentEncadreurRenseigne] = useState(false);
  const [draftNames, setDraftNames] = useState<Partial<Record<SignatureRole, string>>>({});
  const signalerChargement = useSignalerChargement('signatures');

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        store.setTypeTraitement(draft.type_traitement);
        setAgentEncadreurRenseigne(draft.type_traitement === 'TERRESTRE' && !!draft.terrestre?.agent_encadreur_id);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId, signalerChargement]);

  const matrix =
    typeTraitement === 'AERIEN'
      ? computeSignatureMatrix('AERIEN', {
          pilote: store.aerien.pilote,
          mecanicien: store.aerien.mecanicien,
          chef_de_base_id: store.aerien.chefDeBaseId,
          consultant_international: store.aerien.consultantInternational,
        })
      : typeTraitement === 'TERRESTRE'
      ? computeSignatureMatrix('TERRESTRE', {
          chef_equipe_id: store.terrestre.chefEquipeId,
          agent_encadreur_id: store.terrestre.agentEncadreurId,
          consultant_international: store.terrestre.consultantInternational,
        })
      : [];

  const handleSigner = (role: SignatureRole) => {
    const nom = draftNames[role];
    // Précondition imposée par le rendu (bouton désactivé tant que `nom` est
    // vide) plutôt que par un retour muet ici : un `assertPresent` dans un
    // handler synchrone échapperait à `useAsyncAction` et planterait sans passer
    // par la frontière d'erreurs.
    store.setSigned(role, nom!);
    store.setStamp(role, new Date().toISOString());
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar
          currentIndex={typeTraitement === 'TERRESTRE' ? 5 : 6}
          segments={typeTraitement === 'TERRESTRE' ? PROGRESS_SEGMENTS_TERRESTRE : PROGRESS_SEGMENTS_AERIEN}
        />
        <Text style={styles.title}>Signatures</Text>

        {matrix.map((req) => {
          const signe = !!store.signed[req.role];
          return (
            <Card key={req.role} style={styles.row}>
              <Text style={styles.roleLabel}>{ROLE_LABELS[req.role]}</Text>
              {!signe && !readOnly ? (
                <TextInput
                  style={styles.input}
                  placeholder="Nom du signataire"
                  value={draftNames[req.role] ?? ''}
                  onChangeText={(v) => setDraftNames((prev) => ({ ...prev, [req.role]: v }))}
                />
              ) : (
                <Text style={styles.value}>{store.signed[req.role] ?? '—'}</Text>
              )}
              {signe && <Text style={styles.stamp}>{store.stamps[req.role] ?? 'en attente du serveur'}</Text>}
              {!readOnly && (
                <TouchableOpacity
                  style={[styles.signButton, signe && styles.signButtonDone]}
                  onPress={() => handleSigner(req.role)}
                  disabled={signe || !draftNames[req.role]}
                >
                  <Text style={styles.signButtonText}>{signe ? '✓ Signé' : 'Signer'}</Text>
                </TouchableOpacity>
              )}
            </Card>
          );
        })}

        {typeTraitement === 'TERRESTRE' && agentEncadreurRenseigne && (
          <Card variant="avertissement">
            <Text style={styles.roleLabel}>Agent encadreur</Text>
            <Text style={styles.value}>ne signe pas</Text>
          </Card>
        )}

        {!readOnly && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => router.push({ pathname: '/(traitement)/recap' as any, params: { traitementId, isValidationView } })}
          >
            <Text style={styles.continueButtonText}>Continuer  ›</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  row: { gap: 6 },
  roleLabel: { fontFamily: traitementFonts.uiSemiBold, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  value: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteSecondaire },
  stamp: { fontFamily: traitementFonts.mono, fontSize: traitementTypeSizes.label, color: traitementColors.texteNote },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    backgroundColor: '#fff',
  },
  signButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.chip,
  },
  signButtonDone: { backgroundColor: traitementColors.infoFond },
  signButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
