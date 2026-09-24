import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';
import { FICHES_CARD_BG, FICHES_TEXT_DARK, FICHES_TEXT_SECONDARY } from './tokens';
import { AppIcon } from '@/components/ui/AppIcon';
import { EQ } from '@/components/equipe/tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

const PROSPECTION_DESTINATIONS = {
  intensive: '/(prospection)/reference',
  extensive: '/(prospection)/extensive-reference',
} as const;

/**
 * Bouton flottant "+ Nouvelle fiche" mutualisé — extrait de l'accueil ((app)/index.tsx)
 * pour être réutilisé sur "Mes fiches" ((app)/fiches.tsx) sans dupliquer le menu de
 * choix (prospection intensive / extensive / CRT).
 */
export function NewFicheFab() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const hydrateFromDraft = useProspectionWizardStore((s) => s.hydrateFromDraft);
  const { run: runQuickStart, isRunning: isStartingProspection } = useAsyncAction();
  const [menuVisible, setMenuVisible] = useState(false);

  const startQuickProspection = (typeProspection: 'intensive' | 'extensive') => {
    runQuickStart(
      async () => {
        if (!user || !token) return;
        setMenuVisible(false);
        const draft = await startNewProspection({ token, prospecteurId: user.id, typeProspection });
        await hydrateFromDraft(draft.id);
        router.push({ pathname: PROSPECTION_DESTINATIONS[typeProspection] as any, params: { draftId: draft.id } });
      },
      {
        screen: 'NewFicheFab.menu',
        precondition: !!user && !!token,
        preconditionMessage: 'Connexion requise pour créer une fiche.',
        context: { typeProspection },
      }
    );
  };

  return (
    <>
      <TouchableOpacity style={styles.fab} onPress={() => setMenuVisible(true)} activeOpacity={0.85}>
        <AppIcon name="ajouter" size={24} color={EQ.surMarque} />
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={menuVisible} onRequestClose={() => setMenuVisible(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setMenuVisible(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Text style={styles.title}>Nouvelle fiche</Text>
            <Text style={styles.subtitle}>Choisissez le type de fiche à remplir.</Text>

            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              disabled={isStartingProspection}
              onPress={() => startQuickProspection('intensive')}
            >
              <Text style={styles.cardIcon}>🌿</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>Prospection intensive</Text>
                <Text style={styles.cardSubtitle}>Captures détaillées — Locusta / Nomadacris</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.85}
              disabled={isStartingProspection}
              onPress={() => startQuickProspection('extensive')}
            >
              <Text style={styles.cardIcon}>🗒️</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>Prospection extensive</Text>
                <Text style={styles.cardSubtitle}>Densités agrégées par phase</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.card, styles.cardLast]}
              activeOpacity={0.85}
              onPress={() => {
                setMenuVisible(false);
                router.push('/(traitement)/select' as any);
              }}
            >
              <Text style={styles.cardIcon}>🧪</Text>
              <View style={styles.cardTextWrap}>
                <Text style={styles.cardTitle}>Compte-rendu de traitement (CRT)</Text>
                <Text style={styles.cardSubtitle}>Évaluation rapide après traitement</Text>
              </View>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const BASE_TYPE_SIZES = {
  title: 22,
  subtitle: 14,
  cardIcon: 24,
  cardTitle: 16,
  cardSubtitle: 12.5,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 28,
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: EQ.vert,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: FICHES_CARD_BG,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 32,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: '#E0E0E0',
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: typeSizes.title,
      fontWeight: '700',
      color: FICHES_TEXT_DARK,
    },
    subtitle: {
      fontSize: typeSizes.subtitle,
      color: FICHES_TEXT_SECONDARY,
      marginTop: 4,
      marginBottom: 18,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#EDEDED',
      backgroundColor: FICHES_CARD_BG,
      marginBottom: 12,
    },
    cardLast: {
      marginBottom: 0,
    },
    cardIcon: {
      fontSize: typeSizes.cardIcon,
      width: 32,
      textAlign: 'center',
    },
    cardTextWrap: {
      flex: 1,
    },
    cardTitle: {
      fontSize: typeSizes.cardTitle,
      fontWeight: '700',
      color: FICHES_TEXT_DARK,
    },
    cardSubtitle: {
      fontSize: typeSizes.cardSubtitle,
      color: FICHES_TEXT_SECONDARY,
      marginTop: 2,
    },
  });
}
