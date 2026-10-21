import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import AdminNavLink from "@/components/admin-nav-link";
import { canInviteMembers, type AdminIdentity } from "@/lib/auth/types";

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
        <Link className="brand" href="/" prefetch={true} aria-label="INOX Présence — Tableau de bord">
          <Image src="/brand/inox-logo.png" alt="INOX Technologies" width={92} height={65} priority />
          <span>INOX<br />PRÉSENCE</span>
        </Link>
        <nav aria-label="Navigation principale">
          {links.map((link) => <AdminNavLink key={link.href} href={link.href} label={link.label} active={activePath === link.href} />)}
          {canInviteMembers(identity.role) ? <AdminNavLink href="/administrateurs" label="Administrateurs" active={activePath === "/administrateurs"} /> : null}
        </nav>
      </aside>
      <section className="main">
        <header className="topbar">
          <div><p className="eyebrow">ADMINISTRATION · AAL2</p><h1>{title}</h1><p>Connecté : {identity.displayName} · {identity.matricule} · {identity.role}</p></div>
          <form action="/api/auth/logout" method="post"><button className="secondary-button">Se déconnecter</button></form>
        </header>
        {children}
      </section>
    </main>
  );
}
