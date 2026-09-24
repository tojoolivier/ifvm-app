import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { listReprenableTraitements, ReprenableTraitementRow } from '@/lib/traitement-repository';
import { traitementColors, traitementFonts, traitementRadii, useTraitementTypeSizes } from '@/components/traitement/tokens';
import { runTask } from '@/lib/run-task';
import { EtatVide } from '@/components/erreurs/etat-vide';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

/**
 * Écran "Zones à reprendre" (Lot 3) — fiches (terrestres et aériennes)
 * validées dont la surface restante est encore positive ou pas encore
 * connue (`listReprenableTraitements`). Chaque ligne affiche la surface
 * disponible à traiter pour la reprise : c'est la surface restante de
 * CETTE fiche (l'ancien traitement), pas une nouvelle saisie. Amorce une
 * nouvelle fiche sur la même prospection d'origine, avec `origineId`
 * propagé jusqu'à l'écran C (`traitement.tsx`) pour présélectionner
 * automatiquement la reprise sur cette fiche.
 */
export default function TraitementZonesAReprendreScreen() {
  const router = useRouter();
  const [fiches, setFiches] = useState<ReprenableTraitementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [erreurDeLecture, setErreurDeLecture] = useState<unknown>(null);
  const typeSizes = useTraitementTypeSizes();
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  const charger = useCallback(() => {
    void runTask(() => listReprenableTraitements(), {
      name: 'traitement.zonesAReprendre',
      criticality: 'essential',
    }).then((outcome) => {
      setErreurDeLecture(outcome.ok ? null : outcome.error);
      if (outcome.ok) setFiches(outcome.value);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  const openFiche = (fiche: ReprenableTraitementRow) => {
    router.push({
      pathname: '/(traitement)/references' as any,
      params: { prospectionId: fiche.prospection_id, origineId: fiche.id },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Zones à reprendre</Text>

      {loading ? (
        <Text style={styles.emptyText}>Chargement…</Text>
      ) : (
        <FlatList
          style={styles.list}
          data={fiches}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <EtatVide erreur={erreurDeLecture} titreVide="Aucune zone à reprendre pour le moment." onReessayer={charger} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.row} onPress={() => openFiche(item)}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle}>{item.numero_fiche ?? 'généré à l’enregistrement'}</Text>
                {/* #zone-a-reprendre-insigne : même insigne que sur « Mes
                    fiches » (FicheCard.insigneBadge) — cohérent entre les deux
                    écrans, même si celui-ci n'utilise pas FicheCard (système
                    de styles propre au module traitement). */}
                <View style={styles.insigne}>
                  <Text style={styles.insigneText}>↻ REPRISE POSSIBLE</Text>
                </View>
              </View>
              <Text style={styles.rowSubtitle}>
                {item.type_traitement} · {item.localite ?? 'localité non renseignée'}
              </Text>
              {/* Surface disponible à traiter pour la reprise = surface restante de
                  CETTE fiche (l'ancien traitement) : `null` tant qu'aucun pull ne
                  l'a rapatriée depuis le serveur (cf. ReprenableTraitementRow). */}
              <Text style={styles.rowSurface}>
                Surface disponible à traiter :{' '}
                {item.surface_restante_ha != null ? `${item.surface_restante_ha} ha` : 'non communiquée'}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}

      <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
        <Text style={styles.backLinkText}>‹ Retour</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

function createStyles(typeSizes: ReturnType<typeof useTraitementTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: traitementColors.fondApp, padding: 16, gap: 12 },
    title: {
      fontFamily: traitementFonts.uiExtraBold,
      fontSize: typeSizes.titreEcran,
      color: traitementColors.texteTitre,
    },
    list: { flex: 1 },
    emptyText: { fontFamily: traitementFonts.ui, color: traitementColors.texteLabel, textAlign: 'center', marginTop: 20 },
    row: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: traitementColors.bordure,
      borderRadius: traitementRadii.carte,
      padding: 10,
      marginBottom: 8,
      gap: 2,
    },
    rowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
    rowTitle: { fontFamily: traitementFonts.mono, fontSize: typeSizes.corps, color: traitementColors.texteTitre },
    insigne: {
      backgroundColor: traitementColors.avertissementFond,
      borderRadius: traitementRadii.chip,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    insigneText: { fontFamily: traitementFonts.uiExtraBold, fontSize: 10, color: traitementColors.avertissementTexte },
    rowSubtitle: { fontFamily: traitementFonts.ui, fontSize: typeSizes.label, color: traitementColors.texteSecondaire },
    rowSurface: {
      fontFamily: traitementFonts.uiMedium,
      fontSize: typeSizes.label,
      color: traitementColors.texteTitre,
    },
    backLink: {
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: traitementColors.dashedBordure,
      borderRadius: traitementRadii.chip,
      padding: 10,
      alignItems: 'center',
      minHeight: 44,
      justifyContent: 'center',
    },
    backLinkText: { fontFamily: traitementFonts.uiMedium, color: traitementColors.texteSecondaire },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
