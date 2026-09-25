import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import {
  BarreRecherche,
  Carte,
  Chip,
  ChampSelection,
  EtatVide,
  FeuilleFiltres,
  LigneInterrupteur,
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
  type FiltrePesticides,
  type PesticideLigne,
  type StatutFiltre,
  type TriPesticide,
  LIBELLE_TRI,
  compterPesticides,
  libelleEntrees,
  libelleResultats,
  libelleVoirResultats,
  libelleTypeProduit,
  listerMatieresActives,
  listerPesticides,
  listerTypesPesticide,
  formaterJourMois,
} from '@/lib/referentiel-consultation';

const FILTRE_DEFAUT: FiltrePesticides = {
  recherche: '',
  statut: 'tous',
  type: null,
  matiereActive: null,
  tri: 'nom',
  inclureInactifs: true,
};

const STATUTS: { valeur: StatutFiltre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'actifs', libelle: 'Actifs' },
  { valeur: 'inactifs', libelle: 'Inactifs' },
];

const TRIS: TriPesticide[] = ['nom', 'code', 'maj'];

/** Nombre de filtres qui s'écartent du défaut — le chiffre rouge du bouton de filtres. */
function compterFiltres(f: FiltrePesticides): number {
  return (
    (f.statut !== 'tous' ? 1 : 0) +
    (f.type ? 1 : 0) +
    (f.matiereActive ? 1 : 0) +
    (f.inclureInactifs ? 0 : 1)
  );
}

/** Liste des pesticides du cache local (Figma « Pesticides · Liste » et « Pesticides · Filtres »). */
export default function ReferentielPesticidesScreen() {
  const router = useRouter();
  const { filtre, lignes, modifier, effacer, signalerChargement } = useListeFiltrable<FiltrePesticides, PesticideLigne>({
    defaut: FILTRE_DEFAUT,
    lister: listerPesticides,
    source: 'referentiel-pesticides',
  });
  const [total, setTotal] = useState<CompteStatuts>({ tous: 0, actifs: 0, inactifs: 0, majLe: null });
  const [types, setTypes] = useState<string[]>([]);
  const [matieres, setMatieres] = useState<string[]>([]);
  const [feuille, setFeuille] = useState(false);
  const [matiereOuverte, setMatiereOuverte] = useState(false);

  useEffect(() => {
    Promise.all([compterPesticides(), listerTypesPesticide(), listerMatieresActives()])
      .then(([compte, typesConnus, matieresConnues]) => {
        setTotal(compte);
        setTypes(typesConnus);
        setMatieres(matieresConnues);
      })
      .catch((error) => signalerChargement(error, { source: 'referentiel-pesticides' }));
  }, [signalerChargement]);

  const nbFiltres = compterFiltres(filtre);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Pesticides"
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
              placeholder="Rechercher un nom, un code…"
              nbFiltres={nbFiltres}
              onFiltres={() => setFeuille(true)}
            />
            <RangeeChips>
              {STATUTS.map((s) => (
                <Chip
                  key={s.valeur}
                  testID={`pesticides-statut-${s.valeur}`}
                  // « Tous » annonce ce que la liste peut montrer : sans les inactifs, ce sont les seuls actifs.
                  libelle={`${s.libelle} ${s.valeur === 'tous' && !filtre.inclureInactifs ? total.actifs : total[s.valeur]}`}
                  actif={filtre.statut === s.valeur}
                  // « Inactifs » n'a de sens qu'avec les inactifs visibles : on les ré-affiche plutôt que de rendre une liste vide.
                  onPress={() => modifier({ statut: s.valeur, ...(s.valeur === 'inactifs' ? { inclureInactifs: true } : {}) })}
                />
              ))}
              {filtre.type ? <Chip libelle={libelleTypeProduit(filtre.type)} actif onPress={() => modifier({ type: null })} /> : null}
            </RangeeChips>
            <View style={styles.resultats}>
              <TitreSection titre={libelleResultats(lignes.length)} />
              <TouchableOpacity onPress={() => setFeuille(true)} accessibilityRole="button" hitSlop={8}>
                <ThemedText style={styles.tri}>{LIBELLE_TRI[filtre.tri]}</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={<EtatVide texte="Aucun pesticide ne correspond à ces filtres." />}
        renderItem={({ item }) => (
          <Carte>
            <TouchableOpacity
              testID={`pesticide-${item.id}`}
              style={styles.carte}
              onPress={() => router.push({ pathname: '/(app)/referentiel-pesticide' as never, params: { id: item.id } })}
              accessibilityRole="button"
            >
              <View style={styles.ligneHaute}>
                <ThemedText style={styles.nom} numberOfLines={1}>
                  {item.nom}
                </ThemedText>
                <BadgeActif actif={item.actif} />
              </View>
              <View style={styles.ligneBasse}>
                <ThemedText style={styles.code}>{item.code}</ThemedText>
                <ThemedText style={styles.detail} numberOfLines={1}>
                  {[item.matiere_active, item.dose_reference].filter(Boolean).join(' · ')}
                </ThemedText>
                <AppIcon name="suivant" boite={19.2} color={RF.attenue} />
              </View>
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
              <Chip
                key={s.valeur}
                libelle={s.libelle}
                actif={filtre.statut === s.valeur}
                onPress={() => modifier({ statut: s.valeur, ...(s.valeur === 'inactifs' ? { inclureInactifs: true } : {}) })}
              />
            ))}
          </RangeeChips>
        </SectionFiltre>
        {types.length > 0 ? (
          <SectionFiltre titre="Type de produit">
            <RangeeChips>
              {types.map((t) => (
                <Chip key={t} libelle={libelleTypeProduit(t)} actif={filtre.type === t} onPress={() => modifier({ type: filtre.type === t ? null : t })} />
              ))}
            </RangeeChips>
          </SectionFiltre>
        ) : null}
        <SectionFiltre titre="Matière active">
          <ChampSelection
            valeur={filtre.matiereActive}
            vide="Toutes les matières actives"
            options={matieres}
            ouvert={matiereOuverte}
            onBascule={() => setMatiereOuverte((o) => !o)}
            onChoisir={(matiereActive) => {
              modifier({ matiereActive });
              setMatiereOuverte(false);
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
        <SectionFiltre titre="Options">
          <LigneInterrupteur
            libelle="Afficher les entrées inactives"
            valeur={filtre.inclureInactifs}
            // Statut « Inactifs » + inactifs masqués donnerait toujours zéro : on repasse alors sur « Tous ».
            onChange={(inclureInactifs) => modifier({ inclureInactifs, ...(!inclureInactifs && filtre.statut === 'inactifs' ? { statut: 'tous' as const } : {}) })}
          />
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
  carte: { paddingHorizontal: 11, paddingVertical: 9, gap: 6 },
  ligneHaute: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  nom: { flex: 1, fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  ligneBasse: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  code: { fontSize: 9.5, lineHeight: 12, fontWeight: '500', fontFamily: Fonts.mono, color: RF.attenue },
  detail: { flex: 1, fontSize: 10, lineHeight: 13, color: RF.attenue },
});
