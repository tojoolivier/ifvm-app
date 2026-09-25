import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, Champ, EnteteDetail, EtatVide, LigneInfo, NoteInfo, RF, TitreSection, BadgeActif } from '@/components/referentiel/composants';
import { useFicheChargee } from '@/hooks/use-fiche-chargee';
import { type StationLigne, getStation } from '@/lib/referentiel-consultation';

/** Fiche d'une station fixe, en lecture seule (Figma « Station · Détail »). */
export default function ReferentielStationScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const station = useFicheChargee<StationLigne>('referentiel-station', id, getStation);

  const poste = station?.poste_nom ? [station.poste_nom, station.poste_code].filter(Boolean).join(' · ') : '—';

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={station?.nom ?? 'Station fixe'}
        sousTitre={station ? `Station fixe · ${station.code}` : undefined}
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {station === null ? <EtatVide texte="Cette station n’est plus dans le référentiel de ce téléphone." /> : null}
        {station ? (
          <>
            <EnteteDetail actif={station.actif} badge={<BadgeActif actif={station.actif} feminin />} />
            <Champ libelle="Code" valeur={station.code} />
            <Champ libelle="Nom" valeur={station.nom} />
            <Champ libelle="Poste acridien" valeur={poste} />

            <TitreSection titre="LOCALISATION ADMINISTRATIVE" />
            <Carte>
              <LigneInfo libelle="Commune" valeur={station.commune || '—'} separee />
              <LigneInfo libelle="District" valeur={station.district || '—'} separee />
              <LigneInfo libelle="Région" valeur={station.region || '—'} />
            </Carte>

            <TitreSection titre="POSITION GPS" />
            <Carte>
              <View style={styles.carteDouce}>
                <LigneInfo libelle="Latitude" valeur={String(station.latitude)} mono />
                <LigneInfo libelle="Longitude" valeur={String(station.longitude)} mono />
                <LigneInfo libelle="Altitude" valeur={station.altitude === null ? '—' : `${station.altitude} m`} mono />
              </View>
            </Carte>
            <NoteInfo texte="Donnée serveur en lecture seule. Mise à jour à la synchronisation." />
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, gap: 10, paddingBottom: 32 },
  carteDouce: { backgroundColor: RF.carteDouce, borderRadius: 12 },
});
