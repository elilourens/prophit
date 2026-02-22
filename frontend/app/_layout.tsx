// Polyfill for Solana crypto - MUST be first import
import 'react-native-get-random-values';

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { theme } from '../components/theme';
import { ProProvider } from '../contexts/ProContext';
import { ArenaProvider, useArena } from '../contexts/ArenaContext';
import { SolanaProvider } from '../contexts/SolanaContext';
import { UserDataProvider } from '../contexts/UserDataContext';

function AuthGate({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useArena();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthScreen = segments[0] === 'login';

    if (!isAuthenticated && !inAuthScreen) {
      router.replace('/login');
    } else if (isAuthenticated && inAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color={theme.colors.hotCoral} />
      </View>
    );
  }

  return <>{children}</>;
}

/**
 * Root Layout for Prophit App
 *
 * Sets up the navigation stack with:
 * - Global auth gate - must sign in to use app
 * - Tab navigation as the main screen
 * - Pro subscription context for premium features
 * - Arena context for social betting features
 */
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ProProvider>
        <ArenaProvider>
          <UserDataProvider>
            <SolanaProvider>
              <AuthGate>
                <StatusBar style="dark" />
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: {
                      backgroundColor: theme.colors.background,
                    },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen
                    name="login"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="(tabs)"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="onboarding"
                    options={{
                      headerShown: false,
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="chat"
                    options={{
                      headerShown: false,
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="upgrade"
                    options={{
                      headerShown: false,
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="arena-onboarding"
                    options={{
                      headerShown: false,
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="arena-create"
                    options={{
                      headerShown: false,
                      presentation: 'card',
                      animation: 'slide_from_right',
                    }}
                  />
                  <Stack.Screen
                    name="arena-join"
                    options={{
                      headerShown: false,
                      presentation: 'card',
                      animation: 'slide_from_right',
                    }}
                  />
                  <Stack.Screen
                    name="arena-detail"
                    options={{
                      headerShown: false,
                      presentation: 'card',
                      animation: 'slide_from_right',
                    }}
                  />
                  <Stack.Screen
                    name="arena-results"
                    options={{
                      headerShown: false,
                      presentation: 'card',
                      animation: 'slide_from_right',
                    }}
                  />
                </Stack>
              </AuthGate>
            </SolanaProvider>
          </UserDataProvider>
        </ArenaProvider>
      </ProProvider>
    </SafeAreaProvider>
  );
}
