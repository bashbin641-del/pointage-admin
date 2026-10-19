"use client";

import { useCallback, useState } from "react";

type Site = { id: string; name: string; active: boolean };
type Employee = { id: string; matricule: string; display_name: string; active: boolean; sites: { name: string } | null };

export default function EmployeesWorkspace({ initialEmployees, initialSites, employeeAppUrl, initialError = "" }: { initialEmployees: Employee[]; initialSites: Site[]; employeeAppUrl: string; initialError?: string }) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees); const [sites, setSites] = useState<Site[]>(initialSites);
  const [error, setError] = useState(initialError); const [success, setSuccess] = useState(""); const [pending, setPending] = useState(false); const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { const [e, s] = await Promise.all([fetch("/api/core/admin/employes", { cache: "no-store" }), fetch("/api/core/admin/sites", { cache: "no-store" })]); if (!e.ok || !s.ok) throw new Error(); setEmployees((await e.json() as { items: Employee[] }).items); setSites((await s.json() as { items: Site[] }).items.filter((site) => site.active)); }
    catch { setError("Impossible de charger les employés et les sites."); } finally { setLoading(false); }
  }, []);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setPending(true); setError(""); setSuccess("");
    const form = new FormData(formElement);
    const body = { email: form.get("email"), displayName: form.get("displayName"), matricule: form.get("matricule"), siteId: form.get("siteId") };
    try { const response = await fetch("/api/core/admin/employes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); const result = await response.json() as { invitationTokenHash?: string; message?: string }; if (!response.ok || !result.invitationTokenHash) throw new Error(result.message); const invitationUrl = new URL("/activation", employeeAppUrl); invitationUrl.searchParams.set("token_hash", result.invitationTokenHash); invitationUrl.searchParams.set("type", "invite"); await navigator.clipboard.writeText(invitationUrl.toString()); setSuccess("Employé créé. Le lien d’invitation a été copié dans le presse-papiers."); formElement.reset(); await load(); }
    catch { setSuccess(""); setError("La création n’a pas été confirmée. Vérifiez les informations et réessayez."); } finally { setPending(false); }
  }
  return <div className="workspace"><section className="panel"><h2>Ajouter un employé</h2>{sites.length ? <form className="admin-form" onSubmit={submit}><label>Nom affiché<input name="displayName" required minLength={2} /></label><label>E-mail professionnel<input name="email" type="email" required /></label><label>Matricule<input name="matricule" required minLength={2} /></label><label>Site<select name="siteId" required defaultValue=""><option value="" disabled>Choisir un site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label><button className="primary-button" disabled={pending}>{pending ? "Création…" : "Créer et copier l’invitation"}</button></form> : <p>Créez un site avant d’ajouter un employé.</p>}{error ? <p className="form-message error-message" role="alert">{error}</p> : null}{success ? <p className="form-message success-message" role="status">{success}</p> : null}</section><section className="panel"><h2>Personnel enregistré</h2>{loading ? <p>Chargement…</p> : employees.length ? <div className="table-wrap"><table><thead><tr><th>Nom</th><th>Matricule</th><th>Site</th><th>État</th></tr></thead><tbody>{employees.map((employee) => <tr key={employee.id}><td>{employee.display_name}</td><td>{employee.matricule}</td><td>{employee.sites?.name ?? "Non affecté"}</td><td>{employee.active ? "Actif" : "Inactif"}</td></tr>)}</tbody></table></div> : <p>Aucun employé enregistré.</p>}</section></div>;
}
