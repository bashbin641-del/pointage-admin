import { NextResponse } from "next/server";
import { listAdministratorMembers } from "@/lib/admin-members";
import { authenticateAdmin } from "@/lib/auth/server";
import { canInviteMembers } from "@/lib/auth/types";
import { isValidMatricule } from "@/lib/matricule";
import { createAdminClient } from "@/lib/supabase/admin";

function authFailure(reason: "unauthenticated" | "mfa_required" | "enrollment_required" | "forbidden") {
  return NextResponse.json({ error: reason }, { status: reason === "forbidden" ? 403 : 401 });
}

export async function GET() {
  const auth = await authenticateAdmin();
  if (!auth.ok) return authFailure(auth.reason);
  if (!canInviteMembers(auth.identity.role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    return NextResponse.json({ items: await listAdministratorMembers() }, { headers: { "Cache-Control": "no-store" } });
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

  const admin = createAdminClient();
  const [{ data: usersData, error: usersError }, { data: employee, error: employeeError }] = await Promise.all([
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    admin.from("employes").select("id").eq("matricule", matricule).maybeSingle(),
  ]);
  if (usersError || employeeError) return NextResponse.json({ error: "invitation_checks_failed" }, { status: 503 });

  const accountExists = usersData.users.some((user) => user.email?.toLowerCase() === email);
  const matriculeExists = usersData.users.some((user) => user.app_metadata.inox_admin_matricule === matricule);
  if (accountExists) return NextResponse.json({ error: "email_already_used" }, { status: 409 });
  if (employee || matriculeExists) return NextResponse.json({ error: "matricule_already_used" }, { status: 409 });

  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "invite",
    email,
    options: { data: { display_name: displayName, invitation_type: "administrator" } },
  });
  if (error || !link.user || !link.properties?.hashed_token) {
    return NextResponse.json({ error: "invitation_failed" }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(link.user.id, {
    app_metadata: {
      ...link.user.app_metadata,
      inox_admin_active: true,
      inox_admin_role: "administrator",
      inox_admin_display_name: displayName,
      inox_admin_matricule: matricule,
      inox_admin_invited_by: auth.identity.userId,
    },
  });
  if (updateError) {
    await admin.auth.admin.deleteUser(link.user.id);
    return NextResponse.json({ error: "invitation_failed" }, { status: 400 });
  }

  const invitationUrl = new URL("/auth/confirm", request.url);
  invitationUrl.searchParams.set("token_hash", link.properties.hashed_token);
  invitationUrl.searchParams.set("type", "invite");
  return NextResponse.json({
    invitationUrl: invitationUrl.toString(),
    member: {
      userId: link.user.id,
      email,
      displayName,
      matricule,
      role: "administrator",
      status: "pending",
      createdAt: link.user.created_at,
    },
  }, { headers: { "Cache-Control": "no-store" } });
}
