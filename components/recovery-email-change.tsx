"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type RecoveryStatus = { verified: boolean; inCooldown: boolean; recoveryEmail: string | null };
type Step = "idle" | "recovery-code" | "new-email" | "new-email-code";

async function responseBody<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({})) as T & { message?: string };
  if (!response.ok) throw new Error(body.message || "REQUEST_FAILED");
  return body;
}

export default function RecoveryEmailChange({ status }: { status: RecoveryStatus }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("idle");
  const [totp, setTotp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [recoveryProofToken, setRecoveryProofToken] = useState("");
  const [code, setCode] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (!status.verified || status.inCooldown) return null;

  async function verifyTotp() {
    if (!/^\d{6}$/.test(totp)) throw new Error("INVALID_TOTP");
    const supabase = await createClient();
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    const factor = factors?.totp.find((item) => item.status === "verified");
    if (factorsError || !factor) throw new Error("MFA_FACTOR_MISSING");
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
    if (challengeError) throw challengeError;
    const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: totp });
    if (verifyError) throw new Error("INVALID_TOTP");
  }

  async function begin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      await verifyTotp();
      const response = await fetch("/api/core/moi/adresse-recuperation/changement-email/code-recuperation", { method: "POST" });
      const result = await responseBody<{ challengeId: string; destination: string }>(response);
      setChallengeId(result.challengeId);
      setTotp("");
      setStep("recovery-code");
      setSuccess(`Un code a été envoyé à ${result.destination}.`);
    } catch (beginError) {
      setError(beginError instanceof Error && beginError.message === "INVALID_TOTP" ? "Le code TOTP est incorrect ou expiré." : "La procédure sécurisée n’a pas pu être lancée.");
    } finally {
      setPending(false);
    }
  }

  async function verifyRecoveryCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/core/moi/adresse-recuperation/changement-email/code-recuperation/verification", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId, code }),
      });
      const result = await responseBody<{ proofToken: string }>(response);
      setRecoveryProofToken(result.proofToken);
      setCode("");
      setStep("new-email");
      setSuccess("Adresse de récupération confirmée. Saisissez la nouvelle adresse professionnelle.");
    } catch { setError("Le code est incorrect, expiré ou déjà utilisé."); }
    finally { setPending(false); }
  }

  async function requestNewEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const normalized = newEmail.trim().toLowerCase();
    if (normalized !== confirmation.trim().toLowerCase()) { setError("Les deux adresses e-mail ne correspondent pas."); return; }
    if (!normalized.endsWith("@inox.ci")) { setError("Une adresse professionnelle se terminant par @inox.ci est obligatoire."); return; }
    setPending(true);
    try {
      const response = await fetch("/api/core/moi/adresse-recuperation/changement-email/nouvelle-adresse", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofToken: recoveryProofToken, newEmail: normalized }),
      });
      const result = await responseBody<{ challengeId: string; destination: string }>(response);
      setChallengeId(result.challengeId);
      setCode("");
      setStep("new-email-code");
      setSuccess(`Un second code a été envoyé à ${result.destination}.`);
    } catch (requestError) {
      const reason = requestError instanceof Error ? requestError.message : "";
      setError(reason === "EMAIL_DEJA_UTILISE" ? "Cette adresse est déjà utilisée." : "La nouvelle adresse n’a pas pu être vérifiée. Recommencez la procédure si nécessaire.");
    } finally { setPending(false); }
  }

  async function finish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const verifyResponse = await fetch("/api/core/moi/adresse-recuperation/changement-email/nouvelle-adresse/verification", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ recoveryProofToken, challengeId, code }),
      });
      const finalProof = await responseBody<{ proofToken: string }>(verifyResponse);
      const applyResponse = await fetch("/api/core/moi/adresse-recuperation/changement-email/appliquer", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ proofToken: finalProof.proofToken }),
      });
      await responseBody(applyResponse);
      const supabase = await createClient();
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/connexion?email=modifie");
    } catch { setError("Le second code est incorrect ou expiré. Aucune modification n’a été appliquée."); }
    finally { setPending(false); }
  }

  return (
    <div className="email-change-status">
      <strong>Adresse de connexion inaccessible ?</strong>
      <p>Le TOTP, l’adresse de récupération et la nouvelle adresse doivent être confirmés. Toutes les sessions seront ensuite fermées.</p>
      {step === "idle" ? <form className="admin-form compact" onSubmit={begin}><label>Code TOTP actuel<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, ""))} /></label><button className="secondary-button" disabled={pending}>{pending ? "Vérification…" : "Utiliser l’adresse de récupération"}</button></form> : null}
      {step === "recovery-code" ? <form className="admin-form compact" onSubmit={verifyRecoveryCode}><label>Code reçu sur l’adresse de récupération<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="primary-button" disabled={pending}>{pending ? "Vérification…" : "Confirmer l’adresse de récupération"}</button></form> : null}
      {step === "new-email" ? <form className="admin-form compact" onSubmit={requestNewEmailCode}><label>Nouvelle adresse professionnelle<input type="email" autoComplete="email" maxLength={254} required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nom@inox.ci" /></label><label>Confirmer la nouvelle adresse<input type="email" autoComplete="email" maxLength={254} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label><button className="primary-button" disabled={pending}>{pending ? "Envoi…" : "Envoyer le code à la nouvelle adresse"}</button></form> : null}
      {step === "new-email-code" ? <form className="admin-form compact" onSubmit={finish}><label>Code reçu sur la nouvelle adresse<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label><button className="primary-button" disabled={pending}>{pending ? "Modification…" : "Confirmer et modifier l’adresse"}</button></form> : null}
      {step !== "idle" ? <button className="secondary-button" type="button" disabled={pending} onClick={() => { setStep("idle"); setCode(""); setError(""); setSuccess(""); }}>Annuler</button> : null}
      {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
      {success ? <p className="form-message success-message" role="status">{success}</p> : null}
    </div>
  );
}
