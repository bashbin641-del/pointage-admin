import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthShell from "@/components/auth-shell";
import MfaEnrollment from "@/components/mfa-enrollment";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ActivationPage() {
  await connection();
  const supabase = await createClient();
  const [{ data: userData }, { data: aalData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (!userData.user) redirect("/connexion");
  if (aalData?.currentLevel === "aal2") redirect("/");

  const metadata = userData.user.app_metadata;
  const isOwner = metadata.inox_admin_role === "owner";
  const requiresPassword = !isOwner;
  return (
    <AuthShell
      eyebrow={isOwner ? "Activation propriétaire" : "INVITATION ADMINISTRATEUR"}
      title={isOwner ? "Sécurisez votre compte" : "Activez votre accès administrateur"}
      description={requiresPassword ? "Ce lien confidentiel active un compte d’administration INOX. Définissez votre mot de passe puis votre TOTP personnel." : "Activez votre QR TOTP personnel pour protéger votre compte propriétaire."}
    >
      {!isOwner ? <div className="admin-activation-notice" role="note"><strong>Accès administration sécurisé</strong><span>Matricule : {String(metadata.inox_admin_matricule || "Non attribué")} · Une validation TOTP sera exigée à chaque nouvelle session.</span></div> : null}
      <MfaEnrollment email={userData.user.email ?? "Compte INOX"} requiresPassword={requiresPassword} accountLabel={isOwner ? "Compte propriétaire" : "Compte administrateur invité"} />
    </AuthShell>
  );
}
