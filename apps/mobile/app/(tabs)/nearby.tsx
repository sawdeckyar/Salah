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
import { MosqueCard } from '../../src/components/MosqueCard';
import { MosqueMap } from '../../src/components/MosqueMap';
import { BottomSheet } from '../../src/components/BottomSheet';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useNearbyMosques } from '../../src/hooks/useNearbyMosques';
import { useTheme } from '../../src/theme';

export default function NearbyScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const location = useLocation();
  const coords = location.status === 'ready' ? location.coords : null;
  const nearby = useNearbyMosques(coords);

  const open = (id: string) =>
    router.push({ pathname: '/mosque/[id]', params: { id } });

  // Until we have coordinates, show a simple full-screen state.
  if (!coords) {
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

  return (
    <View style={styles.fill}>
      {/* Full-screen map */}
      <MosqueMap center={coords} mosques={mosques} onSelect={open} style={{ flex: 1 }} />

      {/* Floating header pill */}
      <View style={[styles.headerWrap, { top: insets.top + 8 }]} pointerEvents="box-none">
        <View style={[styles.headerPill, { backgroundColor: theme.surface, borderColor: theme.border }]}>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Nearby mosques</Text>
          <TouchableOpacity onPress={nearby.refresh} hitSlop={10}>
            <Text style={{ color: theme.primary, fontWeight: '700' }}>
              {nearby.status === 'loading' ? '…' : '↻'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Draggable bottom sheet with the list */}
      <BottomSheet
        header={
          <Text style={[styles.sheetTitle, { color: theme.text }]}>
            {nearby.status === 'loading'
              ? 'Searching…'
              : `${count} mosque${count === 1 ? '' : 's'} nearby`}
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
              title="No mosques found nearby"
              detail="Try refreshing, or move the map and search again in a later version."
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
  sheetTitle: { fontSize: 16, fontWeight: '800' },
  sheetCenter: { paddingVertical: 28, alignItems: 'center' },
  listContent: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 },
});
