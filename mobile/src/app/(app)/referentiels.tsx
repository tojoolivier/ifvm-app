import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { BarreRecherche, Carte, EtatVide, RF, TitreSection } from '@/components/referentiel/composants';
import { ModaleReinitialisation } from '@/components/referentiel/ModaleReinitialisation';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { filtrerCatalogue } from '@/lib/referentiel-catalogue';
import {
  type EtatFraicheur,
  type ResumeReferentiel,
  etatFraicheur,
  formaterDerniereSynchro,
  formaterJourMois,
  formaterNombre,
  libelleEntrees,
  resumerReferentielLocal,
} from '@/lib/referentiel-consultation';
import { pullReferentiel, resetReferentielSyncCursors } from '@/lib/referentiel-sync';

const BADGE_FRAICHEUR: Record<EtatFraicheur, { texte: string; ton: 'vertDoux' | 'ambre' | 'neutre' }> = {
  a_jour: { texte: 'À JOUR', ton: 'vertDoux' },
  a_synchroniser: { texte: 'À SYNCHRONISER', ton: 'ambre' },
  jamais: { texte: 'JAMAIS SYNCHRONISÉ', ton: 'neutre' },
};

/**
 * Accueil des référentiels (Figma « Référentiels · Accueil ») : ce que le téléphone sait hors-ligne,
 * rangé par domaine. Lecture seule — les données viennent du serveur ; seuls « Synchroniser » et
 * « Tout réinitialiser » agissent, et seulement sur le cache local.
 */
