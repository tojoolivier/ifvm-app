/**
 * PROTOTYPE JETABLE — ticket #159 (carte wayfinder #150)
 * ------------------------------------------------------
 * Question : l'affichage actuel des erreurs tient-il le choc, une fois que
 * les erreurs remontent au lieu d'être avalées ?
 *
 * Trois variantes d'affichage, six scénarios réels, sur un faux écran
 * « Mes prospections » pour que l'erreur ait un contexte.
 *
 * Ouvrir : /(app)/proto-erreurs   —   NE PAS FUSIONNER DANS main.
 */
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  FICHES_BG, FICHES_CARD_BG, FICHES_GREEN, FICHES_GREEN_LIGHT,
  FICHES_TEXT_DARK, FICHES_TEXT_SECONDARY,
} from '@/components/fiches/tokens';

// ── Le modèle de #155, réduit à ce dont l'affichage a besoin ────────────────
type Classe =
  | 'NetworkError' | 'LocalReadError' | 'LocalWriteError'
  | 'PreconditionError' | 'bug';
type Traitement = 'BLOQUER' | 'INFORMER' | 'JOURNAL';

interface Erreur { classe: Classe; traitement: Traitement; message: string; retriable: boolean }

const SCENARIOS: { id: string; label: string; desc: string; erreurs: Erreur[]; casseListe?: boolean; casseRendu?: boolean }[] = [
  {
    id: 'reseau', label: 'Réseau hors-ligne', desc: "L'agent appuie sur « Synchroniser », le serveur est injoignable. Cas NOMINAL sur le terrain.",
    erreurs: [{ classe: 'NetworkError', traitement: 'INFORMER', message: 'Connexion au serveur impossible.', retriable: true }],
  },
  {
    id: 'lecture', label: 'Donnée illisible', desc: 'Une colonne SQLite est corrompue. La liste ne peut pas être lue — 8 sites du code font ça en silence.',
    erreurs: [{ classe: 'LocalReadError', traitement: 'INFORMER', message: "Certaines fiches n'ont pas pu être relues.", retriable: false }],
    casseListe: true,
  },
  {
    id: 'ecriture', label: 'Écriture impossible', desc: "L'agent saisit, l'enregistrement échoue. S'il continue, il perd tout.",
    erreurs: [{ classe: 'LocalWriteError', traitement: 'BLOQUER', message: "Impossible d'enregistrer sur l'appareil.", retriable: true }],
  },
  {
    id: 'bug', label: 'Bug', desc: "Erreur non typée. Aujourd'hui l'agent lit le message JS brut.",
    erreurs: [{ classe: 'bug', traitement: 'INFORMER', message: 'Un problème inattendu est survenu. Vos données sont conservées.', retriable: false }],
  },
  {
    id: 'deux', label: '2 erreurs coup sur coup', desc: "error-store ne garde QU'UNE erreur (`current`). La seconde écrase la première, en silence.",
    erreurs: [
      { classe: 'NetworkError', traitement: 'INFORMER', message: 'Connexion au serveur impossible.', retriable: true },
      { classe: 'PreconditionError', traitement: 'INFORMER', message: 'Brouillon introuvable — reprenez la fiche.', retriable: false },
    ],
  },
  {
    id: 'rendu', label: 'Rendu cassé', desc: "ErrorBoundary est UNIQUE et à la racine : l'agent perd tout son contexte.",
    erreurs: [], casseRendu: true,
  },
];

const VARIANTES = [
  { id: 'A', nom: 'Statu quo', desc: 'Bannière rouge unique, une seule erreur à la fois, « Réessayer » toujours proposé.' },
  { id: 'B', nom: 'Par catégorie', desc: 'BLOQUER = modale · INFORMER = bandeau coloré selon la classe · file d\'erreurs.' },
  { id: 'C', nom: 'État vide explicite', desc: "L'erreur s'affiche LÀ où la donnée manque. Le reste en toast discret." },
];

