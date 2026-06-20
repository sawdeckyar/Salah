import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Mosque } from '@salah/core';
import { useTheme } from '../theme';
import { formatDistance, formatHHmm } from '../format';
import { TrustBadge } from './TrustBadge';

export function MosqueCard({
  mosque,
  onPress,
}: {
  mosque: Mosque;
  onPress: () => void;
}) {
  const theme = useTheme();
  const hasTimes =
    !!mosque.times?.iqama || (mosque.times?.jumuah?.length ?? 0) > 0;
  const jumuah = mosque.times?.jumuah?.[0];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ]}
    >
      <View style={styles.topRow}>
        <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
          {mosque.name}
        </Text>
        <Text style={[styles.dist, { color: theme.primary }]}>
          {formatDistance(mosque.distanceMeters)}
        </Text>
      </View>

      {mosque.address || mosque.city ? (
        <Text style={[styles.addr, { color: theme.text3 }]} numberOfLines={1}>
          {mosque.address ?? mosque.city}
        </Text>
      ) : null}

      {hasTimes ? (
        <View style={styles.timesRow}>
          {jumuah ? (
            <Text style={[styles.jumuah, { color: theme.text2 }]}>
              Jumu‘ah {formatHHmm(jumuah.khutbahTime)}
              {jumuah.language ? ` · ${jumuah.language}` : ''}
            </Text>
          ) : (
            <Text style={[styles.jumuah, { color: theme.text2 }]}>
              Iqama times available
            </Text>
          )}
          <TrustBadge times={mosque.times} />
        </View>
      ) : (
        <Text style={[styles.noTimes, { color: theme.text3 }]}>
          Times not yet submitted — tap to add
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    marginBottom: 10,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: { fontSize: 17, fontWeight: '700', flex: 1 },
  dist: { fontSize: 14, fontWeight: '700' },
  addr: { fontSize: 13, marginTop: 2 },
  timesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    gap: 8,
  },
  jumuah: { fontSize: 13, fontWeight: '600', flexShrink: 1 },
  noTimes: { fontSize: 13, marginTop: 10, fontStyle: 'italic' },
});
