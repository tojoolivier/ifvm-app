import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { Carte, RF } from '@/components/referentiel/composants';
import { ThemedText } from '@/components/themed-text';
import { AppIcon } from '@/components/ui/AppIcon';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useAuthStore } from '@/lib/auth-store';
import { entreesCatalogue, libelleCourtEntite } from '@/lib/referentiel-catalogue';
import { libelleEntrees } from '@/lib/referentiel-consultation';
import { type ProgressionTable, reinitialiserReferentiel } from '@/lib/referentiel-sync';

type Phase = 'telechargement' | 'ecriture' | 'termine' | 'annule' | 'echec';

const TOTAL = entreesCatalogue().length;

const SOUS_TITRE: Record<Phase, string> = {
  telechargement: 'Téléchargement depuis le serveur…',
  ecriture: 'Enregistrement sur le téléphone…',
  termine: 'Référentiels à jour',
  annule: 'Réinitialisation annulée — rien n’a été supprimé',
  echec: 'La réinitialisation a échoué — vos données locales sont intactes',
};

/**
 * Réinitialisation en cours (Figma « Réinitialisation · En cours »). Le téléchargement précède le
 * vidage (cf. `reinitialiserReferentiel`) : « Annuler » est donc sans danger tant que la phase est
 * « téléchargement » ; une fois l'écriture commencée, il n'y a plus de retour.
 */
