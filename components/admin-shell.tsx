import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { AdminIdentity } from "@/lib/auth/types";

const links = [
  { href: "/", label: "Tableau de bord" },
  { href: "/employes", label: "Employés" },
  { href: "/presences", label: "Présences" },
  { href: "/sites-terminaux", label: "Sites et terminaux" },
];

export default function AdminShell({ identity, activePath, title, children }: { identity: AdminIdentity; activePath: string; title: string; children: ReactNode }) {
  return (
    <main className="admin-shell">
      <aside>
        <Link className="brand" href="/" aria-label="INOX Présence — Tableau de bord">
          <Image src="/brand/inox-logo.png" alt="INOX Technologies" width={92} height={65} priority />
          <span>INOX<br />PRÉSENCE</span>
        </Link>
        <nav aria-label="Navigation principale">
          {links.map((link) => <Link key={link.href} href={link.href} className={activePath === link.href ? "active" : undefined} aria-current={activePath === link.href ? "page" : undefined}>{link.label}</Link>)}
        </nav>
      </aside>
      <section className="main">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRATION · AAL2</p><h1>{title}</h1><p>Connecté : {identity.displayName} · {identity.role}</p></div>
          <form action="/api/auth/logout" method="post"><button className="secondary-button">Se déconnecter</button></form>
        </header>
        {children}
      </section>
    </main>
  );
}
