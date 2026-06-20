import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { Screen } from '../../src/components/Screen';
import { MosqueCard } from '../../src/components/MosqueCard';
import { MosqueMap } from '../../src/components/MosqueMap';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useNearbyMosques } from '../../src/hooks/useNearbyMosques';
import { useTheme } from '../../src/theme';

export default function NearbyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const location = useLocation();
  const coords = location.status === 'ready' ? location.coords : null;
  const nearby = useNearbyMosques(coords);

  const open = (id: string) =>
    router.push({ pathname: '/mosque/[id]', params: { id } });

  return (
    <Screen
      title="Nearby"
      subtitle="Mosques around you, with their congregation times"
      onRefresh={nearby.refresh}
      refreshing={nearby.status === 'loading'}
    >
      {location.status === 'loading' && <Loading label="Finding your location…" />}

      {location.status === 'denied' && (
        <Message
          title="Location needed"
          detail="Allow location access to discover mosques near you."
          actionLabel="Try again"
          onAction={location.refresh}
        />
      )}

      {coords && nearby.status === 'loading' && (
        <Loading label="Searching for mosques nearby…" />
      )}

      {nearby.status === 'error' && (
        <Message
          title="Couldn’t load mosques"
          detail={nearby.message}
          actionLabel="Retry"
          onAction={nearby.refresh}
        />
      )}

      {coords && nearby.status === 'ready' && (
        <>
          {nearby.mosques.length > 0 && (
            <MosqueMap center={coords} mosques={nearby.mosques} onSelect={open} />
          )}

          {nearby.mosques.length === 0 ? (
            <Message
              title="No mosques found nearby"
              detail="Try refreshing, or widen your search in a later version."
            />
          ) : (
            <View>
              <Text style={{ color: theme.text3, fontSize: 13, marginBottom: 8 }}>
                {nearby.mosques.length} mosque
                {nearby.mosques.length === 1 ? '' : 's'} found
              </Text>
              {nearby.mosques.map((m) => (
                <MosqueCard key={m.id} mosque={m} onPress={() => open(m.id)} />
              ))}
            </View>
          )}
        </>
      )}
    </Screen>
  );
}
