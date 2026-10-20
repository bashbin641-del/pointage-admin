type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  pending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function ConfirmationDialog({
  title,
  description,
  confirmLabel,
  pending = false,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !pending) onCancel();
    }}>
      <section className="confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description">
        <p className="dialog-eyebrow">CONFIRMATION REQUISE</p>
        <h2 id="confirmation-title">{title}</h2>
        <p id="confirmation-description">{description}</p>
        <div className="dialog-actions">
          <button className="secondary-button" type="button" onClick={onCancel} disabled={pending} autoFocus>Annuler</button>
          <button className="danger-button" type="button" onClick={onConfirm} disabled={pending}>{pending ? "Traitement…" : confirmLabel}</button>
        </div>
      </section>
    </div>
  );
}
