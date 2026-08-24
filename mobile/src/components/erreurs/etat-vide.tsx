import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { toFriendlyError } from '@/lib/friendly-error';
import { useErrorAction } from '@/hooks/use-error-action';
import {
  AMBER_BORDER,
  BACKGROUND,
  FOREGROUND,
  FOREGROUND_TERTIARY,
  PRIMARY,
} from './tokens';

interface Props {
  /** L'erreur qui a empêché la lecture, ou `null` si la lecture a réussi. */
  erreur?: unknown;
  /** Titre quand il n'y a réellement rien à montrer. */
  titreVide: string;
  /** Précision facultative sur l'état vide légitime. */
  sousTitreVide?: string;
  /** Reprise de la lecture, quand l'écran sait la rejouer. */
  onReessayer?: () => void;
}

/**
 * L'**état vide explicite** d'ADR-012 décision 5 — la moitié du ticket que
 * l'on ne voit pas dans le store.
 *
 * Deux scénarios sont tous deux INFORMER et pourtant opposés : un échec réseau
 * sur un geste explicite ne prive l'écran de rien, tandis qu'une donnée locale
 * illisible laisse **une liste vide qu'aucune bannière ne répare**. L'agent lit
 * « aucune fiche », en conclut qu'il n'a rien saisi, et recommence sa journée.
 *
 * D'où la règle : **l'erreur s'affiche là où la donnée manque.** Ce composant
 * est le seul endroit du mobile qui a le droit de rendre une liste vide, et il
 * n'y arrive pas sans avoir demandé s'il y avait une erreur — c'est ce qui rend
 * un vide muet impossible à produire plutôt que simplement déconseillé.
 */
export function EtatVide({ erreur, titreVide, sousTitreVide, onReessayer }: Props) {
  const affichable = erreur == null ? null : toFriendlyError(erreur);
  const action = useErrorAction(
    affichable === null ? null : { action: affichable.action, retry: onReessayer }
  );

  if (!affichable) {
    return (
      <View style={styles.zone}>
        <Text style={styles.titre}>{titreVide}</Text>
        {sousTitreVide ? <Text style={styles.sousTitre}>{sousTitreVide}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.zone, styles.zoneErreur]} accessibilityRole="alert">
      <Text style={styles.titre}>{affichable.message}</Text>
      {action && (
        <TouchableOpacity
          style={styles.bouton}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={action.run}
        >
          <Text style={styles.boutonText}>{action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { alignItems: 'center', justifyContent: 'center', paddingVertical: 32, paddingHorizontal: 20, gap: 8 },
  zoneErreur: { backgroundColor: BACKGROUND, borderWidth: 1, borderColor: AMBER_BORDER, borderRadius: 14, margin: 12 },
  titre: { fontSize: 13, fontWeight: '700', color: FOREGROUND, textAlign: 'center', lineHeight: 19 },
  sousTitre: { fontSize: 12, fontWeight: '500', color: FOREGROUND_TERTIARY, textAlign: 'center' },
  bouton: { backgroundColor: PRIMARY, borderRadius: 13, paddingHorizontal: 20, paddingVertical: 11, marginTop: 4 },
  boutonText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
