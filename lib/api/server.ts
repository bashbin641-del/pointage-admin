import "server-only";

import { createClient } from "@/lib/supabase/server";

function apiUrl() {
  const value = process.env.NEXT_PUBLIC_API_URL?.trim().replace(/\/$/, "");
  if (!value) throw new Error("API_URL_MISSING");
  return value;
}

export async function coreApi(path: string, init: RequestInit = {}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return new Response(JSON.stringify({ message: "SESSION_REQUISE" }), { status: 401 });
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${apiUrl()}/api/v1/${path.replace(/^\//, "")}`, {
    ...init,
    headers,
    cache: "no-store",
  });
}
