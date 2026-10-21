"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AdminPasswordSettings({ email }: { email: string }) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [totp, setTotp] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");
    if (password.length < 12) {
      setError("Le nouveau mot de passe doit contenir au moins 12 caractères.");
      return;
    }
    if (password !== confirmation) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    if (!/^\d{6}$/.test(totp)) {
      setError("Saisissez le code TOTP à 6 chiffres affiché dans votre application d’authentification.");
      return;
    }

    setPending(true);
    try {
      const supabase = await createClient();
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      const factor = factors?.totp.find((item) => item.status === "verified");
      if (factorsError || !factor) throw new Error("MFA_FACTOR_MISSING");

      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: factor.id });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: totp });
      if (verifyError) throw new Error("INVALID_TOTP");

      const { error: passwordError } = await supabase.auth.updateUser({ password });
      if (passwordError) throw passwordError;
      setPassword("");
      setConfirmation("");
      setTotp("");
      setSuccess("Votre mot de passe administrateur a été modifié. Utilisez-le lors de votre prochaine connexion.");
    } catch (submitError) {
      const message = submitError instanceof Error && submitError.message === "INVALID_TOTP"
        ? "Le code TOTP est incorrect ou expiré. Attendez le prochain code puis réessayez."
        : submitError instanceof Error && submitError.message === "MFA_FACTOR_MISSING"
          ? "Aucun facteur TOTP actif n’est disponible pour confirmer cette opération."
          : "Le mot de passe n’a pas pu être modifié. Vérifiez votre connexion puis réessayez.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="panel password-settings" aria-labelledby="admin-password-title">
      <div>
        <p className="eyebrow">SÉCURITÉ DU COMPTE</p>
        <h2 id="admin-password-title">Réinitialiser le mot de passe</h2>
        <p>Adresse concernée : <strong>{email}</strong>. L’ancien mot de passe n’est pas demandé. Un nouveau code TOTP est obligatoire avant l’enregistrement.</p>
      </div>
      <form className="admin-form compact" onSubmit={submit}>
        <label>Nouveau mot de passe<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <label>Code TOTP actuel<input className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={totp} onChange={(event) => setTotp(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
        <button className="primary-button" type="submit" disabled={pending}>{pending ? "Vérification et enregistrement…" : "Vérifier le TOTP et modifier"}</button>
      </form>
      {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
      {success ? <p className="form-message success-message" role="status">{success}</p> : null}
    </section>
  );
}
