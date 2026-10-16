import "server-only";

function value(input: string | undefined) {
  const trimmed = input?.trim();
  return trimmed && trimmed !== "[SENSITIVE]" ? trimmed : undefined;
}

export function getSupabaseConfig() {
  const url = value(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = value(
    process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const secretKey = value(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  return url && publishableKey ? { url, publishableKey, secretKey } : null;
}

export function hasSupabaseConfig() {
  const config = getSupabaseConfig();
  return Boolean(config?.url && config.publishableKey);
}
