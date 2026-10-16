"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); try { const supabase = await createClient(); const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password }); if (signInError) throw signInError; const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel(); router.replace(data?.nextLevel === "aal2" ? "/mfa" : "/activation"); router.refresh(); } catch { setError("Adresse e-mail ou mot de passe incorrect."); } finally { setPending(false); } }
  return <form className="auth-form" onSubmit={submit}><label>E-mail professionnel<input type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nom@inox.ci" /></label><label>Mot de passe<input type="password" autoComplete="current-password" minLength={12} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>{error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="auth-submit" type="submit" disabled={pending}>{pending ? "Vérification…" : "Continuer vers le code à 6 chiffres"}</button><p className="auth-help">Aucune inscription publique. L’accès commence par une invitation du propriétaire ou d’un administrateur.</p></form>;
}
