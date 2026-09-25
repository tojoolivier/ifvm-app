import { type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EQ } from '@/components/equipe/tokens';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { Fonts } from '@/constants/theme';

/**
 * Éléments du parcours « Référentiels » (Figma « Parcours — Référentiels ») : puces de filtre, barre
 * de recherche, champs en lecture seule, feuille de filtres. Les couleurs viennent de `EQ` ; seules
 * les teintes propres à ce parcours (danger, cartes douces) sont ajoutées ici.
 */
export const RF = {
  ...EQ,
  /** Figma : status-danger / status-danger-bg / status-danger-solid. */
  dangerTexte: '#A3362A',
  dangerFond: '#FBECE9',
  dangerPlein: '#D32F2F',
  /** Figma : surface-card-soft, surface-field, surface-inactive. */
  carteDouce: '#F6F3E9',
  champ: '#F8F6F0',
  inactif: '#EFEADA',
  voile: 'rgba(0,0,0,0.5)',
} as const;

// --- Puces -----------------------------------------------------------------------------------

interface ChipProps {
  libelle: string;
  actif: boolean;
  onPress: () => void;
  testID?: string;
}

/** M/Chip : vert plein quand elle est active, blanche à bordure sinon. */
export function Chip({ libelle, actif, onPress, testID }: ChipProps) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={[styles.chip, actif ? styles.chipActive : styles.chipInactive]}
    >
      <ThemedText style={[styles.chipTexte, { color: actif ? RF.surMarque : RF.attenue }]}>{libelle}</ThemedText>
    </TouchableOpacity>
  );
}

export function RangeeChips({ children }: { children: ReactNode }) {
  return <View style={styles.rangeeChips}>{children}</View>;
}

// --- Recherche et filtre ---------------------------------------------------------------------

interface RechercheProps {
  valeur: string;
  onChange: (texte: string) => void;
  placeholder: string;
  /** Nombre de filtres actifs ; le bouton n'apparaît que si `onFiltres` est fourni. */
  nbFiltres?: number;
  onFiltres?: () => void;
}

