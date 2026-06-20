import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CommunityCategory, CommunityPost } from '@salah/core';
import {
  addCommunityPostRemote,
  fetchCommunityPosts,
  remoteEnabled,
  setInterestRemote,
} from './remote';

/**
 * Community posts (Explore hub: fun / events / gatherings / meetups). Uses
 * Supabase when configured, else on-device AsyncStorage. Tracks which posts THIS
 * device is "interested" in (RSVP toggle), persisted locally either way.
 */
const KEY = 'salah.community.v1';
const INTEREST_KEY = 'salah.communityInterest.v1';

let cache: CommunityPost[] = [];
let interested: Record<string, boolean> = {};
let loadedLocal = false;
let loadedInterest = false;
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

async function ensureInterest() {
  if (loadedInterest) return;
  try {
    const raw = await AsyncStorage.getItem(INTEREST_KEY);
    interested = raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    interested = {};
  }
  loadedInterest = true;
}

export async function loadCommunity(): Promise<void> {
  await ensureInterest();
  if (!remoteEnabled()) await ensureLocal();
}

export function isInterested(postId: string): boolean {
  return !!interested[postId];
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
  cache = [{ ...post, contributor: 'you', interested: 0 }, ...cache];
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  emit();
}

/** Toggle the current device's interest in a post; updates the shared count. */
export async function toggleInterest(post: CommunityPost): Promise<void> {
  await ensureInterest();
  const nowInterested = !interested[post.id];
  const delta = nowInterested ? 1 : -1;
  interested = { ...interested, [post.id]: nowInterested };
  if (!nowInterested) delete interested[post.id];
  await AsyncStorage.setItem(INTEREST_KEY, JSON.stringify(interested));

  if (remoteEnabled()) {
    await setInterestRemote(post.id, nowInterested);
  } else {
    await ensureLocal();
    cache = cache.map((p) =>
      p.id === post.id
        ? { ...p, interested: Math.max(0, (p.interested ?? 0) + delta) }
        : p,
    );
    await AsyncStorage.setItem(KEY, JSON.stringify(cache));
  }
  emit();
}

export function subscribeCommunity(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
