import { redirect } from "next/navigation";
import { connection } from "next/server";
import AdminShell from "@/components/admin-shell";
import AdminPasswordSettings from "@/components/admin-password-settings";
import { authenticateAdmin } from "@/lib/auth/server";
import type { AdminRole } from "@/lib/auth/types";

export const instant = false;

const roleLabels: Record<AdminRole, string> = {
  owner: "Propriétaire",
  administrator: "Administrateur",
  maintainer: "Mainteneur",
};

export default async function SettingsPage() {
  await connection();
  const auth = await authenticateAdmin();
  if (!auth.ok) redirect(auth.reason === "mfa_required" ? "/mfa" : auth.reason === "enrollment_required" ? "/activation" : "/connexion");

  return (
    <AdminShell identity={auth.identity} activePath="/parametres" title="Paramètres du compte">
      <div className="workspace settings-workspace">
        <section className="panel account-summary" aria-labelledby="admin-account-title">
          <div>
            <p className="eyebrow">COMPTE ADMINISTRATEUR</p>
            <h2 id="admin-account-title">Informations de connexion</h2>
          </div>
          <dl>
            <div><dt>Nom</dt><dd>{auth.identity.displayName}</dd></div>
            <div><dt>Matricule</dt><dd>{auth.identity.matricule}</dd></div>
            <div><dt>Adresse de connexion</dt><dd>{auth.identity.email}</dd></div>
            <div><dt>Rôle</dt><dd>{roleLabels[auth.identity.role]}</dd></div>
          </dl>
        </section>
        <AdminPasswordSettings email={auth.identity.email} />
      </div>
    </AdminShell>
  );
}