export function BarreRecherche({ valeur, onChange, placeholder, nbFiltres = 0, onFiltres }: RechercheProps) {
  return (
    <View style={styles.rechercheLigne}>
      <View style={styles.recherche}>
        <AppIcon name="rechercher" boite={20} color={RF.etiquette} />
        <TextInput
          testID="referentiel-recherche"
          style={styles.rechercheSaisie}
          value={valeur}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={RF.etiquette}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>
      {onFiltres ? (
        <TouchableOpacity
          testID="referentiel-filtres"
          style={styles.boutonFiltre}
          onPress={onFiltres}
          accessibilityRole="button"
          accessibilityLabel={nbFiltres > 0 ? `Filtres, ${nbFiltres} actifs` : 'Filtres'}
        >
          <AppIcon name="filtrer" boite={21.6} color={RF.surMarque} />
          {nbFiltres > 0 ? (
            <View style={styles.pastille}>
              <ThemedText style={styles.pastilleTexte}>{nbFiltres}</ThemedText>
            </View>
          ) : null}
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// --- Sections, cartes, champs ----------------------------------------------------------------

export function TitreSection({ titre, compteur }: { titre: string; compteur?: string | number }) {
  return (
    <View style={styles.titreSection}>
      <ThemedText style={styles.titreSectionTexte}>{titre}</ThemedText>
      {compteur !== undefined ? <ThemedText style={styles.compteur}>{compteur}</ThemedText> : null}
    </View>
  );
}

export function Carte({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.carte}>
      {children}
    </View>
  );
}

/** M/Champ : une valeur en lecture seule, son libellé au-dessus. */
export function Champ({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View style={styles.champ}>
      <ThemedText style={styles.champLibelle}>{libelle.toUpperCase()}</ThemedText>
      <ThemedText style={styles.champValeur}>{valeur}</ThemedText>
    </View>
  );
}

interface LigneInfoProps {
  libelle: string;
  valeur: string;
  mono?: boolean;
  couleur?: string;
  /** Filet sous la ligne : la carte blanche en a, la carte douce (synchro, GPS) n'en a pas. */
  separee?: boolean;
}

/** Une ligne « libellé … valeur » dans une carte (informations de synchronisation, localisation…). */
export function LigneInfo({ libelle, valeur, mono = false, couleur = RF.encre, separee = false }: LigneInfoProps) {
  return (
    <View style={[styles.ligneInfo, separee && styles.ligneInfoSeparee]}>
      <ThemedText style={styles.ligneInfoLibelle}>{libelle}</ThemedText>
      <ThemedText style={[mono ? styles.ligneInfoMono : styles.ligneInfoValeur, { color: couleur }]}>{valeur}</ThemedText>
    </View>
  );
}

export function NoteInfo({ texte }: { texte: string }) {
  return (
    <View style={styles.note}>
      <AppIcon name="information" boite={21.6} color={RF.ambre} />
      <ThemedText style={styles.noteTexte}>{texte}</ThemedText>
    </View>
  );
}

/** Bandeau « ACTIF » + « Lecture seule » en tête d'une fiche de détail. */
export function EnteteDetail({ actif, badge }: { actif: boolean; badge: ReactNode }) {
  return (
    <View style={styles.enteteDetail} testID={actif ? 'detail-actif' : 'detail-inactif'}>
      {badge}
      <ThemedText style={styles.lectureSeule}>Lecture seule</ThemedText>
    </View>
  );
}

/** Le badge de statut d'une entrée : « ACTIF » en vert doux, « INACTIF » en neutre (« ACTIVE » au féminin, pour les stations). */
export function BadgeActif({ actif, feminin = false }: { actif: boolean; feminin?: boolean }) {
  const texte = feminin ? (actif ? 'ACTIVE' : 'INACTIVE') : actif ? 'ACTIF' : 'INACTIF';
  return <EquipeBadge texte={texte} ton={actif ? 'vertDoux' : 'neutre'} />;
}

export function EtatVide({ texte }: { texte: string }) {
  return <ThemedText style={styles.vide}>{texte}</ThemedText>;
}

// --- Feuille de filtres ----------------------------------------------------------------------

interface FeuilleProps {
  visible: boolean;
  onFermer: () => void;
  onEffacer: () => void;
  libelleAction: string;
  children: ReactNode;
}

/** Feuille « Filtrer » : voile à 50 %, poignée, sections de puces, bouton « Voir les N résultats ». */
export function FeuilleFiltres({ visible, onFermer, onEffacer, libelleAction, children }: FeuilleProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onFermer}>
      <View style={styles.voile}>
        <Pressable style={styles.voileZone} onPress={onFermer} accessibilityLabel="Fermer les filtres" />
        <View style={styles.feuille} testID="feuille-filtres">
          <View style={styles.poignee} />
          <View style={styles.feuilleEntete}>
            <ThemedText style={styles.feuilleTitre}>Filtrer</ThemedText>
            <TouchableOpacity onPress={onEffacer} accessibilityRole="button" hitSlop={8}>
              <ThemedText style={styles.effacer}>Tout effacer</ThemedText>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.feuilleContenu}>{children}</ScrollView>
          <TouchableOpacity style={styles.action} onPress={onFermer} accessibilityRole="button">
            <ThemedText style={styles.actionTexte}>{libelleAction}</ThemedText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function SectionFiltre({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <View style={styles.sectionFiltre}>
      <ThemedText style={styles.titreSectionTexte}>{titre.toUpperCase()}</ThemedText>
      {children}
    </View>
  );
}

interface SelectionProps {
  valeur: string | null;
  vide: string;
  options: string[];
  ouvert: boolean;
  onBascule: () => void;
  onChoisir: (valeur: string | null) => void;
}

/** Champ à liste déroulante (« Toutes les matières actives ») : la liste se déplie sous le champ. */
export function ChampSelection({ valeur, vide, options, ouvert, onBascule, onChoisir }: SelectionProps) {
  return (
    <View>
      <TouchableOpacity style={styles.selection} onPress={onBascule} accessibilityRole="button" accessibilityState={{ expanded: ouvert }}>
        <ThemedText style={styles.selectionTexte}>{valeur ?? vide}</ThemedText>
        <View style={{ transform: [{ rotate: ouvert ? '-90deg' : '90deg' }] }}>
          <AppIcon name="suivant" boite={21.6} color={RF.attenue} />
        </View>
      </TouchableOpacity>
      {ouvert ? (
        <View style={styles.selectionListe}>
          {[null, ...options].map((option) => (
            <TouchableOpacity
              key={option ?? 'toutes'}
              style={styles.selectionOption}
              onPress={() => onChoisir(option)}
              accessibilityRole="button"
            >
              <ThemedText style={[styles.selectionTexte, option === valeur && styles.selectionChoisie]}>{option ?? vide}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function LigneInterrupteur({ libelle, valeur, onChange }: { libelle: string; valeur: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.interrupteurLigne}>
      <ThemedText style={styles.interrupteurLibelle}>{libelle}</ThemedText>
      <TouchableOpacity
        testID="interrupteur"
        onPress={() => onChange(!valeur)}
        accessibilityRole="switch"
        accessibilityState={{ checked: valeur }}
        accessibilityLabel={libelle}
        style={[styles.interrupteur, { backgroundColor: valeur ? RF.vert : RF.bordureForte, alignItems: valeur ? 'flex-end' : 'flex-start' }]}
      >
        <View style={styles.interrupteurPouce} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  // Sans interligne explicite, `ThemedText` impose 24 px et les puces dépassent la maquette.
  chip: { paddingHorizontal: 9, paddingVertical: 7, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipActive: { backgroundColor: RF.vert },
  chipInactive: { backgroundColor: RF.carte, borderWidth: 1, borderColor: RF.bordure },
  chipTexte: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
  rangeeChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  rechercheLigne: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  recherche: {
    flex: 1,
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 9,
    backgroundColor: RF.carte,
    borderWidth: 1,
    borderColor: RF.bordure,
    borderRadius: 12,
  },
  rechercheSaisie: { flex: 1, fontSize: 11, lineHeight: 14, color: RF.encre, padding: 0 },
  boutonFiltre: { width: 40, height: 38, borderRadius: 12, backgroundColor: RF.vert, alignItems: 'center', justifyContent: 'center' },
  pastille: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: RF.dangerPlein,
    borderWidth: 2,
    borderColor: RF.fond,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pastilleTexte: { fontSize: 8, lineHeight: 10, fontWeight: '700', color: RF.surMarque },

  titreSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  titreSectionTexte: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5, color: RF.attenue },
  compteur: { fontSize: 9, lineHeight: 11, fontWeight: '500', color: RF.etiquette },
  carte: { backgroundColor: RF.carte, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12 },

  champ: { backgroundColor: RF.champ, borderWidth: 1, borderColor: RF.bordure, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, gap: 2 },
  champLibelle: { fontSize: 9, lineHeight: 11, fontWeight: '500', color: RF.etiquette },
  champValeur: { fontSize: 13, lineHeight: 16, fontWeight: '700', color: RF.encre },

  ligneInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 11, paddingVertical: 8, gap: 12 },
  ligneInfoSeparee: { borderBottomWidth: 1, borderBottomColor: RF.bordure },
  ligneInfoLibelle: { fontSize: 11, lineHeight: 14, color: RF.attenue },
  ligneInfoValeur: { fontSize: 12, lineHeight: 15, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  ligneInfoMono: { fontSize: 10, lineHeight: 13, fontWeight: '500', fontFamily: Fonts.mono, textAlign: 'right', flexShrink: 1 },

  note: { flexDirection: 'row', gap: 7, padding: 9, backgroundColor: RF.ambreFond, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12, alignItems: 'flex-start' },
  noteTexte: { flex: 1, fontSize: 10, lineHeight: 13, color: RF.ambre },
  enteteDetail: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lectureSeule: { fontSize: 9, lineHeight: 11, fontWeight: '500', color: RF.etiquette },
  vide: { fontSize: 11, lineHeight: 14, color: RF.attenue, textAlign: 'center', paddingVertical: 24 },

  voile: { flex: 1, backgroundColor: RF.voile, justifyContent: 'flex-end' },
  voileZone: { flex: 1 },
  feuille: { backgroundColor: RF.fond, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '88%', paddingBottom: 16 },
  poignee: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: RF.bordure, marginTop: 8 },
  feuilleEntete: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  feuilleTitre: { fontSize: 15, lineHeight: 19, fontWeight: '700', color: RF.encre },
  effacer: { fontSize: 9, lineHeight: 11, fontWeight: '700', color: RF.dangerTexte },
  feuilleContenu: { paddingHorizontal: 16, paddingBottom: 12, gap: 16 },
  sectionFiltre: { gap: 8 },
  action: { marginHorizontal: 16, height: 44, borderRadius: 13, backgroundColor: RF.vert, alignItems: 'center', justifyContent: 'center' },
  actionTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: RF.surMarque },

  selection: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, backgroundColor: RF.carte, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12 },
  selectionTexte: { fontSize: 11, lineHeight: 14, color: RF.encre },
  selectionChoisie: { fontWeight: '700', color: RF.vert },
  selectionListe: { marginTop: 4, backgroundColor: RF.carte, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12 },
  selectionOption: { paddingHorizontal: 11, paddingVertical: 10 },

  interrupteurLigne: { height: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 11, backgroundColor: RF.carte, borderWidth: 1, borderColor: RF.bordure, borderRadius: 12 },
  interrupteurLibelle: { fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  interrupteur: { width: 34, height: 20, borderRadius: 10, padding: 2, justifyContent: 'center' },
  interrupteurPouce: { width: 16, height: 16, borderRadius: 8, backgroundColor: RF.carte },
});
