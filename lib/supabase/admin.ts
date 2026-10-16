import "server-only";

import { createClient } from "@supabase/supabase-js";
import { getSupabaseConfig } from "./config";

export function createAdminClient() {
  const config = getSupabaseConfig();
  if (!config?.secretKey) throw new Error("SUPABASE_SERVER_CONFIG_MISSING");
  return createClient(config.url, config.secretKey, { auth: { autoRefreshToken: false, persistSession: false } });
}
