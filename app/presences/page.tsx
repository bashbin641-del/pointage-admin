import { connection } from "next/server";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import AttendanceWorkspace from "@/components/attendance-workspace";
import { authenticateAdmin } from "@/lib/auth/server";
import { canManageAttendance } from "@/lib/auth/types";
import { coreApi } from "@/lib/api/server";
export const instant = false;
export default async function AttendancePage() { await connection(); const auth = await authenticateAdmin(); if (!auth.ok) redirect(auth.reason === "mfa_required" ? "/mfa" : "/connexion"); const response = await coreApi("admin/presences"); const items = response.ok ? (await response.json() as { items: [] }).items : []; const canManage = canManageAttendance(auth.identity.role); return <AdminShell identity={auth.identity} activePath="/presences" title="Présences"><AttendanceWorkspace initialItems={items} canManage={canManage} initialError={response.ok ? "" : "Impossible de charger les présences."} /></AdminShell>; }
