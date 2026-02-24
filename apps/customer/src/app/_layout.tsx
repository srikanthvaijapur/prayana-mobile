import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';
import { AuthProvider, useAuth } from '@prayana/shared-hooks';
import { setBaseURL } from '@prayana/shared-services';
import { ThemeProvider, useTheme } from '@prayana/shared-ui';
import { setImageServerOrigin } from '@prayana/shared-utils';

// Set API URL immediately at module load time (before any component renders)
const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://172.20.10.3:5000/api';
setBaseURL(API_URL);
// Set image server origin for resolving relative proxy URLs in React Native
// Strip "/api" suffix to get the server origin (e.g. "http://192.168.31.185:5000")
setImageServerOrigin(API_URL.replace(/\/api\/?$/, ''));
console.log('[App] API URL set to:', API_URL);

function AuthGuard() {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  return null;
}

function RootNavigator() {
  const { isDarkMode } = useTheme();

  return (
    <>
      <AuthGuard />
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="bookings" />
        <Stack.Screen name="search" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="chat" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
        <Stack.Screen name="destination" />
        <Stack.Screen name="place" />
        <Stack.Screen name="place-detail" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="esim/index" />
      </Stack>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <SafeAreaProvider>
            <RootNavigator />
          </SafeAreaProvider>
        </GestureHandlerRootView>
      </AuthProvider>
    </ThemeProvider>
  );
}
