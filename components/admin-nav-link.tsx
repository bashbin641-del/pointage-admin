"use client";

import Link, { useLinkStatus } from "next/link";

function LinkStatus() {
  const { pending } = useLinkStatus();
  return <span className={`link-status${pending ? " pending" : ""}`} aria-hidden="true" />;
}

export default function AdminNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} prefetch={true} className={active ? "active" : undefined} aria-current={active ? "page" : undefined}>
      <span>{label}</span>
      <LinkStatus />
    </Link>
  );
}
