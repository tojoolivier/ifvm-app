import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, Champ, EnteteDetail, EtatVide, LigneInfo, NoteInfo, RF, TitreSection } from '@/components/referentiel/composants';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { abregerIdentifiant, formaterDateHeure } from '@/lib/referentiel-consultation';
import { type FicheGenerique, configGenerique, getLigneGenerique } from '@/lib/referentiel-generique';

/** Fiche en lecture seule d'une entrée d'un référentiel sans écran dédié ; ses champs viennent de la configuration de la table. */
export default function ReferentielFicheScreen() {
  const router = useRouter();
  const { table, cle } = useLocalSearchParams<{ table: string; cle: string }>();
  const config = configGenerique(table);
  const signalerChargement = useSignalerChargement('referentiel-fiche');
  const [fiche, setFiche] = useState<FicheGenerique | null | undefined>(undefined);

  useEffect(() => {
    getLigneGenerique(table, cle)
      .then(setFiche)
      .catch((error) => signalerChargement(error, { source: 'referentiel-fiche', table, cle }));
  }, [table, cle, signalerChargement]);

  const aSynchro = fiche && (config.avecIdentifiant || fiche.majLe || fiche.actif !== null);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={fiche?.titre ?? config.libelleFiche}
        sousTitre={fiche ? `${config.libelleFiche}${fiche.code ? ` · ${fiche.code}` : ''}` : undefined}
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {fiche === null ? <EtatVide texte="Cette entrée n’est plus dans le référentiel de ce téléphone." /> : null}
        {fiche ? (
          <>
            <EnteteDetail
              actif={fiche.actif !== false}
              badge={fiche.actif === null ? <View /> : <EquipeBadge texte={fiche.actif ? 'ACTIF' : 'INACTIF'} ton={fiche.actif ? 'vertDoux' : 'neutre'} />}
            />
            {fiche.champs.map((champ) => (
              <Champ key={champ.libelle} libelle={champ.libelle} valeur={champ.valeur} />
            ))}

            {aSynchro ? (
              <>
                <TitreSection titre="INFORMATIONS DE SYNCHRONISATION" />
                <Carte>
                  <View style={styles.carteDouce}>
                    {config.avecIdentifiant ? <LigneInfo libelle="Identifiant" valeur={abregerIdentifiant(fiche.cle)} mono /> : null}
                    {fiche.majLe ? <LigneInfo libelle="Dernière mise à jour" valeur={formaterDateHeure(fiche.majLe)} /> : null}
                    {fiche.actif !== null ? (
                      <LigneInfo libelle="Statut serveur" valeur={fiche.actif ? 'Actif' : 'Inactif'} couleur={fiche.actif ? RF.vert : RF.attenue} />
                    ) : null}
                  </View>
                </Carte>
              </>
            ) : null}
            <NoteInfo texte="Cette fiche vient du serveur. Elle se met à jour à la synchronisation et ne peut pas être modifiée ici." />
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
