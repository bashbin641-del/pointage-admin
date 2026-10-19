import { connection } from "next/server";
import { redirect } from "next/navigation";
import AdminShell from "@/components/admin-shell";
import EmployeesWorkspace from "@/components/employees-workspace";
import { authenticateAdmin } from "@/lib/auth/server";
import { coreApi } from "@/lib/api/server";
export const instant = false;
export default async function EmployeesPage() { await connection(); const auth = await authenticateAdmin(); if (!auth.ok) redirect(auth.reason === "mfa_required" ? "/mfa" : "/connexion"); const [employeesResponse, sitesResponse] = await Promise.all([coreApi("admin/employes"), coreApi("admin/sites")]); const employees = employeesResponse.ok ? (await employeesResponse.json() as { items: [] }).items : []; const sites = sitesResponse.ok ? (await sitesResponse.json() as { items: [] }).items : []; const employeeAppUrl = process.env.NEXT_PUBLIC_EMPLOYEE_APP_URL?.trim() || "https://project-2jijm.vercel.app"; return <AdminShell identity={auth.identity} activePath="/employes" title="Gestion des employés"><EmployeesWorkspace initialEmployees={employees} initialSites={sites} employeeAppUrl={employeeAppUrl} initialError={employeesResponse.ok && sitesResponse.ok ? "" : "Impossible de charger les employés et les sites."} /></AdminShell>; }
