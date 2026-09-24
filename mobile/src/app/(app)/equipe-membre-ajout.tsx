import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ChoixField, OptionChoix } from '@/components/equipe/ChoixField';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useEcritureServeur } from '@/hooks/use-ecriture-serveur';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { apiClient } from '@/lib/api-client';
import { listAnnuaire, listChefsDAutresEquipes, listMembresEquipe, UtilisateurAnnuaire } from '@/lib/equipe-db';
import { libelleFonction, ROLES_A_LA_VOLEE, validerAjoutMembre } from '@/lib/equipe-regles';
import { getEquipeLocale } from '@/lib/referentiel-db';
import { pullReferentiel } from '@/lib/referentiel-sync';

type Mode = 'existant' | 'nouveau';

/** Fonctions proposées pour un compte existant (`chef` + les rôles de `FONCTIONS_EQUIPE`). */
const FONCTIONS_EXISTANT = ['chef', 'chef_equipe', 'agent_encadreur', 'pilote', 'mecanicien', 'consultant_international', 'membre'];

const options = (fonctions: readonly string[]): OptionChoix[] =>
  fonctions.map((f) => ({ valeur: f, libelle: libelleFonction(f) }));

/**
 * Ajout d'un membre (#641, Figma « Ajouter un membre ») : un compte existant choisi dans l'annuaire
 * local, ou un compte « à la volée » (nom + prénom, sans accès) limité aux fonctions de
 * `ROLES_A_LA_VOLEE`. Un seul chef par équipe, et un utilisateur ne dirige qu'une équipe.
 */
