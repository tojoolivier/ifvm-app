import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '@/lib/auth-store';
import { getProspection, DraftProspection } from '@/lib/prospection-repository';
import { buildRecapitulatif, enregistrerEtSynchroniser, RecapitulatifViewModel } from '@/lib/prospection-recapitulatif';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

export default function RecapitulatifScreen() {
  const router = useRouter();
  const { draftId } = useLocalSearchParams<{ draftId: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [draft, setDraft] = useState<DraftProspection | null>(null);
  const [recap, setRecap] = useState<RecapitulatifViewModel | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (!draftId) return;
    getProspection(draftId).then(async (row) => {
      setDraft(row);
      if (row) setRecap(await buildRecapitulatif(row));
    });
  }, [draftId]);

  const handleEnregistrer = async () => {
    if (!draft || !token) return;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const result = await enregistrerEtSynchroniser(draft, token);
      if (result.synced) {
        setSaveSuccess(true);
        setTimeout(() => {
          router.push({ pathname: '/(tabs)/prospection', params: { justSaved: '1' } });
        }, 1500);
      } else {
        setSaveSuccess(true);
        setTimeout(() => {
          router.push({ pathname: '/(tabs)/prospection', params: { justSaved: '1', synced: '0' } });
        }, 1500);
      }
    } catch (error) {
      console.error('Erreur enregistrement:', error);
      setSaveError("Impossible d'enregistrer la fiche localement");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRetour = () => {
    if (!draft) return;
    router.push({
      // @ts-ignore
      pathname: '/(prospection)/vegetation',
      params: { draftId: draft.id }
    });
  };

  if (!draft || !recap) {
    return <View style={styles.root} />;
  }

  const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';
  const typeLabels: Record<string, string> = {
    'intensive': 'Intensive',
    'extensive': 'Extensive',
    'validation': 'Validation'
  };

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Récapitulatif</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: '100%' }]} />
        </View>
        <Text style={styles.progressLabel}>Prêt à enregistrer ✓</Text>
      </SafeAreaView>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Type de prospection */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Type de prospection</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>
              {typeLabels[draft.type_prospection] || draft.type_prospection}
            </Text>
          </View>
        </View>

        {/* Fiche */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fiche</Text>
          <Row label="N° fiche" value={recap.nFiche} />
          <Row label="Station / localité" value={recap.stationLabel} />
          <Row label="Date" value={recap.dateProspection} />
          <Row label="Prospecteur" value={prospecteurLabel} />
          {draft.n_releve && <Row label="N° relevé" value={draft.n_releve} />}
          {draft.n_message && <Row label="N° message" value={draft.n_message} />}
        </View>

        {/* Référence GPS et Surfaces */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Position & surfaces</Text>
          <Row
            label="Position GPS"
            value={recap.latitude != null && recap.longitude != null 
              ? `${recap.latitude.toFixed(5)}, ${recap.longitude.toFixed(5)}` 
              : '—'
            }
          />
          <Row label="Surface station" value={formatHa(recap.surfStation)} />
          <Row label="Surface prospectée" value={formatHa(recap.surfProspectee)} />
          <Row label="Surface infestée" value={formatHa(recap.surfInfestee)} />
          {draft.surface_contaminee != null && (
            <Row label="Surface contaminée" value={formatHa(draft.surface_contaminee)} />
          )}
        </View>

        {/* Captures */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Captures</Text>
          <Row label="Total capturé" value={String(recap.totalCaptures)} />
          <Row label="Femelles" value={String(recap.totalFemelles)} />
          <Row label="Mâles" value={String(recap.totalMales)} />
          <Row label="Phénotype dominant" value={recap.phenotypeDominantLabel} />
          <Row label="Durée de la session" value={recap.dureeSession} />
        </View>

        {/* Végétation & sol */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Végétation & sol</Text>
          <Text style={styles.summaryText}>{recap.vegetationSummary}</Text>
          
          {draft.verdissement != null && (
            <Row label="Verdissement" value={`${draft.verdissement}%`} />
          )}
          {draft.hauteur_strate != null && (
            <Row label="Hauteur strate" value={`${draft.hauteur_strate} m`} />
          )}
        </View>

        {/* Pullulation - Migration 0005 */}
        {(draft.pullulation_nb != null || draft.interdistance != null || draft.taille_info) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pullulation</Text>
            {draft.pullulation_nb != null && (
              <Row label="Nombre" value={String(draft.pullulation_nb)} />
            )}
            {draft.interdistance != null && (
              <Row label="Interdistance" value={`${draft.interdistance} m`} />
            )}
            {draft.taille_info && (() => {
              try {
                const info = JSON.parse(draft.taille_info);
                const parts = [];
                if (info.long) parts.push(`L: ${info.long}m`);
                if (info.large) parts.push(`l: ${info.large}m`);
                if (info.epaisseur) parts.push(`E: ${info.epaisseur}m`);
                return <Row label="Taille" value={parts.join(' · ') || '—'} />;
              } catch {
                return null;
              }
            })()}
          </View>
        )}

        {/* Essaim - Migration 0005 */}
        {(draft.essaim_type || draft.essaim_vol_dir_de || draft.essaim_vol_dir_vers || draft.essaim_pose != null) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Essaim</Text>
            {draft.essaim_type && (
              <Row label="Type" value={draft.essaim_type} />
            )}
            {draft.essaim_vol_dir_de && (
              <Row label="Provenance" value={draft.essaim_vol_dir_de} />
            )}
            {draft.essaim_vol_dir_vers && (
              <Row label="Direction" value={draft.essaim_vol_dir_vers} />
            )}
            {draft.essaim_pose != null && (
              <Row label="Posé" value={draft.essaim_pose ? 'Oui' : 'Non'} />
            )}
            {draft.surface_contaminee != null && (
              <Row label="Surface contaminée" value={formatHa(draft.surface_contaminee)} />
            )}
          </View>
        )}

        {/* Statut */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Statut</Text>
          <View style={styles.statusContainer}>
            <View style={[
              styles.statusBadge,
              draft.statut === 'brouillon' && styles.statusBrouillon,
              draft.statut === 'en_attente' && styles.statusEnAttente,
            ]}>
              <Text style={styles.statusText}>
                {draft.statut === 'brouillon' ? '📝 Brouillon' :
                 draft.statut === 'en_attente' ? '⏳ En attente' :
                 draft.statut === 'verifiee' ? '✅ Vérifiée' :
                 draft.statut === 'validee' ? '🎯 Validée' :
                 draft.statut === 'rejetee' ? '❌ Rejetée' :
                 draft.statut}
              </Text>
            </View>
            <View style={[
              styles.syncBadge,
              draft.statut_sync === 'synced' ? styles.syncOk : styles.syncPending
            ]}>
              <Text style={styles.syncText}>
                {draft.statut_sync === 'synced' ? '☁️ Synchronisé' : '📱 Hors-ligne'}
              </Text>
            </View>
          </View>
        </View>

        {/* Messages de succès/erreur */}
        {saveSuccess && (
          <View style={styles.successBox}>
            <Text style={styles.successBoxIcon}>✅</Text>
            <Text style={styles.successText}>
              {draft.statut_sync === 'synced' 
                ? 'Fiche enregistrée et synchronisée !' 
                : 'Fiche enregistrée localement (hors-ligne)'}
            </Text>
          </View>
        )}

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        {/* Boutons en bas - même taille */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner, isSaving && styles.btnDisabled]}
            onPress={handleRetour}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnEnregistrer, isSaving && styles.btnDisabled]}
            onPress={handleEnregistrer}
            disabled={isSaving}
            activeOpacity={0.85}
          >
            <Text style={styles.btnEnregistrerText}>
              {isSaving ? '⏳ Enregistrement…' : '📤 Enregistrer'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function formatHa(value: number | null): string {
  return value != null ? `${value.toFixed(2)} ha` : '—';
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { 
    flex: 1, 
    backgroundColor: '#F3F4F6' 
  },
  header: { 
    backgroundColor: IFVM_GREEN_DARK, 
    paddingHorizontal: 16, 
    paddingBottom: 14 
  },
  headerTitle: { 
    color: '#FFFFFF', 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 10 
  },
  progressTrack: { 
    height: 4, 
    backgroundColor: '#FFFFFF33', 
    borderRadius: 2, 
    overflow: 'hidden' 
  },
  progressFill: { 
    height: 4, 
    backgroundColor: '#FFFFFF' 
  },
  progressLabel: { 
    color: '#FFFFFFAA', 
    fontSize: 11, 
    marginTop: 4 
  },
  content: { 
    flex: 1 
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  card: { 
    backgroundColor: '#FFFFFF', 
    borderRadius: 10, 
    padding: 14, 
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: { 
    fontSize: 12, 
    fontWeight: '700', 
    color: '#6B7280', 
    marginBottom: 8, 
    textTransform: 'uppercase' 
  },
  typeBadge: {
    backgroundColor: IFVM_GREEN_LIGHT,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  typeBadgeText: {
    color: IFVM_GREEN_DARK,
    fontSize: 14,
    fontWeight: '700',
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F9FAFB',
  },
  rowLabel: { 
    color: '#6B7280', 
    fontSize: 13 
  },
  rowValue: { 
    color: '#111827', 
    fontSize: 13, 
    fontWeight: '600' 
  },
  summaryText: { 
    color: '#111827', 
    fontSize: 13, 
    lineHeight: 19 
  },
  statusContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBrouillon: {
    backgroundColor: '#F3F4F6',
  },
  statusEnAttente: {
    backgroundColor: '#FEF3C7',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  syncBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  syncOk: {
    backgroundColor: '#D1FAE5',
  },
  syncPending: {
    backgroundColor: '#FEF3C7',
  },
  syncText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D1FAE5',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#6EE7B7',
  },
  successBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  successText: {
    color: '#065F46',
    fontSize: 13,
    flex: 1,
    fontWeight: '600',
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEE2E2',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  errorBoxIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  errorText: { 
    color: '#DC2626', 
    fontSize: 13,
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    minHeight: 56,
  },
  btnEnregistrer: { 
    backgroundColor: IFVM_GREEN,
  },
  btnRetourner: {
    backgroundColor: '#6B7280',
  },
  btnRetournerText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  btnEnregistrerText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  btnDisabled: { 
    opacity: 0.6 
  },
});