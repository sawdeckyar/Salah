import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';
import { ensureAuth } from '../src/lib/supabase';
import { loadLocalTimes } from '../src/data/localSubmissions';
import { loadParking } from '../src/data/parkingStore';
import { loadCommunity } from '../src/data/community';

export default function RootLayout() {
  const scheme = useColorScheme();

  useEffect(() => {
    // Establish an anonymous session first so backend writes are authorized.
    ensureAuth().finally(() => {
      loadLocalTimes();
      loadParking();
      loadCommunity();
    });
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: scheme === 'dark' ? '#0C1411' : '#F6F7F5' },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="mosque/[id]"
          options={{ headerShown: true, title: 'Mosque', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="mosque/parking"
          options={{ headerShown: true, title: 'Parking', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="submit"
          options={{ presentation: 'modal', headerShown: true, title: 'Submit times' }}
        />
        <Stack.Screen
          name="community-new"
          options={{ presentation: 'modal', headerShown: true, title: 'Add to community' }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
