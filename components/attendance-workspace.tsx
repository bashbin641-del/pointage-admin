"use client";

import { useCallback, useMemo, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import ConfirmationDialog from "@/components/confirmation-dialog";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

type Event = {
  id: string;
  event_type: "entree" | "sortie";
  occurred_at: string;
  employes: { display_name: string; matricule: string } | null;
  sites: { name: string } | null;
  terminaux: { name: string } | null;
};

type DeleteTarget = { kind: "single"; event: Event } | { kind: "all" };

type AttendanceFilters = {
  employee: string;
  eventType: "" | "entree" | "sortie";
  date: string;
  time: string;
  site: string;
  terminal: string;
};

const emptyFilters: AttendanceFilters = {
  employee: "",
  eventType: "",
  date: "",
  time: "",
  site: "",
  terminal: "",
};

const filterDateTimeFormatter = new Intl.DateTimeFormat("fr-CI", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "Africa/Abidjan",
});

function normalized(value: string | undefined) {
  return (value ?? "").trim().toLocaleLowerCase("fr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function localDateTime(value: string) {
  const parts = Object.fromEntries(filterDateTimeFormatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
  };
}

function dateTimeInputValue(value: string) {
  return new Date(value).toISOString().slice(0, 16);
}

function attendanceLabel(event: Event) {
  return `${event.event_type === "entree" ? "l’entrée" : "la sortie"} de ${event.employes?.display_name ?? "cet employé"}`;
}

export default function AttendanceWorkspace({
  initialItems,
  canManage,
  initialError = "",
}: {
  initialItems: Event[];
  canManage: boolean;
  initialError?: string;
}) {
  const [items, setItems] = useState<Event[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState(initialError);
  const [message, setMessage] = useState("");
  const [editTarget, setEditTarget] = useState<Event | null>(null);
  const [editValue, setEditValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [filters, setFilters] = useState<AttendanceFilters>(emptyFilters);

  const filteredItems = useMemo(() => {
    const employeeQuery = normalized(filters.employee);
    const siteQuery = normalized(filters.site);
    const terminalQuery = normalized(filters.terminal);
    return items.filter((item) => {
      const employee = `${item.employes?.display_name ?? ""} ${item.employes?.matricule ?? ""}`;
      const dateTime = localDateTime(item.occurred_at);
      return (!employeeQuery || normalized(employee).includes(employeeQuery))
        && (!filters.eventType || item.event_type === filters.eventType)
        && (!filters.date || dateTime.date === filters.date)
        && (!filters.time || dateTime.time === filters.time)
        && (!siteQuery || normalized(item.sites?.name).includes(siteQuery))
        && (!terminalQuery || normalized(item.terminaux?.name).includes(terminalQuery));
    });
  }, [filters, items]);

  const hasFilters = Object.values(filters).some(Boolean);

  function updateFilter<Key extends keyof AttendanceFilters>(key: Key, value: AttendanceFilters[Key]) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch("/api/core/admin/presences", { cache: "no-store" });
      if (!response.ok) throw new Error();
      setItems((await response.json() as { items: Event[] }).items);
      setError("");
    } catch {
      if (!silent) setError("Impossible de charger les présences.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useAdminRealtime((event) => {
    if (["attendance.recorded", "attendance.updated", "attendance.deleted"].includes(event.type)) void load(true);
  });

  function openEditor(event: Event) {
    setEditTarget(event);
    setEditValue(dateTimeInputValue(event.occurred_at));
    setError("");
    setMessage("");
  }

  async function saveAttendance(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editTarget || !editValue) return;
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/core/admin/presences/${editTarget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ occurredAt: `${editValue}:00.000Z` }),
      });
      const result = await response.json() as { message?: string };
      if (!response.ok) {
        if (result.message === "LIMITE_POINTAGES_QUOTIDIENNE_ATTEINTE") throw new Error("Cette date contient déjà deux pointages pour cet employé.");
        if (result.message === "TYPE_POINTAGE_DEJA_ENREGISTRE") throw new Error("Un pointage du même type existe déjà à cette date.");
        throw new Error("La modification n’a pas été confirmée.");
      }
      setMessage(`La date et l’heure de ${attendanceLabel(editTarget)} ont été corrigées.`);
      setEditTarget(null);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "La modification n’a pas été confirmée.");
    } finally {
      setActionPending(false);
    }
  }

  async function deleteAttendance() {
    if (!deleteTarget) return;
    setActionPending(true);
    setError("");
    setMessage("");
    try {
      const path = deleteTarget.kind === "all" ? "/api/core/admin/presences" : `/api/core/admin/presences/${deleteTarget.event.id}`;
      const response = await fetch(path, { method: "DELETE" });
      const result = await response.json() as { deletedCount?: number; message?: string };
      if (!response.ok) throw new Error(result.message);
      setMessage(deleteTarget.kind === "all"
        ? `${result.deletedCount ?? 0} pointage(s) supprimé(s). L’historique est maintenant vide.`
        : `${attendanceLabel(deleteTarget.event)} a été supprimée définitivement.`);
      setDeleteTarget(null);
      await load();
    } catch {
      setError("La suppression n’a pas été confirmée. Réessayez.");
    } finally {
      setActionPending(false);
    }
  }

  return (
    <div className="workspace">
      <section className="panel">
        <div className="panel-heading">
          <div><h2>Pointages confirmés</h2><p>Seuls les événements enregistrés par l’API sont affichés.</p></div>
          <div className="row-actions">
            <button className="secondary-button compact-button" type="button" onClick={() => void load()} disabled={loading || actionPending}>{loading ? "Actualisation…" : "Actualiser"}</button>
            {canManage && items.length ? <button className="danger-button compact-button" type="button" onClick={() => setDeleteTarget({ kind: "all" })} disabled={actionPending}>Supprimer l’historique</button> : null}
          </div>
        </div>
        {loading ? <CompactDataLoader label="Actualisation des présences…" /> : null}
        {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
        {message ? <p className="form-message success-message" role="status">{message}</p> : null}
        {items.length ? <div className="attendance-filters" role="search" aria-label="Filtrer les présences">
          <label>Employé<input type="search" value={filters.employee} onChange={(event) => updateFilter("employee", event.target.value)} placeholder="Nom ou matricule" /></label>
          <label>Type<select value={filters.eventType} onChange={(event) => updateFilter("eventType", event.target.value as AttendanceFilters["eventType"])}><option value="">Tous les types</option><option value="entree">Entrée</option><option value="sortie">Sortie</option></select></label>
          <label>Date<input type="date" value={filters.date} onChange={(event) => updateFilter("date", event.target.value)} /></label>
          <label>Heure<input type="time" value={filters.time} onChange={(event) => updateFilter("time", event.target.value)} /></label>
          <label>Site<input type="search" value={filters.site} onChange={(event) => updateFilter("site", event.target.value)} placeholder="Nom du site" /></label>
          <label>Terminal<input type="search" value={filters.terminal} onChange={(event) => updateFilter("terminal", event.target.value)} placeholder="Nom du terminal" /></label>
          <button className="secondary-button compact-button" type="button" onClick={() => setFilters(emptyFilters)} disabled={!hasFilters}>Réinitialiser</button>
        </div> : null}
        {items.length ? <p className="filter-summary" role="status">{filteredItems.length} résultat{filteredItems.length > 1 ? "s" : ""} sur {items.length} pointage{items.length > 1 ? "s" : ""}.</p> : null}
        {filteredItems.length ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Employé</th><th>Type</th><th>Date et heure</th><th>Site</th><th>Terminal</th>{canManage ? <th>Actions</th> : null}</tr></thead>
              <tbody>{filteredItems.map((item) => <tr key={item.id}><td>{item.employes?.display_name ?? "Compte indisponible"}<small>{item.employes?.matricule}</small></td><td>{item.event_type === "entree" ? "Entrée" : "Sortie"}</td><td>{new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(item.occurred_at))}</td><td>{item.sites?.name ?? "—"}</td><td>{item.terminaux?.name ?? "—"}</td>{canManage ? <td><div className="row-actions"><button className="secondary-button compact-button" type="button" onClick={() => openEditor(item)} disabled={actionPending}>Modifier</button><button className="danger-button compact-button" type="button" onClick={() => setDeleteTarget({ kind: "single", event: item })} disabled={actionPending}>Supprimer</button></div></td> : null}</tr>)}</tbody>
            </table>
          </div>
        ) : <p>{items.length ? "Aucun pointage ne correspond aux filtres sélectionnés." : "Aucun pointage confirmé."}</p>}
      </section>

      {editTarget ? <div className="dialog-backdrop" role="presentation"><section className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="edit-attendance-title"><p className="dialog-eyebrow">CORRECTION MANUELLE</p><h2 id="edit-attendance-title">Modifier la date et l’heure</h2><p>Correction de {attendanceLabel(editTarget)}. Cette action sera inscrite dans le journal d’audit.</p><form className="dialog-form" onSubmit={saveAttendance}><label>Date et heure en Côte d’Ivoire<input type="datetime-local" required value={editValue} onChange={(event) => setEditValue(event.target.value)} /></label><div className="dialog-actions"><button className="secondary-button" type="button" onClick={() => setEditTarget(null)} disabled={actionPending}>Annuler</button><button className="primary-button" disabled={actionPending}>{actionPending ? "Enregistrement…" : "Enregistrer la correction"}</button></div></form></section></div> : null}

      {deleteTarget ? <ConfirmationDialog
        title={deleteTarget.kind === "all" ? "Supprimer tout l’historique ?" : `Supprimer ${attendanceLabel(deleteTarget.event)} ?`}
        description={deleteTarget.kind === "all" ? "Tous les pointages seront supprimés définitivement de la base de données. Cette opération ne peut pas être annulée." : "Ce pointage sera supprimé définitivement de la base de données. Cette opération ne peut pas être annulée."}
        confirmLabel={deleteTarget.kind === "all" ? "Supprimer tout l’historique" : "Supprimer définitivement"}
        pending={actionPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void deleteAttendance()}
      /> : null}
    </div>
  );
}
