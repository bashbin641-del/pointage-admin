import Link from "next/link";

export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><span>INOX</span><small>PRÉSENCE</small></div><div className="auth-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}<footer><span>Accès interne protégé par double authentification</span><Link href="https://inox-groupe.vercel.app/">Retour au site INOX</Link></footer></section></main>;
}
