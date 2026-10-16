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

  const requiresPassword = userData.user.app_metadata.inox_admin_role !== "owner";
  return (
    <AuthShell
      eyebrow="Activation personnelle"
      title="Sécurisez votre compte"
      description={requiresPassword ? "Définissez votre mot de passe puis activez votre QR TOTP personnel." : "Activez votre QR TOTP personnel pour protéger votre compte propriétaire."}
    >
      <MfaEnrollment email={userData.user.email ?? "Compte INOX"} requiresPassword={requiresPassword} />
    </AuthShell>
  );
}
