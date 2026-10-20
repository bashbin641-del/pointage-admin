"use client";

import { useCallback, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

type Summary = { period: string; activeEmployees: number; attendanceEvents: number; activeSites: number; activeTerminals: number };

export default function DashboardWorkspace({ initialSummary, initialError = "" }: { initialSummary: Summary | null; initialError?: string }) {
  const [summary, setSummary] = useState<Summary | null>(initialSummary);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/core/admin/tableau-de-bord", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setSummary(await response.json() as Summary);
      setError("");
    } catch {
      if (!silent) setError("Impossible de charger les indicateurs. Vérifiez l’API puis réessayez.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);
  useAdminRealtime((event) => {
    if (["attendance.recorded", "attendance.updated", "attendance.deleted", "employee.created", "employee.updated", "employee.deleted", "site.created", "site.deleted", "terminal.activated", "terminal.created", "terminal.deleted", "terminal.session_revoked"].includes(event.type)) {
      void load(true);
    }
  });
  if (loading) return <section className="workspace-state compact-loading-state"><CompactDataLoader label="Chargement des indicateurs…" /></section>;
  if (error) return <section className="workspace-state error-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void load()}>Réessayer</button></section>;
  return <div className="workspace"><p className="period">Journée du {summary?.period}</p><section className="kpi-grid" aria-label="Indicateurs du jour"><article><span>Employés actifs</span><strong>{summary?.activeEmployees}</strong></article><article><span>Pointages confirmés</span><strong>{summary?.attendanceEvents}</strong></article><article><span>Sites actifs</span><strong>{summary?.activeSites}</strong></article><article><span>Terminaux actifs</span><strong>{summary?.activeTerminals}</strong></article></section>{summary?.activeSites === 0 ? <div className="notice"><strong>Configuration requise</strong><span>Créez d’abord un site, puis un terminal et les employés autorisés.</span></div> : null}</div>;
}
