import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Coordinates, ParkingKind, ParkingReport } from '@salah/core';

/**
 * On-device store of crowdsourced parking reports, keyed by mosque id. Same
 * pattern as localSubmissions — replace with the Supabase-backed registry to
 * share across users (see docs/DATA_INGESTION.md).
 */
const KEY = 'salah.parking.v1';

let cache: Record<string, ParkingReport[]> = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export async function loadParking(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, ParkingReport[]>) : {};
  } catch {
    cache = {};
  }
  loaded = true;
  emit();
}

export function isParkingLoaded(): boolean {
  return loaded;
}

export function getParkingFor(mosqueId: string): ParkingReport[] {
  return cache[mosqueId] ?? [];
}

export async function addParking(
  mosqueId: string,
  kind: ParkingKind,
  location: Coordinates,
  note?: string,
): Promise<void> {
  const report: ParkingReport = {
    id: `p_${Date.now()}_${Math.round(Math.random() * 1e4)}`,
    kind,
    location,
    note: note?.trim() || undefined,
    contributor: 'you',
    createdAt: new Date().toISOString(),
  };
  cache = { ...cache, [mosqueId]: [...(cache[mosqueId] ?? []), report] };
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export async function removeParking(
  mosqueId: string,
  reportId: string,
): Promise<void> {
  cache = {
    ...cache,
    [mosqueId]: (cache[mosqueId] ?? []).filter((r) => r.id !== reportId),
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export function subscribeParking(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
