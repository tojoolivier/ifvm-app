import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, Champ, EnteteDetail, EtatVide, LigneInfo, NoteInfo, RF, TitreSection } from '@/components/referentiel/composants';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import {
  type PesticideLigne,
  abregerIdentifiant,
  formaterDateHeure,
  getPesticide,
  libelleTypeProduit,
} from '@/lib/referentiel-consultation';

/** Fiche d'un pesticide, en lecture seule (Figma « Pesticide · Détail »). */
export default function ReferentielPesticideScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const signalerChargement = useSignalerChargement('referentiel-pesticide');
  const [pesticide, setPesticide] = useState<PesticideLigne | null | undefined>(undefined);

  useEffect(() => {
    getPesticide(id)
      .then(setPesticide)
      .catch((error) => signalerChargement(error, { source: 'referentiel-pesticide', id }));
  }, [id, signalerChargement]);

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre={pesticide?.nom ?? 'Pesticide'}
        sousTitre={pesticide ? `Pesticide · ${pesticide.code}` : undefined}
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu}>
        {pesticide === null ? <EtatVide texte="Ce pesticide n’est plus dans le référentiel de ce téléphone." /> : null}
        {pesticide ? (
          <>
            <EnteteDetail actif={pesticide.actif} badge={<EquipeBadge texte={pesticide.actif ? 'ACTIF' : 'INACTIF'} ton={pesticide.actif ? 'vertDoux' : 'neutre'} />} />
            <Champ libelle="Code" valeur={pesticide.code} />
            <Champ libelle="Nom" valeur={pesticide.nom} />
            <Champ libelle="Matière active" valeur={pesticide.matiere_active ?? '—'} />
            <Champ libelle="Dose de référence" valeur={pesticide.dose_reference ?? '—'} />
            <Champ libelle="Type de produit" valeur={libelleTypeProduit(pesticide.type_produit)} />

            <TitreSection titre="INFORMATIONS DE SYNCHRONISATION" />
            <Carte>
              <View style={styles.carteDouce}>
                <LigneInfo libelle="Identifiant" valeur={abregerIdentifiant(pesticide.id)} mono />
                <LigneInfo libelle="Dernière mise à jour" valeur={formaterDateHeure(pesticide.updated_at)} />
                <LigneInfo libelle="Statut serveur" valeur={pesticide.actif ? 'Actif' : 'Inactif'} couleur={pesticide.actif ? RF.vert : RF.attenue} />
              </View>
            </Carte>
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
