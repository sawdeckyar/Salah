import { StyleSheet, Text, View } from 'react-native';
import type { MosqueTimes } from '@salah/core';
import { useTheme } from '../theme';

/**
 * Surfaces how trustworthy a mosque's community times are, so users know whether
 * to rely on them (see docs/DATA_INGESTION.md trust ladder).
 */
export function TrustBadge({ times }: { times?: MosqueTimes }) {
  const theme = useTheme();
  if (!times) return null;

  let label: string;
  let color: string;
  if (times.verified) {
    label = 'Mosque-verified';
    color = theme.success;
  } else if ((times.confirmations ?? 0) > 0) {
    label = `Crowd-confirmed (${times.confirmations})`;
    color = theme.primary;
  } else {
    label = 'Unverified';
    color = theme.warning;
  }

  return (
    <View style={[styles.badge, { backgroundColor: color + '22' }]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    gap: 5,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  text: { fontSize: 12, fontWeight: '700' },
});
