import Link from "next/link";
import Image from "next/image";

export default function AuthShell({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <main className="auth-page"><section className="auth-card"><div className="auth-brand"><Image src="/brand/inox-logo.png" alt="INOX Technologies" width={86} height={61} /><span>INOX</span><small>PRÉSENCE</small></div><div className="auth-heading"><span>{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}<footer><span>Accès interne protégé par double authentification</span><Link href="https://inox-groupe.vercel.app/">Retour au site INOX</Link></footer></section></main>;
}
