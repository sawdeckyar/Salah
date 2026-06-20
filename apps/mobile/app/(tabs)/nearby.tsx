import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haversineMeters, type Coordinates } from '@salah/core';
import { MosqueCard } from '../../src/components/MosqueCard';
import { MosqueMap } from '../../src/components/MosqueMap';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useNearbyMosques } from '../../src/hooks/useNearbyMosques';
import { useTheme } from '../../src/theme';

// How far the map must be panned before "Search this area" appears.
const RESEARCH_THRESHOLD_M = 2500;

export default function NearbyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const location = useLocation();

  // The point we search around — starts at the user, moves when they tap
  // "Search this area" after panning the map.
  const [searchOrigin, setSearchOrigin] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (location.status === 'ready' && !searchOrigin) {
      setSearchOrigin(location.coords);
    }
  }, [location.status, searchOrigin]);

  const nearby = useNearbyMosques(searchOrigin);
  const open = (id: string) =>
    router.push({ pathname: '/mosque/[id]', params: { id } });

  const canResearch =
    mapCenter != null &&
    searchOrigin != null &&
    haversineMeters(mapCenter, searchOrigin) > RESEARCH_THRESHOLD_M;

  if (!searchOrigin) {
    return (
      <View style={[styles.fill, { backgroundColor: theme.bg, paddingTop: insets.top }]}>
        {location.status === 'loading' && <Loading label="Finding your location…" />}
        {location.status === 'denied' && (
          <Message
            title="Location needed"
            detail="Allow location access to discover mosques near you."
            actionLabel="Try again"
            onAction={location.refresh}
          />
        )}
        {location.status === 'error' && (
          <Message
            title="Couldn’t get location"
            detail={location.message}
            actionLabel="Retry"
            onAction={location.refresh}
          />
        )}
      </View>
    );
  }

  const mosques = nearby.status === 'ready' ? nearby.mosques : [];
  const count = mosques.length;
  // Map view is anchored to the user's location; searchOrigin only drives the
  // Overpass query (so "search this area" updates pins without moving the map).
  const userCoords =
    location.status === 'ready' ? location.coords : searchOrigin;

  return (
    <View style={styles.fill}>
      <MosqueMap
        center={userCoords}
        mosques={mosques}
        onSelect={open}
        onMove={setMapCenter}
        style={{ flex: 1 }}
      />

      {/* Header pill */}
      <View style={[styles.headerWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.headerPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nearby mosques</Text>
          <TouchableOpacity onPress={nearby.refresh} hitSlop={10}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>
              {nearby.status === 'loading' ? '…' : '↻'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* "Search this area" appears after panning */}
        {canResearch && (
          <TouchableOpacity
            onPress={() => mapCenter && setSearchOrigin(mapCenter)}
            style={[styles.researchBtn, { backgroundColor: theme.primary }]}
          >
            <Text style={styles.researchText}>⌖ Search this area</Text>
          </TouchableOpacity>
        )}
      </View>

      <BottomSheet
        header={
          <Text style={[styles.sheetTitle, { color: theme.text }]}>
            {nearby.status === 'loading'
              ? 'Searching…'
              : `${count} mosque${count === 1 ? '' : 's'} here`}
          </Text>
        }
      >
        {nearby.status === 'loading' && (
          <View style={styles.sheetCenter}>
            <ActivityIndicator color={theme.primary} />
          </View>
        )}

        {nearby.status === 'error' && (
          <Message
            title="Couldn’t load mosques"
            detail={nearby.message}
            actionLabel="Retry"
            onAction={nearby.refresh}
          />
        )}

        {nearby.status === 'ready' &&
          (count === 0 ? (
            <Message
              title="No mosques found here"
              detail="Pan the map and tap “Search this area”, or refresh."
            />
          ) : (
            <ScrollView
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {mosques.map((m) => (
                <MosqueCard key={m.id} mosque={m} onPress={() => open(m.id)} />
              ))}
            </ScrollView>
          ))}
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  headerWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 8,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  researchBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  researchText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetCenter: { paddingVertical: 28, alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
