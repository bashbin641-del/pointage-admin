"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export async function createClient() {
  if (client) return client;
  const response = await fetch("/api/auth/config", { cache: "no-store" });
  if (!response.ok) throw new Error("SUPABASE_CONFIG_MISSING");
  const config = await response.json() as { url: string; publishableKey: string };
  client = createBrowserClient(config.url, config.publishableKey);
  return client;
}
