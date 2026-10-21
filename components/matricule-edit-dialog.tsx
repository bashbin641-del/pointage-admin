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
  onConfirm: (matricule: string, hiredAt: string) => void;
};

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Abidjan" }).format(new Date());

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
  const [hiringDate, setHiringDate] = useState(hiredAt);
  const year = hiringDate.slice(0, 4);
  const prefix = kind === "employee" ? "INOX-EMP" : "INOX-ADMIN";
  const pattern = `${prefix}-${year}-(?!0000)[0-9]{4}`;
  const validDate = /^\d{4}-\d{2}-\d{2}$/.test(hiringDate) && hiringDate >= "1900-01-01" && hiringDate <= today;
  const valid = validDate && new RegExp(`^${pattern}$`).test(value);
  const changed = value !== currentMatricule || hiringDate !== hiredAt;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (valid && changed) onConfirm(value, hiringDate);
  }

  function changeHiringDate(nextHiringDate: string) {
    setHiringDate(nextHiringDate);
    const nextYear = nextHiringDate.slice(0, 4);
    const sequence = value.match(/-([0-9]{4})$/)?.[1];
    if (/^\d{4}$/.test(nextYear) && sequence) setValue(`${prefix}-${nextYear}-${sequence}`);
    onEdit?.();
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="matricule-edit-title" aria-describedby="matricule-edit-description">
        <p className="dialog-eyebrow">IDENTIFIANT SENSIBLE</p>
        <h2 id="matricule-edit-title">Modifier les informations professionnelles</h2>
        <p id="matricule-edit-description">La date d’embauche de {subjectName} peut être identique à celle d’autres personnes. Le matricule doit rester unique et reprendre l’année de cette date. La modification sera inscrite dans le journal d’audit.</p>
        <form className="dialog-form" onSubmit={submit}>
          <label>Date d’embauche
            <input
              required
              type="date"
              min="1900-01-01"
              max={today}
              value={hiringDate}
              onChange={(event) => changeHiringDate(event.target.value)}
            />
            <small>Cette date n’est pas unique : plusieurs personnes peuvent avoir la même date ou la même année d’embauche.</small>
          </label>
          <label>Nouveau matricule
            <input
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
            <button className="primary-button" disabled={pending || !valid || !changed}>{pending ? "Enregistrement…" : "Enregistrer les modifications"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
