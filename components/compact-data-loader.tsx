export default function CompactDataLoader({ label = "Chargement des données…" }: { label?: string }) {
  return (
    <span className="compact-data-loader" role="status" aria-live="polite">
      <span className="compact-data-spinner" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}