export default function EquipeMembreAjoutScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const signalerChargement = useSignalerChargement('equipe-membre-ajout');

  const [nomEquipe, setNomEquipe] = useState('');
  const [mode, setMode] = useState<Mode>('existant');
  const [recherche, setRecherche] = useState('');
  const [utilisateurs, setUtilisateurs] = useState<UtilisateurAnnuaire[]>([]);
  const [fonction, setFonction] = useState('pilote');
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [erreurs, setErreurs] = useState<string[]>([]);
  const { ecrire, isRunning } = useEcritureServeur('equipe-membre-ajout', (message) => setErreurs([message]));

  useEffect(() => {
    if (!id) return;
    getEquipeLocale(id)
      .then((e) => setNomEquipe(e?.nom ?? ''))
      .catch((error) => signalerChargement(error, { equipeId: id }));
  }, [id, signalerChargement]);

  useEffect(() => {
    listAnnuaire(recherche)
      .then(setUtilisateurs)
      .catch((error) => signalerChargement(error, { source: 'listAnnuaire' }));
  }, [recherche, signalerChargement]);

  const changerMode = (m: Mode) => {
    setMode(m);
    setErreurs([]);
    // Le vocabulaire d'un compte à la volée est plus étroit : on garde une fonction valide.
    if (m === 'nouveau' && !(ROLES_A_LA_VOLEE as readonly string[]).includes(fonction)) setFonction('pilote');
  };

  const ajouter = (userId: string | null) => {
    void ecrire(
      async (token) => {
        const [membres, chefsAilleurs] = await Promise.all([listMembresEquipe(id), listChefsDAutresEquipes(id)]);
        const trouvees = validerAjoutMembre(
          mode === 'existant' ? { mode, userId, fonction } : { mode, nom, prenom, fonction },
          { equipeADejaUnChef: membres.some((m) => m.fonction === 'chef'), chefsDAutresEquipes: chefsAilleurs }
        );
        setErreurs(trouvees);
        if (trouvees.length > 0) return;

        await apiClient.ajouterMembreEquipe(
          token,
          id,
          mode === 'existant'
            ? { user_id: userId, fonction: fonction as never }
            : { nom: nom.trim(), prenom: prenom.trim() || null, fonction: fonction as never }
        );
        await pullReferentiel(token);
        router.back();
      },
      { precondition: !!id }
    );
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Ajouter un membre" sousTitre={nomEquipe} variante="formulaire" onRetour={() => router.back()} />
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

        <ThemedText style={styles.etiquette}>TYPE DE COMPTE</ThemedText>
        <View style={styles.modes}>
          {(['existant', 'nouveau'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.mode, mode === m && styles.modeActif]}
              onPress={() => changerMode(m)}
              accessibilityRole="button"
              accessibilityState={{ selected: mode === m }}
            >
              <ThemedText style={[styles.modeTexte, mode === m && { color: EQ.surMarque }]}>
                {m === 'existant' ? 'Compte existant' : 'Nouveau compte'}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {mode === 'existant' ? (
          <>
            <TextInput
              style={styles.recherche}
              value={recherche}
              onChangeText={setRecherche}
              placeholder="Rechercher un utilisateur…"
              placeholderTextColor={EQ.etiquette}
              accessibilityLabel="Rechercher un utilisateur"
            />
            {utilisateurs.map((u) => (
              <View key={u.id} style={styles.utilisateur}>
                <View style={styles.avatar}>
                  <ThemedText style={styles.avatarTexte}>{(u.prenom || u.nom)[0]?.toUpperCase()}</ThemedText>
                </View>
                <View style={styles.utilisateurTexte}>
                  <ThemedText style={styles.utilisateurNom}>{`${u.prenom} ${u.nom}`}</ThemedText>
                  <ThemedText style={styles.utilisateurRole}>{libelleFonction(u.role)}</ThemedText>
                </View>
                <TouchableOpacity
                  style={styles.ajouter}
                  onPress={() => ajouter(u.id)}
                  disabled={isRunning}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${u.prenom} ${u.nom}`}
                >
                  <ThemedText style={styles.ajouterTexte}>Ajouter</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
            {utilisateurs.length === 0 && <ThemedText style={styles.vide}>Aucun utilisateur trouvé.</ThemedText>}
          </>
        ) : (
          <>
            <TextInput style={styles.recherche} value={nom} onChangeText={setNom} placeholder="Nom *" placeholderTextColor={EQ.etiquette} accessibilityLabel="Nom" />
            <TextInput style={styles.recherche} value={prenom} onChangeText={setPrenom} placeholder="Prénom" placeholderTextColor={EQ.etiquette} accessibilityLabel="Prénom" />
          </>
        )}

        <ThemedText style={styles.etiquette}>FONCTION *</ThemedText>
        <ChoixField
          etiquette="Fonction"
          valeur={fonction}
          options={options(mode === 'existant' ? FONCTIONS_EXISTANT : ROLES_A_LA_VOLEE)}
          onChoisir={setFonction}
        />

        <View style={styles.info}>
          <ThemedText style={styles.infoTitre}>ℹ Compte à la volée</ThemedText>
          <ThemedText style={styles.infoTexte}>
            Un compte sans accès sera créé. Fonctions : pilote, mécanicien, consultant int., membre.
          </ThemedText>
        </View>

        {mode === 'nouveau' && (
          <TouchableOpacity style={styles.cta} onPress={() => ajouter(null)} disabled={isRunning} accessibilityRole="button">
            <ThemedText style={styles.ctaTexte}>Créer et ajouter</ThemedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  etiquette: { marginTop: 8, fontSize: 9.5, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  modes: { flexDirection: 'row', gap: 6 },
  mode: { flex: 1, height: 32, borderRadius: 10, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, alignItems: 'center', justifyContent: 'center' },
  modeActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  modeTexte: { fontSize: 11, fontWeight: '700', color: EQ.attenue },
  recherche: { height: 36, paddingHorizontal: 11, borderRadius: 11, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, fontSize: 12, fontWeight: '500', color: EQ.encre },
  utilisateur: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte },
  avatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: EQ.vertDoux, alignItems: 'center', justifyContent: 'center' },
  avatarTexte: { fontSize: 13, fontWeight: '700', color: EQ.vert },
  utilisateurTexte: { flex: 1, gap: 2 },
  utilisateurNom: { fontSize: 12.5, fontWeight: '700', color: EQ.encre },
  utilisateurRole: { fontSize: 10, fontWeight: '500', color: EQ.etiquette },
  ajouter: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8, backgroundColor: EQ.vertDoux },
  ajouterTexte: { fontSize: 10, fontWeight: '700', color: EQ.vert },
  vide: { paddingVertical: 12, fontSize: 12, color: EQ.attenue },
  info: { marginTop: 8, gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  infoTitre: { fontSize: 10, fontWeight: '700', color: EQ.ambre },
  infoTexte: { fontSize: 10, fontWeight: '500', lineHeight: 14, color: EQ.attenue },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, fontWeight: '500', color: EQ.ambre },
  cta: { marginTop: 8, height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
