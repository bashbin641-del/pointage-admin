"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import RecoveryEmailChange from "@/components/recovery-email-change";

type RecoveryStatus = {
  primaryEmail: string | null;
  recoveryEmail: string | null;
  verified: boolean;
  availableAfter: string | null;
  inCooldown: boolean;
  configuration: { available: boolean; required: boolean };
};

async function responseMessage(response: Response) {
  const body = await response.json().catch(() => ({})) as { message?: string };
  if (!response.ok) throw new Error(body.message || "REQUEST_FAILED");
  return body;
}

export default function RecoveryEmailSettings() {
  const [status, setStatus] = useState<RecoveryStatus | null>(null);
  const [email, setEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [totp, setTotp] = useState("");
  const [challengeId, setChallengeId] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function refresh() {
    const response = await fetch("/api/core/moi/adresse-recuperation", { cache: "no-store" });
    const result = await responseMessage(response) as RecoveryStatus;
    setStatus(result);
  }

  useEffect(() => {
    let active = true;
    void fetch("/api/core/moi/adresse-recuperation", { cache: "no-store" })
      .then(async (response) => responseMessage(response) as Promise<RecoveryStatus>)
      .then((result) => { if (active) setStatus(result); })
      .catch(() => { if (active) setError("Impossible de charger l’adresse de récupération."); });
    return () => { active = false; };
  }, []);

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

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    const normalized = email.trim().toLowerCase();
    if (normalized !== confirmation.trim().toLowerCase()) {
      setError("Les deux adresses e-mail ne correspondent pas.");
      return;
    }
    setPending(true);
    try {
      await verifyTotp();
      const response = await fetch("/api/core/moi/adresse-recuperation/demande", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalized }),
      });
      const result = await responseMessage(response) as { challengeId: string; destination: string };
      setChallengeId(result.challengeId);
      setTotp("");
      setSuccess(`Un code à 8 chiffres a été envoyé à ${result.destination}.`);
    } catch (requestError) {
      const reason = requestError instanceof Error ? requestError.message : "";
      setError(reason === "INVALID_TOTP" ? "Le code TOTP est incorrect ou expiré."
        : reason === "EMAIL_RECUPERATION_IDENTIQUE" ? "L’adresse de récupération doit être différente de l’adresse de connexion."
          : reason === "EMAIL_RECUPERATION_DEJA_UTILISE" ? "Cette adresse est déjà associée à un autre compte."
            : reason === "TROP_DE_DEMANDES_EMAIL_RECUPERATION" ? "Trop de demandes ont été effectuées. Réessayez dans 15 minutes."
              : "Le code de vérification n’a pas pu être envoyé.");
    } finally {
      setPending(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/core/moi/adresse-recuperation/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      await responseMessage(response);
      setChallengeId("");
      setCode("");
      setEmail("");
      setConfirmation("");
      setSuccess("L’adresse de récupération est vérifiée. Elle sera utilisable pour les actions sensibles après le délai de sécurité de 24 heures.");
      await refresh();
    } catch (verifyError) {
      const reason = verifyError instanceof Error ? verifyError.message : "";
      setError(reason === "CODE_RECUPERATION_EXPIRE" ? "Le code a expiré. Demandez un nouveau code."
        : reason === "CODE_RECUPERATION_BLOQUE" ? "Le code est bloqué après cinq essais. Demandez un nouveau code."
          : "Le code est incorrect ou a déjà été utilisé.");
    } finally {
      setPending(false);
    }
  }

  const availableAt = status?.availableAfter ? new Date(status.availableAfter) : null;

  return (
    <section className="panel password-settings" aria-labelledby="recovery-email-title">
      <div>
        <p className="eyebrow">RÉCUPÉRATION DU COMPTE</p>
        <h2 id="recovery-email-title">Adresse e-mail de récupération</h2>
        <p>Cette adresse secondaire permet de confirmer une action sensible si l’adresse de connexion devient inaccessible.</p>
      </div>
      {!status ? <p role="status">Chargement de la configuration…</p> : !status.configuration.available ? (
        <p className="form-message" role="status">L’envoi sécurisé est en attente de configuration SMTP. Aucune adresse de récupération ne peut encore être enregistrée.</p>
      ) : challengeId ? (
        <form className="admin-form compact" onSubmit={verifyCode}>
          <label>Code reçu sur l’adresse de récupération<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{8}" maxLength={8} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="00000000" /></label>
          <button className="primary-button" disabled={pending}>{pending ? "Vérification…" : "Vérifier l’adresse"}</button>
        </form>
      ) : (
        <>
          {status.verified ? <div className="email-change-status" role="status"><strong>Adresse vérifiée : {status.recoveryEmail}</strong><p>{status.inCooldown && availableAt ? `Délai de sécurité actif jusqu’au ${availableAt.toLocaleString("fr-FR")}.` : "Cette adresse peut recevoir les codes de récupération."}</p></div> : null}
          <RecoveryEmailChange status={status} />
          <form className="admin-form compact" onSubmit={requestCode}>
            <label>{status.verified ? "Nouvelle adresse de récupération" : "Adresse de récupération"}<input type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
            <label>Confirmer l’adresse<input type="email" autoComplete="email" maxLength={254} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
            <label>Code TOTP actuel<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
            <button className="primary-button" disabled={pending}>{pending ? "Vérification…" : status.verified ? "Vérifier la nouvelle adresse" : "Ajouter et vérifier l’adresse"}</button>
          </form>
        </>
      )}
      {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
      {success ? <p className="form-message success-message" role="status">{success}</p> : null}
    </section>
  );
}
