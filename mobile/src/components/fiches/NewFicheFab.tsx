import { useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { startNewProspection } from '@/lib/prospection-accueil';
import { useProspectionWizardStore } from '@/lib/prospection-wizard-store';
import { useAsyncAction } from '@/hooks/use-async-action';

const CARD_BG = '#FFFFFF';
const IFVM_ORANGE = '#E67E22';
const TEXT_DARK = '#1A1A1A';
const TEXT_SECONDARY = '#757575';

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
        <Text style={styles.fabIcon}>+</Text>
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

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: IFVM_ORANGE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 30,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: CARD_BG,
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
    fontSize: 22,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  subtitle: {
    fontSize: 14,
    color: TEXT_SECONDARY,
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
    backgroundColor: CARD_BG,
    marginBottom: 12,
  },
  cardLast: {
    marginBottom: 0,
  },
  cardIcon: {
    fontSize: 24,
    width: 32,
    textAlign: 'center',
  },
  cardTextWrap: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: TEXT_DARK,
  },
  cardSubtitle: {
    fontSize: 12.5,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
});
