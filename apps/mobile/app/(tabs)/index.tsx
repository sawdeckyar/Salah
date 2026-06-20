import { useEffect, useMemo, useState } from 'react';
import { Text } from 'react-native';
import {
  calculatePrayerTimes,
  getPrayerStatus,
  reverseGeocode,
  type Coordinates,
} from '@salah/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { NextPrayerBanner } from '../../src/components/NextPrayerBanner';
import { PrayerList } from '../../src/components/PrayerList';
import { Loading, Message } from '../../src/components/StateView';
import { useLocation } from '../../src/hooks/useLocation';
import { DEFAULT_MADHAB, DEFAULT_METHOD, httpDeps } from '../../src/config';

export default function TodayScreen() {
  const location = useLocation();
  const coords = location.status === 'ready' ? location.coords : null;

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
    return { result, status };
  }, [coords?.latitude, coords?.longitude, now]);

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
          <Card>
            <PrayerList
              times={data.result.times}
              highlight={data.status.next === 'none' ? undefined : data.status.next}
            />
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
