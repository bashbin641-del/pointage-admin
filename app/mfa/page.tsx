import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthShell from "@/components/auth-shell";
import MfaChallenge from "@/components/mfa-challenge";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

export default async function MfaPage() { await connection(); const supabase = await createClient(); const [{ data: userData }, { data: aalData }] = await Promise.all([supabase.auth.getUser(), supabase.auth.mfa.getAuthenticatorAssuranceLevel()]); if (!userData.user) redirect("/connexion"); if (aalData?.currentLevel === "aal2") redirect("/"); if (aalData?.nextLevel !== "aal2") redirect("/activation"); return <AuthShell eyebrow="Deuxième facteur" title="Confirmez votre identité" description="Saisissez le code à 6 chiffres de Google Authenticator, Microsoft Authenticator, 1Password ou votre application TOTP."><MfaChallenge /></AuthShell>; }
