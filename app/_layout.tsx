import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

export const unstable_settings = {
  initialRouteName: 'login',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inAuthScreens = ['login', 'email-login'].includes(segments[0] as string);
    const inOnboardingFlow = ['interests', 'onboarding'].includes(segments[0] as string);

    // Only redirect to login if user is not authenticated AND trying to access protected content
    if (!user && inAuthGroup) {
      router.replace('/login');
    }
    
    // Don't interfere with navigation if:
    // - User is in auth screens (login, email-login)
    // - User is in onboarding flow (interests, onboarding)
    // - User is authenticated and in main app
  }, [user, loading, segments]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="email-login" options={{ headerShown: false }} />
        <Stack.Screen 
          name="interests" 
          options={{ 
            headerShown: false,
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="onboarding" 
          options={{ 
            headerShown: false,
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen 
          name="edit-interests" 
          options={{ 
            headerShown: false,
            presentation: 'modal',
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            gestureEnabled: false,
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
