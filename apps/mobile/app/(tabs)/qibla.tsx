import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { qiblaDirection } from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme';

export default function QiblaScreen() {
  const theme = useTheme();
  const location = useLocation();
  const coords = location.status === 'ready' ? location.coords : null;
  const [heading, setHeading] = useState<number | null>(null);

  const qibla = useMemo(
    () => (coords ? qiblaDirection(coords) : null),
    [coords?.latitude, coords?.longitude],
  );

  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    let active = true;
    (async () => {
      try {
        sub = await Location.watchHeadingAsync((h) => {
          if (!active) return;
          const value = h.trueHeading >= 0 ? h.trueHeading : h.magHeading;
          setHeading(value);
        });
      } catch {
        // Compass unavailable (e.g. simulator) — fall back to static bearing.
      }
    })();
    return () => {
      active = false;
      sub?.remove();
    };
  }, []);

  // Arrow points toward the Qibla relative to where the phone is facing.
  const rotation = qibla == null ? 0 : qibla - (heading ?? 0);

  return (
    <Screen title="Qibla" subtitle="Direction to the Kaaba in Mecca">
      {location.status === 'loading' && <Loading label="Finding your location…" />}
      {location.status === 'denied' && (
        <Message
          title="Location needed"
          detail="Allow location access to compute the Qibla direction."
          actionLabel="Try again"
          onAction={location.refresh}
        />
      )}

      {qibla != null && (
        <Card style={{ alignItems: 'center', paddingVertical: 32 }}>
          <View
            style={[
              styles.dial,
              { borderColor: theme.border, backgroundColor: theme.surface2 },
            ]}
          >
            <Text style={[styles.northLabel, { color: theme.text3 }]}>N</Text>
            <View style={{ transform: [{ rotate: `${rotation}deg` }] }}>
              <Text style={[styles.arrow, { color: theme.primary }]}>↑</Text>
            </View>
            <Text style={styles.kaaba}>🕋</Text>
          </View>
          <Text style={[styles.bearing, { color: theme.text }]}>
            {Math.round(qibla)}° from North
          </Text>
          <Text style={[styles.hint, { color: theme.text3 }]}>
            {heading == null
              ? 'Compass unavailable — bearing is measured clockwise from true north.'
              : 'Hold your phone flat and turn until the arrow points up.'}
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  dial: {
    width: 240,
    height: 240,
    borderRadius: 120,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  northLabel: { position: 'absolute', top: 10, fontSize: 14, fontWeight: '700' },
  arrow: { fontSize: 120, lineHeight: 130, fontWeight: '900' },
  kaaba: { position: 'absolute', bottom: 24, fontSize: 26 },
  bearing: { fontSize: 26, fontWeight: '800', marginTop: 24 },
  hint: { fontSize: 13, textAlign: 'center', marginTop: 8, paddingHorizontal: 12 },
});
