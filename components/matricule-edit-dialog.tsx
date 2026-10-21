"use client";

import { useState, type FormEvent } from "react";
import { formatMatriculeInput } from "@/lib/matricule";

type Props = {
  kind: "employee" | "administrator";
  subjectName: string;
  currentMatricule: string;
  hiredAt: string;
  pending: boolean;
  error?: string;
  onEdit?: () => void;
  onCancel: () => void;
  onConfirm: (matricule: string) => void;
};

export default function MatriculeEditDialog({
  kind,
  subjectName,
  currentMatricule,
  hiredAt,
  pending,
  error = "",
  onEdit,
  onCancel,
  onConfirm,
}: Props) {
  const [value, setValue] = useState(currentMatricule);
  const year = hiredAt.slice(0, 4);
  const prefix = kind === "employee" ? "INOX-EMP" : "INOX-ADMIN";
  const pattern = `${prefix}-${year}-(?!0000)[0-9]{4}`;
  const valid = new RegExp(`^${pattern}$`).test(value);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && value !== currentMatricule) onConfirm(value);
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="matricule-edit-title" aria-describedby="matricule-edit-description">
        <p className="dialog-eyebrow">IDENTIFIANT SENSIBLE</p>
        <h2 id="matricule-edit-title">Modifier le matricule</h2>
        <p id="matricule-edit-description">Le nouveau matricule de {subjectName} doit être libre et conserver l’année d’embauche {year}. La modification sera inscrite dans le journal d’audit.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label>Nouveau matricule
            <input
              autoFocus
              required
              autoComplete="off"
              maxLength={kind === "employee" ? 18 : 20}
              pattern={pattern}
              value={value}
              aria-invalid={Boolean(value) && !valid}
              onChange={(event) => {
                setValue(formatMatriculeInput(event.target.value));
                onEdit?.();
              }}
            />
            <small>Format attendu : {prefix}-{year}-NNNN, avec un numéro différent de 0000.</small>
          </label>
          {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
          <div className="dialog-actions">
            <button className="secondary-button" type="button" onClick={onCancel} disabled={pending}>Annuler</button>
            <button className="danger-button" disabled={pending || !valid || value === currentMatricule}>{pending ? "Enregistrement…" : "Modifier le matricule"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
