import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { BadgeTypeEquipe, EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { peutCreerEquipe } from '@/lib/equipe-aerienne-access';
import {
  aujourdhuiIso,
  AeronefEquipe,
  listAeronefsEquipe,
  listMembresEquipe,
  listSitesEquipe,
  MembreEquipeLocal,
  SiteEquipe,
} from '@/lib/equipe-db';
import { jourMois, libelleFonction, libelleSite } from '@/lib/equipe-regles';
import { EquipeLocale, getEquipeLocale } from '@/lib/referentiel-db';

function initiales(m: MembreEquipeLocal): string {
  return [m.prenom, m.nom].filter(Boolean).map((p) => (p as string)[0].toUpperCase()).join('').slice(0, 2) || '?';
}

function nomMembre(m: MembreEquipeLocal): string {
  return [m.prenom, m.nom].filter(Boolean).join(' ') || '—';
}

function BadgeFonction({ fonction }: { fonction: string }) {
  if (fonction === 'chef') return <EquipeBadge texte="Chef" ton="vertPlein" />;
  if (fonction === 'consultant_international') return <EquipeBadge texte={libelleFonction(fonction)} ton="ambre" />;
  return <EquipeBadge texte={libelleFonction(fonction)} ton="vertDoux" />;
}

/** Détail d'une équipe (#641, Figma « Détail · Équipe Sud ») : membres, sites, aéronefs affectés. */
export default function EquipeDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const role = useAuthStore((s) => s.user?.role);
  const signalerChargement = useSignalerChargement('equipe-detail');
  const [equipe, setEquipe] = useState<EquipeLocale | null>(null);
  const [membres, setMembres] = useState<MembreEquipeLocal[]>([]);
  const [sites, setSites] = useState<SiteEquipe[]>([]);
  const [aeronefs, setAeronefs] = useState<AeronefEquipe[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      Promise.all([
        getEquipeLocale(id),
        listMembresEquipe(id),
        listSitesEquipe(id),
        listAeronefsEquipe(id, aujourdhuiIso()),
      ])
        .then(([e, m, s, a]) => {
          setEquipe(e);
          setMembres(m);
          setSites(s);
          setAeronefs(a);
        })
        .catch((error) => signalerChargement(error, { equipeId: id }));
    }, [id, signalerChargement])
  );

  const aerienne = equipe?.type === 'aerien';
  const principal = sites.find((s) => s.parent_site_id === null);
  const secondaires = sites.filter((s) => s.parent_site_id !== null);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={equipe?.nom ?? 'Équipe'}
        sousTitre={equipe ? `Équipe ${aerienne ? 'aérienne' : 'terrestre'}` : undefined}
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {equipe && (
          <View style={styles.carte}>
            <View style={styles.lignePad}>
              <BadgeTypeEquipe type={equipe.type} />
              <ThemedText style={styles.note}>Type fixé à la création, non modifiable.</ThemedText>
            </View>
          </View>
        )}

        <View style={styles.enTete}>
          <ThemedText style={styles.section}>MEMBRES</ThemedText>
          <ThemedText style={styles.aide}>1 chef obligatoire</ThemedText>
        </View>
        <View style={styles.carte}>
          {membres.map((m) => (
            <View key={m.user_id} style={styles.membre}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarTexte}>{initiales(m)}</ThemedText>
              </View>
              <ThemedText style={styles.membreNom}>{nomMembre(m)}</ThemedText>
              <BadgeFonction fonction={m.fonction} />
            </View>
          ))}
          {membres.length === 0 && <ThemedText style={styles.vide}>Aucun membre.</ThemedText>}
          {peutCreerEquipe(role) && (
            <TouchableOpacity
              style={styles.ajouter}
              onPress={() => router.push(`/(app)/equipe-membre-ajout?id=${id}` as any)}
              accessibilityRole="button"
            >
              <ThemedText style={styles.ajouterTexte}>＋ Ajouter un membre</ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {aerienne && (
          <>
            <View style={styles.enTete}>
              <ThemedText style={styles.section}>SITES AÉRIENS</ThemedText>
              <TouchableOpacity onPress={() => router.push('/(app)/equipes-aeriennes' as any)} accessibilityRole="button">
                <ThemedText style={styles.gerer}>Gérer ›</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={styles.carte}>
              {!principal && secondaires.length === 0 && <ThemedText style={styles.vide}>Aucun site.</ThemedText>}
              {principal && (
                <View style={[styles.site, secondaires.length > 0 && styles.siteSepare]}>
                  <EquipeBadge texte="PRINCIPALE" ton="vertPlein" />
                  <ThemedText style={styles.siteNom}>{libelleSite(principal)}</ThemedText>
                  {principal.date_debut_position && (
                    <ThemedText style={styles.siteDate}>{jourMois(principal.date_debut_position)}</ThemedText>
                  )}
                </View>
              )}
              {secondaires.map((s, i) => (
                <View key={s.id} style={[styles.site, i < secondaires.length - 1 && styles.siteSepare]}>
                  <EquipeBadge texte="STAND" ton="neutre" />
                  <ThemedText style={styles.siteNom}>{`Stand ${s.numero}`}</ThemedText>
                </View>
              ))}
            </View>

            <ThemedText style={styles.section}>AÉRONEFS AFFECTÉS</ThemedText>
            {aeronefs.length === 0 && <ThemedText style={styles.vide}>Aucun aéronef affecté.</ThemedText>}
            {aeronefs.map((a) => (
              <View key={a.id} style={[styles.carte, styles.aeronef]}>
                <View style={styles.aeronefTexte}>
                  <ThemedText style={styles.immat}>{a.immatriculation}</ThemedText>
                  <ThemedText style={styles.aide}>{a.societe}</ThemedText>
                </View>
                <EquipeBadge texte="Actif" ton="vertDoux" />
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 10 },
  carte: { borderRadius: 13, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, overflow: 'hidden' },
  lignePad: { gap: 8, padding: 10 },
  note: { fontSize: 10, fontWeight: '500', color: EQ.etiquette },
  enTete: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  section: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  aide: { fontSize: 10.5, fontWeight: '500', color: EQ.etiquette },
  gerer: { fontSize: 11, fontWeight: '700', color: EQ.vert },
  membre: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: EQ.separateur },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: EQ.vertDoux, alignItems: 'center', justifyContent: 'center' },
  avatarTexte: { fontSize: 11, fontWeight: '700', color: EQ.vert },
  membreNom: { flex: 1, fontSize: 12.5, fontWeight: '700', color: EQ.encre },
  vide: { padding: 12, fontSize: 12, color: EQ.attenue },
  ajouter: { paddingVertical: 10, alignItems: 'center' },
  ajouterTexte: { fontSize: 12, fontWeight: '700', color: EQ.vert },
  site: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10 },
  siteSepare: { borderBottomWidth: 1, borderBottomColor: EQ.separateur },
  siteNom: { flex: 1, fontSize: 12.5, fontWeight: '700', color: EQ.encre },
  siteDate: { fontSize: 10, color: EQ.etiquette },
  aeronef: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 },
  aeronefTexte: { gap: 2 },
  immat: { fontSize: 13, fontWeight: '700', color: EQ.encre },
});
