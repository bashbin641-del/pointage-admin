import { connection } from "next/server";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import SitesTerminalsWorkspace from "@/components/sites-terminals-workspace";
import { authenticateAdmin } from "@/lib/auth/server";
import { coreApi } from "@/lib/api/server";
export const instant = false;
export default async function SitesTerminalsPage() { await connection(); const auth = await authenticateAdmin(); if (!auth.ok) redirect(auth.reason === "mfa_required" ? "/mfa" : "/connexion"); const [sitesResponse, terminalsResponse] = await Promise.all([coreApi("admin/sites"), coreApi("admin/terminaux")]); const sites = sitesResponse.ok ? (await sitesResponse.json() as { items: [] }).items : []; const terminals = terminalsResponse.ok ? (await terminalsResponse.json() as { items: [] }).items : []; const canManage = auth.identity.role === "owner" || auth.identity.role === "administrator"; return <AdminShell identity={auth.identity} activePath="/sites-terminaux" title="Sites et terminaux"><SitesTerminalsWorkspace initialSites={sites} initialTerminals={terminals} canManage={canManage} initialError={sitesResponse.ok && terminalsResponse.ok ? "" : "Impossible de charger les sites et les terminaux."} /></AdminShell>; }