export default function ReferentielsScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('referentiels');
  const token = useAuthStore((s) => s.token);
  const { run, isRunning: enSynchro } = useAsyncAction();

  const [resume, setResume] = useState<ResumeReferentiel | null>(null);
  const [recherche, setRecherche] = useState('');
  const [confirmation, setConfirmation] = useState(false);

  const charger = useCallback(() => {
    resumerReferentielLocal()
      .then(setResume)
      .catch((error) => signalerChargement(error, { source: 'referentiels' }));
  }, [signalerChargement]);

  useFocusEffect(charger);

  const synchroniser = () =>
    run(
      async () => {
        // Curseurs remis à zéro : un pull incrémental ne rattraperait pas une table partiellement peuplée
        // (même raison que le bouton « Synchroniser » de l'écran Synchronisation).
        await resetReferentielSyncCursors();
        await pullReferentiel(token!);
        charger();
      },
      {
        screen: 'referentiels',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
        context: { action: 'synchroniser' },
      }
    );

  const parTable = useMemo(() => new Map((resume?.tables ?? []).map((t) => [t.table, t])), [resume]);
  const sections = filtrerCatalogue(recherche);
  const fraicheur = BADGE_FRAICHEUR[etatFraicheur(resume?.derniereSynchro)];
  const nbTables = resume?.tables.length ?? 0;
  const totalLignes = resume?.totalLignes ?? 0;

  return (
    <View style={styles.racine}>
      <EquipeHeader
        titre="Référentiels"
        sousTitre="Données de référence · disponibles hors-ligne"
        onRetour={() => router.back()}
      />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        <BarreRecherche
          valeur={recherche}
          onChange={setRecherche}
          placeholder="Rechercher dans tous les référentiels"
        />

        <Carte testID="carte-synchro">
          <View style={styles.synchro}>
            <View style={styles.synchroEntete}>
              <View style={styles.synchroTitres}>
                <ThemedText style={styles.etiquette}>DERNIÈRE SYNCHRONISATION</ThemedText>
                <ThemedText style={styles.synchroDate}>{formaterDerniereSynchro(resume?.derniereSynchro)}</ThemedText>
              </View>
              <EquipeBadge texte={fraicheur.texte} ton={fraicheur.ton} />
            </View>
            <ThemedText style={styles.synchroTotal}>
              {nbTables} tables · {formaterNombre(totalLignes)} entrées
            </ThemedText>
            <View style={styles.actions}>
              <TouchableOpacity
                testID="referentiels-synchroniser"
                style={[styles.action, { backgroundColor: RF.vertDoux }, enSynchro && styles.inerte]}
                onPress={synchroniser}
                disabled={enSynchro}
                accessibilityRole="button"
                accessibilityState={{ disabled: enSynchro }}
              >
                <AppIcon name="synchroniser-grand" boite={21.6} color={RF.vert} />
                <ThemedText style={[styles.actionTexte, { color: RF.vert }]}>
                  {enSynchro ? 'Synchronisation…' : 'Synchroniser'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                testID="referentiels-reinitialiser"
                style={[styles.action, { backgroundColor: RF.dangerFond }, enSynchro && styles.inerte]}
                onPress={() => setConfirmation(true)}
                disabled={enSynchro}
                accessibilityRole="button"
              >
                <AppIcon name="alerte" boite={21.6} color={RF.dangerTexte} />
                <ThemedText style={[styles.actionTexte, { color: RF.dangerTexte }]}>Tout réinitialiser</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </Carte>

        {sections.length === 0 ? <EtatVide texte="Aucun référentiel ne correspond à cette recherche." /> : null}

        {sections.map((section) => (
          <View key={section.titre} style={styles.section}>
            <TitreSection titre={section.titre} compteur={section.entrees.length} />
            <Carte>
              {section.entrees.map((entree, i) => {
                const etat = parTable.get(entree.table);
                const majLe = etat?.majLe ? ` · màj ${formaterJourMois(etat.majLe)}` : '';
                const ouvrable = entree.route !== null;
                return (
                  <View key={entree.table}>
                    {i > 0 ? <View style={styles.filet} /> : null}
                    <TouchableOpacity
                      testID={`referentiel-${entree.table}`}
                      style={styles.ligne}
                      disabled={!ouvrable}
                      onPress={() => router.push(entree.route as never)}
                      accessibilityRole={ouvrable ? 'button' : 'text'}
                    >
                      <View style={styles.tuile}>
                        <AppIcon name={entree.icone} size={23.04} color={RF.vert} />
                      </View>
                      <View style={styles.ligneTextes}>
                        <ThemedText style={styles.ligneTitre}>{entree.libelle}</ThemedText>
                        <ThemedText
                          style={styles.ligneSous}
                        >{`${libelleEntrees(etat?.lignes ?? 0)}${majLe}`}</ThemedText>
                      </View>
                      {ouvrable ? <AppIcon name="suivant" boite={21.6} color={RF.attenue} /> : null}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </Carte>
          </View>
        ))}

        <ThemedText style={styles.pied}>Lecture seule · données gérées par le serveur</ThemedText>
      </ScrollView>

      <ModaleReinitialisation
        visible={confirmation}
        nbTables={nbTables}
        nbEntrees={totalLignes}
        onAnnuler={() => setConfirmation(false)}
        onConfirmer={() => {
          setConfirmation(false);
          router.push('/(app)/referentiel-reinit' as never);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, gap: 14, paddingBottom: 32 },
  synchro: { padding: 11, gap: 6 },
  synchroEntete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  synchroTitres: { gap: 3, flexShrink: 1 },
  etiquette: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    color: RF.etiquette,
  },
  synchroDate: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: RF.encre,
  },
  synchroTotal: { fontSize: 10, lineHeight: 13, color: RF.attenue },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    height: 24,
    paddingRight: 8,
    borderRadius: 9,
    flexGrow: 1,
  },
  actionTexte: { fontSize: 9, lineHeight: 11, fontWeight: '700' },
  inerte: { opacity: 0.5 },
  section: { gap: 8 },
  ligne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 9,
    paddingVertical: 9,
  },
  filet: {
    height: 1,
    backgroundColor: RF.bordure,
    marginLeft: 53,
    marginRight: 11,
  },
  tuile: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: RF.vertDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ligneTextes: { flex: 1, gap: 2 },
  ligneTitre: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '600',
    color: RF.encre,
  },
  ligneSous: { fontSize: 10, lineHeight: 13, color: RF.attenue },
  pied: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    color: RF.etiquette,
    textAlign: 'center',
    marginTop: 6,
  },
});
