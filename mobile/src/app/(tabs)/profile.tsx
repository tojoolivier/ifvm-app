import { View, TouchableOpacity, ScrollView, StyleSheet, Image, Switch, SafeAreaView, Alert, ActivityIndicator, TextInput, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/lib/auth-store';
import { ThemedText } from '@/components/themed-text';
import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { storage } from '@/lib/storage';
import { apiClient } from '@/lib/api-client';

const IFVM_GREEN = '#1B5E1B';
const IFVM_GREEN_BG = '#E8F5E9';
const IFVM_BG_LIGHT = '#F0F2F5';
const CARD_BG = '#FFFFFF';
const IFVM_RED = '#E74C3C';
const IFVM_BLUE = '#2196F3';
const IFVM_ORANGE = '#E67E22';
const HEADER_BG = '#1B5E1B';

const PROFILE_IMAGE_KEY = '@profile_image';

export default function ProfileScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const token = useAuthStore((s) => s.token);
  
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [locationEnabled, setLocationEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // État pour la modification du mot de passe
  const [modalVisible, setModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const loadProfileImage = async () => {
    try {
      const image = await storage.getItem(PROFILE_IMAGE_KEY);
      if (image) {
        setProfileImage(image);
      }
    } catch (error) {
      console.error('Erreur chargement image:', error);
    }
  };

  // Charger l'image de profil au montage
  useEffect(() => {
    const id = setTimeout(() => loadProfileImage(), 0);
    return () => clearTimeout(id);
  }, []);

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

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
      console.error('Erreur récupération répertoire:', error);
      return '';
    }
  };

  // Demander les permissions et ouvrir la caméra
  const takePhoto = async () => {
    try {
      console.log('📷 Tentative d\'ouverture de la caméra...');
      
      // Demander la permission caméra
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Statut permission caméra:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée', 
          'Vous devez autoriser l\'accès à la caméra pour prendre une photo.'
        );
        return;
      }

      // Ouvrir la caméra
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('📷 Résultat caméra:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await saveProfileImage(result.assets[0].uri);
      } else {
        console.log('📷 Prise de photo annulée');
      }
    } catch (error) {
      console.error('📷 Erreur prise de photo:', error);
      Alert.alert('Erreur', 'Impossible de prendre la photo: ' + (error as Error).message);
    }
  };

  // Demander les permissions et ouvrir la galerie
  const pickImage = async () => {
    try {
      console.log('🖼️ Tentative d\'ouverture de la galerie...');
      
      // Demander la permission galerie
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('🖼️ Statut permission galerie:', status);
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission refusée', 
          'Vous devez autoriser l\'accès à la galerie pour choisir une photo.'
        );
        return;
      }

      // Ouvrir la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      console.log('🖼️ Résultat galerie:', result);

      if (!result.canceled && result.assets && result.assets.length > 0) {
        await saveProfileImage(result.assets[0].uri);
      } else {
        console.log('🖼️ Sélection annulée');
      }
    } catch (error) {
      console.error('🖼️ Erreur sélection image:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner l\'image: ' + (error as Error).message);
    }
  };

  const saveProfileImage = async (uri: string) => {
    setIsLoading(true);
    try {
      console.log('💾 Sauvegarde de l\'image:', uri);
      
      const docDir = getDocumentDirectory();
      let fileUri = uri;

      // Si nous sommes sur mobile et que le répertoire est disponible
      if (docDir) {
        const fileName = `profile_${user?.id || 'user'}_${Date.now()}.jpg`;
        fileUri = docDir + fileName;
        
        console.log('💾 Copie vers:', fileUri);
        
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
    } catch (error) {
      console.error('💾 Erreur sauvegarde image:', error);
      Alert.alert('Erreur', 'Impossible de sauvegarder l\'image');
    } finally {
      setIsLoading(false);
    }
  };

  const removeProfileImage = async () => {
    Alert.alert(
      'Supprimer la photo',
      'Voulez-vous vraiment supprimer votre photo de profil ?',
      [
        { text: 'Annuler', style: 'cancel' as const },
        {
          text: 'Supprimer',
          style: 'destructive' as const,
          onPress: async () => {
            try {
              const docDir = getDocumentDirectory();
              if (profileImage && docDir) {
                await FileSystem.deleteAsync(profileImage, { idempotent: true });
              }
              await storage.deleteItem(PROFILE_IMAGE_KEY);
              setProfileImage(null);
              Alert.alert('Succès', 'Photo de profil supprimée');
            } catch (error) {
              console.error('Erreur suppression image:', error);
              Alert.alert('Erreur', 'Impossible de supprimer l\'image');
            }
          }
        }
      ]
    );
  };

  // Fonction principale pour ouvrir le sélecteur
  const showImagePickerOptions = () => {
    console.log('🔘 Ouverture du menu photo de profil');
    Alert.alert(
      'Photo de profil',
      'Choisissez une option',
      [
        { 
          text: '📷 Prendre une photo', 
          onPress: () => {
            console.log('📷 Option: Prendre une photo');
            takePhoto();
          }
        },
        { 
          text: '🖼️ Choisir dans la galerie', 
          onPress: () => {
            console.log('🖼️ Option: Choisir dans la galerie');
            pickImage();
          }
        },
        ...(profileImage ? [{ 
          text: '🗑️ Supprimer la photo', 
          style: 'destructive' as const, 
          onPress: () => {
            console.log('🗑️ Option: Supprimer la photo');
            removeProfileImage();
          }
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
    } catch (error: any) {
      console.error('Erreur changement mot de passe:', error);
      Alert.alert(
        'Erreur',
        error?.message || 'Impossible de modifier le mot de passe. Vérifiez votre mot de passe actuel.'
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
            <View style={{ width: 40 }} />
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

        {/* Préférences */}
        <View style={styles.preferencesSection}>
          <ThemedText style={styles.sectionTitle}>⚙️ Préférences</ThemedText>
          <View style={styles.preferencesCard}>
            <PreferenceItem
              icon="🔔"
              label="Notifications"
              value={notificationsEnabled}
              onToggle={setNotificationsEnabled}
            />
            <PreferenceItem
              icon="📍"
              label="Localisation"
              value={locationEnabled}
              onToggle={setLocationEnabled}
            />
            <PreferenceItem
              icon="🌙"
              label="Mode sombre"
              value={darkMode}
              onToggle={setDarkMode}
            />
          </View>
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
            © 2026 CDV_IFVM - Application Mobile V_1.0.0
          </ThemedText>
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
  return (
    <View style={styles.infoItem}>
      <ThemedText style={styles.infoLabel}>{label}</ThemedText>
      <ThemedText style={styles.infoValue}>{value || '—'}</ThemedText>
    </View>
  );
}

function PreferenceItem({ icon, label, value, onToggle }: { 
  icon: string; 
  label: string; 
  value: boolean; 
  onToggle: (val: boolean) => void;
}) {
  return (
    <View style={styles.preferenceItem}>
      <View style={styles.preferenceLeft}>
        <ThemedText style={styles.preferenceIcon}>{icon}</ThemedText>
        <ThemedText style={styles.preferenceLabel}>{label}</ThemedText>
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

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
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
  logo: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    padding: 6,
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
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
    fontSize: 44,
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
    fontSize: 16,
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
    fontSize: 22,
    fontWeight: '700',
    color: '#1A237E',
    marginTop: 12,
  },
  userRole: {
    fontSize: 14,
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
    fontSize: 12,
    color: IFVM_GREEN,
    fontWeight: '500',
  },
  infoSection: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
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
    fontSize: 13,
    color: '#757575',
  },
  infoValue: {
    fontSize: 13,
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
    fontSize: 20,
    marginRight: 12,
  },
  securityText: {
    fontSize: 14,
    color: '#1A237E',
    fontWeight: '500',
  },
  securityArrow: {
    fontSize: 18,
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
  },
  preferenceIcon: {
    fontSize: 18,
  },
  preferenceLabel: {
    fontSize: 14,
    color: '#1A237E',
    fontWeight: '500',
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  versionText: {
    fontSize: 12,
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
    fontSize: 20,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: IFVM_RED,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 11,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#1A237E',
  },
  modalClose: {
    fontSize: 24,
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
    fontSize: 14,
    fontWeight: '500',
    color: '#1A237E',
    marginBottom: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
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
    fontSize: 20,
  },
  inputHint: {
    fontSize: 11,
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