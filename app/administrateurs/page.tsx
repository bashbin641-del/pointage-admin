import { redirect } from "next/navigation";
import { connection } from "next/server";
import AdminShell from "@/components/admin-shell";
import AdministratorsWorkspace from "@/components/administrators-workspace";
import { listAdministratorMembers, type AdministratorMember } from "@/lib/admin-members";
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
    administrators = await listAdministratorMembers();
  } catch {
    initialError = "Impossible de charger les comptes administrateurs.";
  }

  return <AdminShell identity={auth.identity} activePath="/administrateurs" title="Administrateurs"><AdministratorsWorkspace initialAdministrators={administrators} initialError={initialError} /></AdminShell>;
}
