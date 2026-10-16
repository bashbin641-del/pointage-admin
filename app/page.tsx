import { redirect } from "next/navigation";
import { connection } from "next/server";
import { authenticateAdmin } from "@/lib/auth/server";

export const instant = false;

export default async function Home() {
  await connection();
  const auth = await authenticateAdmin();
  if (!auth.ok) {
    if (auth.reason === "unauthenticated") redirect("/connexion");
    if (auth.reason === "enrollment_required") redirect("/activation");
    if (auth.reason === "mfa_required") redirect("/mfa");
    redirect("/connexion");
  }
  return <main className="admin-shell"><aside><div className="brand">INOX<br/>PRÉSENCE</div><nav aria-label="Navigation principale"><a className="active">Tableau de bord</a><a>Employés</a><a>Présences</a><a>Horaires</a><a>Rapports</a><a>Audit</a></nav></aside><section className="main"><header className="topbar"><div><p className="eyebrow">ADMINISTRATION · AAL2</p><h1>Présences du jour</h1><p>Connecté : {auth.identity.displayName} · {auth.identity.role}</p></div><form action="/api/auth/logout" method="post"><button className="secondary-button">Se déconnecter</button></form></header><div className="notice"><strong>Session sécurisée</strong><span>Identité professionnelle validée par mot de passe + TOTP. Les données de pointage seront chargées par l’API centrale.</span></div><section className="empty-state"><div className="empty-icon" aria-hidden="true">—</div><h2>Aucune donnée chargée</h2><p>L’API de présence doit encore être raccordée à Supabase et Redis.</p></section></section></main>;
}