// ── Couleurs par classe (variante B) ────────────────────────────────────────
const TON: Record<Classe, { fg: string; bg: string; bd: string; icone: string }> = {
  NetworkError:     { fg: '#92400E', bg: '#FEF3C7', bd: '#FDE68A', icone: '📡' },
  LocalReadError:   { fg: '#1D4ED8', bg: '#DBEAFE', bd: '#BFDBFE', icone: '📄' },
  LocalWriteError:  { fg: '#B91C1C', bg: '#FEE2E2', bd: '#FCA5A5', icone: '💾' },
  PreconditionError:{ fg: '#6B7280', bg: '#F3F4F6', bd: '#E5E7EB', icone: 'ℹ️' },
  bug:              { fg: '#B91C1C', bg: '#FEE2E2', bd: '#FCA5A5', icone: '⚠️' },
};

const FICHES = [
  { n: 'PRO-2026-0142', lieu: 'Ankazoabo · Toliara', date: '21/08' },
  { n: 'PRO-2026-0141', lieu: 'Betioky · Toliara', date: '20/08' },
  { n: 'PRO-2026-0138', lieu: 'Sakaraha · Toliara', date: '19/08' },
];

export default function ProtoErreursScreen() {
  const [variante, setVariante] = useState('A');
  const [scenarioId, setScenarioId] = useState('reseau');
  const [fermees, setFermees] = useState<number[]>([]);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;
  const visibles = scenario.erreurs.filter((_, i) => !fermees.includes(i));
  const choisir = (id: string) => { setScenarioId(id); setFermees([]); };

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <View style={styles.entete}>
        <Text style={styles.entTitre}>PROTOTYPE #159 — affichage des erreurs</Text>
        <Text style={styles.entDesc}>{scenario.desc}</Text>
      </View>

      {/* ── VARIANTE A : statu quo ─────────────────────────────────────── */}
      {variante === 'A' && visibles.length > 0 && (
        <View style={styles.bannA}>
          <Text style={styles.bannAText} numberOfLines={3}>{visibles[visibles.length - 1].message}</Text>
          <TouchableOpacity style={styles.bannABtn}><Text style={styles.bannABtnText}>Réessayer</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => setFermees(scenario.erreurs.map((_, i) => i))}>
            <Text style={styles.bannAClose}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
      {variante === 'A' && scenario.erreurs.length > 1 && (
        <Text style={styles.note}>⚠️ {scenario.erreurs.length} erreurs levées, 1 seule affichée — la première a disparu sans trace.</Text>
      )}

      {/* ── VARIANTE B : par catégorie ─────────────────────────────────── */}
      {variante === 'B' && visibles.filter((e) => e.traitement === 'INFORMER').map((e, i) => {
        const t = TON[e.classe];
        return (
          <View key={i} style={[styles.bandeau, { backgroundColor: t.bg, borderColor: t.bd }]}>
            <Text style={styles.bandeauIcone}>{t.icone}</Text>
            <Text style={[styles.bandeauText, { color: t.fg }]}>{e.message}</Text>
            {e.retriable && <TouchableOpacity style={[styles.bandeauBtn, { borderColor: t.fg }]}>
              <Text style={[styles.bandeauBtnText, { color: t.fg }]}>Réessayer</Text></TouchableOpacity>}
            <TouchableOpacity onPress={() => setFermees((f) => [...f, scenario.erreurs.indexOf(e)])}>
              <Text style={[styles.bandeauClose, { color: t.fg }]}>✕</Text></TouchableOpacity>
          </View>
        );
      })}

      {/* ── LA LISTE (contexte réel) ───────────────────────────────────── */}
      <ScrollView style={styles.liste} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {scenario.casseRendu && variante !== 'C' ? (
          <View style={styles.rendu}>
            <Text style={styles.renduTitre}>Une erreur est survenue</Text>
            <Text style={styles.renduSub}>L&apos;écran n&apos;a pas pu s&apos;afficher correctement.</Text>
            <TouchableOpacity style={styles.renduBtn}><Text style={styles.renduBtnText}>Réessayer</Text></TouchableOpacity>
            <Text style={styles.note}>⚠️ Boundary racine : tout l&apos;écran a disparu, y compris la navigation. « Réessayer » remonte le même arbre — il replantera.</Text>
          </View>
        ) : scenario.casseRendu ? (
          <View style={styles.carte}>
            <Text style={styles.carteN}>Section « Résumé » indisponible</Text>
            <Text style={styles.carteLieu}>Le reste de l&apos;écran fonctionne. Boundary par section.</Text>
          </View>
        ) : scenario.casseListe ? (
          variante === 'C' ? (
            <View style={styles.vide}>
              <Text style={styles.videIcone}>📄</Text>
              <Text style={styles.videTitre}>Vos fiches n&apos;ont pas pu être relues</Text>
              <Text style={styles.videSub}>Les données sont peut-être abîmées sur l&apos;appareil. Elles ne sont pas perdues côté serveur.</Text>
              <TouchableOpacity style={styles.videBtn}><Text style={styles.videBtnText}>Signaler au support</Text></TouchableOpacity>
            </View>
          ) : (
            <View style={styles.vide}>
              <Text style={styles.videSub}>Aucune fiche</Text>
              <Text style={styles.note}>⚠️ Vide indiscernable d&apos;une absence de données. L&apos;agent croit n&apos;avoir rien saisi.</Text>
            </View>
          )
        ) : (
          FICHES.map((f) => (
            <View key={f.n} style={styles.carte}>
              <Text style={styles.carteN}>{f.n}</Text>
              <Text style={styles.carteLieu}>{f.lieu} · {f.date}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── VARIANTE C : toast discret ─────────────────────────────────── */}
      {variante === 'C' && visibles.filter((e) => e.classe !== 'LocalReadError' && e.traitement === 'INFORMER').map((e, i) => (
        <View key={i} style={styles.toast}>
          <Text style={styles.toastText}>{e.message}</Text>
          {e.retriable && <TouchableOpacity><Text style={styles.toastAction}>Réessayer</Text></TouchableOpacity>}
        </View>
      ))}

      {/* ── BLOQUER : modale (B et C) ──────────────────────────────────── */}
      <Modal transparent animationType="fade"
        visible={variante !== 'A' && visibles.some((e) => e.traitement === 'BLOQUER')}>
        <View style={styles.modalFond}>
          <View style={styles.modalCarte}>
            <Text style={styles.modalIcone}>💾</Text>
            <Text style={styles.modalTitre}>Impossible d&apos;enregistrer</Text>
            <Text style={styles.modalTexte}>
              Votre saisie n&apos;a pas pu être écrite sur l&apos;appareil. N&apos;continuez pas : ce que vous
              taperez ensuite serait perdu aussi.
            </Text>
            <TouchableOpacity style={styles.modalBtn}><Text style={styles.modalBtnText}>Réessayer d&apos;enregistrer</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setFermees(scenario.erreurs.map((_, i) => i))}>
              <Text style={styles.modalLien}>Continuer quand même</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── BARRE DE PILOTAGE ──────────────────────────────────────────── */}
      <View style={styles.barre}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {SCENARIOS.map((s) => (
            <TouchableOpacity key={s.id} onPress={() => choisir(s.id)}
              style={[styles.chip, scenarioId === s.id && styles.chipOn]}>
              <Text style={[styles.chipText, scenarioId === s.id && styles.chipTextOn]}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <View style={styles.variantes}>
          {VARIANTES.map((v) => (
            <TouchableOpacity key={v.id} onPress={() => { setVariante(v.id); setFermees([]); }}
              style={[styles.vBtn, variante === v.id && styles.vBtnOn]}>
              <Text style={[styles.vBtnText, variante === v.id && styles.vBtnTextOn]}>{v.id} · {v.nom}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.vDesc}>{VARIANTES.find((v) => v.id === variante)!.desc}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: FICHES_BG },
  entete: { backgroundColor: FICHES_GREEN, padding: 12 },
  entTitre: { color: '#fff', fontWeight: '800', fontSize: 12, letterSpacing: 0.5 },
  entDesc: { color: '#D9EAD9', fontSize: 12, marginTop: 4, lineHeight: 16 },

  bannA: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FEE2E2',
           borderBottomWidth: 1, borderColor: '#FCA5A5', paddingHorizontal: 14, paddingVertical: 10 },
  bannAText: { flex: 1, color: '#B91C1C', fontSize: 13, fontWeight: '600' },
  bannABtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#B91C1C' },
  bannABtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  bannAClose: { color: '#B91C1C', fontSize: 15, fontWeight: '700', paddingHorizontal: 6 },

  bandeau: { flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: 1,
             paddingHorizontal: 14, paddingVertical: 10 },
  bandeauIcone: { fontSize: 15 },
  bandeauText: { flex: 1, fontSize: 13, fontWeight: '600' },
  bandeauBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1 },
  bandeauBtnText: { fontSize: 12, fontWeight: '700' },
  bandeauClose: { fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },

  liste: { flex: 1 },
  carte: { backgroundColor: FICHES_CARD_BG, borderRadius: 12, padding: 14 },
  carteN: { fontWeight: '700', color: FICHES_TEXT_DARK, fontSize: 14 },
  carteLieu: { color: FICHES_TEXT_SECONDARY, fontSize: 12, marginTop: 3 },

  vide: { alignItems: 'center', padding: 28, gap: 8 },
  videIcone: { fontSize: 34 },
  videTitre: { fontWeight: '700', color: FICHES_TEXT_DARK, fontSize: 15, textAlign: 'center' },
  videSub: { color: FICHES_TEXT_SECONDARY, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  videBtn: { marginTop: 6, backgroundColor: FICHES_GREEN_LIGHT, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 9 },
  videBtnText: { color: FICHES_GREEN, fontWeight: '700', fontSize: 13 },

  rendu: { alignItems: 'center', padding: 24, gap: 8 },
  renduTitre: { fontSize: 16, fontWeight: '700', color: '#16201a' },
  renduSub: { fontSize: 13, color: '#6f6a59', textAlign: 'center' },
  renduBtn: { backgroundColor: '#235a36', borderRadius: 13, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  renduBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  toast: { position: 'absolute', left: 12, right: 12, bottom: 172, flexDirection: 'row', alignItems: 'center',
           gap: 12, backgroundColor: '#1F2937', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12 },
  toastText: { flex: 1, color: '#fff', fontSize: 13 },
  toastAction: { color: '#93C5FD', fontWeight: '700', fontSize: 13 },

  modalFond: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 28 },
  modalCarte: { backgroundColor: '#fff', borderRadius: 16, padding: 22, alignItems: 'center', gap: 10, width: '100%' },
  modalIcone: { fontSize: 32 },
  modalTitre: { fontSize: 16, fontWeight: '800', color: FICHES_TEXT_DARK },
  modalTexte: { fontSize: 13, color: FICHES_TEXT_SECONDARY, textAlign: 'center', lineHeight: 19 },
  modalBtn: { backgroundColor: '#B91C1C', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12, marginTop: 6 },
  modalBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  modalLien: { color: FICHES_TEXT_SECONDARY, fontSize: 12, textDecorationLine: 'underline', marginTop: 4 },

  note: { color: '#92400E', fontSize: 11, fontStyle: 'italic', paddingHorizontal: 14, paddingVertical: 6, lineHeight: 15 },

  barre: { backgroundColor: '#111827', paddingVertical: 10, gap: 8 },
  chips: { paddingHorizontal: 10, gap: 6 },
  chip: { paddingHorizontal: 11, paddingVertical: 6, borderRadius: 999, backgroundColor: '#374151' },
  chipOn: { backgroundColor: '#F3F4F6' },
  chipText: { color: '#D1D5DB', fontSize: 11, fontWeight: '700' },
  chipTextOn: { color: '#111827' },
  variantes: { flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  vBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#374151', alignItems: 'center' },
  vBtnOn: { backgroundColor: FICHES_GREEN },
  vBtnText: { color: '#D1D5DB', fontSize: 11, fontWeight: '700' },
  vBtnTextOn: { color: '#fff' },
  vDesc: { color: '#9CA3AF', fontSize: 11, paddingHorizontal: 12, lineHeight: 15 },
});
