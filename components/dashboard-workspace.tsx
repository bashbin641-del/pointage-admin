"use client";

import { useCallback, useMemo, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import type { AttendanceTrafficDay, DashboardSummary } from "@/lib/dashboard-types";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

const dayLabel = new Intl.DateTimeFormat("fr-FR", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  timeZone: "Africa/Abidjan",
});

const longDate = new Intl.DateTimeFormat("fr-FR", {
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Africa/Abidjan",
});

const updatedTime = new Intl.DateTimeFormat("fr-FR", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Africa/Abidjan",
});

function dateValue(value: string) {
  return new Date(`${value}T12:00:00.000Z`);
}

function AttendanceTrafficChart({ days }: { days: AttendanceTrafficDay[] }) {
  const width = 860;
  const height = 300;
  const plot = { left: 56, top: 34, right: 830, bottom: 238 };
  const plotWidth = plot.right - plot.left;
  const plotHeight = plot.bottom - plot.top;
  const maxValue = Math.max(1, ...days.flatMap((day) => [day.entries, day.exits]));
  const step = Math.max(1, Math.ceil(maxValue / 4));
  const chartMax = step * 4;
  const slot = plotWidth / Math.max(days.length, 1);
  const barWidth = Math.min(24, slot * 0.24);

  return (
    <div className="traffic-chart-scroll" tabIndex={0} role="region" aria-label="Diagramme des entrées et sorties, défilement horizontal disponible">
      <svg className="traffic-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby="traffic-chart-title traffic-chart-description">
        <title id="traffic-chart-title">Trafic des pointages sur les sept derniers jours</title>
        <desc id="traffic-chart-description">Barres bleues pour les entrées et orange pour les sorties. Les valeurs exactes figurent sur chaque barre.</desc>
        {Array.from({ length: 5 }, (_, index) => {
          const y = plot.bottom - (index / 4) * plotHeight;
          return <g key={index}><line className="chart-grid-line" x1={plot.left} x2={plot.right} y1={y} y2={y} /><text className="chart-axis-value" x={plot.left - 14} y={y + 4} textAnchor="end">{step * index}</text></g>;
        })}
        {days.map((day, index) => {
          const center = plot.left + slot * index + slot / 2;
          const entryHeight = (day.entries / chartMax) * plotHeight;
          const exitHeight = (day.exits / chartMax) * plotHeight;
          return (
            <g key={day.date}>
              {day.entries > 0 ? <rect className="chart-bar entries" x={center - barWidth - 5} y={plot.bottom - entryHeight} width={barWidth} height={entryHeight} rx="5"><title>{day.entries} entrée{day.entries > 1 ? "s" : ""} le {dayLabel.format(dateValue(day.date))}</title></rect> : null}
              {day.exits > 0 ? <rect className="chart-bar exits" x={center + 5} y={plot.bottom - exitHeight} width={barWidth} height={exitHeight} rx="5"><title>{day.exits} sortie{day.exits > 1 ? "s" : ""} le {dayLabel.format(dateValue(day.date))}</title></rect> : null}
              {day.entries > 0 ? <text className="chart-bar-value" x={center - barWidth / 2 - 5} y={plot.bottom - entryHeight - 9} textAnchor="middle">{day.entries}</text> : null}
              {day.exits > 0 ? <text className="chart-bar-value" x={center + barWidth / 2 + 5} y={plot.bottom - exitHeight - 9} textAnchor="middle">{day.exits}</text> : null}
              <text className="chart-day-label" x={center} y={plot.bottom + 28} textAnchor="middle">{dayLabel.format(dateValue(day.date))}</text>
              <text className="chart-total-label" x={center} y={plot.bottom + 48} textAnchor="middle">Total {day.total}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function DashboardWorkspace({ initialSummary, initialError = "" }: { initialSummary: DashboardSummary | null; initialError?: string }) {
  const [summary, setSummary] = useState<DashboardSummary | null>(initialSummary);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/core/admin/tableau-de-bord", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setSummary(await response.json() as DashboardSummary);
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

  const trafficSummary = useMemo(() => {
    const days = summary?.attendanceTraffic.days ?? [];
    const entries = days.reduce((total, day) => total + day.entries, 0);
    const exits = days.reduce((total, day) => total + day.exits, 0);
    const total = entries + exits;
    const peak = days.reduce<AttendanceTrafficDay | null>((current, day) => !current || day.total > current.total ? day : current, null);
    return { entries, exits, total, average: total / Math.max(days.length, 1), peak };
  }, [summary]);

  async function exportPdf() {
    if (!summary || exporting) return;
    setExporting(true);
    setExportError("");
    try {
      const { downloadDashboardReport } = await import("@/lib/dashboard-report");
      await downloadDashboardReport(summary);
    } catch {
      setExportError("Le rapport PDF n’a pas pu être généré. Réessayez dans quelques instants.");
    } finally {
      setExporting(false);
    }
  }

  if (loading) return <section className="workspace-state compact-loading-state"><CompactDataLoader label="Chargement des indicateurs…" /></section>;
  if (error) return <section className="workspace-state error-state" role="alert"><p>{error}</p><button className="secondary-button" onClick={() => void load()}>Réessayer</button></section>;
  if (!summary) return null;

  return (
    <div className="workspace">
      <p className="period">Journée du {longDate.format(dateValue(summary.period))}</p>
      <section className="kpi-grid" aria-label="Indicateurs du jour">
        <article><span>Employés actifs</span><strong>{summary.activeEmployees}</strong></article>
        <article><span>Pointages confirmés</span><strong>{summary.attendanceEvents}</strong></article>
        <article><span>Sites actifs</span><strong>{summary.activeSites}</strong></article>
        <article><span>Terminaux actifs</span><strong>{summary.activeTerminals}</strong></article>
      </section>
      {summary.activeSites === 0 ? <div className="notice"><strong>Configuration requise</strong><span>Créez d’abord un site, puis un terminal et les employés autorisés.</span></div> : null}

      <section className="panel traffic-panel" aria-labelledby="traffic-title">
        <div className="traffic-panel-heading">
          <div>
            <p className="traffic-kicker">DONNÉES RÉELLES · 7 JOURS</p>
            <h2 id="traffic-title">Trafic des pointages</h2>
            <p>Entrées et sorties confirmées du {longDate.format(dateValue(summary.attendanceTraffic.startDate))} au {longDate.format(dateValue(summary.attendanceTraffic.endDate))}.</p>
          </div>
          <button className="secondary-button report-button" type="button" disabled={exporting} onClick={() => void exportPdf()}>{exporting ? "Génération du PDF…" : "Télécharger le rapport PDF"}</button>
        </div>
        {exportError ? <p className="form-message error-message" role="alert">{exportError}</p> : null}
        <div className="traffic-stat-grid" aria-label="Synthèse du trafic">
          <article><span>Total des pointages</span><strong>{trafficSummary.total}</strong></article>
          <article><span>Entrées</span><strong>{trafficSummary.entries}</strong></article>
          <article><span>Sorties</span><strong>{trafficSummary.exits}</strong></article>
          <article><span>Moyenne quotidienne</span><strong>{trafficSummary.average.toLocaleString("fr-FR", { maximumFractionDigits: 1 })}</strong></article>
          <article><span>Pic d’activité</span><strong>{trafficSummary.peak?.total ?? 0}</strong><small>{trafficSummary.peak ? dayLabel.format(dateValue(trafficSummary.peak.date)) : "Aucune donnée"}</small></article>
        </div>
        <div className="traffic-legend" aria-label="Légende"><span><i className="legend-dot entries" />Entrées</span><span><i className="legend-dot exits" />Sorties</span></div>
        <AttendanceTrafficChart days={summary.attendanceTraffic.days} />
        <p className="traffic-updated">Actualisé en temps réel · dernière consolidation {updatedTime.format(new Date(summary.generatedAt))}</p>
      </section>
    </div>
  );
}
