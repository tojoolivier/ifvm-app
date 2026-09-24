import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { type OrigineVol, type VolLocal, listVols } from '@/lib/vol-db';
import { type CategorieVol, dureeMinutes, formaterDuree } from '@/lib/vol-regles';

type Filtre = 'tous' | 'application' | 'prospection' | 'convoyage';
const FILTRES: { valeur: Filtre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'application', libelle: 'Application' },
  { valeur: 'prospection', libelle: 'Prospection' },
  { valeur: 'convoyage', libelle: 'Convoyage' },
];

const CATEGORIE: Record<CategorieVol, { libelle: string; fond: string }> = {
  application: { libelle: 'Application', fond: EQ.vert },
  convoyage: { libelle: 'Convoyage', fond: EQ.ambre },
  mise_en_place: { libelle: 'Mise en place', fond: EQ.gris },
  prospection: { libelle: 'Prospection', fond: EQ.bleu },
  divers: { libelle: 'Divers', fond: EQ.gris },
};

const ORIGINE: Record<OrigineVol, string> = {
  traitement: 'Traitement',
  prospection: 'Prospection ext.',
  installation_site: 'Installation site',
  saisie_directe: 'Saisie directe',
};

const jourMois = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const duree = (v: VolLocal) => dureeMinutes(v.heure_debut, v.heure_fin);

/**
 * « Mes vols » (#644, Figma 81:524) : tous les vols de l'équipe de travail, quelle que soit leur
 * origine (traitement, prospection, installation de site, saisie directe), avec leur statut de synchro.
 */
export default function VolsScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('vols');
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const [vols, setVols] = useState<VolLocal[]>([]);
  const [filtre, setFiltre] = useState<Filtre>('tous');

  useFocusEffect(
    useCallback(() => {
      if (!equipeId) return;
      listVols(equipeId)
        .then(setVols)
        .catch((error) => signalerChargement(error, { source: 'vols' }));
    }, [equipeId, signalerChargement])
  );

  const visibles = vols.filter((v) => filtre === 'tous' || v.categorie === filtre);
  const total = visibles.reduce((somme, v) => somme + duree(v), 0);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Mes vols"
        onRetour={() => router.back()}
        action={{ libelle: '+ Nouveau', onPress: () => router.push('/(app)/vol-nouveau') }}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.total}>
          <ThemedText style={styles.totalEtiquette}>Total heures</ThemedText>
          <ThemedText style={styles.totalValeur}>{formaterDuree(total)}</ThemedText>
        </View>

        <View style={styles.filtres}>
          {FILTRES.map((f) => {
            const actif = f.valeur === filtre;
            return (
              <TouchableOpacity
                key={f.valeur}
                testID={`vols-filtre-${f.valeur}`}
                style={[styles.chip, actif && styles.chipActif]}
                onPress={() => setFiltre(f.valeur)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <ThemedText style={[styles.chipTexte, actif && styles.chipTexteActif]}>{f.libelle}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        {visibles.map((v) => {
          const enAttente = v.statut_sync !== 'synced';
          return (
            <View key={v.id} style={styles.carte} testID={`vol-${v.id}`}>
              <View style={styles.ligne}>
                <View style={[styles.badge, { backgroundColor: CATEGORIE[v.categorie].fond }]}>
                  <ThemedText style={styles.badgeTexte}>{CATEGORIE[v.categorie].libelle}</ThemedText>
                </View>
                <View style={styles.droite}>
                  <View style={[styles.sync, enAttente ? styles.syncLocal : styles.syncOk]}>
                    <ThemedText style={[styles.syncTexte, { color: enAttente ? EQ.ambre : EQ.vert }]}>
                      {v.statut_sync === 'echec' ? 'Refusé' : enAttente ? '⏳ Local' : 'Sync'}
                    </ThemedText>
                  </View>
                  <ThemedText style={styles.date}>{jourMois(v.date_vol)}</ThemedText>
                </View>
              </View>
              <ThemedText style={styles.horaires}>
                {v.heure_debut} – {v.heure_fin}  ·  {formaterDuree(duree(v), true)}
              </ThemedText>
              <View style={styles.ligne}>
                <ThemedText style={styles.lieu}>{v.libelle_lieu ?? ''}</ThemedText>
                <ThemedText style={styles.origine}>{ORIGINE[v.origine]}</ThemedText>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  total: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 30,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  totalEtiquette: { fontSize: 10, lineHeight: 13, fontWeight: '600', color: EQ.attenue },
  totalValeur: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: EQ.encre },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  chip: {
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  chipActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  chipTexte: { fontSize: 10, lineHeight: 12, fontWeight: '600', color: EQ.attenue },
  chipTexteActif: { color: EQ.surMarque },
  carte: { gap: 6, padding: 9, borderRadius: 11, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  ligne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  droite: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  badgeTexte: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: EQ.surMarque },
  sync: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 20 },
  syncOk: { backgroundColor: EQ.vertDoux },
  syncLocal: { backgroundColor: EQ.ambreFond },
  syncTexte: { fontSize: 9, lineHeight: 11, fontWeight: '700' },
  date: { fontSize: 12, lineHeight: 15, fontWeight: '700', color: EQ.encre },
  horaires: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: EQ.encre },
  lieu: { fontSize: 10, lineHeight: 13, fontWeight: '500', color: EQ.attenue },
  origine: { fontSize: 9, lineHeight: 12, fontWeight: '500', color: EQ.etiquette },
});
