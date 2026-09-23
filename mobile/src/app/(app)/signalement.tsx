/**
 * Écran de signalement — ADR-012 décision 7, issue #176.
 *
 * L'écran intermédiaire entre « il y a un problème » et « le support a le
 * journal ». Il porte trois décisions, et chacune répond à un défaut mesuré :
 *
 * - **Le commentaire est optionnel, et les deux sorties sont côte à côte.**
 *   L'agent pressé reste à deux gestes ; celui qui peut expliquer donne au
 *   support ce qu'aucune pile d'appel ne contient. Rendre le commentaire
 *   obligatoire aurait converti le second en abandon du premier.
 * - **L'écran dit ce qui part.** Un agent qui ignore ce qu'il envoie n'envoie
 *   pas — et par téléphone, la question coûte plus cher que la réponse.
 * - **Aucune condition d'accès.** C'est tout le ticket : le lien d'export
 *   n'apparaissait qu'en mode débogage, donc après l'avoir activé *avant* le
 *   bug.
 */
import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useAsyncAction } from '@/hooks/use-async-action';
import { envoyerSignalement, LONGUEUR_MAX_COMMENTAIRE } from '@/lib/signalement';
import { depsSignalement } from '@/lib/signalement-natif';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';

/**
 * Jetons de `DESIGN.md`. Ne pas recopier les hex ad hoc des écrans antérieurs.
 *
 * La famille **vert clair** s'emploie par son trio complet fond / texte /
 * bordure : c'est celle du « panneau d'aide » au tableau des familles
 * sémantiques. Le bleu y désigne « vérifiée », un tout autre sens.
 */
const JETONS = {
  primary: '#235a36',
  background: '#faf7ef',
  surface: '#FFFFFF',
  border: '#e7e0cd',
  borderField: '#e0d9c4',
  foreground: '#16201a',
  foregroundSecondary: '#3a3a30',
  foregroundTertiary: '#6f6a59',
  foregroundWeak: '#9a9484',
  aideBg: '#eaf2ec',
  aideBordure: '#cfe0d4',
  aideTexte: '#235a36',
} as const;

/**
 * Ce que le rapport contient, en français d'agent.
 *
 * Écrit ici et pas dans `signalement.ts` : c'est une phrase d'interface, et la
 * garder à côté du bouton est ce qui empêche qu'elle se désaligne du contenu
 * réel sans que personne ne le voie.
 */
const CE_QUI_PART = [
  'Les événements enregistrés par l’application depuis son dernier démarrage.',
  'La version de l’application, le modèle de votre téléphone et sa version d’Android.',
  'Votre nom et votre rôle, pour que le support puisse vous rappeler.',
  'Votre commentaire, si vous en écrivez un.',
];

