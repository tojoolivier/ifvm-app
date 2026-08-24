import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error-boundary';
import { useFonts } from 'expo-font';
import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
} from '@expo-google-fonts/archivo';
import {
  IBMPlexMono_500Medium,
  IBMPlexMono_600SemiBold,
  IBMPlexMono_700Bold,
} from '@expo-google-fonts/ibm-plex-mono';
import { traitementColors } from '@/components/traitement/tokens';

/**
 * Ce module possède ses propres polices (Archivo + IBM Plex Mono), chargées
 * ici plutôt que dans le _layout.tsx racine : les autres écrans (prospection,
 * auth) ne les utilisent pas, pas de raison de les charger globalement.
 */
export default function TraitementParcoursLayout() {
  const [fontsLoaded] = useFonts({
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    IBMPlexMono_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: traitementColors.fondApp }}>
        <ActivityIndicator size="large" color={traitementColors.vertPrincipal} />
      </View>
    );
  }

  return (
    <RouteErrorBoundary zone="traitement">
      <Stack screenOptions={{ headerShown: false }} />
    </RouteErrorBoundary>
  );
}
