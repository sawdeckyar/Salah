import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommunityCategory, CommunityPost } from '@salah/core';
import {
  addCommunityPostRemote,
  fetchCommunityPosts,
  remoteEnabled,
} from './remote';

/**
 * Community posts (Travel hub: fun / events / gatherings). Uses Supabase when
 * configured, else on-device AsyncStorage. Replace nothing else to go shared.
 */
const KEY = 'salah.community.v1';

let cache: CommunityPost[] = [];
let loadedLocal = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

async function ensureLocal() {
  if (loadedLocal) return;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? (JSON.parse(raw) as CommunityPost[]) : [];
  } catch {
    cache = [];
  }
  loadedLocal = true;
}

export async function loadCommunity(): Promise<void> {
  if (!remoteEnabled()) await ensureLocal();
}

/** Posts for a category (remote when configured, else local). */
export async function getCommunity(
  category: CommunityCategory,
): Promise<CommunityPost[]> {
  if (remoteEnabled()) {
    return fetchCommunityPosts(category);
  }
  await ensureLocal();
  return cache
    .filter((p) => p.category === category)
    .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
}

export async function addCommunity(post: CommunityPost): Promise<void> {
  if (remoteEnabled()) {
    await addCommunityPostRemote(post);
    emit();
    return;
  }
  await ensureLocal();
  cache = [{ ...post, contributor: 'you' }, ...cache];
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

export function subscribeCommunity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
