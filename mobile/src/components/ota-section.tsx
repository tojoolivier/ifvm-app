import { useEffect, useMemo, useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { useUpdates } from 'expo-updates';
import * as Clipboard from 'expo-clipboard';

import { ThemedText } from '@/components/themed-text';
import { logger } from '@/lib/logger';
import { useFontScale } from '@/hooks/use-font-scale';
import { scaleTypeSizes } from '@/lib/typography';
import {
  buildNatif,
  deriverEtat,
  formatDateMaj,
  formatDernierCheck,
  formatVersionBuild,
  infosCourantes,
  infosTechniques,
  libelleEtat,
  lireDernierCheck,
  otaActif,
  verifierMaintenant,
  versionApp,
  type DernierCheck,
  type EtatOta,
} from '@/lib/ota';
import { PRIMARY } from '@/components/erreurs/tokens';
import { useTheme } from '@/hooks/use-theme';
import type { ThemePalette } from '@/constants/theme';

/**
 * Trios sémantiques de DESIGN.md (fond / texte), une famille par état.
 * Valeurs prises dans la charte — pas de teinte inventée.
 */
const TONS: Record<EtatOta, { bg: string; fg: string }> = {
  'a-jour': { bg: '#eaf2ec', fg: '#235a36' }, // vert clair
  disponible: { bg: '#eaf0f7', fg: '#31567f' }, // bleu
  prete: { bg: '#eaf0f7', fg: '#31567f' }, // bleu
  telechargement: { bg: '#fdf6e7', fg: '#8a6d2f' }, // ambre
  indisponible: { bg: '#f4efe2', fg: '#6f6a59' }, // brouillon / neutre
};

const FOREGROUND_TERTIARY = '#6f6a59';
const DANGER_TEXT = '#a5341c';

/**
 * Section « Mises à jour » du profil — la transparence OTA demandée par le
 * support (voir grilling).
 *
 * Le bloc lisible (version, date, badge) répond à « quel bundle tourne ? » au
 * téléphone. Le bouton force une vérification. La zone technique dépliable
 * porte l'Update ID à croiser avec le dashboard Expo — et le canal, qu'un
 * agent lisant « preview » pourrait mal interpréter, donc rangé là.
 *
 * Hors build EAS (`!otaActif()`), seul le bloc version reste actif : le reste
 * est masqué et le bouton désactivé.
 */
export function OtaSection() {
  const actif = otaActif();
  const { currentlyRunning, isUpdateAvailable, isDownloading, isUpdatePending } = useUpdates();
  const infos = infosCourantes(currentlyRunning);

  const etat = deriverEtat({
    isEnabled: actif,
    isUpdateAvailable,
    isDownloading,
    isUpdatePending,
  });
  const ton = TONS[etat];

  const [dernierCheck, setDernierCheck] = useState<DernierCheck | null>(null);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ texte: string; erreur: boolean } | null>(null);
  const [techOuvert, setTechOuvert] = useState(false);
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  useEffect(() => {
    if (!actif) return;
    const id = setTimeout(() => {
      void lireDernierCheck()
        .then(setDernierCheck)
        .catch((error) => logger.ignore(error, 'lecture du dernier check OTA impossible'));
    }, 0);
    return () => clearTimeout(id);
  }, [actif]);

  const verifier = async () => {
    setChecking(true);
    setMessage(null);
    const outcome = await verifierMaintenant();
    setChecking(false);

    const dc = await lireDernierCheck().catch((error) => {
      logger.ignore(error, 'relecture du dernier check OTA après vérification');
      return null;
    });
    setDernierCheck(dc);

    if (!outcome.ok) {
      setMessage({ texte: 'Impossible de vérifier — vérifiez la connexion et réessayez.', erreur: true });
    } else if (outcome.value.resultat === 'maj-trouvee') {
      setMessage({
        texte: 'Mise à jour téléchargée — un bandeau apparaîtra pour redémarrer.',
        erreur: false,
      });
    } else {
      setMessage({ texte: 'Application déjà à jour.', erreur: false });
    }
  };

  const copierInfos = async () => {
    await Clipboard.setStringAsync(
      infosTechniques({
        version: versionApp(),
        build: buildNatif(),
        updateId: infos.updateId,
        runtimeVersion: infos.runtimeVersion,
        channel: infos.channel,
      })
    );
    Alert.alert('Copié', 'Les infos techniques sont dans le presse-papier.');
  };

  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle}>🚀 Mises à jour</ThemedText>
      <View style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerTexts}>
            <ThemedText style={styles.version}>
              {formatVersionBuild(versionApp(), buildNatif())}
            </ThemedText>
            <ThemedText style={styles.date}>
              {formatDateMaj(infos.createdAt, infos.isEmbeddedLaunch)}
            </ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: ton.bg }]}>
            <ThemedText style={[styles.badgeText, { color: ton.fg }]}>{libelleEtat(etat)}</ThemedText>
          </View>
        </View>

        {actif && (
          <ThemedText style={styles.dernierCheck}>
            {formatDernierCheck(dernierCheck, new Date())}
          </ThemedText>
        )}

        <TouchableOpacity
          style={styles.bouton}
          onPress={verifier}
          disabled={!actif || checking}
          activeOpacity={0.8}
        >
          <ThemedText style={[styles.boutonText, (!actif || checking) && styles.boutonTextOff]}>
            {checking ? 'Vérification…' : 'Vérifier les mises à jour'}
          </ThemedText>
          {checking ? (
            <ActivityIndicator color={PRIMARY} />
          ) : (
            <ThemedText style={styles.fleche}>→</ThemedText>
          )}
        </TouchableOpacity>

        {!actif && (
          <ThemedText style={styles.hint}>
            Vérification indisponible en mode développement.
          </ThemedText>
        )}
        {message && (
          <ThemedText style={[styles.hint, message.erreur && styles.hintErreur]}>
            {message.texte}
          </ThemedText>
        )}

        {actif && (
          <>
            <TouchableOpacity
              style={styles.techToggle}
              onPress={() => setTechOuvert((v) => !v)}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.techToggleText}>
                {techOuvert ? '▾ Masquer les infos techniques' : '▸ Infos techniques'}
              </ThemedText>
            </TouchableOpacity>

            {techOuvert && (
              <View style={styles.techBloc}>
                <TechLigne label="Update ID" value={infos.updateId ?? '(bundle embarqué)'} />
                <TechLigne label="Runtime" value={infos.runtimeVersion ?? '—'} />
                <TechLigne label="Canal" value={infos.channel ?? '—'} />
                <TouchableOpacity style={styles.copier} onPress={copierInfos} activeOpacity={0.8}>
                  <ThemedText style={styles.copierText}>📋 Copier les infos techniques</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function TechLigne({ label, value }: { label: string; value: string }) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => computeTypeSizes(scale), [scale]);
  const theme = useTheme();
  const styles = useMemo(() => createStyles(typeSizes, theme), [typeSizes, theme]);

  return (
    <View style={styles.techLigne}>
      <ThemedText style={styles.techLabel}>{label}</ThemedText>
      <ThemedText style={styles.techValue} numberOfLines={1} ellipsizeMode="middle">
        {value}
      </ThemedText>
    </View>
  );
}

const BASE_TYPE_SIZES = {
  sectionTitle: 16,
  version: 14,
  date: 12,
  badgeText: 11,
  dernierCheck: 12,
  boutonText: 14,
  fleche: 18,
  hint: 12,
  techToggleText: 12,
  techLabel: 12,
  techValue: 12,
  copierText: 12,
};

function computeTypeSizes(scale: number) {
  return scaleTypeSizes(BASE_TYPE_SIZES, scale);
}

function createStyles(typeSizes: ReturnType<typeof computeTypeSizes>, theme: ThemePalette) {
  return StyleSheet.create({
    section: { paddingHorizontal: 16, marginBottom: 16 },
    sectionTitle: { fontSize: typeSizes.sectionTitle, fontWeight: '600', color: theme.title, marginBottom: 10 },
    card: {
      backgroundColor: theme.card,
      borderRadius: 14,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 10,
      paddingBottom: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    headerTexts: { flex: 1 },
    version: { fontSize: typeSizes.version, fontWeight: '600', color: theme.title },
    date: { fontSize: typeSizes.date, color: FOREGROUND_TERTIARY, marginTop: 2 },
    badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    badgeText: { fontSize: typeSizes.badgeText, fontWeight: '700' },
    dernierCheck: { fontSize: typeSizes.dernierCheck, color: FOREGROUND_TERTIARY, marginTop: 10 },
    bouton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 12,
    },
    boutonText: { fontSize: typeSizes.boutonText, color: PRIMARY, fontWeight: '600' },
    boutonTextOff: { color: theme.faint },
    fleche: { fontSize: typeSizes.fleche, color: theme.faint },
    hint: { fontSize: typeSizes.hint, color: FOREGROUND_TERTIARY, marginTop: 8 },
    hintErreur: { color: DANGER_TEXT },
    techToggle: { marginTop: 12 },
    techToggleText: { fontSize: typeSizes.techToggleText, color: '#31567f', fontWeight: '600' },
    techBloc: { marginTop: 8, gap: 6 },
    techLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
    techLabel: { fontSize: typeSizes.techLabel, color: FOREGROUND_TERTIARY },
    techValue: {
      flex: 1,
      textAlign: 'right',
      fontSize: typeSizes.techValue,
      color: theme.title,
      fontFamily: 'monospace',
    },
    copier: { marginTop: 8, alignSelf: 'flex-start', paddingVertical: 6 },
    copierText: { fontSize: typeSizes.copierText, color: PRIMARY, fontWeight: '600' },
  });
}
