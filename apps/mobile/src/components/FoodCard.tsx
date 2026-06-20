import { useState } from 'react';
import { Image, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Place } from '@salah/core';
import { useTheme } from '../theme';
import { formatDistance } from '../format';
import { placeImage } from '../lib/images';
import { openDirections } from '../lib/maps';

const KIND_LABEL: Record<string, string> = {
  restaurant: 'Restaurant',
  cafe: 'Café',
  fast_food: 'Fast food',
  shop: 'Shop',
  other: 'Place',
};

/** A DoorDash-style image card for a halal place. */
export function FoodCard({ place }: { place: Place }) {
  const theme = useTheme();
  const [failed, setFailed] = useState(false);
  const fullyHalal = place.halal === 'only';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => openDirections(place.location, place.name)}
      >
        <View style={[styles.imageWrap, { backgroundColor: theme.surface2 }]}>
          {!failed ? (
            <Image
              source={{ uri: placeImage(place) }}
              style={styles.image}
              onError={() => setFailed(true)}
            />
          ) : (
            <View style={[styles.image, styles.fallback]}>
              <Text style={{ fontSize: 40 }}>
                {place.kind === 'cafe' ? '☕' : place.kind === 'shop' ? '🛒' : '🍽️'}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.halalBadge,
              { backgroundColor: fullyHalal ? theme.success : 'rgba(0,0,0,0.6)' },
            ]}
          >
            <Text style={styles.halalText}>
              {fullyHalal ? '✓ Fully halal' : 'Halal options'}
            </Text>
          </View>
          {place.distanceMeters != null && (
            <View style={styles.distPill}>
              <Text style={styles.distText}>{formatDistance(place.distanceMeters)}</Text>
            </View>
          )}
        </View>

        <View style={styles.body}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {place.name}
          </Text>
          <Text style={{ color: theme.text3, fontSize: 13 }} numberOfLines={1}>
            {[place.cuisine, KIND_LABEL[place.kind]].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </TouchableOpacity>

      <View style={[styles.actions, { borderTopColor: theme.border }]}>
        <Action label="🧭 Directions" onPress={() => openDirections(place.location, place.name)} />
        {place.phone && <Action label="📞 Call" onPress={() => Linking.openURL(`tel:${place.phone}`)} />}
        {place.website && <Action label="🌐 Website" onPress={() => Linking.openURL(place.website!)} />}
      </View>
    </View>
  );
}

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <TouchableOpacity onPress={onPress} style={styles.action}>
      <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: 16,
  },
  imageWrap: { width: '100%', height: 160 },
  image: { width: '100%', height: '100%' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  halalBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  halalText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  distPill: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  distText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  body: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 8 },
  name: { fontSize: 18, fontWeight: '800' },
  actions: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth },
  action: { flex: 1, alignItems: 'center', paddingVertical: 11 },
});
