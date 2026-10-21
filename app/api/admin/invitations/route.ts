import { NextResponse } from "next/server";
import type { AdministratorMember } from "@/lib/admin-members";
import { coreApi } from "@/lib/api/server";
import { authenticateAdmin } from "@/lib/auth/server";
import { canInviteMembers } from "@/lib/auth/types";
import { isValidMatricule } from "@/lib/matricule";

type CoreResponse = {
  invitationTokenHash?: string;
  member?: AdministratorMember;
  items?: AdministratorMember[];
  message?: string | string[];
};

function authFailure(reason: "unauthenticated" | "mfa_required" | "enrollment_required" | "forbidden") {
  return NextResponse.json({ error: reason }, { status: reason === "forbidden" ? 403 : 401 });
}

export async function GET() {
  const auth = await authenticateAdmin();
  if (!auth.ok) return authFailure(auth.reason);
  if (!canInviteMembers(auth.identity.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const response = await coreApi("admin/administrateurs");
    const result = await response.json() as CoreResponse;
    if (!response.ok || !result.items) {
      return NextResponse.json({ error: "administrators_unavailable" }, { status: response.status >= 500 ? 503 : response.status });
    }
    return NextResponse.json({ items: result.items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "administrators_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const auth = await authenticateAdmin();
  if (!auth.ok) return authFailure(auth.reason);
  if (!canInviteMembers(auth.identity.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await request.json() as { email?: string; displayName?: string; matricule?: string };
  const email = body.email?.trim().toLowerCase();
  const displayName = body.displayName?.trim();
  const matricule = body.matricule?.trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email) || !displayName || displayName.length < 2 || displayName.length > 100 || !matricule || !isValidMatricule(matricule)) {
    return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });
  }

  try {
    const response = await coreApi("admin/administrateurs", {
      method: "POST",
      body: JSON.stringify({ email, displayName, matricule }),
    });
    const result = await response.json() as CoreResponse;
    const messages = Array.isArray(result.message) ? result.message : [result.message];

    if (!response.ok || !result.invitationTokenHash || !result.member) {
      if (messages.includes("EMAIL_DEJA_UTILISE")) {
        return NextResponse.json({ error: "email_already_used" }, { status: 409 });
      }
      if (messages.includes("MATRICULE_DEJA_ATTRIBUE")) {
        return NextResponse.json({ error: "matricule_already_used" }, { status: 409 });
      }
      if (messages.includes("INVITATION_ADMINISTRATEUR_ECHOUEE")) {
        return NextResponse.json({ error: "invitation_failed" }, { status: 400 });
      }
      if (response.status === 401 || response.status === 403) {
        return NextResponse.json({ error: response.status === 403 ? "forbidden" : "unauthenticated" }, { status: response.status });
      }
      return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
    }

    const invitationUrl = new URL("/auth/confirm", request.url);
    invitationUrl.searchParams.set("token_hash", result.invitationTokenHash);
    invitationUrl.searchParams.set("type", "invite");
    return NextResponse.json({
      invitationUrl: invitationUrl.toString(),
      member: result.member,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "service_unavailable" }, { status: 503 });
  }
}
