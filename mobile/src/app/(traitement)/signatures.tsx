import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, saveSignatureLocal, clearSignatureLocal } from '@/lib/traitement-repository';
import { listUtilisateursByRole, UtilisateurEquipe } from '@/lib/referentiel-db';
import { useTraitementCaptureStore, SignatureRole } from '@/lib/traitement-capture-store';
import { computeSignatureMatrix } from '@/lib/traitement-validation';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { Card } from '@/components/traitement/Card';
import { SignaturePad } from '@/components/traitement/SignaturePad';
import { ProgressBar, PROGRESS_SEGMENTS_AERIEN, PROGRESS_SEGMENTS_TERRESTRE } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const ROLE_LABELS: Record<SignatureRole, string> = {
  PILOTE: 'Pilote',
  MECANICIEN: 'Mécanicien',
  CHEF_DE_BASE: 'Chef de base',
  CHEF_EQUIPE: "Chef d'équipe",
  CONSULTANT_INTERNATIONAL: 'Consultant international',
};

/**
 * Écran « Signatures » (#signatures-auto-equipe) — le nom du signataire n'est
 * plus une saisie manuelle : il est résolu automatiquement depuis les rôles
 * renseignés au slide « Équipe » (pilote/mécanicien/consultant en texte libre,
 * chef de base/chef d'équipe résolus depuis le référentiel via leur id). Un
 * signataire trace sa signature au doigt (pavé vectoriel, `SignaturePad`) puis
 * « VALIDE » — ce qui l'enregistre immédiatement en local (SQLite, table
 * `traitement_signature`), pas seulement dans le state de cet écran : fermer
 * et rouvrir la fiche avant l'enregistrement final la retrouve intacte.
 *
 * Si le nom résolu pour un rôle change après signature (Équipe modifiée), la
 * signature devenue caduque est effacée automatiquement au chargement — jamais
 * conservée pour une personne différente de celle qui a réellement signé.
 */
