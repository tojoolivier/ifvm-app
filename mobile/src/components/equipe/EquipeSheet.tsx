import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import type { EquipeLocale } from '@/lib/referentiel-db';
import { BadgeTypeEquipe } from './EquipeBadge';
import { EQ } from './tokens';

interface Props {
  visible: boolean;
  equipes: EquipeLocale[];
  equipeId: string | null;
  peutCreer: boolean;
  onFermer: () => void;
  onConfirmer: (equipeId: string) => void;
  onCreer: () => void;
}

/**
 * Feuille « Définir l'équipe de travail » (Figma « Feuille équipe ») : choix unique parmi les
 * équipes de l'agent, confirmé par un bouton. « Créer une équipe » n'apparaît que pour les rôles
 * autorisés (`peutCreer`) — les autres agents choisissent parmi leurs équipes.
 */
export function EquipeSheet(props: Props) {
  return (
    <Modal animationType="slide" transparent visible={props.visible} onRequestClose={props.onFermer}>
      {/* Contenu monté à l'ouverture seulement : le choix repart de l'équipe active à chaque fois. */}
      {props.visible ? <Contenu {...props} /> : null}
    </Modal>
  );
}

function Contenu({ equipes, equipeId, peutCreer, onFermer, onConfirmer, onCreer }: Props) {
  const [choix, setChoix] = useState<string | null>(equipeId);

  return (
    <>
      <TouchableOpacity style={styles.voile} activeOpacity={1} onPress={onFermer} accessibilityLabel="Fermer" />
      <View style={styles.feuille} testID="equipe-feuille">
        <View style={styles.poignee} />
        <ThemedText style={styles.titre}>Définir l’équipe de travail</ThemedText>
        <ThemedText style={styles.sousTitre}>
          Vos prospections, traitements et vols seront rattachés à cette équipe.
        </ThemedText>

        <ThemedText style={styles.section}>MES ÉQUIPES</ThemedText>
        <ScrollView style={styles.liste} contentContainerStyle={styles.listeContenu}>
          {equipes.map((equipe) => {
            const choisie = equipe.id === choix;
            return (
              <TouchableOpacity
                key={equipe.id}
                style={[styles.carte, choisie && styles.carteChoisie]}
                onPress={() => setChoix(equipe.id)}
                accessibilityRole="radio"
                accessibilityState={{ checked: choisie }}
                testID={`equipe-feuille-${equipe.id}`}
              >
                <View style={[styles.radio, choisie && styles.radioChoisi]}>
                  {choisie ? <View style={styles.point} /> : null}
                </View>
                <View style={styles.carteTexte}>
                  <ThemedText style={styles.nom}>{equipe.nom}</ThemedText>
                  <ThemedText style={styles.meta}>
                    {equipe.type === 'aerien' ? 'Aérienne' : 'Terrestre'} · {equipe.nb_membres} membres
                  </ThemedText>
                </View>
                <BadgeTypeEquipe type={equipe.type} />
              </TouchableOpacity>
            );
          })}

          {peutCreer ? (
            <TouchableOpacity style={styles.creer} onPress={onCreer} accessibilityRole="button" testID="equipe-feuille-creer">
              <View style={styles.creerIcone}>
                <AppIcon name="ajouter" size={24} color={EQ.surMarque} />
              </View>
              <View style={styles.carteTexte}>
                <ThemedText style={styles.creerTitre}>Créer une équipe</ThemedText>
                <ThemedText style={styles.meta}>Chef de base, chef d’équipe ou administrateur</ThemedText>
              </View>
            </TouchableOpacity>
          ) : null}
        </ScrollView>

        <ThemedText style={styles.note}>
          Le bouton « Créer une équipe » n’apparaît que pour ces rôles. Les autres agents choisissent parmi les
          équipes auxquelles ils appartiennent.
        </ThemedText>

        <TouchableOpacity
          style={[styles.cta, !choix && styles.ctaInactif]}
          disabled={!choix}
          onPress={() => choix && onConfirmer(choix)}
          accessibilityRole="button"
          testID="equipe-feuille-confirmer"
        >
          <ThemedText style={styles.ctaTexte}>Confirmer</ThemedText>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  voile: { flex: 1, backgroundColor: 'rgba(22,32,26,0.45)' },
  feuille: {
    maxHeight: '85%',
    backgroundColor: EQ.fond,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: EQ.bordure, marginBottom: 12 },
  titre: { fontSize: 15, fontWeight: '700', color: EQ.encre },
  sousTitre: { marginTop: 6, fontSize: 10.5, color: EQ.attenue },
  section: { marginTop: 16, marginBottom: 8, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  liste: { flexGrow: 0 },
  listeContenu: { gap: 8 },
  carte: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  carteChoisie: { borderWidth: 2, borderColor: EQ.vert },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: EQ.bordure, alignItems: 'center', justifyContent: 'center' },
  radioChoisi: { borderColor: EQ.vert },
  point: { width: 12, height: 12, borderRadius: 6, backgroundColor: EQ.vert },
  carteTexte: { flex: 1, gap: 2 },
  nom: { fontSize: 12, fontWeight: '600', color: EQ.encre },
  meta: { fontSize: 10, color: EQ.attenue },
  creer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: EQ.vert,
    backgroundColor: EQ.vertLeger,
  },
  creerIcone: { width: 28, height: 28, borderRadius: 9, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  creerTitre: { fontSize: 12, fontWeight: '600', color: EQ.vert },
  note: { marginTop: 12, fontSize: 9.5, color: EQ.etiquette },
  cta: { marginTop: 14, height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaInactif: { opacity: 0.5 },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
