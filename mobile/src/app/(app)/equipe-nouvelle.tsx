import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ThemedText } from '@/components/themed-text';
import { ChoixField, OptionChoix } from '@/components/equipe/ChoixField';
import { EquipeHeader } from '@/components/equipe/EquipeHeader';
import { EQ } from '@/components/equipe/tokens';
import { useEcritureServeur } from '@/hooks/use-ecriture-serveur';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { apiClient } from '@/lib/api-client';
import { listAeronefsActifs, listAnnuaire } from '@/lib/equipe-db';
import { TypeEquipe, validerNouvelleEquipe } from '@/lib/equipe-regles';
import { pullReferentiel } from '@/lib/referentiel-sync';

/** Rôles de l'annuaire qui peuvent être chef d'une équipe de ce type (même règle que le portail web). */
const ROLES_CHEF: Record<TypeEquipe, string[]> = { aerien: ['chef_de_base'], terrestre: ['chef_equipe'] };

/**
 * Création d'une équipe (#641, Figma « Nouvelle équipe ») : nom, type (non modifiable ensuite),
 * aéronef obligatoire si aérienne et interdit si terrestre, exactement un chef issu d'un compte
 * existant. Les erreurs sont listées d'un coup ; en ligne uniquement, le serveur reste juge.
 */
export default function EquipeNouvelleScreen() {
  const router = useRouter();
  const signalerChargement = useSignalerChargement('equipe-nouvelle');

  const [nom, setNom] = useState('');
  const [type, setType] = useState<TypeEquipe>('aerien');
  const [aeronefId, setAeronefId] = useState<string | null>(null);
  const [chefId, setChefId] = useState<string | null>(null);
  const [erreurs, setErreurs] = useState<string[]>([]);
  const [aeronefs, setAeronefs] = useState<OptionChoix[]>([]);
  const [chefs, setChefs] = useState<OptionChoix[]>([]);
  const { ecrire, isRunning } = useEcritureServeur('equipe-nouvelle', (message) => setErreurs([message]));

  useEffect(() => {
    listAeronefsActifs()
      .then((rows) => setAeronefs(rows.map((a) => ({ valeur: a.id, libelle: `${a.immatriculation} · ${a.societe}` }))))
      .catch((error) => signalerChargement(error, { source: 'listAeronefsActifs' }));
  }, [signalerChargement]);

  useEffect(() => {
    listAnnuaire('', ROLES_CHEF[type])
      .then((rows) => setChefs(rows.map((u) => ({ valeur: u.id, libelle: `${u.prenom} ${u.nom}` }))))
      .catch((error) => signalerChargement(error, { source: 'listAnnuaire' }));
  }, [type, signalerChargement]);

  const choisirType = (t: TypeEquipe) => {
    setType(t);
    setChefId(null);
    if (t === 'terrestre') setAeronefId(null);
  };

  const creer = () => {
    const trouvees = validerNouvelleEquipe({ nom, type, aeronefId, chefId });
    setErreurs(trouvees);
    if (trouvees.length > 0) return;
    void ecrire(async (token) => {
      await apiClient.createEquipe(token, {
        nom: nom.trim(),
        type,
        aeronef_id: type === 'aerien' ? aeronefId : null,
        membres: [{ user_id: chefId as string, fonction: 'chef' }],
      });
      // L'équipe n'existe localement qu'après le prochain pull : on le fait tout de suite.
      await pullReferentiel(token);
      router.back();
    });
  };

  return (
    <View style={styles.racine}>
      <EquipeHeader titre="Nouvelle équipe" variante="formulaire" onRetour={() => router.back()} />
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

        <ThemedText style={styles.etiquette}>NOM *</ThemedText>
        <FieldNom valeur={nom} onChange={setNom} />

        <ThemedText style={styles.etiquette}>TYPE *</ThemedText>
        <View style={styles.types}>
          {(['aerien', 'terrestre'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.type, type === t && styles.typeActif]}
              onPress={() => choisirType(t)}
              accessibilityRole="button"
              accessibilityState={{ selected: type === t }}
            >
              <ThemedText style={[styles.typeTexte, type === t && { color: EQ.surMarque }]}>
                {t === 'aerien' ? 'Aérienne' : 'Terrestre'}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {type === 'aerien' && (
          <>
            <ThemedText style={styles.etiquette}>AÉRONEF *</ThemedText>
            <ChoixField etiquette="Aéronef" valeur={aeronefId} options={aeronefs} onChoisir={setAeronefId} accent />
          </>
        )}

        <ThemedText style={styles.etiquette}>CHEF D’ÉQUIPE *</ThemedText>
        <ChoixField etiquette="Chef" valeur={chefId} options={chefs} onChoisir={setChefId} />
        <ThemedText style={styles.note}>Un seul chef par équipe. Non modifiable ensuite.</ThemedText>
      </ScrollView>

      <View style={styles.pied}>
        <TouchableOpacity
          style={[styles.cta, isRunning && { opacity: 0.6 }]}
          onPress={creer}
          disabled={isRunning}
          accessibilityRole="button"
        >
          <ThemedText style={styles.ctaTexte}>Créer l’équipe</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function FieldNom({ valeur, onChange }: { valeur: string; onChange: (v: string) => void }) {
  return (
    <TextInput
      style={styles.saisie}
      value={valeur}
      onChangeText={onChange}
      placeholder="Ex. Équipe Sud"
      placeholderTextColor={EQ.etiquette}
      accessibilityLabel="Nom de l'équipe"
    />
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, backgroundColor: EQ.fond },
  contenu: { padding: 16, gap: 8 },
  etiquette: { marginTop: 8, fontSize: 10, fontWeight: '700', letterSpacing: 0.5, color: EQ.attenue },
  saisie: { height: 40, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, fontSize: 13, fontWeight: '700', color: EQ.encre },
  types: { flexDirection: 'row', gap: 6 },
  type: { flex: 1, height: 36, borderRadius: 10, borderWidth: 1, borderColor: EQ.bordure, backgroundColor: EQ.carte, alignItems: 'center', justifyContent: 'center' },
  typeActif: { backgroundColor: EQ.vert, borderColor: EQ.vert },
  typeTexte: { fontSize: 12, fontWeight: '700', color: EQ.attenue },
  note: { marginTop: 4, padding: 8, borderRadius: 9, backgroundColor: EQ.fond, fontSize: 10, fontWeight: '500', color: EQ.etiquette },
  erreurs: { gap: 4, padding: 10, borderRadius: 11, borderWidth: 1, borderColor: EQ.ambreBordure, backgroundColor: EQ.ambreFond },
  erreur: { fontSize: 11, fontWeight: '500', color: EQ.ambre },
  pied: { padding: 16 },
  cta: { height: 48, borderRadius: 13, backgroundColor: EQ.vert, alignItems: 'center', justifyContent: 'center' },
  ctaTexte: { fontSize: 15, fontWeight: '800', color: EQ.surMarque },
});
