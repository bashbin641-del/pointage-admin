import { NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/config";

export function GET() {
  const config = getSupabaseConfig();
  return config ? NextResponse.json({ url: config.url, publishableKey: config.publishableKey }, { headers: { "Cache-Control": "no-store" } }) : NextResponse.json({ error: "configuration_missing" }, { status: 503 });
}
