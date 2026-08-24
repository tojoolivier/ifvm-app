import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error-boundary';

export default function ProspectionParcoursLayout() {
  return (
    <RouteErrorBoundary zone="prospection">
      <Stack screenOptions={{ headerShown: false }} />
    </RouteErrorBoundary>
  );
}
