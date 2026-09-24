import { Modal, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { EquipeBadge } from '@/components/equipe/EquipeBadge';
import { EQ } from '@/components/equipe/tokens';
import { AppIcon, type AppIconName } from '@/components/ui/AppIcon';

export interface MenuEntree {
  cle: string;
  libelle: string;
  icone: AppIconName;
  onPress: () => void;
  /** Entrée mise en avant (fond vert doux, pastille verte) — la page courante dans la maquette. */
  active?: boolean;
}

interface Props {
  visible: boolean;
  onFermer: () => void;
  nom: string;
  email?: string | null;
  role?: string | null;
  navigation: MenuEntree[];
  compte: MenuEntree[];
  onDeconnexion: () => void;
}

function Entree({ entree }: { entree: MenuEntree }) {
  return (
    <TouchableOpacity
      style={[styles.entree, entree.active && styles.entreeActive]}
      onPress={entree.onPress}
      accessibilityRole="button"
      testID={`menu-entree-${entree.cle}`}
    >
      <View style={[styles.entreeIcone, entree.active && styles.entreeIconeActive]}>
        <AppIcon name={entree.icone} size={24} color={entree.active ? EQ.surMarque : EQ.vert} />
      </View>
      <ThemedText style={styles.entreeLibelle}>{entree.libelle}</ThemedText>
      <ThemedText style={styles.chevron}>›</ThemedText>
    </TouchableOpacity>
  );
}

/**
 * Tiroir de menu de l'Accueil (Figma « Tiroir menu ») : identité de l'agent, navigation, compte
 * et déconnexion. Panneau de 252 px à gauche, le reste de l'écran (voile) le referme.
 */
export function MenuDrawer({ visible, onFermer, nom, email, role, navigation, compte, onDeconnexion }: Props) {
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onFermer}>
      <View style={styles.racine} testID="menu-tiroir">
        <View style={styles.panneau}>
          <SafeAreaView edges={['top', 'bottom']} style={styles.securite}>
            <View style={styles.identite}>
              <View style={styles.avatar}>
                <ThemedText style={styles.avatarLettre}>{nom.trim().charAt(0).toUpperCase() || '?'}</ThemedText>
              </View>
              <View style={styles.identiteTexte}>
                <ThemedText style={styles.nom} numberOfLines={1}>
                  {nom}
                </ThemedText>
                {email ? (
                  <ThemedText style={styles.email} numberOfLines={1}>
                    {email}
                  </ThemedText>
                ) : null}
                {role ? <EquipeBadge texte={role} /> : null}
              </View>
              <TouchableOpacity
                style={styles.fermer}
                onPress={onFermer}
                accessibilityRole="button"
                accessibilityLabel="Fermer le menu"
                testID="menu-fermer"
              >
                <AppIcon name="fermer" size={24} color={EQ.surMarque} />
              </TouchableOpacity>
            </View>

            <ThemedText style={styles.section}>NAVIGATION</ThemedText>
            {navigation.map((e) => (
              <Entree key={e.cle} entree={e} />
            ))}

            <View style={styles.separateur} />

            <ThemedText style={styles.section}>COMPTE</ThemedText>
            {compte.map((e) => (
              <Entree key={e.cle} entree={e} />
            ))}

            <View style={styles.pied}>
              <TouchableOpacity
                style={styles.deconnexion}
                onPress={onDeconnexion}
                accessibilityRole="button"
                testID="menu-deconnexion"
              >
                <ThemedText style={styles.deconnexionTexte}>Se déconnecter</ThemedText>
              </TouchableOpacity>
              <ThemedText style={styles.version}>IFVM Veille · v1.0.0</ThemedText>
            </View>
          </SafeAreaView>
        </View>
        <TouchableOpacity style={styles.voile} activeOpacity={1} onPress={onFermer} accessibilityLabel="Fermer le menu" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  racine: { flex: 1, flexDirection: 'row' },
  voile: { flex: 1, backgroundColor: 'rgba(22,32,26,0.45)' },
  panneau: {
    width: '82%',
    maxWidth: 360,
    backgroundColor: EQ.fond,
    borderTopRightRadius: 22,
    borderBottomRightRadius: 22,
    overflow: 'hidden',
  },
  securite: { flex: 1 },
  identite: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: EQ.vert,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 16,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: EQ.vertDoux,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLettre: { fontSize: 20, fontWeight: '700', color: EQ.vert },
  identiteTexte: { flex: 1, gap: 4 },
  nom: { fontSize: 16, fontWeight: '800', color: EQ.surMarque },
  email: { fontSize: 10.5, color: EQ.surMarque, opacity: 0.8 },
  fermer: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: EQ.attenue,
  },
  entree: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    marginHorizontal: 10,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 12,
    gap: 12,
    marginBottom: 4,
  },
  entreeActive: { backgroundColor: EQ.vertDoux },
  entreeIcone: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#F6F3E9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entreeIconeActive: { backgroundColor: EQ.vert },
  entreeLibelle: { flex: 1, fontSize: 12, fontWeight: '600', color: EQ.encre },
  chevron: { fontSize: 15, fontWeight: '700', color: EQ.etiquette },
  separateur: { height: 1, backgroundColor: EQ.bordure, marginHorizontal: 16, marginVertical: 10 },
  pied: { marginTop: 'auto', paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  deconnexion: {
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#D32F2F',
    backgroundColor: EQ.carte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deconnexionTexte: { fontSize: 12, fontWeight: '600', color: '#D32F2F' },
  version: { textAlign: 'center', fontSize: 9, fontWeight: '500', color: EQ.etiquette },
});
