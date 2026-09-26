import { useState } from 'react';
import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { formaterNombre } from '@/lib/referentiel-consultation';
import { NoteInfo, RF } from './composants';

interface Props {
  visible: boolean;
  nbTables: number;
  nbEntrees: number;
  onAnnuler: () => void;
  onConfirmer: () => void;
}

/**
 * Confirmation de « Tout réinitialiser » (Figma « Réinitialisation · Confirmation »). Le geste efface
 * le cache du téléphone : la case « Je comprends » est décochée à chaque fermeture et le bouton rouge
 * reste inerte tant qu'elle ne l'est pas — un simple appui ne peut pas déclencher la suppression.
 */
export function ModaleReinitialisation({ visible, nbTables, nbEntrees, onAnnuler, onConfirmer }: Props) {
  const [compris, setCompris] = useState(false);

  // La case est décochée à chaque fermeture : la prochaine ouverture repart de « pas compris ».
  const annuler = () => {
    setCompris(false);
    onAnnuler();
  };
  const confirmer = () => {
    setCompris(false);
    onConfirmer();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={annuler}>
      <View style={styles.voile}>
        <View style={styles.carte} testID="modale-reinitialisation">
          <View style={styles.rond}>
            <AppIcon name="alerte-grand" boite={36} color={RF.dangerTexte} />
          </View>
          <ThemedText style={styles.titre}>Réinitialiser les référentiels ?</ThemedText>
          <ThemedText style={styles.texte}>
            Toutes les données de référence stockées sur ce téléphone seront supprimées puis retéléchargées depuis le serveur.
          </ThemedText>

          <View style={styles.bilan}>
            <LigneBilan couleur={RF.dangerTexte} etiquette="Supprimé" detail={`${nbTables} tables · ${formaterNombre(nbEntrees)} entrées`} />
            <LigneBilan couleur={RF.vert} etiquette="Conservé" detail="Brouillons et fiches en attente d’envoi" />
            <LigneBilan couleur={RF.ambre} etiquette="Nécessite" detail="Une connexion réseau" />
          </View>

          <NoteInfo texte="Ne quittez pas l’écran pendant la réinitialisation (1 à 2 min)." />

          <TouchableOpacity
            testID="reinit-compris"
            style={styles.compris}
            onPress={() => setCompris((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: compris }}
          >
            <View style={[styles.case, compris && styles.caseCochee]}>
              {compris ? <AppIcon name="verifie" boite={19.2} color={RF.surMarque} /> : null}
            </View>
            <ThemedText style={styles.comprisTexte}>Je comprends que les données locales seront effacées</ThemedText>
          </TouchableOpacity>

          <View style={styles.boutons}>
            <TouchableOpacity testID="reinit-annuler" style={[styles.bouton, styles.secondaire]} onPress={annuler} accessibilityRole="button">
              <ThemedText style={[styles.boutonTexte, { color: RF.vert }]}>Annuler</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              testID="reinit-confirmer"
              style={[styles.bouton, styles.danger, !compris && styles.inerte]}
              onPress={confirmer}
              disabled={!compris}
              accessibilityRole="button"
              accessibilityState={{ disabled: !compris }}
            >
              <ThemedText style={[styles.boutonTexte, { color: RF.surMarque }]}>Réinitialiser</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function LigneBilan({ couleur, etiquette, detail }: { couleur: string; etiquette: string; detail: string }) {
  return (
    <View style={styles.ligneBilan}>
      <View style={[styles.point, { backgroundColor: couleur }]} />
      <ThemedText style={styles.etiquette}>{etiquette}</ThemedText>
      <ThemedText style={styles.detail}>{detail}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: RF.voile, justifyContent: 'center', paddingHorizontal: 16 },
  carte: { backgroundColor: RF.carte, borderRadius: 18, padding: 16, gap: 12 },
  rond: { alignSelf: 'center', width: 68, height: 68, borderRadius: 34, backgroundColor: RF.dangerFond, alignItems: 'center', justifyContent: 'center' },
  titre: { fontSize: 16, lineHeight: 20, fontWeight: '700', color: RF.encre, textAlign: 'center' },
  texte: { fontSize: 11, lineHeight: 14, color: RF.attenue, textAlign: 'center' },
  bilan: { backgroundColor: RF.carteDouce, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12, paddingHorizontal: 11, paddingVertical: 8, gap: 8 },
  ligneBilan: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  point: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  etiquette: { width: 56, fontSize: 9, lineHeight: 11, fontWeight: '700', color: RF.encre },
  detail: { flex: 1, fontSize: 10, lineHeight: 13, color: RF.attenue },
  compris: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  case: { width: 16, height: 16, borderRadius: 5, borderWidth: 2, borderColor: RF.vert, alignItems: 'center', justifyContent: 'center', overflow: 'visible' },
  caseCochee: { backgroundColor: RF.vert },
  comprisTexte: { flex: 1, fontSize: 10, lineHeight: 13, color: RF.encre },
  boutons: { flexDirection: 'row', gap: 12 },
  bouton: { flex: 1, height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  secondaire: { backgroundColor: RF.carte, borderWidth: 1.5, borderColor: RF.vert },
  danger: { backgroundColor: RF.dangerPlein },
  inerte: { opacity: 0.4 },
  boutonTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
});
