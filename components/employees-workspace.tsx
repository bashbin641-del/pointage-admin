"use client";

import { useCallback, useMemo, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { EMPLOYEE_MATRICULE_PATTERN, formatMatriculeInput } from "@/lib/matricule";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

type Site = { id: string; name: string; active: boolean };
type EmployeeStatus = "active" | "pending" | "blocked";
type Employee = { id: string; matricule: string; hired_at: string; display_name: string; email: string; active: boolean; status: EmployeeStatus; sites: { name: string } | null };

type Props = {
  initialEmployees: Employee[];
  initialSites: Site[];
  employeeAppUrl: string;
  canManage: boolean;
  initialError?: string;
};

type EmployeeAction = { kind: "block" | "unblock" | "delete"; employee: Employee };
type EmployeeFilters = {
  name: string;
  matricule: string;
  site: string;
  status: "" | EmployeeStatus;
};

const emptyFilters: EmployeeFilters = {
  name: "",
  matricule: "",
  site: "",
  status: "",
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan" }).format(new Date());

function normalized(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr").trim();
}

export default function EmployeesWorkspace({ initialEmployees, initialSites, employeeAppUrl, canManage, initialError = "" }: Props) {
  const [employees, setEmployees] = useState<Employee[]>(initialEmployees);
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [employeeAction, setEmployeeAction] = useState<EmployeeAction | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [regeneratingEmployeeId, setRegeneratingEmployeeId] = useState("");
  const [filters, setFilters] = useState<EmployeeFilters>(emptyFilters);

  const filteredEmployees = useMemo(() => {
    const nameQuery = normalized(filters.name);
    const matriculeQuery = normalized(filters.matricule);
    const siteQuery = normalized(filters.site);

    return employees.filter((employee) => {
      const matchesStatus = !filters.status || employee.status === filters.status;

      return (!nameQuery || normalized(employee.display_name).includes(nameQuery))
        && (!matriculeQuery || normalized(employee.matricule).includes(matriculeQuery))
        && (!siteQuery || normalized(employee.sites?.name ?? "Non affecté").includes(siteQuery))
        && matchesStatus;
    });
  }, [employees, filters]);

  const hasFilters = Object.values(filters).some(Boolean);

  function updateFilter<Key extends keyof EmployeeFilters>(key: Key, value: EmployeeFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

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
    if (["employee.created", "employee.updated", "employee.deleted", "site.created", "site.deleted"].includes(event.type)) void load(true);
  });

  async function applyEmployeeAction() {
    if (!employeeAction) return;
    setActionPending(true);
    setError("");
    setSuccess("");
    try {
      const deleting = employeeAction.kind === "delete";
      const response = await fetch(`/api/core/admin/employes/${employeeAction.employee.id}${deleting ? "" : "/status"}`, {
        method: deleting ? "DELETE" : "PATCH",
        headers: deleting ? undefined : { "Content-Type": "application/json" },
        body: deleting ? undefined : JSON.stringify({ active: employeeAction.kind === "unblock" }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message);
      setSuccess(deleting
        ? `${employeeAction.employee.display_name} et son compte de connexion ont été supprimés définitivement.`
        : employeeAction.kind === "block"
          ? `${employeeAction.employee.display_name} est bloqué. Aucun nouveau pointage n’est autorisé.`
          : `${employeeAction.employee.display_name} peut de nouveau se connecter et pointer.`);
      setEmployeeAction(null);
      await load();
    } catch {
      setError("L’opération sur cet employé n’a pas été confirmée. Réessayez.");
    } finally {
      setActionPending(false);
    }
  }

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyStatus("Lien copié dans le presse-papiers.");
    } catch {
      setCopyStatus("Copie automatique impossible. Sélectionnez le lien ci-dessus puis copiez-le manuellement.");
    }
  }

  async function regenerateInvitation(employee: Employee) {
    setRegeneratingEmployeeId(employee.id);
    setError("");
    setSuccess("");
    setInvitationUrl("");
    setCopyStatus("");
    try {
      const response = await fetch(`/api/core/admin/employes/${employee.id}/invitation`, { method: "POST" });
      const result = await response.json() as { invitationTokenHash?: string; invitationType?: "invite" | "recovery"; message?: string | string[] };
      if (!response.ok || !result.invitationTokenHash || !result.invitationType) throw new Error();
      const url = new URL("/activation", employeeAppUrl);
      url.searchParams.set("token_hash", result.invitationTokenHash);
      url.searchParams.set("type", result.invitationType);
      const invitation = url.toString();
      setInvitationUrl(invitation);
      try {
        await navigator.clipboard.writeText(invitation);
        setSuccess(`Nouveau lien créé pour ${employee.display_name}. Il est affiché ci-dessous et a été copié.`);
      } catch {
        setSuccess(`Nouveau lien créé pour ${employee.display_name}. Il reste disponible ci-dessous pour une copie manuelle.`);
      }
      await load(true);
    } catch {
      setError("Le lien d’invitation n’a pas pu être régénéré. Réessayez.");
    } finally {
      setRegeneratingEmployeeId("");
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
    const manualMatricule = String(form.get("matricule") ?? "").trim();
    const hiredAt = String(form.get("hiredAt") ?? "");
    if (manualMatricule && !new RegExp(`^INOX-EMP-${hiredAt.slice(0, 4)}-(?!0000)[0-9]{4}$`).test(manualMatricule)) {
      setError(`Le matricule doit correspondre à l’année d’embauche : INOX-EMP-${hiredAt.slice(0, 4)}-NNNN.`);
      setPending(false);
      return;
    }
    const body = {
      email: form.get("email"),
      displayName: form.get("displayName"),
      hiredAt,
      matricule: manualMatricule || undefined,
      siteId: form.get("siteId"),
    };

    try {
      const response = await fetch("/api/core/admin/employes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as { invitationTokenHash?: string; invitationType?: "invite" | "recovery"; message?: string };
      if (!response.ok || !result.invitationTokenHash) throw new Error(result.message);

      const url = new URL("/activation", employeeAppUrl);
      url.searchParams.set("token_hash", result.invitationTokenHash);
      url.searchParams.set("type", result.invitationType ?? "invite");
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
            <label>Date d’embauche<input name="hiredAt" type="date" required max={today} defaultValue={today} /></label>
            <label>Matricule (facultatif)<input name="matricule" autoComplete="off" maxLength={22} pattern={EMPLOYEE_MATRICULE_PATTERN} placeholder={`Automatique · INOX-EMP-${today.slice(0, 4)}-0001`} title="Laissez vide pour obtenir le premier numéro libre, ou saisissez un matricule INOX-EMP-AAAA-NNNN disponible." onInput={(event) => { event.currentTarget.value = formatMatriculeInput(event.currentTarget.value); }} /><small>Laissez vide pour une attribution automatique dans l’ordre croissant.</small></label>
            <label>Site<select name="siteId" required defaultValue=""><option value="" disabled>Choisir un site</option>{sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <button className="primary-button" disabled={pending}>{pending ? "Création…" : "Créer l’employé"}</button>
          </form>
        ) : <p>Créez un site avant d’ajouter un employé.</p>}
        {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
        {success ? <p className="form-message success-message" role="status">{success}</p> : null}
        {invitationUrl ? (
          <section className="invitation-panel" aria-labelledby="invitation-title">
            <h3 id="invitation-title">Lien d’invitation</h3>
            <p>Transmettez ce lien temporaire uniquement à l’employé concerné. S’il expire, utilisez « Régénérer le lien » dans le tableau.</p>
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
          <>
            <div className="employee-filters" role="search" aria-label="Filtrer les employés">
              <label>Nom<input type="search" value={filters.name} onChange={(event) => updateFilter("name", event.target.value)} placeholder="Rechercher un nom" /></label>
              <label>Matricule<input type="search" value={filters.matricule} onChange={(event) => updateFilter("matricule", event.target.value)} placeholder="Rechercher un matricule" /></label>
              <label>Site<input type="search" value={filters.site} onChange={(event) => updateFilter("site", event.target.value)} placeholder="Rechercher un site" /></label>
              <label>État<select value={filters.status} onChange={(event) => updateFilter("status", event.target.value as EmployeeFilters["status"])}><option value="">Tous les états</option><option value="active">Actif</option><option value="pending">Invitation en attente</option><option value="blocked">Bloqué</option></select></label>
              <button className="secondary-button compact-button" type="button" onClick={() => setFilters(emptyFilters)} disabled={!hasFilters}>Réinitialiser</button>
            </div>
            <p className="filter-summary" role="status">{filteredEmployees.length} résultat{filteredEmployees.length > 1 ? "s" : ""} sur {employees.length} employé{employees.length > 1 ? "s" : ""}.</p>
            {filteredEmployees.length ? (
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau des employés, défilement vertical et horizontal disponible">
                <table>
                  <thead><tr><th>Nom</th><th>Matricule</th><th>Site</th><th>État</th>{canManage ? <th>Actions</th> : null}</tr></thead>
                  <tbody>{filteredEmployees.map((employee) => <tr key={employee.id}><td>{employee.display_name}</td><td>{employee.matricule}</td><td>{employee.sites?.name ?? "Non affecté"}</td><td><span className={`status-badge ${employee.status}`}>{employee.status === "active" ? "Actif" : employee.status === "pending" ? "Invitation en attente" : "Bloqué"}</span></td>{canManage ? <td><div className="row-actions">{employee.status === "pending" ? <button className="secondary-button compact-button" type="button" disabled={Boolean(regeneratingEmployeeId) || actionPending} onClick={() => void regenerateInvitation(employee)}>{regeneratingEmployeeId === employee.id ? "Génération…" : "Régénérer le lien"}</button> : null}<button className="secondary-button compact-button" type="button" disabled={actionPending || Boolean(regeneratingEmployeeId)} onClick={() => setEmployeeAction({ kind: employee.active ? "block" : "unblock", employee })}>{employee.active ? "Bloquer" : "Réactiver"}</button><button className="danger-button compact-button" type="button" disabled={actionPending || Boolean(regeneratingEmployeeId)} onClick={() => setEmployeeAction({ kind: "delete", employee })}>Supprimer</button></div></td> : null}</tr>)}</tbody>
                </table>
              </div>
            ) : <p>Aucun employé ne correspond aux filtres sélectionnés.</p>}
          </>
        ) : <p>Aucun employé enregistré.</p>}
      </section>
      {employeeAction ? <ConfirmationDialog
        title={employeeAction.kind === "delete" ? `Supprimer ${employeeAction.employee.display_name} ?` : employeeAction.kind === "block" ? `Bloquer ${employeeAction.employee.display_name} ?` : `Réactiver ${employeeAction.employee.display_name} ?`}
        description={employeeAction.kind === "delete"
          ? "Cette suppression est définitive : le compte Supabase, la fiche employé et tout son historique de présence seront supprimés. La connexion deviendra impossible."
          : employeeAction.kind === "block"
            ? "Le compte sera bloqué immédiatement. L’employé ne pourra plus se connecter, générer un QR ni confirmer un pointage."
            : "Le compte sera réactivé. L’employé pourra de nouveau se connecter et utiliser sa carte de pointage."}
        confirmLabel={employeeAction.kind === "delete" ? "Supprimer définitivement" : employeeAction.kind === "block" ? "Bloquer l’employé" : "Réactiver l’employé"}
        pending={actionPending}
        onCancel={() => setEmployeeAction(null)}
        onConfirm={() => void applyEmployeeAction()}
      /> : null}
    </div>
  );
}
