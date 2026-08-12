import { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTraitement, updateTraitementMoyens } from '@/lib/traitement-repository';
import { validateRecouvrement } from '@/lib/traitement-validation';
import { Card } from '@/components/traitement/Card';
import { Chip } from '@/components/traitement/Chip';
import { ProgressBar } from '@/components/traitement/ProgressBar';
import { traitementColors, traitementFonts, traitementRadii, traitementTypeSizes } from '@/components/traitement/tokens';

const KIT_ROWS: { key: 'kit_combinaison' | 'kit_gants' | 'kit_lunettes' | 'kit_masques' | 'kit_boite'; label: string }[] = [
  { key: 'kit_combinaison', label: 'Combinaison' },
  { key: 'kit_gants', label: 'Gants' },
  { key: 'kit_lunettes', label: 'Lunettes' },
  { key: 'kit_masques', label: 'Masques' },
  { key: 'kit_boite', label: 'Boîte à pharmacie' },
];

const ZONES = [
  { key: 'habitations', label: 'Habitations' },
  { key: 'points_eau', label: "Points d'eau" },
  { key: 'cultures', label: 'Cultures' },
  { key: 'paturages', label: 'Pâturages' },
  { key: 'aire_protegee', label: 'Aire protégée' },
  { key: 'ruchers', label: 'Ruchers' },
];

export default function MoyensScreen() {
  const router = useRouter();
  const { traitementId, isValidationView } = useLocalSearchParams<{ traitementId: string; isValidationView?: string }>();
  const readOnly = isValidationView === '1';

  const [kit, setKit] = useState<Record<string, boolean>>({});
  const [zones, setZones] = useState<Record<string, boolean>>({});
  const [hauteurHerbeuse, setHauteurHerbeuse] = useState<number | null>(null);
  const [hauteurArboree, setHauteurArboree] = useState<number | null>(null);
  const [recouvrement, setRecouvrement] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!traitementId) return;
    getTraitement(traitementId).then((draft) => {
      if (!draft) return;
      setKit({
        kit_combinaison: draft.kit_combinaison ?? false,
        kit_gants: draft.kit_gants ?? false,
        kit_lunettes: draft.kit_lunettes ?? false,
        kit_masques: draft.kit_masques ?? false,
        kit_boite: draft.kit_boite ?? false,
      });
      try {
        setZones(draft.zones_exposees ? JSON.parse(draft.zones_exposees) : {});
      } catch {
        setZones({});
      }
      setHauteurHerbeuse(draft.hauteur_strate_herbeuse_m);
      setHauteurArboree(draft.hauteur_strate_arboree_m);
      setRecouvrement(draft.recouvrement_percent);
    });
  }, [traitementId]);

  const nbKitCoche = Object.values(kit).filter(Boolean).length;
  const recouvrementErrors = validateRecouvrement(recouvrement);

  const handleContinuer = async () => {
    if (!traitementId || recouvrementErrors.length > 0) return;
    setIsSaving(true);
    await updateTraitementMoyens(traitementId, {
      kit_combinaison: !!kit.kit_combinaison,
      kit_gants: !!kit.kit_gants,
      kit_lunettes: !!kit.kit_lunettes,
      kit_masques: !!kit.kit_masques,
      kit_boite: !!kit.kit_boite,
      zones_exposees: zones,
      hauteur_strate_herbeuse_m: hauteurHerbeuse,
      hauteur_strate_arboree_m: hauteurArboree,
      recouvrement_percent: recouvrement,
    });
    setIsSaving(false);
    router.push({ pathname: '/(traitement)/impacts' as any, params: { traitementId, isValidationView } });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ProgressBar currentIndex={3} />
        <Text style={styles.title}>Moyens & protection</Text>

        <Card variant={nbKitCoche === 5 ? 'info' : 'avertissement'}>
          <Text style={nbKitCoche === 5 ? styles.bannerTextOk : styles.bannerTextWarn}>
            {nbKitCoche === 5 ? '✓ Kit complet (5/5)' : `⚠ Kit incomplet (${nbKitCoche}/5)`}
          </Text>
        </Card>

        {KIT_ROWS.map((row) => (
          <TouchableOpacity
            key={row.key}
            style={styles.kitRow}
            disabled={readOnly}
            onPress={() => setKit((prev) => ({ ...prev, [row.key]: !prev[row.key] }))}
          >
            <Text style={styles.kitCheckbox}>{kit[row.key] ? '✓' : '✕'}</Text>
            <Text style={styles.kitLabel}>{row.label}</Text>
          </TouchableOpacity>
        ))}

        <Text style={styles.label}>Zones exposées</Text>
        <View style={styles.chipRow}>
          {ZONES.map((z) => (
            <Chip
              key={z.key}
              label={z.label}
              selected={!!zones[z.key]}
              onPress={() => !readOnly && setZones((prev) => ({ ...prev, [z.key]: !prev[z.key] }))}
            />
          ))}
        </View>

        <Text style={styles.label}>Végétation</Text>
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Strate herbeuse (m)"
          keyboardType="numeric"
          value={hauteurHerbeuse != null ? String(hauteurHerbeuse) : ''}
          onChangeText={(v) => setHauteurHerbeuse(v ? Number(v) : null)}
        />
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Strate arborée (m)"
          keyboardType="numeric"
          value={hauteurArboree != null ? String(hauteurArboree) : ''}
          onChangeText={(v) => setHauteurArboree(v ? Number(v) : null)}
        />
        <TextInput
          editable={!readOnly}
          style={styles.input}
          placeholder="Recouvrement (%)"
          keyboardType="numeric"
          value={recouvrement != null ? String(recouvrement) : ''}
          onChangeText={(v) => setRecouvrement(v ? Number(v) : null)}
        />
        {recouvrementErrors.map((e) => (
          <Text key={e.field} style={styles.error}>{e.message}</Text>
        ))}

        {!readOnly && (
          <TouchableOpacity style={styles.continueButton} onPress={handleContinuer} disabled={isSaving}>
            <Text style={styles.continueButtonText}>{isSaving ? 'Enregistrement…' : 'Continuer  ›'}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: traitementColors.fondApp },
  content: { padding: 16, gap: 10 },
  title: { fontFamily: traitementFonts.uiExtraBold, fontSize: traitementTypeSizes.titreEcran, color: traitementColors.texteTitre },
  bannerTextOk: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.vertPrincipal },
  bannerTextWarn: { fontFamily: traitementFonts.uiSemiBold, color: traitementColors.avertissementTexte },
  kitRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44, paddingVertical: 6 },
  kitCheckbox: { fontFamily: traitementFonts.uiBold, fontSize: 16, color: traitementColors.vertPrincipal, width: 24 },
  kitLabel: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.corps, color: traitementColors.texteTitre },
  label: { fontFamily: traitementFonts.uiMedium, fontSize: traitementTypeSizes.label, color: traitementColors.texteLabel },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  input: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: traitementColors.bordure,
    borderRadius: traitementRadii.chip,
    paddingHorizontal: 10,
    fontFamily: traitementFonts.ui,
    fontSize: traitementTypeSizes.corps,
    color: traitementColors.texteTitre,
    backgroundColor: '#fff',
  },
  error: { fontFamily: traitementFonts.ui, fontSize: traitementTypeSizes.label, color: traitementColors.erreurTexte },
  continueButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: traitementRadii.boutonPrincipal,
    marginTop: 8,
  },
  continueButtonText: { fontFamily: traitementFonts.uiBold, color: '#fff', fontSize: traitementTypeSizes.corps + 1 },
});
