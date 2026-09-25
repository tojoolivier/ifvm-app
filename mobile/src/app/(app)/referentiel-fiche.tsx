import { useCallback } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, Champ, EnteteDetail, EtatVide, LigneInfo, NoteInfo, RF, TitreSection, BadgeActif } from '@/components/referentiel/composants';
import { useFicheChargee } from '@/hooks/use-fiche-chargee';
import { abregerIdentifiant, formaterDateHeure } from '@/lib/referentiel-consultation';
import { type FicheGenerique, configGenerique, estGenerique, getLigneGenerique } from '@/lib/referentiel-generique';

/** Fiche en lecture seule d'une entrée d'un référentiel sans écran dédié ; ses champs viennent de la configuration de la table. */
export default function ReferentielFicheScreen() {
  const router = useRouter();
  const { table, cle } = useLocalSearchParams<{ table: string; cle: string }>();
  // Un paramètre absent ou inconnu (lien périmé) ne doit pas faire planter l'écran.
  const config = estGenerique(table) ? configGenerique(table) : null;
  const charger = useCallback(
    (identifiant: string) => (estGenerique(table) ? getLigneGenerique(table, identifiant) : Promise.resolve(null)),
    [table]
  );
  const fiche = useFicheChargee<FicheGenerique>(`referentiel-fiche-${table}`, cle, charger);

  if (!config) {
    return (
      <View style={styles.racine}>
        <EquipeHeader titre="Fiche" onRetour={() => router.back()} />
        <EtatVide texte="Ce référentiel n’existe pas." />
      </View>
    );
  }

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
              badge={fiche.actif === null ? <View /> : <BadgeActif actif={fiche.actif} />}
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
