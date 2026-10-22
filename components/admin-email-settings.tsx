"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

type EmailRequest = {
  id: string;
  newEmail: string;
  status: "pending_target" | "awaiting_confirmations";
  expiresAt: string;
  assisted: boolean;
  canCancel: boolean;
};

type EmailChangeState = { currentEmail: string; authPendingEmail: string | null; request: EmailRequest | null };

export default function AdminEmailSettings({ email }: { email: string }) {
  const [state, setState] = useState<EmailChangeState>({ currentEmail: email, authPendingEmail: null, request: null });
  const [newEmail, setNewEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [totp, setTotp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/core/moi/changement-email", { cache: "no-store" });
    if (!response.ok) throw new Error();
    setState(await response.json() as EmailChangeState);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/core/moi/changement-email", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<EmailChangeState>;
      })
      .then((result) => { if (!cancelled) setState(result); })
      .catch(() => { if (!cancelled) setError("Impossible de charger l’état du changement d’adresse."); });
    return () => { cancelled = true; };
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

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    setSuccess("");
    let request = state.request;
    try {
      const requestedEmail = request?.newEmail ?? newEmail.trim().toLowerCase();
      if (!request) {
        if (requestedEmail !== confirmation.trim().toLowerCase()) throw new Error("EMAIL_MISMATCH");
        if (!requestedEmail.endsWith("@inox.ci")) throw new Error("INOX_EMAIL_REQUIRED");
        if (requestedEmail === state.currentEmail.toLowerCase()) throw new Error("EMAIL_IDENTICAL");
      }
      await verifyTotp();
      if (!request) {
        const response = await fetch("/api/core/moi/changement-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ newEmail: requestedEmail }),
        });
        const result = await response.json() as { request?: EmailRequest; message?: string };
        if (!response.ok || !result.request) throw new Error(result.message || "REQUEST_FAILED");
        request = result.request;
        setState((current) => ({ ...current, request }));
      }
      const supabase = await createClient();
      const { error: updateError } = await supabase.auth.updateUser(
        { email: request.newEmail },
        { emailRedirectTo: `${window.location.origin}/changement-email-confirme` },
      );
      if (updateError) throw updateError;
      const response = await fetch(`/api/core/moi/changement-email/${request.id}/initie`, { method: "POST" });
      if (!response.ok) throw new Error("TRACKING_FAILED");
      setTotp("");
      setNewEmail("");
      setConfirmation("");
      setSuccess("Les confirmations ont été envoyées à l’adresse actuelle et à la nouvelle adresse.");
      await refresh();
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : "";
      setError(code === "INVALID_TOTP" ? "Le code TOTP est incorrect ou expiré."
        : code === "MFA_FACTOR_MISSING" ? "Aucun facteur TOTP actif n’est disponible."
          : code === "EMAIL_MISMATCH" ? "Les deux adresses e-mail ne correspondent pas."
            : code === "INOX_EMAIL_REQUIRED" || code === "EMAIL_ADMINISTRATEUR_INOX_REQUIS" ? "Une adresse professionnelle se terminant par @inox.ci est obligatoire."
              : code === "EMAIL_DEJA_UTILISE" || code === "EMAIL_DEJA_EN_ATTENTE" ? "Cette adresse est déjà utilisée ou réservée."
                : code === "EMAIL_IDENTICAL" ? "La nouvelle adresse doit être différente de l’adresse actuelle."
                  : "La modification n’a pas pu être lancée. Vérifiez les informations puis réessayez.");
    } finally {
      setPending(false);
    }
  }

  async function cancelRequest() {
    if (!state.request?.canCancel) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/core/moi/changement-email/${state.request.id}/annulation`, { method: "POST" });
      if (!response.ok) throw new Error();
      setSuccess("La demande a été annulée.");
      await refresh();
    } catch {
      setError("Cette demande ne peut plus être annulée.");
    } finally {
      setPending(false);
    }
  }

  async function resendConfirmations() {
    setPending(true);
    setError("");
    try {
      const supabase = await createClient();
      const { error: resendError } = await supabase.auth.resend({
        type: "email_change",
        email: state.currentEmail,
        options: { emailRedirectTo: `${window.location.origin}/changement-email-confirme` },
      });
      if (resendError) throw resendError;
      if (!state.request) throw new Error("REQUEST_MISSING");
      const trackingResponse = await fetch(`/api/core/moi/changement-email/${state.request.id}/renvoye`, { method: "POST" });
      if (!trackingResponse.ok) throw new Error("TRACKING_FAILED");
      setSuccess("Les confirmations ont été renvoyées aux deux adresses.");
      await refresh();
    } catch {
      setError("Les confirmations n’ont pas pu être renvoyées. Attendez quelques instants puis réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel password-settings" aria-labelledby="admin-email-title">
      <div>
        <p className="eyebrow">IDENTIFIANT DE CONNEXION</p>
        <h2 id="admin-email-title">Modifier l’adresse e-mail</h2>
        <p>Adresse actuelle : <strong>{state.currentEmail}</strong>. Un code TOTP et la confirmation des deux adresses sont obligatoires.</p>
      </div>
      {state.request?.status === "awaiting_confirmations" ? (
        <div className="email-change-status" role="status">
          <strong>Confirmations en attente</strong>
          <p>Nouvelle adresse : {state.request.newEmail}. Les deux messages doivent être confirmés avant expiration.</p>
          <button className="secondary-button" type="button" disabled={pending} onClick={() => void resendConfirmations()}>{pending ? "Envoi…" : "Renvoyer les confirmations"}</button>
        </div>
      ) : (
        <form className="admin-form compact" onSubmit={submit}>
          {state.request ? <div className="email-change-status"><strong>{state.request.assisted ? "Modification proposée par le propriétaire" : "Demande en attente"}</strong><p>Nouvelle adresse : {state.request.newEmail}. Aucun changement ne sera appliqué sans votre TOTP.</p></div> : <>
            <label>Nouvelle adresse professionnelle<input type="email" autoComplete="email" maxLength={254} required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} placeholder="nom@inox.ci" /></label>
            <label>Confirmer la nouvelle adresse<input type="email" autoComplete="email" maxLength={254} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          </>}
          <label>Code TOTP actuel<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
          <div className="settings-actions">
            <button className="primary-button" disabled={pending}>{pending ? "Vérification…" : "Vérifier et envoyer les confirmations"}</button>
            {state.request?.canCancel ? <button className="secondary-button" type="button" disabled={pending} onClick={() => void cancelRequest()}>{state.request.assisted ? "Refuser la demande" : "Annuler la demande"}</button> : null}
          </div>
        </form>
      )}
      {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
      {success ? <p className="form-message success-message" role="status">{success}</p> : null}
    </section>
  );
}
