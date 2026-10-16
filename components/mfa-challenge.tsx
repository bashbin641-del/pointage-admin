"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaChallenge() { const router = useRouter(); const [factorId, setFactorId] = useState(""); const [code, setCode] = useState(""); const [error, setError] = useState(""); const [pending, setPending] = useState(false);
  useEffect(() => { let active = true; void (async () => { const supabase = await createClient(); const { data, error: listError } = await supabase.auth.mfa.listFactors(); const factor = data?.totp.find((item) => item.status === "verified"); if (!active) return; if (listError || !factor) { router.replace("/activation"); return; } setFactorId(factor.id); })(); return () => { active = false; }; }, [router]);
  async function verify(event: React.FormEvent<HTMLFormElement>) { event.preventDefault(); setPending(true); setError(""); try { const supabase = await createClient(); const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId }); if (challengeError) throw challengeError; const { error: verifyError } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code }); if (verifyError) throw verifyError; router.replace("/"); router.refresh(); } catch { setError("Le code est incorrect ou expiré."); } finally { setPending(false); } }
  return <form className="auth-form" onSubmit={verify}><label>Code TOTP à 6 chiffres<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>{error ? <p className="auth-error" role="alert">{error}</p> : null}<button className="auth-submit" type="submit" disabled={pending || !factorId || code.length !== 6}>{pending ? "Validation…" : "Ouvrir ma session"}</button></form>;
}
