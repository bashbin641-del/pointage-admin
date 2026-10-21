import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const invitationUrl = new URL("/invitation", request.url);
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  if (tokenHash) invitationUrl.searchParams.set("token_hash", tokenHash);
  if (type) invitationUrl.searchParams.set("type", type);
  return NextResponse.redirect(invitationUrl, {
    status: 303,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const tokenHash = form.get("token_hash");
  const requestedType = form.get("type");
  const type = requestedType === "invite" || requestedType === "recovery"
    ? requestedType as EmailOtpType
    : null;
  let destination = "/connexion?erreur=invitation";

  if (typeof tokenHash === "string" && tokenHash && type) {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) destination = "/activation";
  }

  return NextResponse.redirect(new URL(destination, request.url), {
    status: 303,
    headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" },
  });
}