export default function SignaturesScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const store = useTraitementCaptureStore();
  const readOnly = isValidationView === '1';
  const signalerChargement = useSignalerChargement('signatures');

  const typeTraitement = store.typeTraitement;
  const [agentEncadreurRenseigne, setAgentEncadreurRenseigne] = useState(false);
  const [chefsDeBase, setChefsDeBase] = useState<UtilisateurEquipe[]>([]);
  const [chefsEquipe, setChefsEquipe] = useState<UtilisateurEquipe[]>([]);
  // Signatures déjà persistées localement (SQLite), pas un state éphémère :
  // rechargées à chaque montage de l'écran et après chaque VALIDER.
  const [signatures, setSignatures] = useState<Record<string, { nom: string; image: string }>>({});
  const [editingRoles, setEditingRoles] = useState<Set<SignatureRole>>(new Set());
  const [resetTicks, setResetTicks] = useState<Record<string, number>>({});
  const [pendingPaths, setPendingPaths] = useState<Record<string, string>>({});

  const nomPersonne = (utilisateurs: UtilisateurEquipe[], id: string | null | undefined): string | null => {
    if (!id) return null;
    const u = utilisateurs.find((p) => p.id === id);
    return u ? `${u.prenom} ${u.nom}` : null;
  };

  // Nom actuel du signataire pour chaque rôle, résolu depuis « Équipe » — jamais
  // une saisie indépendante (#signatures-auto-equipe §5/§8).
  const nomsAttendus: Partial<Record<SignatureRole, string>> = useMemo(() => {
    if (typeTraitement === 'AERIEN') {
      return {
        PILOTE: store.aerien.pilote?.trim() || undefined,
        MECANICIEN: store.aerien.mecanicien?.trim() || undefined,
        CHEF_DE_BASE: nomPersonne(chefsDeBase, store.aerien.chefDeBaseId) ?? undefined,
        CONSULTANT_INTERNATIONAL: store.aerien.consultantInternational?.trim() || undefined,
      };
    }
    if (typeTraitement === 'TERRESTRE') {
      return {
        CHEF_EQUIPE: nomPersonne(chefsEquipe, store.terrestre.chefEquipeId) ?? undefined,
        CONSULTANT_INTERNATIONAL: store.terrestre.consultantInternational?.trim() || undefined,
      };
    }
    return {};
  }, [
    typeTraitement,
    store.aerien.pilote,
    store.aerien.mecanicien,
    store.aerien.chefDeBaseId,
    store.aerien.consultantInternational,
    store.terrestre.chefEquipeId,
    store.terrestre.consultantInternational,
    chefsDeBase,
    chefsEquipe,
  ]);

  useEffect(() => {
    listUtilisateursByRole('chef_de_base').then(setChefsDeBase).catch((error) => signalerChargement(error, { traitementId, source: 'chef_de_base' }));
    listUtilisateursByRole('chef_equipe').then(setChefsEquipe).catch((error) => signalerChargement(error, { traitementId, source: 'chef_equipe' }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  const chargerSignatures = useCallback(() => {
    if (!traitementId) return;
    getTraitement(traitementId)
      .then((draft) => {
        if (!draft) return;
        store.setTypeTraitement(draft.type_traitement);
        setAgentEncadreurRenseigne(draft.type_traitement === 'TERRESTRE' && !!draft.terrestre?.agent_encadreur_id);

        const parRole: Record<string, { nom: string; image: string }> = {};
        for (const s of draft.signatures ?? []) {
          if (s.signataire_nom && s.signature_image) {
            parRole[s.role] = { nom: s.signataire_nom, image: s.signature_image };
          }
        }
        setSignatures(parRole);
      })
      .catch((error) => signalerChargement(error, { traitementId }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [traitementId]);

  useEffect(() => {
    chargerSignatures();
  }, [chargerSignatures]);

  // Invalide toute signature devenue caduque : le nom persisté ne correspond
  // plus au nom actuellement résolu depuis « Équipe » (rôle réassigné à une
  // autre personne après signature) — #signatures-auto-equipe §8.
  useEffect(() => {
    if (!traitementId) return;
    for (const [role, signature] of Object.entries(signatures)) {
      const nomAttendu = nomsAttendus[role as SignatureRole];
      if (nomAttendu && signature.nom !== nomAttendu) {
        clearSignatureLocal(traitementId, role)
          .then(() => setSignatures((prev) => {
            const suivant = { ...prev };
            delete suivant[role];
            return suivant;
          }))
          .catch((error) => signalerChargement(error, { traitementId, source: 'clearSignatureLocal' }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatures, nomsAttendus, traitementId]);

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

  const handleValider = async (role: SignatureRole) => {
    const nom = nomsAttendus[role];
    const trace = pendingPaths[role];
    // Préconditions déjà imposées par le rendu (bouton désactivé tant que le
    // nom est absent ou le tracé vide) — jamais atteint autrement.
    if (!nom || !trace) return;
    await saveSignatureLocal(traitementId, role, nom, trace);
    setSignatures((prev) => ({ ...prev, [role]: { nom, image: trace } }));
    setEditingRoles((prev) => {
      const suivant = new Set(prev);
      suivant.delete(role);
      return suivant;
    });
  };

  const handleModifier = (role: SignatureRole) => {
    setPendingPaths((prev) => ({ ...prev, [role]: '' }));
    setResetTicks((prev) => ({ ...prev, [role]: (prev[role] ?? 0) + 1 }));
    setEditingRoles((prev) => new Set(prev).add(role));
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
          const nom = nomsAttendus[req.role];
          const signature = signatures[req.role];
          const enEdition = editingRoles.has(req.role) || !signature;
          const trace = pendingPaths[req.role] ?? '';

          return (
            <Card key={req.role} style={styles.row}>
              <Text style={styles.roleLabel}>{ROLE_LABELS[req.role]}</Text>
              <Text style={styles.value}>{nom ?? '— (à renseigner sur « Équipe »)'}</Text>

              {!readOnly && enEdition && nom && (
                <>
                  <SignaturePad
                    key={`${req.role}-${resetTicks[req.role] ?? 0}`}
                    testID={`signature-pad-${req.role}`}
                    value={null}
                    onChange={(p) => setPendingPaths((prev) => ({ ...prev, [req.role]: p }))}
                  />
                  <TouchableOpacity
                    style={[styles.signButton, !trace && styles.signButtonDisabled]}
                    onPress={() => handleValider(req.role)}
                    disabled={!trace}
                  >
                    <Text style={styles.signButtonText}>VALIDER</Text>
                  </TouchableOpacity>
                </>
              )}

              {!enEdition && signature && (
                <>
                  <SignaturePad testID={`signature-pad-${req.role}`} value={signature.image} onChange={() => {}} readOnly />
                  <Text style={styles.stamp}>Signature enregistrée</Text>
                  {!readOnly && (
                    <TouchableOpacity style={styles.modifyButton} onPress={() => handleModifier(req.role)}>
                      <Text style={styles.modifyButtonText}>MODIFIER</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}

              {readOnly && !signature && <Text style={styles.stamp}>Non signée</Text>}
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
  signButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.chip,
  },
  signButtonDisabled: { backgroundColor: traitementColors.infoFond },
  signButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps },
  modifyButton: {
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
  },
  modifyButtonText: { fontFamily: traitementFonts.uiBold, color: traitementColors.texteTitre, fontSize: traitementTypeSizes.corps },
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
