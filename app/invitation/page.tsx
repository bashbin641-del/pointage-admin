import type { Metadata } from "next";
import AuthShell from "@/components/auth-shell";

export const metadata: Metadata = {
  title: "Invitation administrateur | INOX PRÉSENCE",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

type InvitationPageProps = {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
};

export default async function InvitationPage({ searchParams }: InvitationPageProps) {
  const { token_hash: tokenHash, type } = await searchParams;
  const invitationType = type === "invite" || type === "recovery" ? type : null;
  const validRequest = Boolean(tokenHash && invitationType);

  return (
    <AuthShell
      eyebrow="INVITATION ADMINISTRATEUR"
      title="Accepter votre accès sécurisé"
      description="Cette invitation donne accès à l’administration INOX Présence. Elle ne sera validée qu’après votre confirmation."
    >
      {validRequest ? (
        <form className="auth-form" action="/auth/confirm" method="post">
          <input type="hidden" name="token_hash" value={tokenHash} />
          <input type="hidden" name="type" value={invitationType ?? ""} />
          <div className="admin-activation-notice" role="note">
            <strong>Lien personnel valable une heure</strong>
            <span>Après confirmation, vous définirez votre mot de passe puis votre code TOTP personnel.</span>
          </div>
          <button className="auth-submit" type="submit">Accepter l’invitation administrateur</button>
          <p className="auth-help">Ne transmettez pas ce lien. Il est utilisable une seule fois.</p>
        </form>
      ) : (
        <div className="auth-form">
          <p className="auth-error" role="alert">Ce lien d’invitation est incomplet. Demandez un nouveau lien à un administrateur.</p>
          <a className="auth-submit auth-link" href="/connexion">Retour à la connexion</a>
        </div>
      )}
    </AuthShell>
  );
}
