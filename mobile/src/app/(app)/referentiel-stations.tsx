import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import {
  BarreRecherche,
  Carte,
  ChampSelection,
  Chip,
  EtatVide,
  FeuilleFiltres,
  RangeeChips,
  RF,
  SectionFiltre,
  TitreSection,
  BadgeActif
} from '@/components/referentiel/composants';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Fonts } from '@/constants/theme';
import { useListeFiltrable } from '@/hooks/use-liste-filtrable';
import {
  type CompteStatuts,
  type FiltreStations,
  type StationLigne,
  type StatutFiltre,
  type TriStation,
  LIBELLE_TRI,
  compterStations,
  formaterJourMois,
  libelleEntrees,
  libelleResultats,
  libelleVoirResultats,
  listerRegionsStations,
  listerStations,
} from '@/lib/referentiel-consultation';

const FILTRE_DEFAUT: FiltreStations = { recherche: '', statut: 'tous', region: null, tri: 'nom' };

const STATUTS: { valeur: StatutFiltre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Toutes' },
  { valeur: 'actifs', libelle: 'Actives' },
  { valeur: 'inactifs', libelle: 'Inactives' },
];

const TRIS: TriStation[] = ['nom', 'code', 'maj'];

/** Liste des stations fixes du cache local (Figma « Stations fixes · Liste »). */
export default function ReferentielStationsScreen() {
  const router = useRouter();
  const { filtre, lignes, modifier, effacer, signalerChargement } = useListeFiltrable<FiltreStations, StationLigne>({
    defaut: FILTRE_DEFAUT,
    lister: listerStations,
    source: 'referentiel-stations',
  });
  const [total, setTotal] = useState<CompteStatuts>({ tous: 0, actifs: 0, inactifs: 0, majLe: null });
  const [regions, setRegions] = useState<string[]>([]);
  const [feuille, setFeuille] = useState(false);
  const [regionOuverte, setRegionOuverte] = useState(false);

  useEffect(() => {
    Promise.all([compterStations(), listerRegionsStations()])
      .then(([compte, regionsConnues]) => {
        setTotal(compte);
        setRegions(regionsConnues);
      })
      .catch((error) => signalerChargement(error, { source: 'referentiel-stations' }));
  }, [signalerChargement]);

  const nbFiltres = (filtre.statut !== 'tous' ? 1 : 0) + (filtre.region ? 1 : 0);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Stations fixes"
        sousTitre={`${libelleEntrees(total.tous)}${total.majLe ? ` · màj ${formaterJourMois(total.majLe)}` : ''}`}
        onRetour={() => router.back()}
      />
      <FlatList
        data={lignes}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contenu}
        ListHeaderComponent={
          <View style={styles.entete}>
            <BarreRecherche
              valeur={filtre.recherche}
              onChange={(recherche) => modifier({ recherche })}
              placeholder="Rechercher une station, une commune…"
              nbFiltres={nbFiltres}
              onFiltres={() => setFeuille(true)}
            />
            <RangeeChips>
              {STATUTS.map((s) => (
                <Chip
                  key={s.valeur}
                  testID={`stations-statut-${s.valeur}`}
                  libelle={`${s.libelle} ${total[s.valeur]}`}
                  actif={filtre.statut === s.valeur}
                  onPress={() => modifier({ statut: s.valeur })}
                />
              ))}
              {filtre.region ? <Chip libelle={filtre.region} actif onPress={() => modifier({ region: null })} /> : null}
            </RangeeChips>
            <View style={styles.resultats}>
              <TitreSection titre={libelleResultats(lignes.length)} />
              <TouchableOpacity onPress={() => setFeuille(true)} accessibilityRole="button" hitSlop={8}>
                <ThemedText style={styles.tri}>{LIBELLE_TRI[filtre.tri]}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={<EtatVide texte="Aucune station ne correspond à ces filtres." />}
        renderItem={({ item }) => (
          <Carte>
            <TouchableOpacity
              testID={`station-${item.id}`}
              style={styles.carte}
              onPress={() => router.push({ pathname: '/(app)/referentiel-station' as never, params: { id: item.id } })}
              accessibilityRole="button"
            >
              <View style={styles.tuile}>
                <AppIcon name="localisation" size={23.04} color={RF.vert} />
              </View>
              <View style={styles.textes}>
                <View style={styles.ligneHaute}>
                  <ThemedText style={styles.nom} numberOfLines={1}>
                    {item.nom}
                  </ThemedText>
                  <BadgeActif actif={item.actif} feminin />
                </View>
                <View style={styles.ligneCode}>
                  <ThemedText style={styles.code}>{item.code}</ThemedText>
                  {item.poste_nom ? <ThemedText style={styles.detail}>{item.poste_nom}</ThemedText> : null}
                </View>
                <ThemedText style={styles.lieu} numberOfLines={1}>
                  {[item.commune, item.region].filter(Boolean).join(' · ')}
                </ThemedText>
              </View>
              <AppIcon name="suivant" boite={19.2} color={RF.attenue} />
            </TouchableOpacity>
          </Carte>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />

      <FeuilleFiltres
        visible={feuille}
        onFermer={() => setFeuille(false)}
        onEffacer={effacer}
        libelleAction={libelleVoirResultats(lignes.length)}
      >
        <SectionFiltre titre="Statut">
          <RangeeChips>
            {STATUTS.map((s) => (
              <Chip key={s.valeur} libelle={s.libelle} actif={filtre.statut === s.valeur} onPress={() => modifier({ statut: s.valeur })} />
            ))}
          </RangeeChips>
        </SectionFiltre>
        <SectionFiltre titre="Région">
          <ChampSelection
            valeur={filtre.region}
            vide="Toutes les régions"
            options={regions}
            ouvert={regionOuverte}
            onBascule={() => setRegionOuverte((o) => !o)}
            onChoisir={(region) => {
              modifier({ region });
              setRegionOuverte(false);
            }}
          />
        </SectionFiltre>
        <SectionFiltre titre="Trier par">
          <RangeeChips>
            {TRIS.map((t) => (
              <Chip key={t} libelle={LIBELLE_TRI[t]} actif={filtre.tri === t} onPress={() => modifier({ tri: t })} />
            ))}
          </RangeeChips>
        </SectionFiltre>
      </FeuilleFiltres>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, paddingBottom: 32 },
  entete: { gap: 10, marginBottom: 10 },
  resultats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  tri: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: RF.vert },
  carte: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 9 },
  tuile: { width: 34, height: 34, borderRadius: 10, backgroundColor: RF.vertDoux, alignItems: 'center', justifyContent: 'center' },
  textes: { flex: 1, gap: 3 },
  ligneHaute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nom: { flex: 1, fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  ligneCode: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  code: { fontSize: 9.5, lineHeight: 12, fontWeight: '500', fontFamily: Fonts.mono, color: RF.attenue },
  detail: { fontSize: 10, lineHeight: 13, color: RF.attenue },
  lieu: { fontSize: 10, lineHeight: 13, color: RF.etiquette },
});
