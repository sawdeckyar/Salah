import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  centroid,
  type Coordinates,
  type ParkingKind,
  type ParkingReport,
} from '@salah/core';
import {
  addParkingPoint,
  addParkingPolygon,
  fetchParking,
  removeParkingRemote,
  remoteEnabled,
} from './remote';

/**
 * Parking reports store. When Supabase is configured it reads/writes the shared
 * backend; otherwise it persists on-device (AsyncStorage). The screen API is the
 * same either way: getParkingFor + refreshParking + subscribe.
 */
const KEY = 'salah.parking.v1';

let cache: Record<string, ParkingReport[]> = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function persistLocal() {
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

export async function loadParking(): Promise<void> {
  if (!remoteEnabled()) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as Record<string, ParkingReport[]>) : {};
    } catch {
      cache = {};
    }
  }
  emit();
}

export function getParkingFor(mosqueId: string): ParkingReport[] {
  return cache[mosqueId] ?? [];
}

/** Refresh a mosque's reports from the backend (no-op offline). */
export async function refreshParking(mosqueId: string): Promise<void> {
  if (!remoteEnabled()) return;
  const remote = await fetchParking(mosqueId);
  cache = { ...cache, [mosqueId]: remote };
  emit();
}

export async function addParking(
  mosqueId: string,
  kind: ParkingKind,
  location: Coordinates,
  note?: string,
): Promise<void> {
  if (remoteEnabled()) {
    await addParkingPoint(mosqueId, kind, location, note);
    await refreshParking(mosqueId);
    return;
  }
  const report = makeReport(kind, location, undefined, note);
  cache = { ...cache, [mosqueId]: [...(cache[mosqueId] ?? []), report] };
  await persistLocal();
  emit();
}

export async function addParkingArea(
  mosqueId: string,
  kind: ParkingKind,
  polygon: Coordinates[],
  note?: string,
): Promise<void> {
  if (remoteEnabled()) {
    await addParkingPolygon(mosqueId, kind, polygon, note);
    await refreshParking(mosqueId);
    return;
  }
  const report = makeReport(kind, centroid(polygon), polygon, note);
  cache = { ...cache, [mosqueId]: [...(cache[mosqueId] ?? []), report] };
  await persistLocal();
  emit();
}

export async function removeParking(
  mosqueId: string,
  reportId: string,
): Promise<void> {
  if (remoteEnabled()) {
    await removeParkingRemote(reportId);
    await refreshParking(mosqueId);
    return;
  }
  cache = {
    ...cache,
    [mosqueId]: (cache[mosqueId] ?? []).filter((r) => r.id !== reportId),
  };
  await persistLocal();
  emit();
}

export function subscribeParking(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function makeReport(
  kind: ParkingKind,
  location: Coordinates,
  polygon: Coordinates[] | undefined,
  note?: string,
): ParkingReport {
  return {
    id: `p_${Date.now()}_${Math.round(Math.random() * 1e4)}`,
    kind,
    location,
    polygon,
    note: note?.trim() || undefined,
    contributor: 'you',
    createdAt: new Date().toISOString(),
  };
}
