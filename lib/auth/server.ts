import "server-only";

import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isAdminRole, type AdminIdentity } from "./types";

export type AdminAuthResult =
  | { ok: true; identity: AdminIdentity; user: User }
  | { ok: false; reason: "unauthenticated" | "mfa_required" | "enrollment_required" | "forbidden" };

export async function authenticateAdmin(): Promise<AdminAuthResult> {
  const supabase = await createClient();
  const [{ data: userData }, { data: aalData }, { data: claimsData }] = await Promise.all([
    supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel(), supabase.auth.getClaims(),
  ]);
  if (!userData.user) return { ok: false, reason: "unauthenticated" };
  if (!aalData || aalData.nextLevel !== "aal2") return { ok: false, reason: "enrollment_required" };
  if (aalData.currentLevel !== "aal2") return { ok: false, reason: "mfa_required" };
  // getUser fetches the current account from Supabase Auth rather than trusting
  // app_metadata from the browser's session token.
  const metadata = userData.user.app_metadata;
  if (metadata.inox_admin_active !== true || !isAdminRole(metadata.inox_admin_role)) return { ok: false, reason: "forbidden" };
  const claims = claimsData?.claims as Record<string, unknown> | undefined;
  const sessionId = typeof claims?.session_id === "string" ? claims.session_id : "";
  if (!sessionId) return { ok: false, reason: "unauthenticated" };
  return { ok: true, user: userData.user, identity: { userId: userData.user.id, sessionId, email: userData.user.email ?? "", displayName: String(metadata.inox_admin_display_name || userData.user.email?.split("@")[0] || "Membre INOX"), role: metadata.inox_admin_role } };
}
