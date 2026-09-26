import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import type { ResumeEquipe } from '@/lib/equipe-db';
import { jourMois, libelleSite } from '@/lib/equipe-regles';
import type { EquipeLocale } from '@/lib/referentiel-db';
import { BadgeTypeEquipe } from './EquipeBadge';
import { EQ } from './tokens';

interface Props {
  equipe: EquipeLocale | null;
  resume: ResumeEquipe | null;
  onChanger: () => void;
  onVoir: () => void;
}

function Ligne({ etiquette, valeur, derniere = false }: { etiquette: string; valeur: string; derniere?: boolean }) {
  return (
    <View style={[styles.ligne, !derniere && styles.ligneSeparee]}>
      <ThemedText style={styles.ligneEtiquette}>{etiquette}</ThemedText>
      <ThemedText style={styles.ligneValeur}>{valeur}</ThemedText>
    </View>
  );
}

/**
 * Carte « Équipe de travail » de l'Accueil (#641, Figma « Accueil · Équipe de travail ») : l'équipe
 * reprise par toute nouvelle saisie, avec — pour une équipe aérienne — son site principal, ses
 * stands et son aéronef ; pour une équipe terrestre, sa dernière intervention. Sans équipe : une
 * invitation à en définir une.
 */
export function EquipeTravailCard({ equipe, resume, onChanger, onVoir }: Props) {
  if (!equipe) {
    return (
      <View style={[styles.carte, styles.carteVide]} testID="equipe-carte-vide">
        <View style={styles.videTexte}>
          <ThemedText style={styles.videTitre}>AUCUNE ÉQUIPE DE TRAVAIL</ThemedText>
          <ThemedText style={styles.videAide}>Choisissez ou créez votre équipe</ThemedText>
        </View>
        <TouchableOpacity style={styles.definir} onPress={onChanger} accessibilityRole="button">
          <ThemedText style={styles.definirTexte}>Définir l’équipe</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  const aerienne = equipe.type === 'aerien';
  const stands = resume?.sitesSecondaires ?? [];
  return (
    <View style={styles.carte} testID="equipe-carte">
      <View style={styles.haut}>
        <View style={styles.hautLigne}>
          <ThemedText style={styles.hautTitre}>ÉQUIPE DE TRAVAIL</ThemedText>
          <TouchableOpacity onPress={onChanger} accessibilityRole="button" accessibilityLabel="Changer d'équipe de travail">
            <ThemedText style={styles.changer}>Changer ›</ThemedText>
          </TouchableOpacity>
        </View>
        <BadgeTypeEquipe type={equipe.type} plein />
        <ThemedText style={styles.nom}>{equipe.nom}</ThemedText>
      </View>

      {aerienne ? (
        <>
          <Ligne etiquette="Site principal" valeur={resume?.sitePrincipal ? libelleSite(resume.sitePrincipal) : '—'} />
          <Ligne
            etiquette="Stand"
            valeur={stands.length > 0 ? stands.map((s) => `Stand ${s.numero} · ${s.localite}`).join(', ') : '—'}
          />
          <Ligne etiquette="Aéronef" valeur={resume?.aeronef?.immatriculation ?? '—'} derniere />
        </>
      ) : (
        <Ligne
          etiquette="Dernière intervention"
          valeur={resume?.derniereIntervention ? jourMois(resume.derniereIntervention) : '—'}
          derniere
        />
      )}

      <TouchableOpacity style={styles.voir} onPress={onVoir} accessibilityRole="button">
        <ThemedText style={styles.voirTexte}>Voir l’équipe et ses sites ›</ThemedText>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  carte: {
    marginHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: EQ.vert,
    backgroundColor: EQ.carte,
    overflow: 'hidden',
  },
  haut: { backgroundColor: EQ.vertLeger, paddingHorizontal: 10, paddingVertical: 10, gap: 6 },
  hautLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hautTitre: { fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, color: EQ.vert },
  changer: { fontSize: 11, fontWeight: '700', color: EQ.vert },
  nom: { fontSize: 16, fontWeight: '800', color: EQ.encre },
  ligne: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8 },
  ligneSeparee: { borderBottomWidth: 1, borderBottomColor: EQ.separateur },
  ligneEtiquette: { width: 126, fontSize: 11.5, fontWeight: '500', color: EQ.attenue },
  ligneValeur: { flex: 1, fontSize: 12, fontWeight: '700', color: EQ.encre },
  voir: { borderTopWidth: 1, borderTopColor: EQ.separateur, paddingVertical: 8, alignItems: 'center' },
  voirTexte: { fontSize: 11.5, fontWeight: '700', color: EQ.vert },
  carteVide: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 10,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: EQ.ambre,
    backgroundColor: EQ.ambreFond,
  },
  videTexte: { flex: 1, gap: 2 },
  videTitre: { fontSize: 9, fontWeight: '500', color: EQ.ambre },
  videAide: { fontSize: 10, color: EQ.ambre },
  definir: { backgroundColor: EQ.ambre, borderRadius: 9, paddingHorizontal: 12, paddingVertical: 8 },
  definirTexte: { fontSize: 9, fontWeight: '700', color: EQ.surMarque },
});
