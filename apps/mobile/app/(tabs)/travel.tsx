import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  fetchHalalPlaces,
  geocodeCity,
  haversineMeters,
  reverseGeocode,
  type CommunityCategory,
  type CommunityPost,
  type Coordinates,
  type Place,
} from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme';
import { httpDeps } from '../../src/config';
import { openDirections } from '../../src/lib/maps';
import { getCommunity, subscribeCommunity } from '../../src/data/community';

type Tab = 'food' | CommunityCategory;
const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: 'food', label: 'Halal Food', emoji: '🍽️' },
  { key: 'fun', label: 'Fun', emoji: '🎡' },
  { key: 'event', label: 'Events', emoji: '📅' },
  { key: 'gathering', label: 'Gatherings', emoji: '🤝' },
];
const KIND_EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  fast_food: '🥙',
  shop: '🛒',
  other: '📍',
};

function fmtDist(m?: number): string {
  if (m == null) return '';
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

export default function TravelScreen() {
  const theme = useTheme();
  const router = useRouter();
  const location = useLocation();

  const [tab, setTab] = useState<Tab>('food');
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [area, setArea] = useState<{ coords: Coordinates; label: string; city?: string } | null>(null);

  // Default the area to the user's current location.
  useEffect(() => {
    if (area || location.status !== 'ready') return;
    const c = location.coords;
    setArea({ coords: c, label: 'Near you' });
    reverseGeocode(c, {}, httpDeps)
      .then((r) => {
        if (r) setArea({ coords: c, label: r.city ?? 'Near you', city: r.city });
      })
      .catch(() => {});
  }, [location.status, area]);

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    try {
      const results = await geocodeCity(query.trim(), { limit: 1 }, httpDeps);
      if (results[0]) {
        const r = results[0];
        setArea({ coords: r.coordinates, label: r.city ?? r.displayName, city: r.city });
      }
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Explore" subtitle="Halal food, fun, events & gatherings">
      <View style={[styles.searchRow, { borderColor: theme.border, backgroundColor: theme.surface }]}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a city…"
          placeholderTextColor={theme.text3}
          style={[styles.input, { color: theme.text }]}
          autoCapitalize="words"
          returnKeyType="search"
          onSubmitEditing={search}
        />
        <TouchableOpacity onPress={search} style={[styles.goBtn, { backgroundColor: theme.primary }]} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.goText}>Go</Text>}
        </TouchableOpacity>
      </View>

      {area && (
        <Text style={[styles.area, { color: theme.text3 }]}>📍 {area.label}</Text>
      )}

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[styles.tab, { borderColor: theme.border }, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
            >
              <Text style={{ color: active ? '#fff' : theme.text2, fontWeight: '700', fontSize: 13 }}>
                {t.emoji} {t.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!area ? (
        <Loading label="Finding your area…" />
      ) : tab === 'food' ? (
        <FoodList area={area.coords} onOpen={(p) => openDirections(p.location, p.name)} />
      ) : (
        <CommunityList
          category={tab}
          area={area.coords}
          onAdd={() =>
            router.push({
              pathname: '/community-new',
              params: {
                category: tab,
                lat: String(area.coords.latitude),
                lon: String(area.coords.longitude),
                city: area.city ?? '',
              },
            })
          }
        />
      )}
    </Screen>
  );
}

