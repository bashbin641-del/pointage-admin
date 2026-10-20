import Image from "next/image";

export default function Loading() {
  return (
    <main className="admin-shell route-loading-shell" aria-busy="true">
      <aside>
        <span className="brand">
          <Image src="/brand/inox-logo.png" alt="INOX Technologies" width={92} height={65} priority />
          <span>INOX<br />PRÉSENCE</span>
        </span>
      </aside>
      <section className="main route-loading" role="status" aria-live="polite">
        <span className="route-loading-spinner" aria-hidden="true" />
        <h1>Chargement de la page</h1>
        <p>Vérification de la session et récupération des données…</p>
      </section>
    </main>
  );
}
