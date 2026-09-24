import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { DateField } from '@/components/DateField';
import { ThemedText } from '@/components/themed-text';
import { TimeField } from '@/components/TimeField';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { BandeauEquipeVol } from '@/components/vol/BandeauEquipeVol';
import { useAeronefDuJour } from '@/hooks/use-aeronef-du-jour';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAuthStore } from '@/lib/auth-store';
import { aujourdhuiIso } from '@/lib/equipe-db';
import { useEquipeTravailStore } from '@/lib/equipe-travail-store';
import { getEquipeLocale } from '@/lib/referentiel-db';
import { envoyerSitesSiEnLigne } from '@/lib/site-aerien-envoi';
import { creerVolAutonome } from '@/lib/vol-db';
import { type CategorieVol, validerVol } from '@/lib/vol-regles';

type Categorie = Extract<CategorieVol, 'convoyage' | 'divers'>;
const CATEGORIES: { valeur: Categorie; libelle: string }[] = [
  { valeur: 'convoyage', libelle: 'Convoyage' },
  { valeur: 'divers', libelle: 'Divers' },
];

/**
 * Écran « Convoyage / divers » (#644, Figma 81:487) : les seuls vols saisis hors d'une opération.
 * Équipe et aéronef sont repris de l'équipe de travail (#641, #642) ; motif obligatoire, lieux de
 * départ et d'arrivée obligatoires pour un convoyage. Enregistré sur l'appareil, envoyé ensuite.
 */
export default function VolNouveauScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('vol-nouveau');
  const token = useAuthStore((s) => s.token);
  const equipeId = useEquipeTravailStore((s) => s.equipeId);
  const { run, isRunning } = useAsyncAction();

  const [equipe, setEquipe] = useState<{ nom: string; type: 'terrestre' | 'aerien' } | null>(null);
  const [categorie, setCategorie] = useState<Categorie>('convoyage');
  const [date, setDate] = useState(aujourdhuiIso());
  const { aeronef, aeronefs, choisir: choisirAeronef } = useAeronefDuJour(equipeId, date, 'vol-nouveau.aeronef');
  const [debut, setDebut] = useState('');
  const [fin, setFin] = useState('');
  const [lieuDepart, setLieuDepart] = useState('');
  const [lieuArrivee, setLieuArrivee] = useState('');
  const [motif, setMotif] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);

  useEffect(() => {
    if (!equipeId) return;
    getEquipeLocale(equipeId)
      .then((e) => setEquipe(e ? { nom: e.nom, type: e.type } : null))
      .catch((error) => signalerChargement(error, { source: 'vol-nouveau' }));
  }, [equipeId, signalerChargement]);

  const enregistrer = () => {
    const saisie = {
      categorie,
      equipeType: equipe?.type ?? null,
      aeronefId: aeronef?.id ?? null,
      date,
      debut,
      fin,
      sitePrincipalId: null,
      standId: null,
      baseSecondaireId: null,
      motif,
      lieuDepart,
      lieuArrivee,
    };
    const trouvees = equipeId ? validerVol(saisie, { dependantIds: [] }) : ['Choisissez une équipe de travail dans Paramètres.'];
    setErreurs(trouvees);
    if (trouvees.length > 0) return;

    void run(
      async () => {
        await creerVolAutonome({ ...saisie, categorie, equipeId: equipeId as string });
        if (token) void envoyerSitesSiEnLigne(token);
        router.back();
      },
      { screen: 'vol-nouveau', precondition: !!equipeId }
    );
  };

  const convoyage = categorie === 'convoyage';

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Nouveau vol" variante="formulaire" onRetour={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenu} keyboardShouldPersistTaps="handled">
        {erreurs.length > 0 && (
          <View style={styles.erreurs} accessibilityRole="alert">
            {erreurs.map((e) => (
              <ThemedText key={e} style={styles.erreur}>
                • {e}
              </ThemedText>
            ))}
          </View>
        )}

        <ThemedText style={styles.section}>CATÉGORIE *</ThemedText>
        <View style={styles.categories}>
          {CATEGORIES.map((c) => {
            const actif = c.valeur === categorie;
            return (
              <TouchableOpacity
                key={c.valeur}
                testID={`vol-categorie-${c.valeur}`}
                style={[styles.categorie, actif && styles.categorieActive]}
                onPress={() => setCategorie(c.valeur)}
                accessibilityRole="button"
                accessibilityState={{ selected: actif }}
              >
                <ThemedText style={[styles.categorieTexte, actif && styles.categorieTexteActive]}>{c.libelle}</ThemedText>
              </TouchableOpacity>
            );
          })}
        </View>

        <BandeauEquipeVol equipe={equipe} aeronef={aeronef} aeronefs={aeronefs} onChoisirAeronef={choisirAeronef} />

        <ThemedText style={styles.etiquette}>Date *</ThemedText>
        <DateField value={date} onChange={setDate} style={styles.champ} textStyle={styles.champTexte} />

        <View style={styles.heures}>
          <View style={styles.heure} testID="vol-debut">
            <ThemedText style={styles.etiquette}>Début *</ThemedText>
            <TimeField value={debut || null} onChange={setDebut} />
          </View>
          <View style={styles.heure} testID="vol-fin">
            <ThemedText style={styles.etiquette}>Fin *</ThemedText>
            <TimeField value={fin || null} onChange={setFin} />
          </View>
        </View>

        {convoyage && (
          <>
            <ThemedText style={styles.etiquette}>Lieu de départ *</ThemedText>
            <TextInput
              testID="vol-lieu-depart"
              style={[styles.champ, styles.champTexte]}
              value={lieuDepart}
              onChangeText={setLieuDepart}
            />
            <ThemedText style={styles.etiquette}>Lieu d’arrivée *</ThemedText>
            <TextInput
              testID="vol-lieu-arrivee"
              style={[styles.champ, styles.champTexte]}
              value={lieuArrivee}
              onChangeText={setLieuArrivee}
            />
          </>
        )}

        <ThemedText style={styles.etiquette}>Motif *</ThemedText>
        <TextInput
          testID="vol-motif"
          style={[styles.champ, styles.champTexte, styles.motif]}
          value={motif}
          onChangeText={setMotif}
          multiline
        />
      </ScrollView>

      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={enregistrer}
          disabled={isRunning}
          accessibilityRole="button"
          testID="vol-enregistrer"
        >
          <ThemedText style={styles.ctaTexte}>Enregistrer le vol</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 6 },
  section: { fontSize: 10, lineHeight: 12, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  categories: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  categorie: {
    flex: 1,
    height: 32,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categorieActive: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  categorieTexte: { fontSize: 12, lineHeight: 15, fontWeight: '700', color: EQ.attenue },
  categorieTexteActive: { color: EQ.surMarque },
  etiquette: { fontSize: 10, lineHeight: 12, fontWeight: '600', color: EQ.attenue, marginTop: 4 },
  champ: {
    minHeight: 34,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: EQ.bordure,
    backgroundColor: EQ.carte,
    paddingHorizontal: 11,
  },
  champTexte: { fontSize: 12, lineHeight: 16, fontWeight: '600', color: EQ.encre },
  motif: { minHeight: 44, paddingVertical: 12 },
  heures: { flexDirection: 'row', gap: 10 },
  heure: { flex: 1, gap: 6 },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, lineHeight: 14, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, lineHeight: 19, fontWeight: '800', color: EQ.surMarque },
});
