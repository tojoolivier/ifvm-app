import { useEffect, useMemo, useRef, useState } from 'react';
import { SectionList, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import {
  BarreRecherche,
  Chip,
  EtatVide,
  FeuilleFiltres,
  RangeeChips,
  RF,
  SectionFiltre,
  TitreSection,
} from '@/components/referentiel/composants';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Fonts } from '@/constants/theme';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import {
  type CategorieFiltre,
  type CodeStadeLigne,
  type FiltreCodesStades,
  type SexeFiltre,
  especeCourte,
  formaterJourMois,
  glypheSexe,
  grouperCodesStades,
  libelleEntrees,
  libelleVoirResultats,
  listerCodesStades,
  listerEspecesCodesStades,
} from '@/lib/referentiel-consultation';

const FILTRE_DEFAUT: FiltreCodesStades = { recherche: '', sexe: 'tous', espece: null, categorie: 'toutes' };

const SEXES: { valeur: SexeFiltre; libelle: string }[] = [
  { valeur: 'tous', libelle: 'Tous' },
  { valeur: 'F', libelle: 'Femelle ♀' },
  { valeur: 'M', libelle: 'Mâle ♂' },
  { valeur: 'non_sexe', libelle: 'Non sexé' },
];

const CATEGORIES: { valeur: CategorieFiltre; libelle: string }[] = [
  { valeur: 'toutes', libelle: 'Toutes' },
  { valeur: 'imago', libelle: 'Imago' },
  { valeur: 'larve', libelle: 'Larve' },
];

