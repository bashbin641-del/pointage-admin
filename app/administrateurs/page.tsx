import { redirect } from "next/navigation";
import { connection } from "next/server";
import AdminShell from "@/components/admin-shell";
import AdministratorsWorkspace from "@/components/administrators-workspace";
import type { AdministratorMember } from "@/lib/admin-members";
import { coreApi } from "@/lib/api/server";
import { authenticateAdmin } from "@/lib/auth/server";
import { canInviteMembers } from "@/lib/auth/types";

export default async function AdministratorsPage() {
  await connection();
  const auth = await authenticateAdmin();
  if (!auth.ok) redirect(auth.reason === "mfa_required" ? "/mfa" : "/connexion");
  if (!canInviteMembers(auth.identity.role)) redirect("/");

  let administrators: AdministratorMember[] = [];
  let initialError = "";
  try {
    const response = await coreApi("admin/administrateurs");
    const result = await response.json() as { items?: AdministratorMember[] };
    if (!response.ok || !result.items) throw new Error("ADMINISTRATORS_UNAVAILABLE");
    administrators = result.items;
  } catch {
    initialError = "Impossible de charger les comptes administrateurs.";
  }

  return <AdminShell identity={auth.identity} activePath="/administrateurs" title="Administrateurs"><AdministratorsWorkspace initialAdministrators={administrators} initialError={initialError} /></AdminShell>;
}
