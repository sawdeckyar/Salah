import { StyleSheet, Text, View } from 'react-native';
import type { MusafirInfo } from '@salah/core';
import { useTheme } from '../theme';
import { formatTimeAt } from '../lib/tz';

/**
 * Informational traveller (musāfir) panel: qaṣr (shortened) prayers and the
 * jam‘ (combine) windows. Guidance only — rulings vary; not a fatwa.
 */
export function MusafirPanel({
  info,
  tz,
}: {
  info: MusafirInfo;
  tz?: string | null;
}) {
  const theme = useTheme();
  const fmt = (d?: Date) => (d ? formatTimeAt(d, tz ?? null) : '—');

  return (
    <View>
      <Text style={[styles.line, { color: theme.text2 }]}>
        Travellers may <Text style={{ fontWeight: '800' }}>shorten</Text> Dhuhr,
        Asr & Isha to 2 rak‘ah (qaṣr), and may{' '}
        <Text style={{ fontWeight: '800' }}>combine</Text> these pairs:
      </Text>

      <View style={[styles.window, { borderColor: theme.border }]}>
        <Text style={[styles.pair, { color: theme.text }]}>Dhuhr + Asr</Text>
        <Text style={[styles.range, { color: theme.text2 }]}>
          {fmt(info.dhuhrAsr.start)} – {fmt(info.dhuhrAsr.end)}
        </Text>
      </View>
      <View style={[styles.window, { borderColor: theme.border }]}>
        <Text style={[styles.pair, { color: theme.text }]}>Maghrib + Isha</Text>
        <Text style={[styles.range, { color: theme.text2 }]}>
          {fmt(info.maghribIsha.start)}
          {info.maghribIsha.end ? ` – ${fmt(info.maghribIsha.end)}` : ' onward'}
        </Text>
      </View>

      <Text style={[styles.note, { color: theme.text3 }]}>
        Guidance for journeys (commonly ~77 km / 48 mi from home). Rulings vary by
        madhab and situation.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  line: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  window: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pair: { fontSize: 15, fontWeight: '700' },
  range: { fontSize: 15, fontVariant: ['tabular-nums'] },
  note: { fontSize: 11, marginTop: 10, lineHeight: 16 },
});