function FoodList({ area, onOpen }: { area: Coordinates; onOpen: (p: Place) => void }) {
  const theme = useTheme();
  const [state, setState] = useState<{ loading: boolean; places: Place[] }>({ loading: true, places: [] });

  useEffect(() => {
    let active = true;
    setState({ loading: true, places: [] });
    fetchHalalPlaces(area, { radiusMeters: 6000, limit: 40 }, httpDeps)
      .then((p) => {
        if (!active) return;
        const sorted = p
          .map((x) => ({ ...x, distanceMeters: haversineMeters(area, x.location) }))
          .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
        setState({ loading: false, places: sorted });
      })
      .catch(() => active && setState({ loading: false, places: [] }));
    return () => {
      active = false;
    };
  }, [area.latitude, area.longitude]);

  if (state.loading) return <Loading label="Finding halal spots…" />;
  if (state.places.length === 0)
    return (
      <Message
        title="No halal places tagged here"
        detail="OpenStreetMap has no diet:halal spots in this area yet. Try another city."
      />
    );

  return (
    <Card>
      {state.places.map((p) => (
        <TouchableOpacity key={p.id} onPress={() => onOpen(p)} style={[styles.row, { borderTopColor: theme.border }]}>
          <Text style={styles.emoji}>{KIND_EMOJI[p.kind] ?? '📍'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>{p.name}</Text>
            <Text style={{ color: theme.text3, fontSize: 12 }} numberOfLines={1}>
              {[p.cuisine, p.halal === 'only' ? 'fully halal' : 'halal options'].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Text style={{ color: theme.primary, fontWeight: '700' }}>{fmtDist(p.distanceMeters)}</Text>
        </TouchableOpacity>
      ))}
    </Card>
  );
}

function CommunityList({
  category,
  area,
  onAdd,
}: {
  category: CommunityCategory;
  area: Coordinates;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const [posts, setPosts] = useState<CommunityPost[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      getCommunity(category).then((p) => {
        if (!active) return;
        const withDist = p
          .map((x) => ({
            ...x,
            distanceMeters: x.location ? haversineMeters(area, x.location) : undefined,
          }))
          .sort((a, b) => (a.distanceMeters ?? 9e9) - (b.distanceMeters ?? 9e9));
        setPosts(withDist);
      });
    load();
    const unsub = subscribeCommunity(load);
    return () => {
      active = false;
      unsub();
    };
  }, [category, area.latitude, area.longitude]);

  const addBtn = (
    <TouchableOpacity onPress={onAdd} style={[styles.addBtn, { backgroundColor: theme.primary }]}>
      <Text style={styles.addText}>+ Add</Text>
    </TouchableOpacity>
  );

  if (posts === null) return <Loading />;

  if (posts.length === 0) {
    return (
      <Card>
        <Message
          title="Nothing here yet"
          detail="Be the first to share a halal spot, event, or gathering for the community."
        />
        <View style={{ alignItems: 'center', marginTop: 6 }}>{addBtn}</View>
      </Card>
    );
  }

  return (
    <>
      <View style={styles.addRow}>{addBtn}</View>
      <Card>
        {posts.map((p) => (
          <TouchableOpacity
            key={p.id}
            onPress={() => {
              if (p.url) Linking.openURL(p.url).catch(() => {});
              else if (p.location) openDirections(p.location, p.title);
            }}
            style={[styles.row, { borderTopColor: theme.border }]}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: theme.text }]}>{p.title}</Text>
              {p.whenText ? (
                <Text style={{ color: theme.primary, fontSize: 13, fontWeight: '600' }}>🕒 {p.whenText}</Text>
              ) : null}
              {p.placeName || p.city ? (
                <Text style={{ color: theme.text3, fontSize: 12 }} numberOfLines={1}>
                  {[p.placeName, p.city].filter(Boolean).join(' · ')}
                  {p.distanceMeters != null ? ` · ${fmtDist(p.distanceMeters)}` : ''}
                </Text>
              ) : null}
              {p.description ? (
                <Text style={{ color: theme.text2, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {p.description}
                </Text>
              ) : null}
            </View>
            {(p.url || p.location) && <Text style={{ color: theme.text3 }}>›</Text>}
          </TouchableOpacity>
        ))}
      </Card>
    </>
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
    gap: 8,
  },
  input: { flex: 1, fontSize: 16, paddingVertical: 6 },
  goBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 9, minWidth: 52, alignItems: 'center' },
  goText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  area: { fontSize: 13, marginTop: 8 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 14 },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, borderTopWidth: StyleSheet.hairlineWidth },
  emoji: { fontSize: 20 },
  name: { fontSize: 15, fontWeight: '700' },
  addRow: { alignItems: 'flex-end', marginBottom: 8 },
  addBtn: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 999 },
  addText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
