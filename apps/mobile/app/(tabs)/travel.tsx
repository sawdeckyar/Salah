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
  fetchHalalPlaces,
  geocodeCity,
  haversineMeters,
  musafirInfo,
  planJourneyPrayers,
  type Coordinates,
  type GeocodeResult,
  type JourneyPrayerPlan,
  type Place,
} from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrayerList } from '../../src/components/PrayerList';
import { MusafirPanel } from '../../src/components/MusafirPanel';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD, httpDeps } from '../../src/config';
import { prayerLabel } from '../../src/format';
import { formatTimeAt, tzAbbrev, tzForCoords } from '../../src/lib/tz';
import { openDirections } from '../../src/lib/maps';

const AVG_SPEED_KMH = 90;
const DAY = 24 * 3.6e6;

const KIND_EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  fast_food: '🥙',
  shop: '🛒',
  other: '📍',
};

export default function TravelScreen() {
  const theme = useTheme();
  const location = useLocation();
  const origin = location.status === 'ready' ? location.coords : null;

  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dest, setDest] = useState<GeocodeResult | null>(null);
  const [halal, setHalal] = useState<Place[]>([]);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setHalal([]);
    try {
      const results = await geocodeCity(query.trim(), { limit: 1 }, httpDeps);
      if (results.length === 0) {
        setError('No place found for that search.');
        setDest(null);
      } else {
        const d = results[0];
        setDest(d);
        fetchHalalPlaces(d.coordinates, { radiusMeters: 6000, limit: 30 }, httpDeps)
          .then((p) =>
            setHalal(
              p
                .map((x) => ({ ...x, distanceMeters: haversineMeters(d.coordinates, x.location) }))
                .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0)),
            ),
          )
          .catch(() => {});
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    } finally {
      setBusy(false);
    }
  };

  const plan = dest ? buildPlan(origin, dest.coordinates) : null;
  const destTz = dest ? tzForCoords(dest.coordinates) : null;
  const destTimes = dest
    ? calculatePrayerTimes(dest.coordinates, new Date(), {
        method: DEFAULT_METHOD,
        madhab: DEFAULT_MADHAB,
      })
    : null;
  const nextFajr = dest
    ? calculatePrayerTimes(dest.coordinates, new Date(Date.now() + DAY), {
        method: DEFAULT_METHOD,
        madhab: DEFAULT_MADHAB,
      }).times.fajr
    : undefined;

  return (
    <Screen title="Travel" subtitle="Plan prayers — and find halal spots — on the road">
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
        <TouchableOpacity onPress={search} style={[styles.searchBtn, { backgroundColor: theme.primary }]} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.searchBtnText}>Go</Text>}
        </TouchableOpacity>
      </View>

      {error ? <Text style={{ color: theme.danger, marginBottom: 12 }}>{error}</Text> : null}
      {dest && <Text style={[styles.destName, { color: theme.text }]}>{dest.displayName}</Text>}

      {plan && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>On the road</Text>
          <Text style={{ color: theme.text3, marginBottom: 10, fontSize: 13 }}>
            {origin
              ? `Assuming you leave now at ~${AVG_SPEED_KMH} km/h. Times shown where you'll be.`
              : 'Enable location to plan along your route. Destination times below.'}
          </Text>
          {origin && plan.map((p) => <PlanRow key={p.prayer} item={p} />)}
        </Card>
      )}

      {destTimes && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Prayer times on arrival{destTz ? ` · ${tzAbbrev(destTimes.times.dhuhr, destTz)}` : ''}
          </Text>
          <PrayerList times={destTimes.times} tz={destTz} />
        </Card>
      )}

      {destTimes && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>Traveller (musāfir)</Text>
          <MusafirPanel info={musafirInfo(destTimes, nextFajr)} tz={destTz} />
        </Card>
      )}

      {dest && (
        <Card>
          <Text style={[styles.cardTitle, { color: theme.text }]}>
            Halal nearby{halal.length ? ` · ${halal.length}` : ''}
          </Text>
          {halal.length === 0 ? (
            <Text style={{ color: theme.text3, fontSize: 13 }}>
              Searching OpenStreetMap for halal restaurants, cafés and shops…
            </Text>
          ) : (
            halal.map((p) => (
              <TouchableOpacity
                key={p.id}
                onPress={() => openDirections(p.location, p.name)}
                style={[styles.placeRow, { borderTopColor: theme.border }]}
              >
                <Text style={styles.placeEmoji}>{KIND_EMOJI[p.kind] ?? '📍'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.placeName, { color: theme.text }]} numberOfLines={1}>
                    {p.name}
                  </Text>
                  <Text style={{ color: theme.text3, fontSize: 12 }} numberOfLines={1}>
                    {[p.cuisine, p.halal === 'only' ? 'fully halal' : 'halal options']
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                </View>
                <Text style={{ color: theme.primary, fontWeight: '700' }}>
                  {p.distanceMeters != null
                    ? p.distanceMeters < 1000
                      ? `${Math.round(p.distanceMeters)} m`
                      : `${(p.distanceMeters / 1000).toFixed(1)} km`
                    : '›'}
                </Text>
              </TouchableOpacity>
            ))
          )}
        </Card>
      )}
    </Screen>
  );
}

function PlanRow({ item }: { item: JourneyPrayerPlan }) {
  const theme = useTheme();
  const during = item.status === 'during-journey';
  const tz = tzForCoords(item.coordinates);
  const isFriday =
    item.prayer === 'dhuhr' &&
    (() => {
      try {
        return (
          new Intl.DateTimeFormat('en-US', { timeZone: tz ?? undefined, weekday: 'short' }).format(
            item.time,
          ) === 'Fri'
        );
      } catch {
        return false;
      }
    })();

  return (
    <View style={[styles.planRow, { borderTopColor: theme.border }]}>
      <Text style={[styles.planPrayer, { color: theme.text }]}>
        {prayerLabel(item.prayer)}
        {isFriday ? <Text style={{ color: theme.primary }}> · Jumu‘ah</Text> : ''}
      </Text>
      <Text style={{ color: theme.text2, width: 86, textAlign: 'right', fontVariant: ['tabular-nums'] }}>
        {formatTimeAt(item.time, tz)}
      </Text>
      <Text
        style={[
          styles.planTag,
          { color: during ? theme.primary : theme.text3, fontWeight: during ? '800' : '500' },
        ]}
      >
        {during ? `🚗 ${item.label ?? 'en route'}` : item.status === 'before-journey' ? 'before' : 'after'}
      </Text>
    </View>
  );
}

function buildPlan(origin: Coordinates | null, dest: Coordinates): JourneyPrayerPlan[] | null {
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
  searchBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9, minWidth: 52, alignItems: 'center' },
  searchBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  destName: { fontSize: 15, fontWeight: '600', marginBottom: 12 },
  cardTitle: { fontSize: 17, fontWeight: '800', marginBottom: 8 },
  planRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  planPrayer: { fontSize: 16, flex: 1 },
  planTag: { width: 120, textAlign: 'right', fontSize: 13 },
  placeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  placeEmoji: { fontSize: 20 },
  placeName: { fontSize: 15, fontWeight: '600' },
});
