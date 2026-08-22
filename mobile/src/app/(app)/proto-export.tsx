/**
 * PROTOTYPE JETABLE — ticket #157 (carte wayfinder #150)
 * ------------------------------------------------------
 * Question : comment un agent terrain, sans formation technique, envoie-t-il
 * ses logs au support — et est-ce que ça marche vraiment sans réseau ?
 *
 * Trois parcours concurrents, et le rapport que le support reçoit dans chacun.
 * Ouvrir : /(app)/proto-export   —   NE PAS FUSIONNER DANS main.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FICHES_BG, FICHES_CARD_BG, FICHES_GREEN, FICHES_GREEN_LIGHT,
  FICHES_TEXT_DARK, FICHES_TEXT_SECONDARY,
} from '@/components/fiches/tokens';

type Parcours = 'A' | 'B' | 'C';

const PARCOURS: Record<Parcours, { nom: string; etapes: string[]; desc: string }> = {
  A: {
    nom: 'Statu quo',
    desc: "Ce qui existe aujourd'hui. L'interrupteur devait être activé AVANT le bug.",
    etapes: ['Profil', 'Trouver « mode débogage »', "L'activer", 'Ouvrir « Journal de debug »', 'Exporter'],
  },
  B: {
    nom: 'Partage direct',
    desc: 'Le bouton « Signaler » ouvre immédiatement la feuille de partage native.',
    etapes: ['Signaler au support', 'Feuille de partage'],
  },
  C: {
    nom: 'Écran de signalement',
    desc: "Un écran intermédiaire : l'agent dit ce qu'il faisait, puis partage.",
    etapes: ['Signaler au support', 'Décrire + envoyer', 'Feuille de partage'],
  },
};

/** Ce que le support reçoit, selon le parcours. */
const RAPPORT: Record<Parcours, string> = {
  A: `{
  "generatedAt": "2026-08-22T09:14:02Z",
  "requests": [ … 100 entrées … ],
  "errors":   [ … 12 entrées … ]
}

// ⚠ ni version d'app, ni modèle d'appareil,
//   ni OS, ni identité de l'agent
// ⚠ aucun mot de l'agent sur ce qu'il faisait
// ⚠ vide si le mode debug n'était pas actif avant`,
  B: `{
  "app":    { "version": "1.4.2", "build": "142" },
  "device": { "model": "Tecno Spark 8C", "os": "Android 12" },
  "agent":  { "id": "PRO-0412" },
  "journal": [ … 84 lignes … ]
}

// ✓ contexte technique complet
// ⚠ toujours aucun mot de l'agent`,
  C: `{
  "app":    { "version": "1.4.2", "build": "142" },
  "device": { "model": "Tecno Spark 8C", "os": "Android 12" },
  "agent":  { "id": "PRO-0412" },
  "commentaire": "j'ai appuyé sur Suivant après
     les captures et rien ne s'est passé",
  "correlationId": "7F3A-21",
  "journal": [ … 84 lignes … ]
}

// ✓ contexte + le mot de l'agent
// ✓ correlationId : relie au moment exact`,
};

