import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { canInviteMembers, isAdminRole, type AdminRole } from "@/lib/auth/types";

const inviteRoles: AdminRole[] = ["administrator", "moderator", "editor", "viewer"];

export async function POST(request: Request) {
  const auth = await authenticateAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.reason === "forbidden" ? 403 : 401 });
  if (!canInviteMembers(auth.identity.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json() as { email?: string; displayName?: string; role?: string };
  const email = body.email?.trim().toLowerCase(); const displayName = body.displayName?.trim();
  if (!email || !displayName || displayName.length < 2 || !isAdminRole(body.role) || !inviteRoles.includes(body.role)) return NextResponse.json({ error: "invalid_invitation" }, { status: 400 });
  if (auth.identity.role === "administrator" && body.role === "administrator") return NextResponse.json({ error: "owner_required" }, { status: 403 });
  const admin = createAdminClient();
  const { data: link, error } = await admin.auth.admin.generateLink({ type: "invite", email, options: { data: { display_name: displayName } } });
  if (error || !link.user || !link.properties?.hashed_token) return NextResponse.json({ error: "invitation_failed" }, { status: 400 });
  const { error: updateError } = await admin.auth.admin.updateUserById(link.user.id, { app_metadata: { ...link.user.app_metadata, inox_admin_active: true, inox_admin_role: body.role, inox_admin_display_name: displayName, inox_admin_invited_by: auth.identity.userId } });
  if (updateError) return NextResponse.json({ error: "invitation_failed" }, { status: 400 });
  // Admin-generated links use an implicit fragment, which a server callback cannot read.
  // A token hash can instead be verified server-side and stored in SSR cookies.
  const invitationUrl = new URL("/auth/confirm", request.url);
  invitationUrl.searchParams.set("token_hash", link.properties.hashed_token);
  invitationUrl.searchParams.set("type", "invite");
  return NextResponse.json({ invitationUrl: invitationUrl.toString(), member: { userId: link.user.id, email, displayName, role: body.role } }, { headers: { "Cache-Control": "no-store" } });
}
