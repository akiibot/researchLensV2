import { createClient, SupabaseClient } from '@supabase/supabase-js';

let cachedServiceClient: SupabaseClient | null = null;
let cachedPublicClient: SupabaseClient | null = null;

export function hasSupabaseConfig(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function hasSupabaseServiceConfig(): boolean {
  return Boolean(hasSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabasePublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  if (!cachedPublicClient) {
    cachedPublicClient = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
  }

  return cachedPublicClient;
}

export function getSupabaseServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  if (!cachedServiceClient) {
    cachedServiceClient = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
  }

  return cachedServiceClient;
}
