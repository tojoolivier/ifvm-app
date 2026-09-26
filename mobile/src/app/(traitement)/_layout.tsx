import { Stack } from 'expo-router';

/** Les polices sont chargées une fois pour toute l'app (`lib/fonts.ts`, `app/_layout.tsx`). */
export default function TraitementParcoursLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
