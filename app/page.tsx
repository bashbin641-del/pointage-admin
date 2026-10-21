import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authenticateAdmin } from "@/lib/auth/server";
import AdminShell from "@/components/admin-shell";
import DashboardWorkspace from "@/components/dashboard-workspace";
import { coreApi } from "@/lib/api/server";
import type { DashboardSummary } from "@/lib/dashboard-types";

export const instant = false;

export default async function Home() {
  await connection();
  const auth = await authenticateAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/connexion");
    if (auth.reason === "enrollment_required") redirect("/activation");
    if (auth.reason === "mfa_required") redirect("/mfa");
    redirect("/connexion");
  }
  const response = await coreApi("admin/tableau-de-bord");
  const summary = response.ok ? await response.json() as DashboardSummary : null;
  return <AdminShell identity={auth.identity} activePath="/" title="Présences du jour"><DashboardWorkspace initialSummary={summary} initialError={response.ok ? "" : "Impossible de charger les indicateurs. Vérifiez l’API puis réessayez."} /></AdminShell>;
}
