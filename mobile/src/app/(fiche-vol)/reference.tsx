import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCurrentPosition } from '@/lib/location';
import { getFicheVol, updateFicheVolReference } from '@/lib/fiche-vol-repository';
import { useAsyncAction } from '@/hooks/use-async-action';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { logger } from '@/lib/logger';

const GREEN = '#235a36';
const BG = '#faf7ef';
const TEXT = '#16201a';
const TEXT_SECONDARY = '#6f6a59';
const BORDER = '#e7e0cd';
const AUTO_BG = '#eaf2ec';

/**
 * Fiche de Vol — A. Références (#fiche-vol). Le brouillon local est déjà créé
 * (par la tuile « Fiche de Vol » de l'Accès rapide) avant d'arriver ici :
 * cet écran restaure/renseigne, jamais ne crée.
 *
 * Localisation : capturée une seule fois, au premier passage (jamais
 * relancée sur une fiche déjà géolocalisée) — même règle que
 * extensive-reference.tsx. Alimente directement base_latitude/longitude/
 * altitude : on est en principe à la base au moment de remplir la fiche, le
 * slide C (Informations sur les Bases) réutilisera cette valeur plutôt que
 * d'en recapturer une (décision produit du 2026-09-14).
 */
export default function FicheVolReferenceScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();

  const [dateVol, setDateVol] = useState('');
  const [compagnie, setCompagnie] = useState('');
  const [immatriculation, setImmatriculation] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [altitude, setAltitude] = useState('');
  const [isLoadingGps, setIsLoadingGps] = useState(true);
  const [gpsError, setGpsError] = useState('');
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);

  const { run, isRunning: isSaving } = useAsyncAction();
  const signalerChargement = useSignalerChargement('fiche-vol-reference');

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (!draftId) return;
      const draft = await getFicheVol(draftId);
      if (!isMounted || !draft) return;

      setDateVol(draft.date_vol);
      setCompagnie(draft.compagnie ?? '');
      setImmatriculation(draft.immatriculation ?? '');

      if (draft.base_latitude != null && draft.base_longitude != null) {
        setLatitude(String(draft.base_latitude));
        setLongitude(String(draft.base_longitude));
        setAltitude(draft.base_altitude != null ? String(draft.base_altitude) : '');
        setIsLoadingGps(false);
        setIsDraftLoaded(true);
        return;
      }

      try {
        const position = await getCurrentPosition();
        if (!isMounted) return;
        setLatitude(String(position.latitude));
        setLongitude(String(position.longitude));
        setAltitude(position.altitude != null ? String(position.altitude) : '');
      } catch (error) {
        logger.ignore(error, 'position GPS indisponible, saisie manuelle non prévue sur cet écran');
        if (isMounted) setGpsError('Position GPS indisponible.');
      } finally {
        if (isMounted) setIsLoadingGps(false);
      }
      if (isMounted) setIsDraftLoaded(true);
    };

    void init().catch((error) => signalerChargement(error, { draftId }));

    return () => {
      isMounted = false;
    };
  }, [draftId, signalerChargement]);

  const handleContinue = () => {
    return run(
      async () => {
        await updateFicheVolReference(draftId, {
          compagnie: compagnie || null,
          immatriculation: immatriculation || null,
          baseLatitude: latitude ? parseFloat(latitude) : null,
          baseLongitude: longitude ? parseFloat(longitude) : null,
          baseAltitude: altitude ? parseFloat(altitude) : null,
        });
        router.push({ pathname: '/(fiche-vol)/equipe' as any, params: { draftId } });
      },
      {
        screen: 'fiche-vol-reference',
        precondition: !!draftId,
        preconditionMessage: 'Session de saisie perdue — revenez à l’écran précédent et réessayez.',
        context: { draftId },
      }
    );
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.safe}>
        <KeyboardAvoidingView style={styles.keyboardAvoidingView} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7}>
              <Text style={styles.back}>‹</Text>
            </TouchableOpacity>
            <Text style={styles.title}>Fiche de Vol</Text>
          </View>
          <View style={styles.progressRow}>
            <View style={[styles.progressBar, styles.progressActive]} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
            <View style={styles.progressBar} />
          </View>

          <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <Text style={styles.sectionLabel}>A · Références</Text>

            <View style={styles.autoCard}>
              <Text style={styles.autoLabel}>Date</Text>
              <Text style={styles.autoValueMono}>{dateVol || '—'}</Text>
            </View>

            <View style={styles.row}>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Latitude</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS…</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{latitude || '—'}</Text>
                )}
              </View>
              <View style={[styles.autoCard, styles.flex1]}>
                <Text style={styles.autoLabel}>Longitude</Text>
                {isLoadingGps ? (
                  <Text style={styles.gpsLoading}>Récupération GPS…</Text>
                ) : (
                  <Text style={styles.autoValueMono}>{longitude || '—'}</Text>
                )}
              </View>
            </View>
            {gpsError ? <Text style={styles.gpsErrorText}>{gpsError}</Text> : null}

            <View style={styles.card}>
              <Text style={styles.label}>Société</Text>
              <TextInput
                value={compagnie}
                onChangeText={setCompagnie}
                placeholder="Ex. Aviation Malgache"
                placeholderTextColor={TEXT_SECONDARY}
                style={styles.input}
              />
            </View>

            <View style={styles.card}>
              <Text style={styles.label}>Immatricule Aéronef</Text>
              <TextInput
                value={immatriculation}
                onChangeText={setImmatriculation}
                placeholder="Ex. 5R-ABC"
                placeholderTextColor={TEXT_SECONDARY}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.continueButton, (isSaving || !isDraftLoaded) && styles.continueButtonDisabled]}
              onPress={handleContinue}
              disabled={isSaving || !isDraftLoaded}
              activeOpacity={0.85}
            >
              <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Suivant : Équipe ›'}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  safe: { flex: 1 },
  keyboardAvoidingView: { flex: 1 },
  headerRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  back: { fontSize: 22, fontWeight: '700', color: TEXT_SECONDARY },
  title: { fontSize: 15, fontWeight: '700', color: TEXT },
  progressRow: { flexDirection: 'row', gap: 5, paddingHorizontal: 18, paddingBottom: 12 },
  progressBar: { flex: 1, height: 5, borderRadius: 3, backgroundColor: '#dcd5c2' },
  progressActive: { backgroundColor: GREEN },
  scroll: { flex: 1 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  flex1: { flex: 1 },
  autoCard: { backgroundColor: AUTO_BG, borderRadius: 10, padding: 9, marginBottom: 8 },
  autoLabel: { fontSize: 11, fontWeight: '700', color: GREEN, textTransform: 'uppercase' },
  autoValueMono: { fontSize: 15, fontWeight: '700', color: TEXT, fontFamily: 'monospace' },
  card: { backgroundColor: '#fff', borderWidth: 1, borderColor: BORDER, borderRadius: 10, padding: 9, marginBottom: 8 },
  // #lisibilite-terrain : libellés agrandis et assombris dès la création de cet
  // écran, même niveau de lisibilité que les correctifs appliqués ailleurs cette
  // session (densités, base aérienne...).
  label: { fontSize: 11, fontWeight: '700', color: TEXT_SECONDARY, marginBottom: 3 },
  input: { fontSize: 15, fontWeight: '700', color: TEXT, padding: 0 },
  gpsLoading: { fontSize: 13, fontWeight: '600', color: TEXT_SECONDARY, fontStyle: 'italic' },
  gpsErrorText: { fontSize: 11, color: '#c0412b', marginBottom: 8 },
  footer: { padding: 16 },
  continueButton: { backgroundColor: GREEN, borderRadius: 13, padding: 15, alignItems: 'center' },
  continueButtonDisabled: { opacity: 0.6 },
  continueButtonText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
