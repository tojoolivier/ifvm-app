import { useCallback, useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { BarreRecherche, Carte, Chip, EtatVide, RangeeChips, RF, TitreSection, BadgeActif } from '@/components/referentiel/composants';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Fonts } from '@/constants/theme';
import { useListeFiltrable } from '@/hooks/use-liste-filtrable';
import { libelleEntrees, libelleResultats } from '@/lib/referentiel-consultation';
import {
  type CompteGenerique,
  type FiltreGenerique,
  type LigneGenerique,
  compterGenerique,
  configGenerique,
  estGenerique,
  listerGenerique,
  majJourMois,
} from '@/lib/referentiel-generique';

const FILTRE_DEFAUT: FiltreGenerique = { recherche: '', statut: 'tous' };

const STATUTS = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'actifs', libelle: 'Actifs' },
  { valeur: 'inactifs', libelle: 'Inactifs' },
] as const;

/**
 * Liste d'un référentiel sans écran dédié (cultures, campagnes, aéronefs, équipes…). Une seule liste
 * pour les dix tables : ce qui les distingue — requête, colonnes, recherche — vient de leur
 * configuration (`CONFIGS_GENERIQUES`), pas de l'écran.
 */
export default function ReferentielListeScreen() {
  const router = useRouter();
  const { table } = useLocalSearchParams<{ table: string }>();
  // Un paramètre absent ou inconnu (lien périmé) ne doit pas faire planter l'écran.
  const config = estGenerique(table) ? configGenerique(table) : null;
  const lister = useCallback(
    (filtre: FiltreGenerique) => (config ? listerGenerique(table, filtre) : Promise.resolve([])),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `config` ne change qu'avec `table`
    [table]
  );
  const { filtre, lignes, modifier, signalerChargement } = useListeFiltrable<FiltreGenerique, LigneGenerique>({
    defaut: FILTRE_DEFAUT,
    lister,
    source: `referentiel-liste-${table}`,
  });
  const [total, setTotal] = useState<CompteGenerique>({ tous: 0, actifs: 0, inactifs: 0, majLe: null });
  const avecStatut = config?.actifSql != null;

  useEffect(() => {
    if (!config) return;
    compterGenerique(table)
      .then(setTotal)
      .catch((error) => signalerChargement(error, { source: `referentiel-liste-${table}` }));
  // eslint-disable-next-line react-hooks/exhaustive-deps -- `config` ne change qu'avec `table`
  }, [table, signalerChargement]);

  if (!config) {
    return (
      <View style={styles.racine}>
        <EquipeHeader titre="Référentiel" onRetour={() => router.back()} />
        <EtatVide texte="Ce référentiel n’existe pas." />
      </View>
    );
  }

  return (
    <View style={styles.racine}>
      <EquipeHeader titre={config.titre} sousTitre={`${libelleEntrees(total.tous)}${majJourMois(total.majLe)}`} onRetour={() => router.back()} />
      <FlatList
        data={lignes}
        keyExtractor={(l) => l.cle}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.contenu}
        ListHeaderComponent={
          <View style={styles.entete}>
            <BarreRecherche valeur={filtre.recherche} onChange={(recherche) => modifier({ recherche })} placeholder={config.placeholderRecherche} />
            {avecStatut ? (
              <RangeeChips>
                {STATUTS.map((s) => (
                  <Chip
                    key={s.valeur}
                    testID={`liste-statut-${s.valeur}`}
                    libelle={`${s.libelle} ${total[s.valeur]}`}
                    actif={filtre.statut === s.valeur}
                    onPress={() => modifier({ statut: s.valeur })}
                  />
                ))}
              </RangeeChips>
            ) : null}
            <TitreSection titre={libelleResultats(lignes.length)} />
          </View>
        }
        ListEmptyComponent={
          <EtatVide
            texte={
              filtre.recherche || filtre.statut !== 'tous'
                ? 'Aucune entrée ne correspond à ces filtres.'
                : 'Aucune entrée sur ce téléphone — synchronisez le référentiel.'
            }
          />
        }
        renderItem={({ item }) => (
          <Carte>
            <TouchableOpacity
              testID={`ligne-${item.cle}`}
              style={styles.carte}
              onPress={() => router.push({ pathname: '/(app)/referentiel-fiche' as never, params: { table, cle: item.cle } })}
              accessibilityRole="button"
            >
              <View style={styles.ligneHaute}>
                <ThemedText style={styles.nom} numberOfLines={1}>
                  {item.titre}
                </ThemedText>
                {item.actif !== null ? <BadgeActif actif={item.actif} /> : null}
              </View>
              <View style={styles.ligneBasse}>
                {item.code ? <ThemedText style={styles.code}>{item.code}</ThemedText> : null}
                <ThemedText style={styles.detail} numberOfLines={1}>
                  {item.sousTitre ?? ''}
                </ThemedText>
                <AppIcon name="suivant" boite={19.2} color={RF.attenue} />
              </View>
            </TouchableOpacity>
          </Carte>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, paddingBottom: 32 },
  entete: { gap: 10, marginBottom: 10 },
  carte: { paddingHorizontal: 11, paddingVertical: 9, gap: 6 },
  ligneHaute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nom: { flex: 1, fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  ligneBasse: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontSize: 9.5, lineHeight: 12, fontWeight: '500', fontFamily: Fonts.mono, color: RF.attenue },
  detail: { flex: 1, fontSize: 10, lineHeight: 13, color: RF.attenue },
});
