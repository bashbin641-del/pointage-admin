import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthShell from "@/components/auth-shell";
import MfaEnrollment from "@/components/mfa-enrollment";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function ActivationPage() { await connection(); const supabase = await createClient(); const [{ data: userData }, { data: aalData }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]); if (!userData.user) redirect("/connexion"); if (aalData?.currentLevel === "aal2") redirect("/"); return <AuthShell eyebrow="Activation personnelle" title="Sécurisez votre compte" description="Définissez votre mot de passe puis activez votre QR TOTP personnel."><MfaEnrollment email={userData.user.email ?? "Compte INOX"} /></AuthShell>; }
