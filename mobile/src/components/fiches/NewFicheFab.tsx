import { useMemo, useState } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { peutSaisirVols } from '@/lib/equipe-aerienne-access';
import { motifEquipeIncompatible } from '@/lib/equipe-travail';
import { useEquipeSheetStore } from '@/lib/equipe-sheet-store';
import { useEquipesDeTravail } from '@/hooks/use-equipes-de-travail';
import { BandeauEquipe } from '@/components/equipe/BandeauEquipe';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';
import { EQ } from '@/components/equipe/tokens';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

/**
 * Bouton flottant "+ Nouvelle fiche" mutualisé — extrait de l'accueil ((app)/index.tsx)
 * pour être réutilisé sur "Mes fiches" ((app)/fiches.tsx) sans dupliquer le menu de
 * choix (prospection intensive / extensive / CRT).
 */
export function NewFicheFab() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const user = useAuthStore((s) => s.user);
  const avecVol = peutSaisirVols(user?.role);
  const [menuVisible, setMenuVisible] = useState(false);
  const ouvrirChoixEquipe = useEquipeSheetStore((s) => s.ouvrir);
  const { courante } = useEquipesDeTravail();
  const motifVol = motifEquipeIncompatible('aerien', courante);

  // Deux Modal ne se superposent pas proprement sur iOS : on ferme le menu avant d'ouvrir la feuille.
  const fermerMenu = () => {
    setMenuVisible(false);
  };
  const aller = (pathname: string) => {
    fermerMenu();
    router.push(pathname as any);
  };
  const changerEquipe = () => {
    fermerMenu();
    ouvrirChoixEquipe();
  };

  return (
    <>
      <TouchableOpacity testID="fab-nouvelle-fiche" style={styles.fab} onPress={() => setMenuVisible(true)} activeOpacity={0.85}>
        <AppIcon name="ajouter" size={26} color={EQ.surMarque} />
      </TouchableOpacity>

      <Modal animationType="slide" transparent visible={menuVisible} onRequestClose={fermerMenu}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={fermerMenu}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <>
                <Text style={styles.title}>Nouvelle fiche</Text>
                <Text style={styles.subtitle}>Choisissez le type de fiche à remplir.</Text>
                <View style={styles.equipe}>
                  <BandeauEquipe equipe={courante} onChanger={changerEquipe} />
                </View>
                <View style={styles.cards}>
                  <CarteChoix
                    styles={styles}
                    testID="fab-prospection"
                    icone="prospections"
                    couleur={EQ.vert}
                    fond={EQ.vertDoux}
                    titre="Prospection"
                    sousTitre="Intensive, extensive ou validation"
                    onPress={() => aller('/(prospection)/type-chooser')}
                  />
                  <CarteChoix
                    styles={styles}
                    testID="fab-traitement"
                    icone="crt"
                    couleur={EQ.violet}
                    fond={EQ.violetDoux}
                    titre="Traitement"
                    sousTitre="Compte-rendu après une opération"
                    onPress={() => {
                      fermerMenu();
                      router.push('/(traitement)/select' as any);
                    }}
                  />
                  {avecVol && (
                    <CarteChoix
                      styles={styles}
                      testID="fab-nouveau-vol"
                      icone="aeronef-avion"
                      couleur={EQ.bleu}
                      fond={EQ.bleuDoux}
                      titre="Vol"
                      sousTitre={motifVol ?? 'Convoyage ou vol divers'}
                      indisponible={!!motifVol}
                      onPress={() => {
                        if (motifVol) return changerEquipe();
                        fermerMenu();
                        router.push('/(app)/vol-nouveau' as any);
                      }}
                    />
                  )}
                </View>
            </>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

interface CarteChoixProps {
  styles: ReturnType<typeof createStyles>;
  testID: string;
  icone: AppIconName;
  couleur: string;
  fond: string;
  titre: string;
  sousTitre: string;
  indisponible?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

/** Carte de la feuille « Nouvelle fiche » (Figma 220:90) : pastille d'icône, titre, sous-titre, chevron. */
function CarteChoix({ styles, testID, icone, couleur, fond, titre, sousTitre, indisponible, disabled, onPress }: CarteChoixProps) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.card, indisponible && styles.cardIndisponible]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <View style={[styles.cardIconBox, { backgroundColor: fond }]}>
        <AppIcon name={icone} size={24} color={couleur} />
      </View>
      <View style={styles.cardTextWrap}>
        <Text style={styles.cardTitle}>{titre}</Text>
        <Text style={styles.cardSubtitle}>{sousTitre}</Text>
      </View>
      <View style={styles.chevron}>
        <AppIcon name="suivant" size={24} color={EQ.etiquette} />
      </View>
    </TouchableOpacity>
  );
}

const BASE_TYPE_SIZES = {
  title: 19,
  subtitle: 13,
  cardTitle: 15,
  cardSubtitle: 12,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    fab: {
      position: 'absolute',
      right: 20,
      bottom: 20,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: EQ.vert,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    sheet: {
      backgroundColor: EQ.carte,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 10,
      paddingBottom: 32,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: EQ.bordureForte,
      alignSelf: 'center',
      marginBottom: 14,
    },
    title: {
      fontSize: typeSizes.title,
      fontWeight: '800',
      color: EQ.encre,
    },
    subtitle: {
      fontSize: typeSizes.subtitle,
      color: EQ.attenue,
    },
    equipe: {
      marginTop: 12,
    },
    cards: {
      gap: 10,
      marginTop: 14,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      padding: 14,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: EQ.bordure,
      backgroundColor: EQ.carte,
    },
    cardIconBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardTextWrap: {
      flex: 1,
      gap: 2,
    },
    cardTitle: {
      fontSize: typeSizes.cardTitle,
      fontWeight: '700',
      color: EQ.encre,
    },
    cardSubtitle: {
      fontSize: typeSizes.cardSubtitle,
      color: EQ.attenue,
    },
    chevron: {
      width: 16,
      height: 16,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'visible',
    },
    retour: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 16,
    },
    retourTexte: {
      fontSize: typeSizes.cardSubtitle,
      fontWeight: '700',
      color: EQ.vert,
    },
    cardIndisponible: {
      opacity: 0.55,
    },
  });
}
