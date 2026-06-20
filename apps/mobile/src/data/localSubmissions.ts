import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Mosque, MosqueTimes } from '@salah/core';

/**
 * On-device store of community time submissions. This is the crowdsourcing
 * layer's local persistence: a user can add/edit a mosque's iqama and Jumu‘ah
 * times and they're saved on the phone and overlaid onto the map + lists.
 *
 * NEXT STEP: replace the read/write here with the Supabase-backed registry so
 * submissions are shared across all users and run through moderation (see
 * docs/DATA_INGESTION.md). The rest of the app stays the same.
 */
const KEY = 'salah.localTimes.v1';

let cache: Record<string, MosqueTimes> = {};
let loaded = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export async function loadLocalTimes(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as Record<string, MosqueTimes>) : {};
  } catch {
    cache = {};
  }
  loaded = true;
  emit();
}

export function isLoaded(): boolean {
  return loaded;
}

export function getLocalTimesFor(id: string): MosqueTimes | undefined {
  return cache[id];
}

export async function saveLocalTimes(
  id: string,
  times: MosqueTimes,
): Promise<void> {
  cache = {
    ...cache,
    [id]: {
      ...times,
      contributor: 'you',
      updatedAt: new Date().toISOString(),
      provenance: { method: 'crowd', observedAt: new Date().toISOString() },
    },
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export async function clearLocalTimes(id: string): Promise<void> {
  const next = { ...cache };
  delete next[id];
  cache = next;
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

/** Overlay any locally-saved times onto a list of mosques. */
export function applyLocalTimes(mosques: Mosque[]): Mosque[] {
  if (Object.keys(cache).length === 0) return mosques;
  return mosques.map((m) =>
    cache[m.id] ? { ...m, source: 'merged', times: cache[m.id] } : m,
  );
}

/** Subscribe to local-store changes (returns an unsubscribe fn). */
export function subscribeLocal(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
