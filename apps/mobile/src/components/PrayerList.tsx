import { StyleSheet, Text, View } from 'react-native';
import {
  DAILY_PRAYERS,
  type IqamaPrayer,
  type Prayer,
} from '@salah/core';
import { useTheme } from '../theme';
import { formatHHmm, formatTime, prayerLabel } from '../format';

interface PrayerListProps {
  /** Astronomical (adhan) times for the day. */
  times: Record<Prayer, Date>;
  /** Optional mosque iqama times to show alongside. */
  iqama?: Partial<Record<IqamaPrayer, string>>;
  /** Prayer to emphasize (e.g. the next one). */
  highlight?: Prayer;
}

export function PrayerList({ times, iqama, highlight }: PrayerListProps) {
  const theme = useTheme();
  const showIqama = !!iqama;

  return (
    <View>
      <View style={styles.row}>
        <Text style={[styles.head, { color: theme.text3, flex: 1 }]}>Prayer</Text>
        <Text style={[styles.head, { color: theme.text3, width: 90, textAlign: 'right' }]}>
          Adhan
        </Text>
        {showIqama ? (
          <Text style={[styles.head, { color: theme.text3, width: 90, textAlign: 'right' }]}>
            Iqama
          </Text>
        ) : null}
      </View>

      {DAILY_PRAYERS.map((p) => {
        const active = p === highlight;
        const iqamaVal = p !== 'sunrise' ? iqama?.[p as IqamaPrayer] : undefined;
        return (
          <View
            key={p}
            style={[
              styles.row,
              styles.dataRow,
              { borderTopColor: theme.border },
              active && { backgroundColor: theme.primaryMuted, borderRadius: 10 },
            ]}
          >
            <Text
              style={[
                styles.name,
                { color: active ? theme.primary : theme.text, flex: 1 },
                active && { fontWeight: '800' },
              ]}
            >
              {prayerLabel(p)}
              {p === 'sunrise' ? '  ·  end of Fajr' : ''}
            </Text>
            <Text
              style={[
                styles.time,
                { color: active ? theme.primary : theme.text2, width: 90 },
              ]}
            >
              {formatTime(times[p])}
            </Text>
            {showIqama ? (
              <Text style={[styles.time, { color: theme.text, width: 90, fontWeight: '700' }]}>
                {iqamaVal ? formatHHmm(iqamaVal) : '—'}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 6 },
  dataRow: {
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  name: { fontSize: 16 },
  time: { fontSize: 16, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
