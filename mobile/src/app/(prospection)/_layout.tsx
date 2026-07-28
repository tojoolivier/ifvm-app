import { Stack } from 'expo-router';

export default function ProspectionParcoursLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="reference" />
      <Stack.Screen name="especes" />
      <Stack.Screen name="plan" />
      <Stack.Screen name="captures" />
      <Stack.Screen name="densites" />
      <Stack.Screen name="reproduction" />
      <Stack.Screen name="infestation" />
      <Stack.Screen name="infestation-comportement" />
      <Stack.Screen name="essaim" />
      <Stack.Screen name="vegetation" />
      <Stack.Screen name="recapitulatif" />
      <Stack.Screen name="fiche-lecture" />
    </Stack>
  );
}