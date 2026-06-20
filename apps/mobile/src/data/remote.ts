import type {
  CommunityCategory,
  CommunityPost,
  Coordinates,
  MosqueTimes,
  ParkingKind,
  ParkingReport,
  RegistryEntry,
} from '@salah/core';
import { centroid } from '@salah/core';
import { remoteEnabled, supabase } from '../lib/supabase';

export { remoteEnabled };

/** Metadata to store alongside a submission (so standalone mosques resolve). */
export interface MosqueMeta {
  name?: string;
  location?: Coordinates;
  city?: string;
  country?: string;
}

// --- mosque times -----------------------------------------------------------

interface SubmissionRow {
  id: string;
  mosque_id: string;
  mosque_name: string | null;
  lat: number | null;
  lon: number | null;
  city: string | null;
  country: string | null;
  iqama: MosqueTimes['iqama'] | null;
  jumuah: MosqueTimes['jumuah'] | null;
  notes: string | null;
  contributor: string | null;
  status: string;
  confirms: number;
  disputes: number;
  last_confirmed_at: string | null;
}

function rowToEntry(r: SubmissionRow): RegistryEntry {
  const times: MosqueTimes = {
    iqama: r.iqama ?? undefined,
    jumuah: r.jumuah ?? undefined,
    notes: r.notes ?? undefined,
    contributor: r.contributor ?? undefined,
    verified: r.status === 'mosque-verified',
    confirmations: (r.confirms ?? 0) - (r.disputes ?? 0),
    lastConfirmedAt: r.last_confirmed_at ?? undefined,
    provenance: { method: 'crowd' },
  };
  if (r.mosque_id.startsWith('osm:')) {
    return { id: r.id, osmId: r.mosque_id.slice(4), times };
  }
  return {
    id: r.id,
    name: r.mosque_name ?? 'Mosque',
    location:
      r.lat != null && r.lon != null
        ? { latitude: r.lat, longitude: r.lon }
        : undefined,
    city: r.city ?? undefined,
    country: r.country ?? undefined,
    times,
  };
}

/** Load the whole community time registry from Supabase. */
export async function fetchTimeRegistry(): Promise<RegistryEntry[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('mosque_time_submission')
    .select('*')
    .neq('status', 'rejected');
  if (error || !data) return [];
  return (data as SubmissionRow[]).map(rowToEntry);
}

/** Insert or update the times for a mosque. */
export async function submitTimes(
  mosqueId: string,
  meta: MosqueMeta,
  times: MosqueTimes,
): Promise<void> {
  if (!supabase) return;
  await supabase.from('mosque_time_submission').upsert(
    {
      mosque_id: mosqueId,
      mosque_name: meta.name ?? null,
      lat: meta.location?.latitude ?? null,
      lon: meta.location?.longitude ?? null,
      city: meta.city ?? null,
      country: meta.country ?? null,
      iqama: times.iqama ?? null,
      jumuah: times.jumuah ?? null,
      notes: times.notes ?? null,
      contributor: 'you',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'mosque_id' },
  );
}

/** Record a confirm/dispute (drives the server-side trust ladder). */
export async function confirmTimes(
  mosqueId: string,
  vote: 'confirm' | 'dispute',
): Promise<void> {
  if (!supabase) return;
  await supabase.rpc('confirm_times', { p_mosque_id: mosqueId, p_vote: vote });
}

// --- parking ----------------------------------------------------------------

interface ParkingRow {
  id: string;
  kind: ParkingKind;
  lat: number;
  lon: number;
  polygon: [number, number][] | null;
  note: string | null;
  created_at: string;
}

function rowToParking(r: ParkingRow): ParkingReport {
  return {
    id: r.id,
    kind: r.kind,
    location: { latitude: r.lat, longitude: r.lon },
    polygon: r.polygon
      ? r.polygon.map(([lng, lat]) => ({ latitude: lat, longitude: lng }))
      : undefined,
    note: r.note ?? undefined,
    createdAt: r.created_at,
  };
}

export async function fetchParking(mosqueId: string): Promise<ParkingReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('parking_report')
    .select('*')
    .eq('mosque_id', mosqueId);
  if (error || !data) return [];
  return (data as ParkingRow[]).map(rowToParking);
}

export async function addParkingPoint(
  mosqueId: string,
  kind: ParkingKind,
  location: Coordinates,
  note?: string,
): Promise<void> {
  if (!supabase) return;
  await supabase.from('parking_report').insert({
    mosque_id: mosqueId,
    kind,
    lat: location.latitude,
    lon: location.longitude,
    polygon: null,
    note: note?.trim() || null,
    contributor: 'you',
  });
}

export async function addParkingPolygon(
  mosqueId: string,
  kind: ParkingKind,
  polygon: Coordinates[],
  note?: string,
): Promise<void> {
  if (!supabase) return;
  const c = centroid(polygon);
  await supabase.from('parking_report').insert({
    mosque_id: mosqueId,
    kind,
    lat: c.latitude,
    lon: c.longitude,
    polygon: polygon.map((p) => [p.longitude, p.latitude]),
    note: note?.trim() || null,
    contributor: 'you',
  });
}

export async function removeParkingRemote(reportId: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('parking_report').delete().eq('id', reportId);
}

// --- community posts (fun / events / gatherings) ----------------------------

interface CommunityRow {
  id: string;
  category: CommunityCategory;
  title: string;
  description: string | null;
  lat: number | null;
  lon: number | null;
  place_name: string | null;
  city: string | null;
  when_text: string | null;
  url: string | null;
  contributor: string | null;
  created_at: string;
}

function rowToPost(r: CommunityRow): CommunityPost {
  return {
    id: r.id,
    category: r.category,
    title: r.title,
    description: r.description ?? undefined,
    location:
      r.lat != null && r.lon != null
        ? { latitude: r.lat, longitude: r.lon }
        : undefined,
    placeName: r.place_name ?? undefined,
    city: r.city ?? undefined,
    whenText: r.when_text ?? undefined,
    url: r.url ?? undefined,
    contributor: r.contributor ?? undefined,
    createdAt: r.created_at,
  };
}

export async function fetchCommunityPosts(
  category: CommunityCategory,
): Promise<CommunityPost[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('community_post')
    .select('*')
    .eq('category', category)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error || !data) return [];
  return (data as CommunityRow[]).map(rowToPost);
}

export async function addCommunityPostRemote(post: CommunityPost): Promise<void> {
  if (!supabase) return;
  await supabase.from('community_post').insert({
    category: post.category,
    title: post.title,
    description: post.description ?? null,
    lat: post.location?.latitude ?? null,
    lon: post.location?.longitude ?? null,
    place_name: post.placeName ?? null,
    city: post.city ?? null,
    when_text: post.whenText ?? null,
    url: post.url ?? null,
    contributor: 'you',
  });
}
