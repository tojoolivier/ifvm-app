import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, Champ, EnteteDetail, EtatVide, LigneInfo, NoteInfo, RF, TitreSection, BadgeActif } from '@/components/referentiel/composants';
import { useFicheChargee } from '@/hooks/use-fiche-chargee';
import {
  type CodeStadeLigne,
  getCodeStade,
  libelleCategorie,
  libelleSexe,
} from '@/lib/referentiel-consultation';

/** Fiche d'un code stade, en lecture seule (Figma « Code stade · Détail »). */
export default function ReferentielCodeStadeScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const stade = useFicheChargee<CodeStadeLigne>('referentiel-code-stade', id, getCodeStade);

  const categorieSexe = stade ? [libelleCategorie(stade.categorie), stade.sexe === 'F' ? 'femelle' : stade.sexe === 'M' ? 'mâle' : null].filter(Boolean).join(' ') : '';

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={stade ? `${stade.code} · ${stade.libelle}` : 'Code stade'}
        sousTitre={stade ? `Code stade · ${categorieSexe}` : undefined}
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {stade === null ? <EtatVide texte="Ce code stade n’est plus dans le référentiel de ce téléphone." /> : null}
        {stade ? (
          <>
            <EnteteDetail actif={stade.actif} badge={<BadgeActif actif={stade.actif} />} />
            <Champ libelle="Code" valeur={stade.code} />
            <Champ libelle="Libellé" valeur={stade.libelle} />
            <Champ libelle="Catégorie" valeur={libelleCategorie(stade.categorie)} />
            <Champ libelle="Sexe" valeur={libelleSexe(stade.sexe)} />
            <Champ libelle="Espèce" valeur={stade.espece ?? 'Toutes espèces'} />

            <TitreSection titre="ORDRE DANS LA GRILLE" />
            <Carte>
              <View style={styles.carteDouce}>
                <LigneInfo libelle="Position de saisie" valeur={String(stade.ordre)} mono />
              </View>
            </Carte>
            <NoteInfo texte="Un même code peut figurer plusieurs fois : A1 existe en version femelle et en version mâle. Espèce ou sexe vides valent « toutes espèces » / « non sexé »." />
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
