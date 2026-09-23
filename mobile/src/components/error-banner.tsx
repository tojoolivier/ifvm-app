import { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { autresNonAffichees, laPlusGrave, useErrorStore } from '@/lib/error-store';
import { useErrorAction } from '@/hooks/use-error-action';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import { LienVersLeJournal } from './erreurs/lien-vers-le-journal';
import {
  AMBER_BG,
  AMBER_BORDER,
  AMBER_TEXT,
  FOREGROUND_TERTIARY,
} from './erreurs/tokens';

/**
 * La surface **INFORMER globale** d'ADR-012 décision 5 : montée une fois à la
 * racine, elle porte l'erreur la plus grave qui n'est pas rattachée à une zone.
 *
 * Ce qu'elle ne fait plus, depuis #172 :
 *
 * - elle ne montre plus « la dernière arrivée » mais **la plus grave**, et ne
 *   perd plus les autres — elles sont comptées par `LienVersLeJournal` ;
 * - elle ne propose plus « Réessayer » à tout le monde : l'action vient de la
 *   classe, et disparaît quand il n'y a rien à rejouer ;
 * - elle laisse les `BLOQUER` à la modale — un bandeau qu'on peut ignorer est
 *   le mauvais support pour « n'allez pas plus loin ».
 *
 * Le ton est ambre et non rouge : le rouge est réservé au BLOQUER de la
 * modale, faute de quoi les deux niveaux d'insistance deviennent indiscernables.
 */
export function ErrorBanner() {
  const erreurs = useErrorStore((s) => s.erreurs);
  const dismiss = useErrorStore((s) => s.dismiss);

  const informer = erreurs.filter((e) => e.traitement === 'INFORMER');
  const courante = laPlusGrave(informer);
  // La modale montre la sienne : on ne la recompte pas dans « +N autres ».
  const bloquante = laPlusGrave(erreurs.filter((e) => e.traitement === 'BLOQUER'));
  const action = useErrorAction(courante);
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);

  if (!courante) return null;

  return (
    <SafeAreaView edges={['top']} style={styles.safe} pointerEvents="box-none">
      <View style={styles.banner} accessibilityRole="alert">
        <View style={styles.corps}>
          <Text style={styles.message} numberOfLines={3}>
            {courante.message}
          </Text>
          <View style={styles.pied}>
            {courante.occurrences > 1 && (
              <Text style={styles.compteur}>{courante.occurrences} fois</Text>
            )}
            <LienVersLeJournal autres={autresNonAffichees(erreurs, [courante, bloquante])} />
          </View>
        </View>
        <View style={styles.actions}>
          {action && (
            <TouchableOpacity
              onPress={() => {
                dismiss(courante.classe);
                action.run();
              }}
              accessibilityRole="button"
              activeOpacity={0.7}
              style={styles.actionBtn}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={() => dismiss(courante.classe)}
            accessibilityRole="button"
            accessibilityLabel="Fermer l’alerte"
            activeOpacity={0.7}
            style={styles.closeBtn}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const BASE_TYPE_SIZES = {
  message: 13,
  compteur: 12,
  actionText: 12,
  closeText: 15,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>) {
  return StyleSheet.create({
    safe: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 999 },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: AMBER_BG,
      borderBottomWidth: 1,
      borderColor: AMBER_BORDER,
      paddingHorizontal: 14,
      paddingVertical: 10,
      gap: 10,
    },
    corps: { flex: 1, gap: 3 },
    message: { color: AMBER_TEXT, fontSize: typeSizes.message, fontWeight: '600' },
    pied: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    compteur: { color: FOREGROUND_TERTIARY, fontSize: typeSizes.compteur, fontWeight: '600' },
    actions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: AMBER_TEXT },
    actionText: { color: '#fff', fontSize: typeSizes.actionText, fontWeight: '700' },
    closeBtn: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },
    closeText: { color: AMBER_TEXT, fontSize: typeSizes.closeText, fontWeight: '700' },
  });
}
