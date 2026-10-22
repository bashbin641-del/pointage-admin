import Link from "next/link";

export default function EmailChangeConfirmedPage() {
  return (
    <main className="login-page">
      <section className="login-card">
        <p className="eyebrow">SÉCURITÉ ADMINISTRATIVE</p>
        <h1>Confirmation enregistrée</h1>
        <p>Confirmez également le message reçu sur l’autre adresse. Après validation des deux messages, toutes les sessions sont révoquées et vous devrez vous reconnecter avec la nouvelle adresse et votre TOTP.</p>
        <Link className="primary-button" href="/connexion">Revenir à la connexion</Link>
      </section>
    </main>
  );
}
