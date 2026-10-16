import { redirect } from "next/navigation";
import { connection } from "next/server";
import AuthShell from "@/components/auth-shell";
import LoginForm from "@/components/login-form";
import { createClient } from "@/lib/supabase/server";
import { hasSupabaseConfig } from "@/lib/supabase/config";

export const instant = false;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  await connection();
  if (!hasSupabaseConfig()) redirect("/");
  const { data } = await (await createClient()).auth.getUser();
  if (data.user) redirect("/");
  const { erreur } = await searchParams;
  return <AuthShell eyebrow="Connexion sécurisée" title="Accéder à INOX Présence" description="Identifiants professionnels, puis code TOTP généré par votre application d’authentification."><LoginForm initialError={erreur === "invitation" ? "Ce lien d’invitation est invalide ou expiré. Demandez un nouveau lien à un administrateur." : undefined} /></AuthShell>;
}