export default function SignalementScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const [commentaire, setCommentaire] = useState('');
  const { run, isRunning } = useAsyncAction();

  // Une seule route vers l'envoi : les deux boutons ne diffèrent que par le
  // commentaire transmis. Deux chemins auraient fait deux endroits où un
  // silence peut naître.
  const envoyer = (texte: string | null) =>
    run(
      async () => {
        await envoyerSignalement({ commentaire: texte }, depsSignalement());
        router.back();
      },
      { screen: 'signalement' }
    );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <SafeAreaView edges={['top']}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Retour"
            >
              <Text style={styles.backIcon}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Signaler un problème</Text>
          </View>
        </SafeAreaView>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Décrivez ce qui s’est passé si vous le pouvez. Ce n’est pas obligatoire : le rapport
          technique part de toute façon.
        </Text>

        <TextInput
          style={styles.champ}
          value={commentaire}
          onChangeText={setCommentaire}
          placeholder="Ex. : l’écran reste blanc après « Enregistrer »"
          placeholderTextColor={JETONS.foregroundWeak}
          multiline
          numberOfLines={5}
          textAlignVertical="top"
          // Le clavier s'arrête là où `construireRapport` couperait de toute
          // façon : mieux vaut que l'agent le voie en tapant qu'après l'envoi.
          maxLength={LONGUEUR_MAX_COMMENTAIRE}
          editable={!isRunning}
          accessibilityLabel="Commentaire (facultatif)"
        />

        <View style={styles.carte}>
          <Text style={styles.carteTitre}>Ce qui est envoyé</Text>
          {CE_QUI_PART.map((item) => (
            <Text key={item} style={styles.carteLigne}>
              • {item}
            </Text>
          ))}
          {/* Information rassurante, pas un filtre : l'expurgation est posée à
              l'écriture, dans `sink()` (décision 6). L'export n'a aucune
              responsabilité de confidentialité. */}
          <Text style={styles.carteNote}>
            Aucun mot de passe ni code d’accès n’est inclus.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.boutonPrincipal, isRunning && styles.boutonDesactive]}
          onPress={() => envoyer(commentaire)}
          disabled={isRunning}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.boutonPrincipalTexte}>
            {isRunning ? 'Préparation…' : 'Envoyer au support'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.boutonSecondaire, isRunning && styles.boutonDesactive]}
          onPress={() => envoyer(null)}
          disabled={isRunning}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Text style={styles.boutonSecondaireTexte}>Envoyer sans commentaire</Text>
        </TouchableOpacity>

        <Text style={styles.aide}>
          Le rapport s’ouvre ensuite dans WhatsApp, par e-mail ou dans l’application de votre
          choix.
        </Text>
      </ScrollView>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  backIcon: 22,
  headerTitle: 19,
  intro: 13,
  champ: 13,
  carteTitre: 13,
  carteLigne: 12,
  carteNote: 12,
  boutonPrincipalTexte: 14,
  boutonSecondaireTexte: 14,
  aide: 12,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: JETONS.background },
    header: { backgroundColor: JETONS.primary, paddingHorizontal: 16, paddingBottom: 14 },
    headerContent: { flexDirection: 'row', alignItems: 'center', paddingTop: 8 },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#FFFFFF22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: { color: JETONS.surface, fontSize: typeSizes.backIcon, fontWeight: '300', lineHeight: 26, marginTop: -2 },
    headerTitle: { color: JETONS.surface, fontSize: typeSizes.headerTitle, fontWeight: '800', marginLeft: 12 },
    container: { flex: 1 },
    content: { padding: 16, paddingBottom: 40 },
    intro: { fontSize: typeSizes.intro, color: JETONS.foregroundSecondary, lineHeight: 19, marginBottom: 12 },
    champ: {
      backgroundColor: JETONS.surface,
      borderWidth: 1,
      borderColor: JETONS.borderField,
      borderRadius: 10,
      padding: 12,
      minHeight: 110,
      fontSize: typeSizes.champ,
      color: JETONS.foreground,
    },
    carte: {
      backgroundColor: JETONS.aideBg,
      borderWidth: 1,
      borderColor: JETONS.aideBordure,
      borderRadius: 10,
      padding: 12,
      marginTop: 16,
    },
    carteTitre: { fontSize: typeSizes.carteTitre, fontWeight: '700', color: JETONS.aideTexte, marginBottom: 6 },
    carteLigne: { fontSize: typeSizes.carteLigne, color: JETONS.aideTexte, lineHeight: 18 },
    carteNote: { fontSize: typeSizes.carteNote, color: JETONS.aideTexte, marginTop: 8, fontWeight: '700' },
    boutonPrincipal: {
      backgroundColor: JETONS.primary,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 20,
    },
    boutonPrincipalTexte: { color: JETONS.surface, fontSize: typeSizes.boutonPrincipalTexte, fontWeight: '700' },
    boutonSecondaire: {
      backgroundColor: JETONS.surface,
      borderWidth: 1,
      borderColor: JETONS.border,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 10,
    },
    boutonSecondaireTexte: { color: JETONS.primary, fontSize: typeSizes.boutonSecondaireTexte, fontWeight: '700' },
    boutonDesactive: { opacity: 0.6 },
    aide: { fontSize: typeSizes.aide, color: JETONS.foregroundTertiary, marginTop: 14, lineHeight: 18 },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172).
 *
 * Elle compte doublement ici : un crash sur l'écran de signalement priverait
 * l'agent de son dernier recours, en silence.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
