import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useAuthStore } from '@/lib/auth-store';
import { apiClient, ProspectionRead } from '@/lib/api-client';
import { buildFicheLecture, FicheLectureViewModel, isFicheValidee, getStatusLabel } from '@/lib/prospection-fiche-lecture';
import { buildFicheLecturePdfHtml } from '@/lib/prospection-fiche-lecture-pdf';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_DARK = '#163F16';
const IFVM_GREEN_LIGHT = '#E8F3E8';

/**
 * Écran de lecture d'une fiche Validée (#16) : strictement lecture seule, aucune resaisie.
 * Toutes les valeurs affichées sont dérivées de la fiche telle que renvoyée par l'API.
 */
export default function FicheLectureScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);

  const [prospection, setProspection] = useState<ProspectionRead | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (!id || !token) return;
    apiClient
      .getProspection(token, id)
      .then(setProspection)
      .catch(() => setLoadError('Impossible de charger la fiche.'));
  }, [id, token]);

  const handleExportPdf = async () => {
    if (!prospection) return;
    setIsExporting(true);
    setExportError(null);
    try {
      const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';
      const { uri } = await Print.printToFileAsync({
        html: buildFicheLecturePdfHtml(buildFicheLecture(prospection), prospecteurLabel),
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      }
    } catch (error) {
      console.error('Erreur export PDF:', error);
      setExportError("Impossible d'exporter la fiche en PDF.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRetour = () => {
    router.push('/(tabs)/prospection');
  };

  if (loadError) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.header}>
          {/* Suppression du bouton de retour dans la navbar */}
          <Text style={styles.headerTitle}>Fiche de lecture</Text>
        </SafeAreaView>
        <View style={styles.errorBox}>
          <Text style={styles.errorBoxIcon}>⚠️</Text>
          <Text style={styles.errorText}>{loadError}</Text>
        </View>
        {/* Bouton retour en bas */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner]}
            onPress={handleRetour}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!prospection || !isFicheValidee(prospection)) {
    return (
      <View style={styles.root}>
        <SafeAreaView edges={['top']} style={styles.header}>
          {/* Suppression du bouton de retour dans la navbar */}
          <Text style={styles.headerTitle}>Fiche de lecture</Text>
        </SafeAreaView>
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            {!prospection ? 'Chargement...' : 'Cette fiche n\'est pas encore validée'}
          </Text>
        </View>
        {/* Bouton retour en bas */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner]}
            onPress={handleRetour}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const recap: FicheLectureViewModel = buildFicheLecture(prospection);
  const prospecteurLabel = user ? `${user.prenom} ${user.nom}` : '—';
  const statusLabel = getStatusLabel(prospection.statut);
  const isValidee = prospection.statut === 'validee';

  return (
    <View style={styles.root}>
      <SafeAreaView edges={['top']} style={styles.header}>
        {/* Suppression du bouton de retour dans la navbar */}
        <Text style={styles.headerTitle}>Fiche de lecture</Text>
        <View style={styles.headerRow}>
          <View style={[styles.badge, isValidee ? styles.badgeValide : styles.badgePending]}>
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
          {prospection.n_fiche && (
            <Text style={styles.headerNfiche}>N° {prospection.n_fiche}</Text>
          )}
        </View>
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
              {prospection.type_prospection === 'intensive' ? 'Intensive' :
               prospection.type_prospection === 'extensive' ? 'Extensive' :
               prospection.type_prospection === 'validation' ? 'Validation' :
               prospection.type_prospection}
            </Text>
          </View>
        </View>

        {/* Fiche */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Fiche</Text>
          <Row label="N° fiche" value={recap.nFiche} />
          {prospection.n_releve && <Row label="N° relevé" value={prospection.n_releve} />}
          {prospection.n_message && <Row label="N° message" value={prospection.n_message} />}
          <Row label="Station / localité" value={recap.stationLabel} />
          <Row label="Date" value={recap.dateProspection} />
          <Row label="Prospecteur" value={prospecteurLabel} />
          {prospection.biotope && <Row label="Biotope" value={prospection.biotope} />}
        </View>

        {/* Position & Surfaces */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Position & surfaces</Text>
          {prospection.latitude != null && prospection.longitude != null ? (
            <Row 
              label="GPS" 
              value={`${prospection.latitude.toFixed(5)}, ${prospection.longitude.toFixed(5)}`} 
            />
          ) : (
            <Row label="GPS" value="—" />
          )}
          {prospection.altitude != null && (
            <Row label="Altitude" value={`${prospection.altitude} m`} />
          )}
          <Row label="Surface station" value={formatHa(prospection.surf_station)} />
          <Row label="Surface prospectée" value={formatHa(prospection.surf_prospectee)} />
          <Row label="Surface infestée" value={formatHa(prospection.surf_infestee)} />
          {prospection.surface_contaminee != null && (
            <Row label="Surface contaminée" value={formatHa(prospection.surface_contaminee)} />
          )}
        </View>

        {/* Infestation */}
        {recap.infestation.hasInfestation && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Infestation</Text>
            <Row label="Type" value={recap.infestation.typeLabel} />
            {prospection.infestations[0]?.espece && (
              <Row label="Espèce" value={prospection.infestations[0].espece} />
            )}
            <Row label="Surface" value={recap.infestation.surfaceTot != null ? `${recap.infestation.surfaceTot} ha` : '—'} />
            <Row label="Comportement" value={recap.infestation.comportementLabel} />
            {prospection.infestations[0]?.direction_vers && (
              <Row label="Direction" value={prospection.infestations[0].direction_vers} />
            )}
            {prospection.infestations[0]?.vent_de && (
              <Row label="Vent" value={`${prospection.infestations[0].vent_de} ${prospection.infestations[0].vent_vitesse ? `• ${prospection.infestations[0].vent_vitesse} km/h` : ''}`} />
            )}
          </View>
        )}

        {/* Synthèse par espèce */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Synthèse par espèce</Text>
          {recap.especes.length === 0 ? (
            <Text style={styles.summaryText}>Aucune capture enregistrée.</Text>
          ) : (
            recap.especes.map((e) => (
              <View key={e.espece} style={styles.especeBlock}>
                <Text style={styles.especeTitle}>{e.espece}</Text>
                <Row label="Total capturé" value={String(e.totalCaptures)} />
                <Row label="Densité diffuse /ha" value={e.densiteDiffuse != null ? String(e.densiteDiffuse) : '—'} />
                <Row label="Densité groupée /ha" value={e.densiteGroupee != null ? String(e.densiteGroupee) : '—'} />
                <Row label="Phénotype dominant" value={e.phenotypeDominantLabel} />
              </View>
            ))
          )}
        </View>

        {/* Végétation & sol */}
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Végétation & sol</Text>
          <Text style={styles.summaryText}>{recap.vegetationSummary}</Text>
          {prospection.verdissement != null && (
            <Row label="Verdissement" value={`${prospection.verdissement}%`} />
          )}
          {prospection.hauteur_strate != null && (
            <Row label="Hauteur strate" value={`${prospection.hauteur_strate} m`} />
          )}
        </View>

        {/* Pullulation */}
        {(prospection.pullulation_nb != null || prospection.interdistance != null || prospection.taille_info) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Pullulation</Text>
            {prospection.pullulation_nb != null && (
              <Row label="Nombre" value={String(prospection.pullulation_nb)} />
            )}
            {prospection.interdistance != null && (
              <Row label="Interdistance" value={`${prospection.interdistance} m`} />
            )}
            {prospection.taille_info && (() => {
              try {
                const info = prospection.taille_info as any;
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

        {/* Essaim */}
        {(prospection.essaim_type || prospection.essaim_vol_dir_de || prospection.essaim_vol_dir_vers || prospection.essaim_pose != null) && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Essaim</Text>
            {prospection.essaim_type && (
              <Row label="Type" value={prospection.essaim_type} />
            )}
            {prospection.essaim_vol_dir_de && (
              <Row label="Provenance" value={prospection.essaim_vol_dir_de} />
            )}
            {prospection.essaim_vol_dir_vers && (
              <Row label="Direction" value={prospection.essaim_vol_dir_vers} />
            )}
            {prospection.essaim_pose != null && (
              <Row label="Posé" value={prospection.essaim_pose ? 'Oui' : 'Non'} />
            )}
          </View>
        )}

        {/* Observations */}
        {prospection.observations && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Observations</Text>
            <Text style={styles.summaryText}>{prospection.observations}</Text>
          </View>
        )}

        {/* Historique / Audit */}
        {prospection.verified_at && (
          <View style={styles.card}>
            <Text style={styles.cardLabel}>Historique</Text>
            {prospection.verified_at && (
              <Row label="Vérifié le" value={formatDate(prospection.verified_at)} />
            )}
            {prospection.validated_at && (
              <Row label="Validé le" value={formatDate(prospection.validated_at)} />
            )}
            <Row label="Créé le" value={formatDate(prospection.created_at)} />
            <Row label="Mis à jour" value={formatDate(prospection.updated_at)} />
          </View>
        )}

        {exportError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorBoxIcon}>❌</Text>
            <Text style={styles.errorText}>{exportError}</Text>
          </View>
        )}

        {/* Boutons en bas - même taille */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.btn, styles.btnRetourner, isExporting && styles.btnDisabled]}
            onPress={handleRetour}
            disabled={isExporting}
            activeOpacity={0.85}
          >
            <Text style={styles.btnRetournerText}>← Retour</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn, styles.btnExport, isExporting && styles.btnDisabled]}
            onPress={handleExportPdf}
            disabled={isExporting}
            activeOpacity={0.85}
          >
            <Text style={styles.btnExportText}>
              {isExporting ? '⏳ Export en cours…' : '📄 Exporter PDF'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function formatHa(value: number | null): string {
  return value != null ? `${value.toFixed(2)} ha` : '—';
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return dateStr;
  }
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
    fontWeight: '700' 
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
  },
  headerNfiche: {
    color: '#FFFFFFAA',
    fontSize: 13,
    fontWeight: '600',
  },
  badge: { 
    borderRadius: 6, 
    paddingHorizontal: 10, 
    paddingVertical: 4, 
    alignSelf: 'flex-start',
  },
  badgeValide: {
    backgroundColor: '#DCFCE7',
  },
  badgePending: {
    backgroundColor: '#FEF3C7',
  },
  badgeText: { 
    fontSize: 12, 
    fontWeight: '700',
    color: '#374151',
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
    fontSize: 13,
    fontWeight: '700',
  },
  especeBlock: { 
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  especeTitle: { 
    fontSize: 13, 
    fontWeight: '700', 
    color: '#111827', 
    marginBottom: 4 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    paddingVertical: 3,
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
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
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
  btnExport: { 
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
  btnExportText: { 
    color: '#FFFFFF', 
    fontSize: 15, 
    fontWeight: '600' 
  },
  btnDisabled: { 
    opacity: 0.6 
  },
});