export default function ReferentielReinitScreen() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { run } = useAsyncAction();

  const [phase, setPhase] = useState<Phase>('telechargement');
  const [finies, setFinies] = useState<ProgressionTable[]>([]);
  const [enCours, setEnCours] = useState<ProgressionTable | null>(null);
  const [essai, setEssai] = useState(0);
  const annule = useRef(false);

  useEffect(() => {
    annule.current = false;

    let abouti = false;
    void run(
      async () => {
        const resultat = await reinitialiserReferentiel(token!, {
          estAnnule: () => annule.current,
          surProgression: (p) => {
            setPhase('ecriture');
            if (p.etat === 'en_cours') setEnCours(p);
            else {
              setEnCours(null);
              setFinies((liste) => [...liste, p]);
            }
          },
        });
        abouti = true;
        setPhase(resultat === 'annule' ? 'annule' : 'termine');
      },
      {
        screen: 'referentiel-reinit',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour réinitialiser.',
        context: { action: 'reinitialiser' },
      }
    ).then(() => {
      // `run` ne relance pas l'erreur : elle est déjà signalée, il reste à l'écran d'en tenir compte.
      if (!abouti) setPhase('echec');
    });
    // `token` change rarement ; `essai` relance volontairement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [essai]);

  const fini = phase === 'termine' || phase === 'annule' || phase === 'echec';
  const nbFinies = finies.length;
  const restantes = entreesCatalogue()
    .filter((e) => !finies.some((f) => f.table === e.entite) && enCours?.table !== e.entite)
    .map((e) => libelleCourtEntite(e.entite));

  const relancer = () => {
    setPhase('telechargement');
    setFinies([]);
    setEnCours(null);
    setEssai((n) => n + 1);
  };

  const retour = () => {
    if (phase === 'telechargement') annule.current = true;
    if (phase === 'telechargement' || fini) router.back();
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Réinitialisation" sousTitre={fini ? 'Terminé' : 'Ne quittez pas cet écran'} onRetour={retour} />
      <ScrollView contentContainerStyle={styles.contenu}>
        <View style={styles.rond}>
          <AppIcon name="synchroniser-grand" boite={48} color={RF.vert} />
        </View>
        <ThemedText style={styles.compte} testID="reinit-compte">
          {nbFinies} / {TOTAL} tables
        </ThemedText>
        <ThemedText style={styles.sousTitre} testID="reinit-phase">
          {SOUS_TITRE[phase]}
        </ThemedText>

        <View style={styles.piste} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: TOTAL, now: nbFinies }}>
          <View style={[styles.remplissage, { width: `${(nbFinies / TOTAL) * 100}%` }]} />
        </View>

        {nbFinies > 0 || enCours ? (
          <Carte>
            {finies.map((p, i) => (
              <LigneTable key={p.table} entite={p.table} etat="fait" detail={libelleEntrees(p.lignes)} premiere={i === 0} />
            ))}
            {enCours ? <LigneTable entite={enCours.table} etat="en_cours" detail="en cours…" premiere={nbFinies === 0} /> : null}
          </Carte>
        ) : null}

        {!fini && restantes.length > 0 && phase === 'ecriture' ? (
          <ThemedText style={styles.restantes}>
            {restantes.length} tables restantes : {restantes.join(', ')}
          </ThemedText>
        ) : null}

        {phase === 'echec' ? (
          <TouchableOpacity testID="reinit-reessayer" style={[styles.bouton, styles.principal]} onPress={relancer} accessibilityRole="button">
            <ThemedText style={[styles.boutonTexte, { color: RF.surMarque }]}>Réessayer</ThemedText>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity
          testID="reinit-action"
          style={[styles.bouton, styles.secondaire, phase === 'ecriture' && styles.inerte]}
          onPress={retour}
          disabled={phase === 'ecriture'}
          accessibilityRole="button"
          accessibilityState={{ disabled: phase === 'ecriture' }}
        >
          <ThemedText style={[styles.boutonTexte, { color: RF.vert }]}>{fini ? 'Fermer' : 'Annuler'}</ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

function LigneTable({ entite, etat, detail, premiere }: { entite: string; etat: 'fait' | 'en_cours'; detail: string; premiere: boolean }) {
  const entree = entreesCatalogue().find((e) => e.entite === entite);
  return (
    <View>
      {!premiere ? <View style={styles.filet} /> : null}
      <View style={styles.ligne}>
        {etat === 'fait' ? (
          <View style={styles.coche}>
            <AppIcon name="verifie" boite={19.2} color={RF.surMarque} />
          </View>
        ) : (
          <View style={styles.cocheVide} />
        )}
        <ThemedText style={[styles.ligneNom, etat === 'en_cours' && { color: RF.vert }]}>{entree?.libelle ?? entite}</ThemedText>
        <ThemedText style={styles.ligneDetail}>{detail}</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: RF.fond },
  contenu: { padding: 16, gap: 10, paddingBottom: 32, alignItems: 'stretch' },
  rond: { alignSelf: 'center', width: 100, height: 100, borderRadius: 50, backgroundColor: RF.vertDoux, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  compte: { fontSize: 18, lineHeight: 22, fontWeight: '700', color: RF.encre, textAlign: 'center', marginTop: 6 },
  sousTitre: { fontSize: 11, lineHeight: 14, color: RF.attenue, textAlign: 'center' },
  piste: { height: 8, borderRadius: 4, backgroundColor: RF.inactif, marginTop: 6, overflow: 'hidden' },
  remplissage: { height: 8, borderRadius: 4, backgroundColor: RF.vert },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, paddingVertical: 9 },
  filet: { height: 1, backgroundColor: RF.bordure, marginHorizontal: 11 },
  coche: { width: 16, height: 16, borderRadius: 8, backgroundColor: RF.vert, alignItems: 'center', justifyContent: 'center' },
  cocheVide: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: RF.vert },
  ligneNom: { flex: 1, fontSize: 12, lineHeight: 15, fontWeight: '600', color: RF.encre },
  ligneDetail: { fontSize: 10, lineHeight: 13, color: RF.attenue },
  restantes: { fontSize: 10, lineHeight: 13, color: RF.etiquette, textAlign: 'center' },
  bouton: { height: 44, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  principal: { backgroundColor: RF.vert },
  secondaire: { backgroundColor: RF.carte, borderWidth: 1.5, borderColor: RF.vert },
  inerte: { opacity: 0.4 },
  boutonTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
});
