import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { autresNonAffichees, laPlusGrave, useErrorStore } from '@/lib/error-store';
import { useErrorAction } from '@/hooks/use-error-action';
import { LienVersLeJournal } from './lien-vers-le-journal';
import {
  DANGER,
  DANGER_BORDER,
  DANGER_TEXT,
  FOREGROUND_SECONDARY,
  FOREGROUND_TERTIARY,
  SUR_FOND_COLORE,
  SURFACE,
  VOILE,
} from './tokens';

/**
 * La surface **BLOQUER** d'ADR-012 décision 5.
 *
 * Deux classes seules l'atteignent depuis un geste de l'agent (`AuthError`,
 * `LocalWriteError`) : celles où **continuer coûte quelque chose** — plus rien
 * ne fonctionnera, ou la saisie sera perdue. Une bannière serait le mauvais
 * support : l'agent la lit, hausse les épaules, et perd sa fiche.
 *
 * « Fermer » existe, et c'est délibéré : une modale sans sortie, sur un
 * appareil déjà en difficulté, transformerait un problème d'enregistrement en
 * application inutilisable. Le libellé est neutre à dessein — « Continuer quand
 * même » inviterait à faire exactement ce que le message de `LocalWriteError`
 * déconseille. Fermer ne ferme que la classe courante, pas les autres.
 */
export function ModaleBloquante() {
  const erreurs = useErrorStore((s) => s.erreurs);
  const dismiss = useErrorStore((s) => s.dismiss);

  const courante = laPlusGrave(erreurs.filter((e) => e.traitement === 'BLOQUER'));
  // La bannière montre le plus grave des INFORMER : lui non plus n'est pas « autre ».
  const informante = laPlusGrave(erreurs.filter((e) => e.traitement === 'INFORMER'));
  const action = useErrorAction(courante);

  return (
    <Modal transparent animationType="fade" visible={courante !== null} onRequestClose={() => courante && dismiss(courante.classe)}>
      <View style={styles.fond}>
        <View style={styles.carte} accessibilityRole="alert">
          <Text style={styles.titre}>Action impossible</Text>
          <Text style={styles.texte}>{courante?.message}</Text>
          {courante && courante.occurrences > 1 && (
            <Text style={styles.compteur}>Survenu {courante.occurrences} fois.</Text>
          )}
          {action && (
            <TouchableOpacity
              style={styles.bouton}
              accessibilityRole="button"
              activeOpacity={0.85}
              onPress={() => {
                if (courante) dismiss(courante.classe);
                action.run();
              }}
            >
              <Text style={styles.boutonText}>{action.label}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            accessibilityRole="button"
            onPress={() => courante && dismiss(courante.classe)}
            activeOpacity={0.7}
          >
            <Text style={styles.lien}>Fermer</Text>
          </TouchableOpacity>
          <View style={styles.pied}>
            <LienVersLeJournal autres={autresNonAffichees(erreurs, [courante, informante])} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fond: { flex: 1, backgroundColor: VOILE, alignItems: 'center', justifyContent: 'center', padding: 24 },
  carte: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: SURFACE,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: DANGER_BORDER,
    padding: 20,
    gap: 10,
  },
  titre: { fontSize: 16, fontWeight: '800', color: DANGER_TEXT },
  texte: { fontSize: 13, fontWeight: '500', color: FOREGROUND_SECONDARY, lineHeight: 19 },
  compteur: { fontSize: 12, fontWeight: '600', color: FOREGROUND_TERTIARY },
  bouton: { backgroundColor: DANGER, borderRadius: 13, paddingVertical: 12, alignItems: 'center', marginTop: 4 },
  boutonText: { color: SUR_FOND_COLORE, fontWeight: '800', fontSize: 14 },
  lien: { color: FOREGROUND_TERTIARY, fontSize: 12, fontWeight: '700', textAlign: 'center', paddingVertical: 6 },
  pied: { alignItems: 'center' },
});
