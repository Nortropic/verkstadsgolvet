/**
 * Supabase-klient för Leads-modulen. SERVER-ONLY — använder service_role-nyckeln
 * (kringgår RLS) och får ALDRIG importeras av klientkod. Klienten når Supabase bara
 * via app-API-routes. Lazy + graceful: saknas env returneras null och anroparen
 * svarar med ett "ej konfigurerad"-envelope i stället för att krascha (som github-read).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;

export function isConfigured(): boolean {
  return Boolean(URL && KEY);
}

let _client: SupabaseClient | null = null;

export function supa(): SupabaseClient | null {
  if (!URL || !KEY) return null;
  if (!_client) {
    _client = createClient(URL, KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _client;
}
