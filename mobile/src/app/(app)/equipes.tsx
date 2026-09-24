import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { BadgeTypeEquipe } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { peutCreerEquipe } from '@/lib/equipe-aerienne-access';
import { aujourdhuiIso, chargerListeEquipes, EquipeDeListe } from '@/lib/equipe-db';
import { jourMois, libelleSite } from '@/lib/equipe-regles';

type Filtre = 'toutes' | 'aerien' | 'terrestre';
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'aerien', libelle: 'Aériennes' },
  { valeur: 'terrestre', libelle: 'Terrestres' },
];

/** Position d'une équipe : son site actif (aérienne) ou sa dernière intervention (terrestre). */
export function libellePosition({ equipe, resume }: EquipeDeListe): { texte: string; actif: boolean } {
  if (equipe.type === 'terrestre') {
    return resume.derniereIntervention
      ? { texte: `Dernière intervention : ${jourMois(resume.derniereIntervention)}`, actif: false }
      : { texte: 'Aucune intervention enregistrée', actif: false };
  }
  const site = resume.sitePrincipal;
  if (!site) return { texte: 'Aucun site actif', actif: false };
  const depuis = site.date_debut_position ? ` — depuis le ${jourMois(site.date_debut_position)}` : '';
  return { texte: `${libelleSite(site)}${depuis}`, actif: true };
}

/** Écran Équipes (#641, Figma « Équipes ») : équipes terrestres et aériennes, filtrables. */
export default function EquipesScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const signalerChargement = useSignalerChargement('equipes');
  const [liste, setListe] = useState<EquipeDeListe[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('toutes');

  useFocusEffect(
    useCallback(() => {
      chargerListeEquipes(aujourdhuiIso())
        .then(setListe)
        .catch((error) => signalerChargement(error, { source: 'chargerListeEquipes' }));
    }, [signalerChargement])
  );

  const visibles = liste.filter((e) => filtre === 'toutes' || e.equipe.type === filtre);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Équipes"
        onRetour={() => router.back()}
        action={peutCreerEquipe(role) ? { libelle: '+ Nouvelle', onPress: () => router.push('/(app)/equipe-nouvelle' as any) } : undefined}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.filtres}>
          {FILTRES.map((f) => {
            const actif = f.valeur === filtre;
            return (
              <TouchableOpacity
                key={f.valeur}
                style={[styles.filtre, actif && styles.filtreActif]}
                onPress={() => setFiltre(f.valeur)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <ThemedText style={[styles.filtreTexte, actif && { color: EQ.surMarque }]}>{f.libelle}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {visibles.length === 0 && <ThemedText style={styles.vide}>Aucune équipe.</ThemedText>}
        {visibles.map((item) => {
          const { equipe } = item;
          const position = libellePosition(item);
          const chef = [equipe.chef_prenom, equipe.chef_nom].filter(Boolean).join(' ');
          return (
            <TouchableOpacity
              key={equipe.id}
              style={styles.carte}
              onPress={() => router.push(`/(app)/equipe-detail?id=${equipe.id}` as any)}
              accessibilityRole="button"
            >
              <View style={styles.carteHaut}>
                <BadgeTypeEquipe type={equipe.type} />
                <ThemedText style={styles.membres}>{equipe.nb_membres} membres ›</ThemedText>
              </View>
              <ThemedText style={styles.nom}>{equipe.nom}</ThemedText>
              <ThemedText style={styles.chef}>
                Chef : <ThemedText style={styles.chefNom}>{chef || '—'}</ThemedText>
              </ThemedText>
              <View style={styles.position}>
                <View style={[styles.point, { backgroundColor: position.actif ? EQ.vert : EQ.etiquette }]} />
                <ThemedText style={styles.positionTexte}>{position.texte}</ThemedText>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 10 },
  filtres: { flexDirection: 'row', gap: 8 },
  filtre: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  filtreActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  filtreTexte: { fontSize: 10, fontWeight: '600', color: EQ.attenue },
  vide: { paddingVertical: 24, textAlign: 'center', fontSize: 12, color: EQ.attenue },
  carte: { gap: 6, padding: 9, borderRadius: 13, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  carteHaut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  membres: { fontSize: 10.5, fontWeight: '600', color: EQ.attenue },
  nom: { fontSize: 14, fontWeight: '700', color: EQ.encre },
  chef: { fontSize: 11, fontWeight: '500', color: EQ.attenue },
  chefNom: { fontSize: 11, fontWeight: '700', color: EQ.encre },
  position: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 9, backgroundColor: EQ.fond },
  point: { width: 7, height: 7, borderRadius: 4 },
  positionTexte: { flex: 1, fontSize: 10.5, fontWeight: '500', color: EQ.attenue },
});
