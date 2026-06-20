import { StyleSheet, Text, View } from 'react-native';
import type { Coordinates, Mosque } from '@salah/core';
import { useTheme } from '../theme';

/**
 * Web fallback for the map. `react-native-webview` (used in the native map) does
 * not support web, so on web we skip it and show a short note — the mosque list
 * below still works. Metro picks this file over `MosqueMap.tsx` on web.
 */
export function MosqueMap(_props: {
  center: Coordinates;
  mosques: Mosque[];
  onSelect?: (id: string) => void;
  height?: number;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        { borderColor: theme.border, backgroundColor: theme.surface2 },
      ]}
    >
      <Text style={[styles.title, { color: theme.text2 }]}>🗺️ Map view</Text>
      <Text style={[styles.note, { color: theme.text3 }]}>
        The interactive map runs on the mobile app. The nearby mosque list below
        is fully functional here on the web.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 28,
    paddingHorizontal: 16,
    marginBottom: 14,
    alignItems: 'center',
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 420 },
});
