import { StyleSheet, Text, View } from 'react-native';
import type { PrayerStatus } from '@salah/core';
import { useTheme } from '../theme';
import { formatCountdown, formatTime, prayerLabel } from '../format';

export function NextPrayerBanner({ status }: { status: PrayerStatus }) {
  const theme = useTheme();
  const next = status.next === 'none' ? null : status.next;

  return (
    <View style={[styles.banner, { backgroundColor: theme.primary }]}>
      <Text style={styles.label}>NEXT PRAYER</Text>
      <Text style={styles.prayer}>{next ? prayerLabel(next) : '—'}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.meta}>
          {status.nextTime ? formatTime(status.nextTime) : ''}
        </Text>
        <Text style={styles.dot}>•</Text>
        <Text style={styles.meta}>in {formatCountdown(status.minutesToNext)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { borderRadius: 18, padding: 20, marginBottom: 14 },
  label: {
    color: '#ffffffcc',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
  },
  prayer: { color: '#fff', fontSize: 40, fontWeight: '800', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  meta: { color: '#ffffffe6', fontSize: 16, fontWeight: '600' },
  dot: { color: '#ffffff99' },
});
