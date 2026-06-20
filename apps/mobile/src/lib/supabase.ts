import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase client, configured from public env vars at build time:
 *   EXPO_PUBLIC_SUPABASE_URL
 *   EXPO_PUBLIC_SUPABASE_ANON_KEY
 *
 * If they're not set, this is `null` and the app falls back to on-device
 * storage — so everything still runs in Expo Go before the backend exists.
 *
 * Auth: the app signs in ANONYMOUSLY (see ensureAuth) so every device has a
 * stable auth.uid(). The hardened RLS requires this for writes; reads stay
 * public. (Enable "Anonymous sign-ins" in the Supabase dashboard.)
 */
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          storage: AsyncStorage,
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;

export function remoteEnabled(): boolean {
  return supabase !== null;
}

/** Ensure there is an (anonymous) session so writes are allowed. Safe to call
 *  repeatedly; no-ops when the backend isn't configured. */
export async function ensureAuth(): Promise<void> {
  if (!supabase) return;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      await supabase.auth.signInAnonymously();
    }
  } catch {
    // Anonymous sign-ins may be disabled in the dashboard — reads still work.
  }
}
