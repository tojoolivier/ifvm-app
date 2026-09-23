import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useUpdates, isEnabled as otaEstActif } from 'expo-updates';

import { appliquerMaintenant } from '@/lib/ota';
import { logger } from '@/lib/logger';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { PRIMARY, SURFACE, FOREGROUND, FOREGROUND_TERTIARY } from './erreurs/tokens';

/** `bar-fond` de DESIGN.md — piste de barre de progression. */
const BAR_FOND = '#f1ecdd';

type Phase = 'telechargement' | 'prete';

function phaseCourante(isDownloading: boolean, isUpdatePending: boolean): Phase | null {
  if (isUpdatePending) return 'prete';
  if (isDownloading) return 'telechargement';
  return null;
}

/**
 * Bandeau OTA — surface non bloquante, montée une fois à la racine.
 *
 * Décision produit (voir #250-adjacent / grilling) : le lancement n'est jamais
 * retenu par un splash. L'agent voit passivement qu'une mise à jour se
 * télécharge, puis qu'elle est prête, et **choisit** quand redémarrer. S'il
 * ignore le bandeau, `expo-updates` appliquera le bundle au prochain lancement
 * de toute façon.
 *
 * Overlay bas, `dismissable` : l'agent peut le fermer. Le rejet est par phase —
 * fermer « téléchargement » ne masque pas « prête ».
 */
export function BandeauOta() {
  const { isDownloading, isUpdatePending, downloadProgress, downloadError } = useUpdates();
  const [phaseRejetee, setPhaseRejetee] = useState<Phase | null>(null);
  const [redemarrage, setRedemarrage] = useState(false);
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  // En Expo Go / dev client, `expo-updates` est inerte : rien à annoncer.
  if (!otaEstActif) return null;

  const phase = phaseCourante(isDownloading, isUpdatePending);

  // Le rejet ne vaut que pour la phase fermée : quand `phase` passe de
  // « téléchargement » à « prête », `phaseRejetee` ne correspond plus et le
  // bandeau réapparaît de lui-même — pas d'effet à câbler.
  if (!phase || phase === phaseRejetee) return null;
  if (downloadError && phase === 'telechargement') return null; // échec : silencieux, déjà tracé

  const redemarrer = () => {
    setRedemarrage(true);
    appliquerMaintenant().catch((error) => {
      setRedemarrage(false);
      logger.failure('ota.reload.failed', error);
    });
  };

  const pct =
    typeof downloadProgress === 'number'
      ? Math.round(Math.min(1, Math.max(0, downloadProgress)) * 100)
      : null;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safe} pointerEvents="box-none">
      <View style={styles.bandeau} accessibilityRole="alert">
        <View style={styles.corps}>
          <Text style={styles.titre}>
            {phase === 'prete' ? '✓ Mise à jour prête' : '⬇ Mise à jour en cours…'}
          </Text>
          {phase === 'telechargement' && (
            <View style={styles.pisteBarre}>
              <View
                style={[styles.remplissageBarre, pct === null ? styles.barreIndeterminee : { width: `${pct}%` }]}
              />
            </View>
          )}
          {phase === 'telechargement' && pct !== null && (
            <Text style={styles.pourcent}>{pct} %</Text>
          )}
        </View>

        <View style={styles.actions}>
          {phase === 'prete' && (
            <TouchableOpacity
              onPress={redemarrer}
              disabled={redemarrage}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={styles.boutonRedemarrer}
            >
              <Text style={styles.boutonRedemarrerTexte}>
                {redemarrage ? 'Redémarrage…' : 'Redémarrer'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => setPhaseRejetee(phase)}
            accessibilityRole="button"
            accessibilityLabel="Fermer"
            activeOpacity={0.7}
            style={styles.boutonFermer}
          >
            <Text style={styles.boutonFermerTexte}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BASE_TYPE_SIZES = {
  titre: 13,
  pourcent: 11,
  boutonRedemarrerTexte: 12,
  boutonFermerTexte: 15,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>) {
  return StyleSheet.create({
    safe: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 998 },
    bandeau: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: SURFACE,
      borderTopWidth: 1,
      borderColor: BAR_FOND,
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    corps: { flex: 1, gap: 6 },
    titre: { color: FOREGROUND, fontSize: typeSizes.titre, fontWeight: '700' },
    pisteBarre: {
      height: 4,
      borderRadius: 4,
      backgroundColor: BAR_FOND,
      overflow: 'hidden',
    },
    remplissageBarre: {
      height: 4,
      borderRadius: 4,
      backgroundColor: PRIMARY,
    },
    barreIndeterminee: { width: '40%' },
    pourcent: { color: FOREGROUND_TERTIARY, fontSize: typeSizes.pourcent, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    boutonRedemarrer: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderRadius: 8,
      backgroundColor: PRIMARY,
    },
    boutonRedemarrerTexte: { color: '#FFFFFF', fontSize: typeSizes.boutonRedemarrerTexte, fontWeight: '700' },
    boutonFermer: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    boutonFermerTexte: { color: FOREGROUND_TERTIARY, fontSize: typeSizes.boutonFermerTexte, fontWeight: '700' },
  });
}