/** Grille des codes stades du cache local (Figma « Codes stades · Liste »), rangée par catégorie et sexe. */
export default function ReferentielCodesStadesScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('referentiel-codes-stades');
  const [filtre, setFiltre] = useState<FiltreCodesStades>(FILTRE_DEFAUT);
  const [lignes, setLignes] = useState<CodeStadeLigne[]>([]);
  const [total, setTotal] = useState<{ n: number; majLe: string | null }>({ n: 0, majLe: null });
  const [especes, setEspeces] = useState<string[]>([]);
  const [feuille, setFeuille] = useState(false);
  const derniereRequete = useRef(0);

  useEffect(() => {
    const numero = ++derniereRequete.current;
    listerCodesStades(filtre)
      .then((resultat) => {
        if (numero === derniereRequete.current) setLignes(resultat);
      })
      .catch((error) => signalerChargement(error, { source: 'referentiel-codes-stades' }));
  }, [filtre, signalerChargement]);

  useEffect(() => {
    // Le total du sous-titre ignore les filtres : on relit la table entière une seule fois.
    Promise.all([listerCodesStades(FILTRE_DEFAUT), listerEspecesCodesStades()])
      .then(([tous, especesConnues]) => {
        setTotal({ n: tous.length, majLe: tous.reduce<string | null>((max, l) => (!max || l.updated_at > max ? l.updated_at : max), null) });
        setEspeces(especesConnues);
      })
      .catch((error) => signalerChargement(error, { source: 'referentiel-codes-stades' }));
  }, [signalerChargement]);

  const modifier = (partie: Partial<FiltreCodesStades>) => setFiltre((f) => ({ ...f, ...partie }));
  const groupes = useMemo(() => grouperCodesStades(lignes), [lignes]);
  const nbFiltres = (filtre.sexe !== 'tous' ? 1 : 0) + (filtre.espece ? 1 : 0) + (filtre.categorie !== 'toutes' ? 1 : 0);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Codes stades"
        sousTitre={`${libelleEntrees(total.n)}${total.majLe ? ` · màj ${formaterJourMois(total.majLe)}` : ''}`}
        onRetour={() => router.back()}
      />
      <SectionList
        sections={groupes.map((g) => ({ ...g, data: g.lignes }))}
        keyExtractor={(l) => l.id}
        keyboardShouldPersistTaps="handled"
        stickySectionHeadersEnabled={false}
        contentContainerStyle={styles.contenu}
        ListHeaderComponent={
          <View style={styles.entete}>
            <BarreRecherche
              valeur={filtre.recherche}
              onChange={(recherche) => modifier({ recherche })}
              placeholder="Rechercher un code, un libellé…"
              nbFiltres={nbFiltres}
              onFiltres={() => setFeuille(true)}
            />
            <RangeeChips>
              {SEXES.map((s) => (
                <Chip key={s.valeur} testID={`stades-sexe-${s.valeur}`} libelle={s.libelle} actif={filtre.sexe === s.valeur} onPress={() => modifier({ sexe: s.valeur })} />
              ))}
            </RangeeChips>
            <RangeeChips>
              <Chip libelle="Toutes espèces" actif={filtre.espece === null} onPress={() => modifier({ espece: null })} />
              {especes.map((e) => (
                <Chip key={e} testID={`stades-espece-${especeCourte(e)}`} libelle={especeCourte(e)} actif={filtre.espece === e} onPress={() => modifier({ espece: e })} />
              ))}
            </RangeeChips>
          </View>
        }
        ListEmptyComponent={<EtatVide texte="Aucun code stade ne correspond à ces filtres." />}
        renderSectionHeader={({ section }) => (
          <View style={styles.titreGroupe}>
            <TitreSection titre={section.titre} />
          </View>
        )}
        renderSectionFooter={() => <View style={{ height: 14 }} />}
        renderItem={({ item, index, section }) => (
          <View style={[styles.rangee, index === 0 && styles.premiere, index === section.data.length - 1 && styles.derniere]}>
            {index > 0 ? <View style={styles.filet} /> : null}
            <TouchableOpacity
              testID={`stade-${item.id}`}
              style={styles.ligne}
              onPress={() => router.push({ pathname: '/(app)/referentiel-code-stade' as never, params: { id: item.id } })}
              accessibilityRole="button"
            >
              <View style={styles.puce}>
                <ThemedText style={styles.puceTexte}>{item.code}</ThemedText>
              </View>
              <View style={styles.textes}>
                <ThemedText style={styles.libelle}>{item.libelle}</ThemedText>
                <ThemedText style={styles.espece}>{especeCourte(item.espece)}</ThemedText>
              </View>
              {glypheSexe(item.sexe) ? <EquipeBadge texte={glypheSexe(item.sexe)!} ton="neutre" /> : null}
              <AppIcon name="suivant" boite={19.2} color={RF.attenue} />
            </TouchableOpacity>
          </View>
        )}
      />

      <FeuilleFiltres
        visible={feuille}
        onFermer={() => setFeuille(false)}
        onEffacer={() => setFiltre((f) => ({ ...FILTRE_DEFAUT, recherche: f.recherche }))}
        libelleAction={libelleVoirResultats(lignes.length)}
      >
        <SectionFiltre titre="Catégorie">
          <RangeeChips>
            {CATEGORIES.map((c) => (
              <Chip key={c.valeur} libelle={c.libelle} actif={filtre.categorie === c.valeur} onPress={() => modifier({ categorie: c.valeur })} />
            ))}
          </RangeeChips>
        </SectionFiltre>
        <SectionFiltre titre="Sexe">
          <RangeeChips>
            {SEXES.map((s) => (
              <Chip key={s.valeur} libelle={s.libelle} actif={filtre.sexe === s.valeur} onPress={() => modifier({ sexe: s.valeur })} />
            ))}
          </RangeeChips>
        </SectionFiltre>
      </FeuilleFiltres>
    </View>
  );
}

// La carte blanche de la maquette englobe toutes les lignes d'un groupe ; une liste par section ne peut
// pas envelopper ses lignes dans un seul conteneur, les coins et bordures sont donc posés ligne à ligne.
const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, paddingBottom: 32 },
  entete: { gap: 10, marginBottom: 14 },
  titreGroupe: { marginBottom: 8 },
  rangee: { backgroundColor: RF.carte, borderLeftWidth: 1, borderRightWidth: 1, borderColor: RF.bordure },
  premiere: { borderTopWidth: 1, borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  derniere: { borderBottomWidth: 1, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  filet: { height: 1, backgroundColor: RF.bordure, marginLeft: 59, marginRight: 11 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 9, paddingVertical: 10 },
  puce: { width: 40, height: 30, borderRadius: 9, backgroundColor: RF.vertDoux, alignItems: 'center', justifyContent: 'center' },
  puceTexte: { fontSize: 10, lineHeight: 12, fontWeight: '500', fontFamily: Fonts.mono, color: RF.vert },
  textes: { flex: 1, gap: 3 },
  libelle: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  espece: { fontSize: 10, lineHeight: 13, color: RF.attenue },
});
