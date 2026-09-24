import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { AffectationActiveCard } from '@/components/equipe/AffectationActiveCard';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useEquipesDeTravail } from '@/hooks/use-equipes-de-travail';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { peutGererParcAeronefs } from '@/lib/equipe-aerienne-access';
import {
  aujourdhuiIso,
  AffectationLocale,
  AeronefParc,
  listAffectationsEquipe,
  listParcAeronefs,
} from '@/lib/equipe-db';
import { affectationActive, jourMoisAnnee, joursDepuis } from '@/lib/equipe-regles';

/**
 * Parc aéronefs (#642, Figma « Parc aéronefs ») : l'affectation active de l'équipe de travail mise
 * en avant, puis tous les appareils avec leur équipe du jour ou « Libre ». Consultation locale
 * (hors-ligne) ; l'ajout d'un appareil, réservé à l'administrateur, exige le réseau.
 */
export default function ParcAeronefsScreen() {
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const { courante } = useEquipesDeTravail();
  const signalerChargement = useSignalerChargement('parc-aeronefs');
  const [parc, setParc] = useState<AeronefParc[]>([]);
  const [active, setActive] = useState<AffectationLocale | null>(null);

  const equipeId = courante?.type === 'aerien' ? courante.id : null;

  useFocusEffect(
    useCallback(() => {
      const aujourdhui = aujourdhuiIso();
      Promise.all([listParcAeronefs(aujourdhui), equipeId ? listAffectationsEquipe(equipeId) : Promise.resolve([])])
        .then(([p, affectations]) => {
          setParc(p);
          setActive(affectationActive(affectations, aujourdhui));
        })
        .catch((error) => signalerChargement(error, { source: 'parc-aeronefs' }));
    }, [equipeId, signalerChargement])
  );

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Parc aéronefs"
        onRetour={() => router.back()}
        action={
          peutGererParcAeronefs(role)
            ? { libelle: '＋ Appareil', onPress: () => router.push('/(app)/aeronef-nouveau' as any) }
            : undefined
        }
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {active && (
          <AffectationActiveCard
            immatriculation={active.immatriculation}
            societe={active.societe}
            equipeNom={courante?.nom}
            depuis={jourMoisAnnee(active.date_debut)}
            jours={joursDepuis(active.date_debut, aujourdhuiIso())}
          />
        )}
        <ThemedText style={styles.section}>TOUS LES AÉRONEFS</ThemedText>
        {parc.length === 0 && <ThemedText style={styles.vide}>Aucun aéronef dans le parc.</ThemedText>}
        {parc.map((a) => (
          <View key={a.id} style={styles.ligne}>
            <View style={[styles.icone, a.equipe_id && styles.iconeActive]}>
              <ThemedText style={styles.iconeTexte}>↗</ThemedText>
            </View>
            <View style={styles.textes}>
              <ThemedText style={styles.immat}>{a.immatriculation}</ThemedText>
              <ThemedText style={styles.societe}>{a.societe}</ThemedText>
            </View>
            {a.equipe_nom ? <EquipeBadge texte={a.equipe_nom} /> : <EquipeBadge texte="Libre" ton="neutre" />}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  section: { marginTop: 4, fontSize: 9, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  vide: { padding: 12, fontSize: 12, color: EQ.attenue },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    paddingHorizontal: 9,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
  },
  icone: { width: 32, height: 32, borderRadius: 9, backgroundColor: EQ.fond, alignItems: 'center', justifyContent: 'center' },
  iconeActive: { backgroundColor: EQ.vertDoux },
  iconeTexte: { fontSize: 12, fontWeight: '700', color: EQ.encre },
  textes: { flex: 1 },
  immat: { fontSize: 13, fontWeight: '700', fontFamily: 'monospace', color: EQ.encre },
  societe: { fontSize: 10, fontWeight: '500', color: EQ.etiquette },
});
