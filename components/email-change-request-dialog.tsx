"use client";

import { useState, type FormEvent } from "react";

type Props = {
  subjectName: string;
  currentEmail: string;
  requireInoxDomain?: boolean;
  pending: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (newEmail: string) => void;
};

export default function EmailChangeRequestDialog({ subjectName, currentEmail, requireInoxDomain = false, pending, error = "", onCancel, onConfirm }: Props) {
  const [newEmail, setNewEmail] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = newEmail.trim().toLowerCase();
    if (normalized !== confirmation.trim().toLowerCase()) {
      setValidationError("Les deux adresses e-mail ne correspondent pas.");
      return;
    }
    if (normalized === currentEmail.trim().toLowerCase()) {
      setValidationError("La nouvelle adresse doit être différente de l’adresse actuelle.");
      return;
    }
    if (requireInoxDomain && !normalized.endsWith("@inox.ci")) {
      setValidationError("Une adresse professionnelle se terminant par @inox.ci est obligatoire.");
      return;
    }
    setValidationError("");
    onConfirm(normalized);
  }

  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="email-change-dialog-title">
        <p className="dialog-eyebrow">IDENTIFIANT DE CONNEXION</p>
        <h2 id="email-change-dialog-title">Proposer une nouvelle adresse à {subjectName}</h2>
        <p>L’adresse actuelle reste active. Le titulaire devra accepter la demande puis confirmer l’ancienne et la nouvelle adresse.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label>Adresse actuelle<input value={currentEmail} readOnly /></label>
          <label>Nouvelle adresse<input type="email" autoComplete="off" maxLength={254} required value={newEmail} onChange={(event) => setNewEmail(event.target.value)} /></label>
          <label>Confirmer la nouvelle adresse<input type="email" autoComplete="off" maxLength={254} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
          {validationError || error ? <p className="error-message" role="alert">{validationError || error}</p> : null}
          <div className="dialog-actions">
            <button className="secondary-button" type="button" disabled={pending} onClick={onCancel}>Annuler</button>
            <button className="primary-button" disabled={pending}>{pending ? "Création…" : "Créer la demande"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
