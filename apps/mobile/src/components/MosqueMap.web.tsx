import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import type { Coordinates, Mosque } from '@salah/core';
import { useTheme } from '../theme';

/**
 * Web fallback for the map. `react-native-webview` (used in the native map) does
 * not support web, so on web we skip it and show a short note — the mosque list
 * still works. Metro picks this file over `MosqueMap.tsx` on web.
 */
export function MosqueMap(_props: {
  center: Coordinates;
  mosques: Mosque[];
  onSelect?: (id: string) => void;
  height?: number;
  style?: ViewStyle;
  interactive?: boolean;
}) {
  const theme = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        _props.height != null ? { height: _props.height } : { flex: 1 },
        { borderColor: theme.border, backgroundColor: theme.surface2 },
        _props.style,
      ]}
    >
      <Text style={[styles.title, { color: theme.text2 }]}>🗺️ Map view</Text>
      <Text style={[styles.note, { color: theme.text3 }]}>
        The interactive map runs on the mobile app. The nearby mosque list is
        fully functional here on the web.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  title: { fontSize: 16, fontWeight: '700' },
  note: { fontSize: 13, textAlign: 'center', lineHeight: 19, maxWidth: 420 },
});
