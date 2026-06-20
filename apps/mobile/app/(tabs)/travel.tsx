import { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  calculatePrayerTimes,
  geocodeCity,
  haversineMeters,
  planJourneyPrayers,
  type Coordinates,
  type GeocodeResult,
  type JourneyPrayerPlan,
} from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrayerList } from '../../src/components/PrayerList';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD, httpDeps } from '../../src/config';
import { formatTime, prayerLabel } from '../../src/format';

const AVG_SPEED_KMH = 90;

export default function TravelScreen() {
  const theme = useTheme();
  const location = useLocation();
  const origin = location.status === 'ready' ? location.coords : null;

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<GeocodeResult | null>(null);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const results = await geocodeCity(query.trim(), { limit: 1 }, httpDeps);
      if (results.length === 0) {
        setError('No place found for that search.');
        setDest(null);
      } else {
        setDest(results[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const plan = dest ? buildPlan(origin, dest.coordinates) : null;
  const destTimes = dest
    ? calculatePrayerTimes(dest.coordinates, new Date(), {
        method: DEFAULT_METHOD,
        madhab: DEFAULT_MADHAB,
      })
    : null;

  return (
    <Screen title="Travel" subtitle="Plan prayers for a city you’re driving to">
      <View style={[styles.searchRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a city or place…"
          placeholderTextColor={theme.text3}
          style={[styles.input, { color: theme.text }]}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity
          onPress={search}
          style={[styles.searchBtn, { backgroundColor: theme.primary }]}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.searchBtnText}>Go</Text>
          )}
        </TouchableOpacity>
      </View>

      {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}

      {dest && (
        <Text style={[styles.destName, { color: theme.text }]}>{dest.displayName}</Text>
      )}

      {plan && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>On the road</Text>
          {origin ? (
            <Text style={{ color: theme.text3, marginBottom: 10, fontSize: 13 }}>
              Assuming you leave now at ~{AVG_SPEED_KMH} km/h. Prayers that fall
              during the drive are flagged — find a mosque near that point.
            </Text>
          ) : (
            <Text style={{ color: theme.text3, marginBottom: 10, fontSize: 13 }}>
              Enable location to plan prayers along your route. Showing the
              destination’s times below.
            </Text>
          )}
          {origin &&
            plan.map((p) => <PlanRow key={p.prayer} item={p} />)}
        </Card>
      )}

      {destTimes && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Prayer times on arrival
          </Text>
          <PrayerList times={destTimes.times} />
          <Text style={{ color: theme.text3, fontSize: 12, marginTop: 10 }}>
            Note: times shown in your device’s local timezone — per-city timezone
            conversion is planned.
          </Text>
        </Card>
      )}
    </Screen>
  );
}

function PlanRow({ item }: { item: JourneyPrayerPlan }) {
  const theme = useTheme();
  const during = item.status === 'during-journey';
  return (
    <View style={[styles.planRow, { borderTopColor: theme.border }]}>
      <Text style={[styles.planPrayer, { color: theme.text }]}>
        {prayerLabel(item.prayer)}
      </Text>
      <Text style={{ color: theme.text2, width: 90, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {formatTime(item.time)}
      </Text>
      <Text
        style={[
          styles.planTag,
          {
            color: during ? theme.primary : theme.text3,
            fontWeight: during ? '800' : '500',
          },
        ]}
      >
        {during ? `🚗 ${item.label ?? 'en route'}` : item.status === 'before-journey' ? 'before' : 'after'}
      </Text>
    </View>
  );
}

/** Build a 3-sample journey (origin → midpoint → destination) from now. */
function buildPlan(
  origin: Coordinates | null,
  dest: Coordinates,
): JourneyPrayerPlan[] | null {
  if (!origin) return [];
  const now = Date.now();
  const distanceKm = haversineMeters(origin, dest) / 1000;
  const hours = Math.max(0.25, distanceKm / AVG_SPEED_KMH);
  const mid: Coordinates = {
    latitude: (origin.latitude + dest.latitude) / 2,
    longitude: (origin.longitude + dest.longitude) / 2,
  };
  return planJourneyPrayers(
    [
      { coordinates: origin, timeUtc: new Date(now), label: 'Departure' },
      { coordinates: mid, timeUtc: new Date(now + (hours / 2) * 3.6e6), label: 'En route' },
      { coordinates: dest, timeUtc: new Date(now + hours * 3.6e6), label: 'Destination' },
    ],
    { method: DEFAULT_METHOD, madhab: DEFAULT_MADHAB },
  );
}

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    marginBottom: 14,
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 6 },
  searchBtn: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 9,
    minWidth: 52,
    alignItems: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  destName: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  planPrayer: { fontSize: 16, flex: 1 },
  planTag: { width: 120, textAlign: 'right', fontSize: 13 },
});
