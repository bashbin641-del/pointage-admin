"use client";

import { useCallback, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

type Site = { id: string; name: string; active: boolean };
type Employee = { id: string; matricule: string; display_name: string; active: boolean; sites: { name: string } | null };

type Props = {
  initialEmployees: Employee[];
  initialSites: Site[];
  employeeAppUrl: string;
  initialError?: string;
};

export default function EmployeesWorkspace({ initialEmployees, initialSites, employeeAppUrl, initialError = "" }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [employeesResponse, sitesResponse] = await Promise.all([
        fetch("/api/core/admin/employes", { cache: "no-store" }),
        fetch("/api/core/admin/sites", { cache: "no-store" }),
      ]);
      if (!employeesResponse.ok || !sitesResponse.ok) throw new Error();
      setEmployees((await employeesResponse.json() as { items: Employee[] }).items);
      setSites((await sitesResponse.json() as { items: Site[] }).items.filter((site) => site.active));
      setError("");
    } catch {
      if (!silent) setError("Impossible de charger les employés et les sites.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useAdminRealtime((event) => {
    if (event.type === "employee.created" || event.type === "site.created") void load(true);
  });

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyStatus("Lien copié dans le presse-papiers.");
    } catch {
      setCopyStatus("Copie automatique impossible. Sélectionnez le lien ci-dessus puis copiez-le manuellement.");
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true);
    setError("");
    setSuccess("");
    setInvitationUrl("");
    setCopyStatus("");
    const form = new FormData(formElement);
    const body = {
      email: form.get("email"),
      displayName: form.get("displayName"),
      matricule: form.get("matricule"),
      siteId: form.get("siteId"),
    };

    try {
      const response = await fetch("/api/core/admin/employes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { invitationTokenHash?: string; message?: string };
      if (!response.ok || !result.invitationTokenHash) throw new Error(result.message);

      const url = new URL("/activation", employeeAppUrl);
      url.searchParams.set("token_hash", result.invitationTokenHash);
      url.searchParams.set("type", "invite");
      const invitation = url.toString();
      setInvitationUrl(invitation);
      formElement.reset();
      await load();

      try {
        await navigator.clipboard.writeText(invitation);
        setSuccess("Employé créé. Le lien d’invitation est affiché ci-dessous et a été copié.");
      } catch {
        setSuccess("Employé créé. Le lien d’invitation reste disponible ci-dessous pour une copie manuelle.");
      }
    } catch {
      setSuccess("");
      setInvitationUrl("");
      setError("La création n’a pas été confirmée. Vérifiez les informations et réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace">
      <section className="panel">
        <h2>Ajouter un employé</h2>
        <p className="panel-intro">L’employé utilisera le lien d’invitation pour choisir lui-même son mot de passe.</p>
        {sites.length ? (
          <form className="admin-form" onSubmit={submit}>
            <label>Nom affiché<input name="displayName" required minLength={2} /></label>
            <label>E-mail professionnel<input name="email" type="email" required /></label>
            <label>Matricule<input name="matricule" required minLength={2} /></label>
            <label>Site<select name="siteId" required defaultValue=""><option value="" disabled>Choisir un site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <button className="primary-button" disabled={pending}>{pending ? "Création…" : "Créer l’employé"}</button>
          </form>
        ) : <p>Créez un site avant d’ajouter un employé.</p>}
        {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
        {success ? <p className="form-message success-message" role="status">{success}</p> : null}
        {invitationUrl ? (
          <section className="invitation-panel" aria-labelledby="invitation-title">
            <h3 id="invitation-title">Lien d’invitation</h3>
            <p>Transmettez ce lien uniquement à l’employé concerné. Il reste visible ici jusqu’à la création d’une nouvelle invitation ou au rechargement de la page.</p>
            <label htmlFor="employee-invitation-link">Lien à transmettre</label>
            <div className="invitation-copy-row">
              <input id="employee-invitation-link" value={invitationUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <button className="secondary-button" type="button" onClick={() => void copyInvitation()}>Copier le lien</button>
            </div>
            {copyStatus ? <p className="copy-status" role="status">{copyStatus}</p> : null}
          </section>
        ) : null}
      </section>

      <section className="panel">
        <h2>Personnel enregistré</h2>
        {loading ? <CompactDataLoader label="Actualisation des employés…" /> : employees.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Nom</th><th>Matricule</th><th>Site</th><th>État</th></tr></thead>
              <tbody>{employees.map((employee) => <tr key={employee.id}><td>{employee.display_name}</td><td>{employee.matricule}</td><td>{employee.sites?.name ?? "Non affecté"}</td><td>{employee.active ? "Actif" : "Inactif"}</td></tr>)}</tbody>
            </table>
          </div>
        ) : <p>Aucun employé enregistré.</p>}
      </section>
    </div>
  );
}
