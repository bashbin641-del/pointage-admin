import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const requestedType = request.nextUrl.searchParams.get("type");
  const type = requestedType === "invite" || requestedType === "recovery"
    ? requestedType as EmailOtpType
    : null;
  let destination = "/connexion?erreur=invitation";

  if (tokenHash && type) {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) destination = "/activation";
  }

  return NextResponse.redirect(new URL(destination, request.url), {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
