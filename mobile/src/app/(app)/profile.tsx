import { View, TouchableOpacity, ScrollView, StyleSheet, Image, Switch, SafeAreaView, Alert, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect, useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { storage } from '@/lib/storage';
import { apiClient } from '@/lib/api-client';
import { pullReferentiel, resetReferentielSyncCursors } from '@/lib/referentiel-sync';
import { useDebugStore } from '@/lib/debug-store';
import { useFontScaleStore } from '@/lib/font-scale-store';
import { FONT_SCALE_LEVELS, FontScaleLevel, scaleTypeSizes } from '@/lib/typography';
import { useFontScale } from '@/hooks/use-font-scale';
import { useSignalerChargement } from '@/hooks/use-signaler-chargement';
import { useAsyncAction } from '@/hooks/use-async-action';
import { logger } from '@/lib/logger';
import { OtaSection } from '@/components/ota-section';
import { buildNatif, formatVersionBuild, versionApp } from '@/lib/ota';
import { useThemeStore } from '@/lib/theme-store';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_BG = '#E8F5E9';
const IFVM_BG_LIGHT = '#F0F2F5';
const CARD_BG = '#FFFFFF';
const IFVM_RED = '#E74C3C';
const IFVM_BLUE = '#2196F3';
const IFVM_ORANGE = '#E67E22';
const HEADER_BG = '#1B5E1B';

const PROFILE_IMAGE_KEY = 'profile_image';

export default function ProfileScreen() {
  const router = useRouter();
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  const debugEnabled = useDebugStore((s) => s.enabled);
  const setDebugEnabled = useDebugStore((s) => s.setEnabled);
  const fontScaleLevel = useFontScaleStore((s) => s.level);
  const setFontScaleLevel = useFontScaleStore((s) => s.setLevel);
  const themeMode = useThemeStore((s) => s.mode);
  const setThemeMode = useThemeStore((s) => s.setMode);

  const [locationEnabled, setLocationEnabled] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const { run: runImage, isRunning: isLoading } = useAsyncAction();
  const { run: runSync, isRunning: isSyncing } = useAsyncAction();
  const signalerChargement = useSignalerChargement('profile');

  // État pour la modification du mot de passe
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Charger l'image de profil au montage
  useEffect(() => {
    const id = setTimeout(() => {
      void storage
        .getItem(PROFILE_IMAGE_KEY)
        .then((image) => {
          if (image) setProfileImage(image);
        })
        .catch((error) => signalerChargement(error));
    }, 0);
    return () => clearTimeout(id);
  }, [signalerChargement]);

  const { run: runLogout } = useAsyncAction();
  const handleLogout = () =>
    runLogout(
      async () => {
        await logout();
        router.replace('/(auth)/login');
      },
      { screen: 'profile', context: { action: 'logout' } }
    );

  const handleForcePull = () =>
    runSync(
      async () => {
        await resetReferentielSyncCursors();
        await pullReferentiel(token!);
        Alert.alert('Succès', 'Référentiel synchronisé.');
      },
      {
        screen: 'profile',
        precondition: !!token,
        preconditionMessage: 'Session expirée — reconnectez-vous pour synchroniser.',
        context: { action: 'forcePull' },
      }
    );

  const roleLabels: Record<string, string> = {
    prospecteur: 'Prospecteur',
    chef_equipe: "Chef d'équipe",
    agent_encadreur: 'Agent encadreur',
    pilote: 'Pilote',
    mecanicien: 'Mécanicien',
    chef_de_base: 'Chef de base',
    admin: 'Administrateur',
  };

  const roleColors: Record<string, string> = {
    prospecteur: IFVM_GREEN,
    chef_equipe: IFVM_BLUE,
    agent_encadreur: IFVM_ORANGE,
    pilote: '#9B59B6',
    mecanicien: '#F39C12',
    chef_de_base: '#1ABC9C',
    admin: '#E74C3C',
  };

  const roleIcons: Record<string, string> = {
    prospecteur: '🔍',
    chef_equipe: '👔',
    agent_encadreur: '📋',
    pilote: '🚗',
    mecanicien: '🔧',
    chef_de_base: '🏢',
    admin: '👑',
  };

  const userRole = user?.role || 'prospecteur';
  const roleLabel = roleLabels[userRole] || userRole;
  const roleColor = roleColors[userRole] || IFVM_GREEN;
  const roleIcon = roleIcons[userRole] || '👤';

  // ============================================
  // FONCTIONS PHOTO DE PROFIL - CORRIGÉES
  // ============================================

  // Obtenir le répertoire de l'application de manière sécurisée
  const getDocumentDirectory = (): string => {
    if (Platform.OS === 'web') {
      return '';
    }
    try {
      const docDir = (FileSystem as any).documentDirectory;
      return docDir || '';
    } catch (error) {
      // Best-effort délibéré : sans répertoire dédié, `persistProfileImage`
      // garde l'URI d'origine (galerie/caméra) au lieu de copier le fichier.
      logger.ignore(error, "répertoire de documents indisponible, l'image n'est pas copiée localement");
      return '';
    }
  };

  // Étape partagée par takePhoto/pickImage — pas de `runImage` propre : ces
  // deux appelants sont eux-mêmes déjà dans l'action d'un `runImage` en
  // cours, et `run()` ignore silencieusement tout appel imbriqué tant que
  // `isRunningRef` est vrai (voir use-async-action.ts) — la photo ne se
  // serait jamais sauvegardée.
  const persistProfileImage = async (uri: string) => {
    const docDir = getDocumentDirectory();
    let fileUri = uri;

    // Si nous sommes sur mobile et que le répertoire est disponible
    if (docDir) {
      const fileName = `profile_${user?.id || 'user'}_${Date.now()}.jpg`;
      fileUri = docDir + fileName;

      // Copier le fichier vers le répertoire de l'application
      await FileSystem.copyAsync({
        from: uri,
        to: fileUri,
      });
    }

    // Sauvegarder le chemin dans le storage
    await storage.setItem(PROFILE_IMAGE_KEY, fileUri);
    setProfileImage(fileUri);

    Alert.alert('Succès', 'Photo de profil mise à jour !');
  };

  // Demander les permissions et ouvrir la caméra
  const takePhoto = () =>
    runImage(
      async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission refusée',
            'Vous devez autoriser l\'accès à la caméra pour prendre une photo.'
          );
          return;
        }

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          await persistProfileImage(result.assets[0].uri);
        }
      },
      { screen: 'profile', context: { action: 'takePhoto' } }
    );

  // Demander les permissions et ouvrir la galerie
  const pickImage = () =>
    runImage(
      async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Permission refusée',
            'Vous devez autoriser l\'accès à la galerie pour choisir une photo.'
          );
          return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.8,
        });

        if (!result.canceled && result.assets && result.assets.length > 0) {
          await persistProfileImage(result.assets[0].uri);
        }
      },
      { screen: 'profile', context: { action: 'pickImage' } }
    );

  const removeProfileImage = () => {
    Alert.alert(
      'Supprimer la photo',
      'Voulez-vous vraiment supprimer votre photo de profil ?',
      [
        { text: 'Annuler', style: 'cancel' as const },
        {
          text: 'Supprimer',
          style: 'destructive' as const,
          onPress: () =>
            runImage(
              async () => {
                const docDir = getDocumentDirectory();
                if (profileImage && docDir) {
                  await FileSystem.deleteAsync(profileImage, { idempotent: true });
                }
                await storage.deleteItem(PROFILE_IMAGE_KEY);
                setProfileImage(null);
                Alert.alert('Succès', 'Photo de profil supprimée');
              },
              { screen: 'profile', context: { action: 'removeProfileImage' } }
            ),
        }
      ]
    );
  };

  // Fonction principale pour ouvrir le sélecteur
  const showImagePickerOptions = () => {
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        {
          text: '📷 Prendre une photo',
          onPress: () => takePhoto(),
        },
        {
          text: '🖼️ Choisir dans la galerie',
          onPress: () => pickImage(),
        },
        ...(profileImage ? [{
          text: '🗑️ Supprimer la photo',
          style: 'destructive' as const,
          onPress: () => removeProfileImage(),
        }] : []),
        { text: 'Annuler', style: 'cancel' as const },
      ]
    );
  };

  // ============================================
  // FONCTIONS MODIFICATION MOT DE PASSE
  // ============================================

  const handleChangePassword = async () => {
    // Validation
    if (!currentPassword.trim()) {
      Alert.alert('Erreur', 'Veuillez entrer votre mot de passe actuel');
      return;
    }
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Erreur', 'Le nouveau mot de passe doit contenir au moins 6 caractères');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Erreur', 'Les mots de passe ne correspondent pas');
      return;
    }

    setIsChangingPassword(true);
    try {
      await apiClient.changePassword({
        currentPassword,
        newPassword,
      }, token);

      Alert.alert(
        'Succès',
        'Votre mot de passe a été modifié avec succès',
        [
          {
            text: 'OK',
            onPress: () => {
              setModalVisible(false);
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
            }
          }
        ]
      );
    } catch (error) {
      // Message serveur affiché verbatim (ex. « mot de passe actuel
      // incorrect ») : `erreurHttp` mappe tout hors 401 sur `NetworkError`,
      // dont le message générique de `toFriendlyError` masquerait la vraie
      // raison. Pas `useAsyncAction` ici pour cette raison précise.
      logger.failure('profile.changePassword.failed', error);
      Alert.alert(
        'Erreur',
        error instanceof Error && error.message
          ? error.message
          : 'Impossible de modifier le mot de passe. Vérifiez votre mot de passe actuel.'
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  // ============================================
  // RENDU
  // ============================================

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ThemedText style={styles.backIcon}>‹</ThemedText>
            </TouchableOpacity>
            <Image
              source={require('../../../assets/images/logo-ifvm.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <View style={styles.headerTextContainer}>
              <ThemedText style={styles.headerTitle}>Profil</ThemedText>
              <ThemedText style={styles.headerSub}>
                {user?.prenom} {user?.nom}
              </ThemedText>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Contenu principal */}
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Section Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={showImagePickerOptions}
            activeOpacity={0.8}
            style={styles.avatarTouchable}
          >
            <View style={[styles.avatarContainer, { backgroundColor: roleColor + '20' }]}>
              {profileImage ? (
                <Image
                  source={{ uri: profileImage }}
                  style={styles.avatarImage}
                />
              ) : (
                <ThemedText style={[styles.avatarText, { color: roleColor }]}>
                  {user?.prenom?.charAt(0).toUpperCase() ?? '?'}
                </ThemedText>
              )}
              {/* Icône caméra avec son propre TouchableOpacity */}
              <TouchableOpacity
                style={styles.cameraIconContainer}
                onPress={(e) => {
                  e.stopPropagation();
                  showImagePickerOptions();
                }}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.cameraIcon}>📷</ThemedText>
              </TouchableOpacity>
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#FFFFFF" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <ThemedText style={styles.userName}>
            {user?.prenom} {user?.nom}
          </ThemedText>
          <ThemedText style={styles.userRole}>
            {roleIcon} {roleLabel}
          </ThemedText>
        </View>

        {/* Informations personnelles */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>📋 Informations personnelles</ThemedText>
          <View style={styles.infoCard}>
            <InfoItem label="Nom complet" value={`${user?.prenom || ''} ${user?.nom || ''}`} />
            <InfoItem label="Email" value={user?.email || 'Non défini'} />
            <InfoItem label="Rôle" value={roleLabel} />
          </View>
        </View>

        {/* Sécurité */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>🔒 Sécurité</ThemedText>
          <TouchableOpacity
            style={styles.securityButton}
            onPress={() => setModalVisible(true)}
            activeOpacity={0.8}
          >
            <View style={styles.securityButtonLeft}>
              <ThemedText style={styles.securityIcon}>🔑</ThemedText>
              <ThemedText style={styles.securityText}>Changer le mot de passe</ThemedText>
            </View>
            <ThemedText style={styles.securityArrow}>→</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Mises à jour OTA */}
        <OtaSection />

        {/* Synchronisation */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>🔄 Synchronisation</ThemedText>
          <TouchableOpacity
            style={styles.securityButton}
            onPress={handleForcePull}
            disabled={isSyncing}
            activeOpacity={0.8}
          >
            <View style={styles.securityButtonLeft}>
              <ThemedText style={styles.securityIcon}>📡</ThemedText>
              <ThemedText style={styles.securityText}>
                {isSyncing ? 'Synchronisation…' : 'Forcer la synchronisation du référentiel'}
              </ThemedText>
            </View>
            {isSyncing ? (
              <ActivityIndicator color={IFVM_GREEN} />
            ) : (
              <ThemedText style={styles.securityArrow}>→</ThemedText>
            )}
          </TouchableOpacity>
        </View>

        {/* Préférences */}
        <View style={styles.preferencesSection}>
          <ThemedText style={styles.sectionTitle}>⚙️ Préférences</ThemedText>
          <View style={styles.preferencesCard}>
            <PreferenceItem
              icon="📍"
              label="Localisation"
              value={locationEnabled}
              onToggle={setLocationEnabled}
            />
            <PreferenceItem
              icon="🌙"
              label="Mode sombre"
              value={themeMode === 'dark'}
              onToggle={async (value) => {
                await setThemeMode(value ? 'dark' : 'light');
              }}
            />
            <PreferenceChoice
              icon="🔤"
              label="Taille de police"
              value={fontScaleLevel}
              onChange={(level) => {
                if (user) void setFontScaleLevel(user.id, level);
              }}
            />
          </View>
        </View>

        {/* Aide — ADR-012 décision 7 (#176) */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>🆘 Aide</ThemedText>
          {/*
            L'**entrée froide**, sans aucune condition. C'est tout le ticket :
            ce lien vivait derrière `debugEnabled`, donc l'agent devait avoir
            activé l'interrupteur AVANT le bug — une dépendance temporelle
            impossible à satisfaire. Pas de geste caché non plus : il faudrait
            l'enseigner par téléphone, exactement le coût qu'on supprime.
          */}
          <TouchableOpacity
            style={styles.securityButton}
            onPress={() => router.push('/(app)/signalement')}
            activeOpacity={0.8}
          >
            <View style={styles.securityButtonLeft}>
              <ThemedText style={styles.securityIcon}>🆘</ThemedText>
              <ThemedText style={styles.securityText}>Signaler un problème</ThemedText>
            </View>
            <ThemedText style={styles.securityArrow}>→</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Débogage */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.sectionTitle}>🐞 Débogage</ThemedText>
          <View style={styles.preferencesCard}>
            {/*
              Le flag n'est plus un gate : tout part au journal sans condition
              (décision 4). Il ne règle plus que la **verbosité** — la durée de
              vie des lignes `detail` dans `journal-db.purgerJournal`. Le
              libellé le dit, sinon l'agent croirait encore devoir l'activer
              pour que quoi que ce soit soit enregistré.
            */}
            <PreferenceItem
              icon="🔬"
              label="Enregistrer les détails techniques"
              hint="À activer si le support vous le demande."
              value={debugEnabled}
              onToggle={setDebugEnabled}
            />
          </View>
          <TouchableOpacity
            style={styles.securityButton}
            onPress={() => router.push('/(app)/debug-logs')}
            activeOpacity={0.8}
          >
            <View style={styles.securityButtonLeft}>
              <ThemedText style={styles.securityIcon}>📋</ThemedText>
              <ThemedText style={styles.securityText}>Journal des requêtes</ThemedText>
            </View>
            <ThemedText style={styles.securityArrow}>→</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Bouton déconnexion */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.8}
        >
          <ThemedText style={styles.logoutIcon}>🚪</ThemedText>
          <ThemedText style={styles.logoutText}>Se déconnecter</ThemedText>
        </TouchableOpacity>

        {/* Footer */}
        <View style={styles.footer}>
          <ThemedText style={styles.footerText}>
            © 2026 CDV_IFVM · {formatVersionBuild(versionApp(), buildNatif())}
          </ThemedText>
          {/* Attribution obligatoire (licence CC BY 4.0) : zones administratives
              du géocodage inverse hors ligne, cf. src/lib/geo-administratif.ts */}
          <ThemedText style={styles.footerText}>Zones administratives : GeoNames.org (CC BY 4.0)</ThemedText>
        </View>
      </ScrollView>

      {/* Modal de changement de mot de passe */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>🔑 Changer le mot de passe</ThemedText>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <ThemedText style={styles.modalClose}>✕</ThemedText>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {/* Mot de passe actuel */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Mot de passe actuel</ThemedText>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Entrez votre mot de passe actuel"
                    placeholderTextColor="#999"
                    secureTextEntry={!showCurrentPassword}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                  >
                    <ThemedText style={styles.eyeIcon}>
                      {showCurrentPassword ? '👁️' : '👁️‍🗨️'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Nouveau mot de passe */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Nouveau mot de passe</ThemedText>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Entrez votre nouveau mot de passe"
                    placeholderTextColor="#999"
                    secureTextEntry={!showNewPassword}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                  >
                    <ThemedText style={styles.eyeIcon}>
                      {showNewPassword ? '👁️' : '👁️‍🗨️'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                <ThemedText style={styles.inputHint}>
                  Minimum 6 caractères
                </ThemedText>
              </View>

              {/* Confirmation mot de passe */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Confirmer le mot de passe</ThemedText>
                <View style={styles.passwordInputContainer}>
                  <TextInput
                    style={styles.input}
                    placeholder="Confirmez votre nouveau mot de passe"
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                  >
                    <ThemedText style={styles.eyeIcon}>
                      {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                    </ThemedText>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Boutons */}
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonCancel]}
                  onPress={() => {
                    setModalVisible(false);
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                >
                  <ThemedText style={styles.modalButtonCancelText}>Annuler</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonConfirm]}
                  onPress={handleChangePassword}
                  disabled={isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <ThemedText style={styles.modalButtonConfirmText}>Confirmer</ThemedText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ============================================
// COMPOSANTS ENFANTS
// ============================================

function InfoItem({ label, value }: { label: string; value: string }) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  return (
    <View style={styles.infoItem}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value || '—'}</ThemedText>
    </View>
  );
}

function PreferenceItem({ icon, label, hint, value, onToggle }: {
  icon: string;
  label: string;
  /** Seconde ligne, quand le libellé seul laisserait l'agent deviner. */
  hint?: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  return (
    <View style={styles.preferenceItem}>
      <View style={styles.preferenceLeft}>
        <ThemedText style={styles.preferenceIcon}>{icon}</ThemedText>
        <View style={styles.preferenceTextes}>
          <ThemedText style={styles.preferenceLabel}>{label}</ThemedText>
          {hint && <ThemedText style={styles.preferenceHint}>{hint}</ThemedText>}
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#D1D5DB', true: IFVM_GREEN }}
        thumbColor={value ? '#FFFFFF' : '#FFFFFF'}
        ios_backgroundColor="#D1D5DB"
      />
    </View>
  );
}

/**
 * Pendant de `PreferenceItem` pour un réglage à 3 valeurs plutôt que
 * booléen (#taille-police-par-utilisateur) — même en-tête icône/libellé,
 * un rang de chips à la place du `Switch`.
 */
function PreferenceChoice({ icon, label, value, onChange }: {
  icon: string;
  label: string;
  value: FontScaleLevel;
  onChange: (level: FontScaleLevel) => void;
}) {
  const { scale } = useFontScale();
  const typeSizes = useMemo(() => scaleTypeSizes(BASE_TYPE_SIZES, scale), [scale]);
  const styles = useMemo(() => createStyles(typeSizes), [typeSizes]);
  return (
    <View style={[styles.preferenceItem, styles.preferenceChoiceItem]}>
      <View style={styles.preferenceLeft}>
        <ThemedText style={styles.preferenceIcon}>{icon}</ThemedText>
        <ThemedText style={styles.preferenceLabel}>{label}</ThemedText>
      </View>
      <View style={styles.fontScaleChips}>
        {FONT_SCALE_LEVELS.map((option) => {
          const active = option.value === value;
          return (
            <TouchableOpacity
              key={option.value}
              onPress={() => onChange(option.value)}
              style={[styles.fontScaleChip, active && styles.fontScaleChipActive]}
              activeOpacity={0.8}
            >
              <ThemedText style={[styles.fontScaleChipText, active && styles.fontScaleChipTextActive]}>
                {option.label}
              </ThemedText>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ============================================
// STYLES
// ============================================

const BASE_TYPE_SIZES = {
  backIcon: 22,
  headerTitle: 18,
  headerSub: 12,
  avatarText: 44,
  cameraIcon: 16,
  userName: 22,
  userRole: 14,
  changePhotoText: 12,
  sectionTitle: 16,
  infoLabel: 13,
  infoValue: 13,
  securityIcon: 20,
  securityText: 14,
  securityArrow: 18,
  preferenceIcon: 18,
  preferenceLabel: 14,
  preferenceHint: 12,
  fontScaleChipText: 12,
  versionText: 12,
  logoutIcon: 20,
  logoutText: 16,
  footerText: 11,
  modalTitle: 18,
  modalClose: 24,
  inputLabel: 14,
  input: 14,
  eyeIcon: 20,
  inputHint: 11,
};

function createStyles(typeSizes: ReturnType<typeof scaleTypeSizes<typeof BASE_TYPE_SIZES>>) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: IFVM_BG_LIGHT,
    },
    container: {
      flex: 1,
      backgroundColor: IFVM_BG_LIGHT,
    },
    contentContainer: {
      paddingBottom: 40,
    },
    header: {
      backgroundColor: HEADER_BG,
      paddingHorizontal: 16,
      paddingBottom: 16,
      borderBottomLeftRadius: 24,
      borderBottomRightRadius: 24,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 12,
      elevation: 8,
    },
    safeArea: {
      backgroundColor: HEADER_BG,
    },
    headerContent: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: 8,
    },
    backBtn: {
      width: 32,
      height: 32,
      borderRadius: 8,
      backgroundColor: '#FFFFFF22',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      color: '#FFFFFF',
      fontSize: typeSizes.backIcon,
      fontWeight: '300',
      lineHeight: 26,
      marginTop: -2,
    },
    logo: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: 'rgba(255,255,255,0.15)',
      padding: 6,
      marginLeft: 10,
    },
    headerTextContainer: {
      flex: 1,
      marginLeft: 12,
    },
    headerTitle: {
      color: '#FFFFFF',
      fontSize: typeSizes.headerTitle,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    headerSub: {
      color: 'rgba(255,255,255,0.8)',
      fontSize: typeSizes.headerSub,
      marginTop: 1,
    },
    avatarSection: {
      alignItems: 'center',
      paddingTop: 20,
      paddingBottom: 16,
    },
    avatarTouchable: {
      position: 'relative',
    },
    avatarContainer: {
      width: 120,
      height: 120,
      borderRadius: 60,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 4,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 6,
      position: 'relative',
    },
    avatarImage: {
      width: 112,
      height: 112,
      borderRadius: 56,
    },
    avatarText: {
      fontSize: typeSizes.avatarText,
      fontWeight: '700',
    },
    cameraIconContainer: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: IFVM_GREEN,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: '#FFFFFF',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 10,
    },
    cameraIcon: {
      fontSize: typeSizes.cameraIcon,
      color: '#FFFFFF',
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: 60,
      backgroundColor: 'rgba(0,0,0,0.5)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    userName: {
      fontSize: typeSizes.userName,
      fontWeight: '700',
      color: '#1A237E',
      marginTop: 12,
    },
    userRole: {
      fontSize: typeSizes.userRole,
      color: '#757575',
      marginTop: 2,
    },
    changePhotoButton: {
      marginTop: 8,
      paddingHorizontal: 16,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: IFVM_GREEN_BG,
    },
    changePhotoText: {
      fontSize: typeSizes.changePhotoText,
      color: IFVM_GREEN,
      fontWeight: '500',
    },
    infoSection: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: typeSizes.sectionTitle,
      fontWeight: '600',
      color: '#1A237E',
      marginBottom: 10,
    },
    infoCard: {
      backgroundColor: CARD_BG,
      borderRadius: 14,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    infoItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    infoLabel: {
      fontSize: typeSizes.infoLabel,
      color: '#757575',
    },
    infoValue: {
      fontSize: typeSizes.infoValue,
      color: '#1A237E',
      fontWeight: '500',
    },
    securityButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      backgroundColor: CARD_BG,
      borderRadius: 14,
      padding: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    securityButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    securityIcon: {
      fontSize: typeSizes.securityIcon,
      marginRight: 12,
    },
    securityText: {
      fontSize: typeSizes.securityText,
      color: '#1A237E',
      fontWeight: '500',
    },
    securityArrow: {
      fontSize: typeSizes.securityArrow,
      color: '#9E9E9E',
    },
    preferencesSection: {
      paddingHorizontal: 16,
      marginBottom: 16,
    },
    preferencesCard: {
      backgroundColor: CARD_BG,
      borderRadius: 14,
      padding: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    preferenceItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    preferenceLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      // Sans borne, un libellé sur deux lignes pousse le Switch hors de l'écran.
      flex: 1,
      paddingRight: 12,
    },
    preferenceIcon: {
      fontSize: typeSizes.preferenceIcon,
    },
    preferenceTextes: {
      flex: 1,
    },
    preferenceLabel: {
      fontSize: typeSizes.preferenceLabel,
      color: '#1A237E',
      fontWeight: '500',
    },
    // Jeton `foreground-tertiary` de DESIGN.md ; le reste de ce fichier porte des
    // hex ad hoc antérieurs, ne pas les recopier.
    preferenceHint: {
      fontSize: typeSizes.preferenceHint,
      color: '#6f6a59',
      marginTop: 2,
    },
    preferenceChoiceItem: {
      flexWrap: 'wrap',
      rowGap: 8,
    },
    fontScaleChips: {
      flexDirection: 'row',
      gap: 6,
    },
    fontScaleChip: {
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: 20,
      backgroundColor: '#F0F2F5',
    },
    fontScaleChipActive: {
      backgroundColor: IFVM_GREEN,
    },
    fontScaleChipText: {
      fontSize: typeSizes.fontScaleChipText,
      fontWeight: '600',
      color: '#6f6a59',
    },
    fontScaleChipTextActive: {
      color: '#FFFFFF',
    },
    versionContainer: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    versionText: {
      fontSize: typeSizes.versionText,
      color: '#BDBDBD',
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: CARD_BG,
      marginHorizontal: 16,
      marginTop: 16,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: '#FCE4EC',
      gap: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
      elevation: 3,
    },
    logoutIcon: {
      fontSize: typeSizes.logoutIcon,
    },
    logoutText: {
      fontSize: typeSizes.logoutText,
      fontWeight: '600',
      color: IFVM_RED,
    },
    footer: {
      alignItems: 'center',
      paddingTop: 20,
    },
    footerText: {
      fontSize: typeSizes.footerText,
      color: '#BDBDBD',
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContainer: {
      backgroundColor: '#FFFFFF',
      borderRadius: 20,
      width: '90%',
      maxWidth: 400,
      maxHeight: '80%',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 12,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: '#F0F0F0',
    },
    modalTitle: {
      fontSize: typeSizes.modalTitle,
      fontWeight: '700',
      color: '#1A237E',
    },
    modalClose: {
      fontSize: typeSizes.modalClose,
      color: '#757575',
      padding: 4,
    },
    modalBody: {
      padding: 20,
    },
    inputContainer: {
      marginBottom: 16,
    },
    inputLabel: {
      fontSize: typeSizes.inputLabel,
      fontWeight: '500',
      color: '#1A237E',
      marginBottom: 6,
    },
    input: {
      flex: 1,
      paddingVertical: 12,
      paddingHorizontal: 14,
      fontSize: typeSizes.input,
      color: '#1A237E',
    },
    passwordInputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#F5F5F5',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    eyeButton: {
      padding: 12,
    },
    eyeIcon: {
      fontSize: typeSizes.eyeIcon,
    },
    inputHint: {
      fontSize: typeSizes.inputHint,
      color: '#9E9E9E',
      marginTop: 4,
    },
    modalButtons: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
      marginTop: 8,
    },
    modalButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 12,
      alignItems: 'center',
    },
    modalButtonCancel: {
      backgroundColor: '#F5F5F5',
      borderWidth: 1,
      borderColor: '#E0E0E0',
    },
    modalButtonCancelText: {
      color: '#757575',
      fontWeight: '600',
    },
    modalButtonConfirm: {
      backgroundColor: IFVM_GREEN,
    },
    modalButtonConfirmText: {
      color: '#FFFFFF',
      fontWeight: '600',
    },
  });
}

/**
 * Frontière de rendu de cette route — ADR-012 décision 5 (#172). `expo-router`
 * enveloppe la route dans un `<Try>` : la pile de navigation survit au crash.
 */
export { RouteErrorBoundary as ErrorBoundary } from '@/components/error-boundary';
