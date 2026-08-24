import { Stack } from 'expo-router';
import { RouteErrorBoundary } from '@/components/error-boundary';

export default function AuthLayout() {
  return (
    <RouteErrorBoundary zone="auth">
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
      </Stack>
    </RouteErrorBoundary>
  );
}
