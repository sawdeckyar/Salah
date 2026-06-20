import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useColorScheme } from 'react-native';

export default function RootLayout() {
  const scheme = useColorScheme();
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
      </Stack>
    </SafeAreaProvider>
  );
}
