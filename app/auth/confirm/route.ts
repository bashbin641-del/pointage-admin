import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  let destination = "/connexion?erreur=invitation";

  if (tokenHash && type === "invite") {
    const { error } = await (await createClient()).auth.verifyOtp({ token_hash: tokenHash, type: "invite" });
    if (!error) destination = "/activation";
  }

  return NextResponse.redirect(new URL(destination, request.url), {
    headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