export default function ProtoExportScreen() {
  const [parcours, setParcours] = useState<Parcours>('A');
  const [etape, setEtape] = useState(0);
  const [commentaire, setCommentaire] = useState('');
  const [gate, setGate] = useState(false);

  const p = PARCOURS[parcours];
  const choisir = (k: Parcours) => { setParcours(k); setEtape(0); setGate(false); };
  const suivant = () => setEtape((e) => Math.min(e + 1, p.etapes.length - 1));

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.entete}>
        <Text style={styles.entTitre}>PROTOTYPE #157 — parcours d&apos;export</Text>
        <Text style={styles.entDesc}>{p.desc}</Text>
      </View>

      {/* Fil des étapes */}
      <View style={styles.fil}>
        {p.etapes.map((e, i) => (
          <View key={i} style={styles.filItem}>
            <View style={[styles.pastille, i <= etape && styles.pastilleOn]}>
              <Text style={[styles.pastilleT, i <= etape && styles.pastilleTOn]}>{i + 1}</Text>
            </View>
            <Text style={[styles.filT, i === etape && styles.filTOn]} numberOfLines={2}>{e}</Text>
          </View>
        ))}
      </View>

      <ScrollView style={styles.corps} contentContainerStyle={{ padding: 14, gap: 12 }}>
        {/* ── A : le chemin actuel, étape par étape ─────────────────────── */}
        {parcours === 'A' && etape < 3 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Profil</Text>
            <View style={styles.ligne}>
              <Text style={styles.ligneT}>Mode débogage</Text>
              <Switch value={gate} onValueChange={(v) => { setGate(v); setEtape(v ? 3 : 1); }} />
            </View>
            {!gate && <Text style={styles.alerte}>
              ⚠️ Tant que c&apos;est éteint, le lien vers le journal n&apos;existe pas
              (profile.tsx:530) — et les requêtes ne sont pas enregistrées.
              L&apos;agent devait l&apos;activer AVANT de rencontrer le bug.
            </Text>}
            {gate && <TouchableOpacity style={styles.lien} onPress={() => setEtape(3)}>
              <Text style={styles.lienT}>Journal de debug ›</Text></TouchableOpacity>}
          </View>
        )}
        {parcours === 'A' && etape >= 3 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Journal de debug</Text>
            <Text style={styles.sub}>100 requêtes · 12 erreurs</Text>
            <View style={styles.ligneBtns}>
              <TouchableOpacity style={styles.btnSec} onPress={() => setEtape(4)}>
                <Text style={styles.btnSecT}>Exporter</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSec}><Text style={styles.btnSecT}>Vider</Text></TouchableOpacity>
            </View>
            <Text style={styles.alerte}>
              ⚠️ Écran technique : « requêtes », « statut 422 », JSON brut.
              Rien n&apos;y est écrit pour un agent terrain.
            </Text>
          </View>
        )}

        {/* ── B : partage direct ─────────────────────────────────────────── */}
        {parcours === 'B' && etape === 0 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Une erreur vient de s&apos;afficher</Text>
            <View style={styles.banniere}>
              <Text style={styles.banniereT}>Un problème inattendu est survenu. Vos données sont conservées.</Text>
              <TouchableOpacity style={styles.btnPrim} onPress={suivant}>
                <Text style={styles.btnPrimT}>Signaler au support</Text></TouchableOpacity>
            </View>
            <Text style={styles.note}>Le bouton décidé en #159 — au moment où l&apos;agent subit l&apos;erreur.</Text>
          </View>
        )}
        {parcours === 'B' && etape === 1 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Feuille de partage</Text>
            <Text style={styles.sub}>ifvm-rapport-2026-08-22.jsonl</Text>
            <View style={styles.apps}>
              {['WhatsApp', 'Gmail', 'Bluetooth', 'Fichiers'].map((a) => (
                <View key={a} style={styles.app}><Text style={styles.appT}>{a}</Text></View>
              ))}
            </View>
            <Text style={styles.note}>2 étapes. Le plus court chemin — mais l&apos;agent n&apos;a rien pu dire.</Text>
          </View>
        )}

        {/* ── C : écran de signalement ───────────────────────────────────── */}
        {parcours === 'C' && etape === 0 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Une erreur vient de s&apos;afficher</Text>
            <View style={styles.banniere}>
              <Text style={styles.banniereT}>Un problème inattendu est survenu. Vos données sont conservées.</Text>
              <TouchableOpacity style={styles.btnPrim} onPress={suivant}>
                <Text style={styles.btnPrimT}>Signaler au support</Text></TouchableOpacity>
            </View>
          </View>
        )}
        {parcours === 'C' && etape === 1 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Signaler un problème</Text>
            <Text style={styles.sub}>Que faisiez-vous juste avant ?</Text>
            <TextInput
              style={styles.champ} multiline placeholder="Ex. : j'ai appuyé sur Suivant après les captures et rien ne s'est passé"
              placeholderTextColor="#9CA3AF" value={commentaire} onChangeText={setCommentaire}
            />
            <View style={styles.recap}>
              <Text style={styles.recapT}>Seront joints automatiquement :</Text>
              <Text style={styles.recapL}>• Version de l&apos;app et de l&apos;appareil</Text>
              <Text style={styles.recapL}>• Les 84 dernières lignes du journal</Text>
              <Text style={styles.recapL}>• Code de l&apos;erreur : 7F3A-21</Text>
              <Text style={styles.recapOk}>✓ Aucun mot de passe ni jeton — filtré à l&apos;écriture (#161)</Text>
            </View>
            <TouchableOpacity style={styles.btnPrim} onPress={suivant}>
              <Text style={styles.btnPrimT}>Envoyer au support</Text></TouchableOpacity>
            <Text style={styles.note}>Fonctionne hors ligne : on écrit un fichier, on ouvre le partage. Aucun réseau requis.</Text>
          </View>
        )}
        {parcours === 'C' && etape === 2 && (
          <View style={styles.ecran}>
            <Text style={styles.ecranTitre}>Feuille de partage</Text>
            <Text style={styles.sub}>ifvm-rapport-2026-08-22.jsonl</Text>
            <View style={styles.apps}>
              {['WhatsApp', 'Gmail', 'Bluetooth', 'Fichiers'].map((a) => (
                <View key={a} style={styles.app}><Text style={styles.appT}>{a}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* Ce que le support reçoit */}
        <View style={styles.rapport}>
          <Text style={styles.rapportT}>CE QUE LE SUPPORT REÇOIT</Text>
          <Text style={styles.rapportC}>{RAPPORT[parcours]}</Text>
        </View>
      </ScrollView>

      <View style={styles.barre}>
        <View style={styles.variantes}>
          {(Object.keys(PARCOURS) as Parcours[]).map((k) => (
            <TouchableOpacity key={k} onPress={() => choisir(k)}
              style={[styles.vBtn, parcours === k && styles.vBtnOn]}>
              <Text style={[styles.vBtnT, parcours === k && styles.vBtnTOn]}>
                {k} · {PARCOURS[k].nom}</Text>
              <Text style={[styles.vBtnN, parcours === k && styles.vBtnTOn]}>
                {PARCOURS[k].etapes.length} étapes</Text>
            </TouchableOpacity>
          ))}
        </View>
        {etape < p.etapes.length - 1 && (
          <TouchableOpacity style={styles.next} onPress={suivant}>
            <Text style={styles.nextT}>Étape suivante ›</Text></TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FICHES_BG },
  entete: { backgroundColor: FICHES_GREEN, padding: 12 },
  entTitre: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  entDesc: { color: '#D9EAD9', fontSize: 12, marginTop: 4, lineHeight: 16 },

  fil: { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 10, paddingHorizontal: 8,
         borderBottomWidth: 1, borderColor: '#E5E7EB' },
  filItem: { flex: 1, alignItems: 'center', gap: 4 },
  pastille: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#E5E7EB',
              alignItems: 'center', justifyContent: 'center' },
  pastilleOn: { backgroundColor: FICHES_GREEN },
  pastilleT: { fontSize: 11, fontWeight: '800', color: '#9CA3AF' },
  pastilleTOn: { color: '#fff' },
  filT: { fontSize: 9, color: FICHES_TEXT_SECONDARY, textAlign: 'center', lineHeight: 12 },
  filTOn: { color: FICHES_TEXT_DARK, fontWeight: '700' },

  corps: { flex: 1 },
  ecran: { backgroundColor: FICHES_CARD_BG, borderRadius: 12, padding: 16, gap: 10 },
  ecranTitre: { fontSize: 15, fontWeight: '800', color: FICHES_TEXT_DARK },
  sub: { fontSize: 12, color: FICHES_TEXT_SECONDARY },
  ligne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ligneT: { fontSize: 14, color: FICHES_TEXT_DARK, fontWeight: '600' },
  ligneBtns: { flexDirection: 'row', gap: 8 },
  lien: { paddingVertical: 8 },
  lienT: { color: FICHES_GREEN, fontWeight: '700', fontSize: 14 },

  banniere: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5', borderWidth: 1,
              borderRadius: 10, padding: 12, gap: 10 },
  banniereT: { color: '#B91C1C', fontSize: 13, fontWeight: '600' },

  btnPrim: { backgroundColor: FICHES_GREEN, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnPrimT: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnSec: { backgroundColor: FICHES_GREEN_LIGHT, borderRadius: 9, paddingHorizontal: 14, paddingVertical: 9 },
  btnSecT: { color: FICHES_GREEN, fontWeight: '700', fontSize: 13 },

  champ: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 10, padding: 12, minHeight: 84,
           textAlignVertical: 'top', fontSize: 13, color: FICHES_TEXT_DARK },
  recap: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, gap: 3 },
  recapT: { fontSize: 12, fontWeight: '700', color: FICHES_TEXT_DARK, marginBottom: 2 },
  recapL: { fontSize: 12, color: FICHES_TEXT_SECONDARY },
  recapOk: { fontSize: 12, color: '#15803D', fontWeight: '600', marginTop: 4 },

  apps: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  app: { backgroundColor: '#F3F4F6', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  appT: { fontSize: 12, fontWeight: '600', color: FICHES_TEXT_DARK },

  alerte: { color: '#92400E', fontSize: 11, fontStyle: 'italic', lineHeight: 15,
            backgroundColor: '#FFFBEB', borderRadius: 8, padding: 9 },
  note: { color: FICHES_TEXT_SECONDARY, fontSize: 11, fontStyle: 'italic', lineHeight: 15 },

  rapport: { backgroundColor: '#111827', borderRadius: 12, padding: 12, gap: 6 },
  rapportT: { color: '#9CA3AF', fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  rapportC: { color: '#D1D5DB', fontSize: 10, lineHeight: 15, fontFamily: 'monospace' },

  barre: { backgroundColor: '#111827', padding: 10, gap: 8 },
  variantes: { flexDirection: 'row', gap: 6 },
  vBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center', gap: 2 },
  vBtnOn: { backgroundColor: FICHES_GREEN },
  vBtnT: { color: '#D1D5DB', fontSize: 11, fontWeight: '700' },
  vBtnN: { color: '#9CA3AF', fontSize: 9 },
  vBtnTOn: { color: '#fff' },
  next: { backgroundColor: '#374151', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  nextT: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
