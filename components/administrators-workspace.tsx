"use client";

import { useState, type FormEvent } from "react";
import ConfirmationDialog from "@/components/confirmation-dialog";
import type { AdministratorMember } from "@/lib/admin-members";
import { adminRoleLabel } from "@/lib/auth/types";
import { formatMatriculeInput, MATRICULE_PATTERN } from "@/lib/matricule";

type Props = {
  initialAdministrators: AdministratorMember[];
  currentUserId: string;
  initialError?: string;
};

type ManagedRole = "administrator" | "maintainer";

const statusLabels: Record<AdministratorMember["status"], string> = {
  active: "Actif",
  pending: "Invitation en attente",
  blocked: "Bloqué",
};

export default function AdministratorsWorkspace({ initialAdministrators, currentUserId, initialError = "" }: Props) {
  const [administrators, setAdministrators] = useState(initialAdministrators);
  const [invitationUrl, setInvitationUrl] = useState("");
  const [error, setError] = useState(initialError);
  const [success, setSuccess] = useState("");
  const [copyStatus, setCopyStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [regeneratingUserId, setRegeneratingUserId] = useState("");
  const [rolePendingUserId, setRolePendingUserId] = useState("");
  const [roleTarget, setRoleTarget] = useState<{ administrator: AdministratorMember; role: ManagedRole } | null>(null);
  const [draftRoles, setDraftRoles] = useState<Record<string, ManagedRole>>(() => Object.fromEntries(
    initialAdministrators
      .filter((administrator): administrator is AdministratorMember & { role: ManagedRole } => administrator.role !== "owner")
      .map((administrator) => [administrator.userId, administrator.role]),
  ));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setPending(true);
    setError("");
    setSuccess("");
    setCopyStatus("");
    setInvitationUrl("");

    try {
      const response = await fetch("/api/admin/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: form.get("displayName"),
          email: form.get("email"),
          matricule: form.get("matricule"),
          role: form.get("role"),
        }),
      });
      const result = await response.json() as { invitationUrl?: string; member?: AdministratorMember; error?: string };
      if (!response.ok || !result.invitationUrl || !result.member) {
        if (result.error === "email_already_used") throw new Error("Cette adresse e-mail possède déjà un compte.");
        if (result.error === "matricule_already_used") throw new Error("Ce matricule est déjà attribué.");
        if (result.error === "unauthenticated" || result.error === "mfa_required") throw new Error("Votre session sécurisée a expiré. Reconnectez-vous, puis réessayez.");
        if (result.error === "forbidden") throw new Error("Votre compte ne dispose pas du droit d’inviter un administrateur.");
        if (result.error === "service_unavailable") throw new Error("Le service d’administration est momentanément indisponible. Réessayez dans quelques instants.");
        throw new Error("L’invitation administrateur n’a pas été créée. Vérifiez les informations.");
      }

      setInvitationUrl(result.invitationUrl);
      setAdministrators((current) => [...current, result.member!].sort((first, second) => first.displayName.localeCompare(second.displayName, "fr")));
      if (result.member.role !== "owner") {
        setDraftRoles((current) => ({ ...current, [result.member!.userId]: result.member!.role as ManagedRole }));
      }
      formElement.reset();
      try {
        await navigator.clipboard.writeText(result.invitationUrl);
        setSuccess(`${adminRoleLabel(result.member.role)} créé. Le lien sécurisé est affiché ci-dessous et a été copié.`);
      } catch {
        setSuccess(`${adminRoleLabel(result.member.role)} créé. Le lien sécurisé reste disponible ci-dessous pour une copie manuelle.`);
      }
    } catch (submitError) {
      const message = submitError instanceof TypeError
        ? "Connexion au service interrompue. Vérifiez votre réseau, puis réessayez."
        : submitError instanceof Error
          ? submitError.message
          : "L’invitation administrateur n’a pas été créée.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function copyInvitation() {
    if (!invitationUrl) return;
    try {
      await navigator.clipboard.writeText(invitationUrl);
      setCopyStatus("Lien administrateur copié dans le presse-papiers.");
    } catch {
      setCopyStatus("Copie automatique impossible. Sélectionnez le lien puis copiez-le manuellement.");
    }
  }

  async function regenerateInvitation(administrator: AdministratorMember) {
    setRegeneratingUserId(administrator.userId);
    setError("");
    setSuccess("");
    setCopyStatus("");
    setInvitationUrl("");
    try {
      const response = await fetch(`/api/core/admin/administrateurs/${administrator.userId}/invitation`, { method: "POST" });
      const result = await response.json() as { invitationTokenHash?: string; invitationType?: "invite" | "recovery"; message?: string | string[] };
      if (!response.ok || !result.invitationTokenHash || !result.invitationType) throw new Error();
      const url = new URL("/invitation", window.location.origin);
      url.searchParams.set("token_hash", result.invitationTokenHash);
      url.searchParams.set("type", result.invitationType);
      const invitation = url.toString();
      setInvitationUrl(invitation);
      try {
        await navigator.clipboard.writeText(invitation);
        setSuccess(`Nouveau lien créé pour ${administrator.displayName}. Il est affiché ci-dessous et a été copié.`);
      } catch {
        setSuccess(`Nouveau lien créé pour ${administrator.displayName}. Il reste disponible ci-dessous pour une copie manuelle.`);
      }
    } catch {
      setError("Le lien administrateur n’a pas pu être régénéré. Réessayez.");
    } finally {
      setRegeneratingUserId("");
    }
  }

  async function updateRole() {
    if (!roleTarget) return;
    const { administrator, role } = roleTarget;
    setRolePendingUserId(administrator.userId);
    setError("");
    setSuccess("");
    try {
      const response = await fetch(`/api/core/admin/administrateurs/${administrator.userId}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const result = await response.json() as { member?: AdministratorMember; message?: string | string[] };
      const messages = Array.isArray(result.message) ? result.message : [result.message];
      if (!response.ok || !result.member) {
        if (messages.includes("PROPRIETAIRE_PROTEGE")) throw new Error("Le rôle du propriétaire est protégé.");
        if (messages.includes("ROLE_PROPRE_COMPTE_PROTEGE")) throw new Error("Vous ne pouvez pas modifier votre propre rôle.");
        if (response.status === 403) throw new Error("Votre compte ne dispose pas du droit de modifier ce rôle.");
        throw new Error("Le rôle n’a pas été modifié. Réessayez.");
      }
      setAdministrators((current) => current.map((item) => item.userId === result.member!.userId ? result.member! : item));
      setDraftRoles((current) => ({ ...current, [result.member!.userId]: result.member!.role as ManagedRole }));
      setSuccess(`Le rôle de ${administrator.displayName} est maintenant ${adminRoleLabel(result.member.role).toLowerCase()}.`);
      setRoleTarget(null);
    } catch (roleError) {
      setError(roleError instanceof Error ? roleError.message : "Le rôle n’a pas été modifié.");
    } finally {
      setRolePendingUserId("");
    }
  }

  return (
    <div className="workspace">
      <section className="panel sensitive-admin-panel">
        <div className="sensitive-admin-heading">
          <p>ACCÈS SENSIBLE</p>
          <h2>Inviter un administrateur ou un mainteneur</h2>
          <span>L’administrateur gère les comptes et les opérations. Le mainteneur gère les pointages, sites et terminaux, sans pouvoir créer, bloquer ou supprimer des comptes.</span>
        </div>
        <form className="admin-form" onSubmit={submit}>
          <label>Nom complet<input name="displayName" required minLength={2} maxLength={100} autoComplete="name" /></label>
          <label>E-mail professionnel<input name="email" type="email" required autoComplete="email" /></label>
          <label>Matricule administrateur<input name="matricule" inputMode="numeric" autoComplete="off" required maxLength={11} pattern={MATRICULE_PATTERN} placeholder="000-000-000" title="Saisissez exactement 9 chiffres." onInput={(event) => { event.currentTarget.value = formatMatriculeInput(event.currentTarget.value); }} /></label>
          <label>Rôle<select name="role" defaultValue="maintainer" required><option value="maintainer">Mainteneur — opérations uniquement</option><option value="administrator">Administrateur — tous les droits hors propriétaire</option></select></label>
          <button className="danger-button" disabled={pending}>{pending ? "Création sécurisée…" : "Créer l’invitation"}</button>
        </form>
        {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
        {success ? <p className="form-message success-message" role="status">{success}</p> : null}
        {invitationUrl ? (
          <section className="admin-invitation-panel" aria-labelledby="admin-invitation-title">
            <p className="admin-invitation-kicker">LIEN D’INSCRIPTION SÉCURISÉ</p>
            <h3 id="admin-invitation-title">Invitation confidentielle à usage personnel</h3>
            <p>Transmettez ce lien temporaire uniquement à l’administrateur concerné. S’il expire, régénérez-le depuis la ligne du compte en attente.</p>
            <label htmlFor="administrator-invitation-link">Lien sécurisé</label>
            <div className="invitation-copy-row">
              <input id="administrator-invitation-link" value={invitationUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
              <button className="secondary-button" type="button" onClick={() => void copyInvitation()}>Copier le lien administrateur</button>
            </div>
            {copyStatus ? <p className="copy-status" role="status">{copyStatus}</p> : null}
          </section>
        ) : null}
      </section>

      <section className="panel">
        <h2>Comptes administrateurs</h2>
        {administrators.length ? (
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tableau des administrateurs, défilement vertical et horizontal disponible">
            <table>
              <thead><tr><th>Nom</th><th>Matricule</th><th>E-mail</th><th>Rôle</th><th>État</th><th>Action</th></tr></thead>
              <tbody>{administrators.map((administrator) => {
                const isProtected = administrator.role === "owner" || administrator.userId === currentUserId;
                const draftRole = administrator.role === "owner" ? null : (draftRoles[administrator.userId] ?? administrator.role);
                return <tr key={administrator.userId}>
                  <td>{administrator.displayName}</td>
                  <td>{administrator.matricule}</td>
                  <td>{administrator.email}</td>
                  <td>{adminRoleLabel(administrator.role)}</td>
                  <td><span className={`status-badge ${administrator.status}`}>{statusLabels[administrator.status]}</span></td>
                  <td><div className="row-actions">
                    {administrator.role !== "owner" && administrator.status === "pending" ? <button className="secondary-button compact-button" type="button" disabled={Boolean(regeneratingUserId) || Boolean(rolePendingUserId)} onClick={() => void regenerateInvitation(administrator)}>{regeneratingUserId === administrator.userId ? "Génération…" : "Régénérer le lien"}</button> : null}
                    {!isProtected && draftRole ? <><select className="compact-role-select" aria-label={`Nouveau rôle de ${administrator.displayName}`} value={draftRole} disabled={Boolean(rolePendingUserId)} onChange={(event) => setDraftRoles((current) => ({ ...current, [administrator.userId]: event.target.value as ManagedRole }))}><option value="administrator">Administrateur</option><option value="maintainer">Mainteneur</option></select><button className="secondary-button compact-button" type="button" disabled={draftRole === administrator.role || Boolean(rolePendingUserId)} onClick={() => setRoleTarget({ administrator, role: draftRole })}>{rolePendingUserId === administrator.userId ? "Modification…" : "Changer le rôle"}</button></> : null}
                    {isProtected && administrator.status !== "pending" ? <span className="protected-role-label">{administrator.role === "owner" ? "Rôle protégé" : "Votre compte"}</span> : null}
                  </div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : <p>Aucun compte administrateur disponible.</p>}
      </section>
      {roleTarget ? <ConfirmationDialog
        title={`Changer le rôle de ${roleTarget.administrator.displayName} ?`}
        description={roleTarget.role === "administrator"
          ? "Ce compte pourra gérer les administrateurs et les employés, en plus de toutes les opérations de pointage. Le propriétaire restera protégé."
          : "Ce compte conservera l’accès aux métriques, aux pointages, aux sites, aux terminaux et à ses paramètres, mais ne pourra plus gérer les comptes."}
        confirmLabel={`Attribuer le rôle ${adminRoleLabel(roleTarget.role).toLowerCase()}`}
        pending={rolePendingUserId === roleTarget.administrator.userId}
        onCancel={() => setRoleTarget(null)}
        onConfirm={() => void updateRole()}
      /> : null}
    </div>
  );
}
