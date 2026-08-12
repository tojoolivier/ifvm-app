import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { traitementColors, traitementFonts, traitementTypeSizes } from './tokens';

const TOAST_DURATION_MS = 1900;

/** Affiche un toast bas d'écran ~1.9s puis se referme seul, sans état porté par l'appelant. */
export function useTraitementToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(null), TOAST_DURATION_MS);
    return () => clearTimeout(timeout);
  }, [message]);

  return { message, show: setMessage };
}

interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <View style={styles.toast} pointerEvents="none">
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    backgroundColor: traitementColors.vertPrincipal,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  text: {
    fontFamily: traitementFonts.uiSemiBold,
    fontSize: traitementTypeSizes.corps,
    color: '#fff',
    textAlign: 'center',
  },
});
