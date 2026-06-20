import { useEffect, useMemo, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import {
  calculatePrayerTimes,
  getPrayerStatus,
  musafirInfo,
  reverseGeocode,
  type Coordinates,
} from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { NextPrayerBanner } from '../../src/components/NextPrayerBanner';
import { PrayerList } from '../../src/components/PrayerList';
import { MusafirPanel } from '../../src/components/MusafirPanel';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { useTheme } from '../../src/theme';
import { DEFAULT_MADHAB, DEFAULT_METHOD, httpDeps } from '../../src/config';

const DAY = 24 * 3.6e6;

export default function TodayScreen() {
  const theme = useTheme();
  const location = useLocation();
  const coords = location.status === 'ready' ? location.coords : null;
  const [showMusafir, setShowMusafir] = useState(false);

  // Tick every 30s so the countdown and "next prayer" stay fresh.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const label = usePlaceLabel(coords);

  const data = useMemo(() => {
    if (!coords) return null;
    const result = calculatePrayerTimes(coords, now, {
      method: DEFAULT_METHOD,
      madhab: DEFAULT_MADHAB,
    });
    const status = getPrayerStatus(coords, now, { method: DEFAULT_METHOD });
    const nextFajr = calculatePrayerTimes(coords, new Date(now.getTime() + DAY), {
      method: DEFAULT_METHOD,
      madhab: DEFAULT_MADHAB,
    }).times.fajr;
    return { result, status, musafir: musafirInfo(result, nextFajr) };
  }, [coords?.latitude, coords?.longitude, now]);

  const isFriday = now.getDay() === 5;

  const dateLabel = now.toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <Screen
      title="Today"
      subtitle={label ? `${label} · ${dateLabel}` : dateLabel}
      onRefresh={location.refresh}
      refreshing={location.status === 'loading'}
    >
      {location.status === 'loading' && <Loading label="Finding your location…" />}

      {location.status === 'denied' && (
        <Message
          title="Location needed"
          detail="Salah needs location access to show prayer times for where you are."
          actionLabel="Try again"
          onAction={location.refresh}
        />
      )}

      {location.status === 'error' && (
        <Message title="Couldn’t get location" detail={location.message} actionLabel="Retry" onAction={location.refresh} />
      )}

      {data && (
        <>
          <NextPrayerBanner status={data.status} />

          {isFriday && (
            <View style={{ backgroundColor: theme.primaryMuted, borderRadius: 12, padding: 12, marginBottom: 14 }}>
              <Text style={{ color: theme.primary, fontWeight: '800' }}>
                🕌 It’s Jumu‘ah — Dhuhr is the congregational Friday prayer. Check
                your mosque’s khutbah time in Nearby.
              </Text>
            </View>
          )}

          <Card>
            <PrayerList
              times={data.result.times}
              highlight={data.status.next === 'none' ? undefined : data.status.next}
            />
          </Card>

          <Card>
            <TouchableOpacity
              onPress={() => setShowMusafir((s) => !s)}
              style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Text style={{ color: theme.text, fontSize: 16, fontWeight: '800' }}>
                🧳 Traveller (musāfir)
              </Text>
              <Text style={{ color: theme.primary, fontWeight: '700' }}>
                {showMusafir ? 'Hide' : 'Show'}
              </Text>
            </TouchableOpacity>
            {showMusafir && (
              <View style={{ marginTop: 12 }}>
                <MusafirPanel info={data.musafir} />
              </View>
            )}
          </Card>

          <Text style={{ color: '#8A968F', fontSize: 12, textAlign: 'center' }}>
            Adhan times · {DEFAULT_METHOD} method · {DEFAULT_MADHAB} (Asr).
            Shown in your device’s local time.
          </Text>
        </>
      )}
    </Screen>
  );
}

/** Reverse-geocode the coordinates into a short "City, Country" label. */
function usePlaceLabel(coords: Coordinates | null): string | null {
  const [label, setLabel] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (!coords) return;
    reverseGeocode(coords, {}, httpDeps)
      .then((r) => {
        if (cancelled || !r) return;
        setLabel([r.city, r.country].filter(Boolean).join(', ') || r.displayName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [coords?.latitude, coords?.longitude]);
  return label;
}
