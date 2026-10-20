"use client";

import { useCallback, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import { useAdminRealtime } from "@/lib/use-admin-realtime";
type Event = { id: string; event_type: "entree" | "sortie"; occurred_at: string; employes: { display_name: string; matricule: string } | null; sites: { name: string } | null; terminaux: { name: string } | null };
export default function AttendanceWorkspace({ initialItems, initialError = "" }: { initialItems: Event[]; initialError?: string }) {
  const [items, setItems] = useState<Event[]>(initialItems); const [loading, setLoading] = useState(false); const [error, setError] = useState(initialError);
  const load = useCallback(async (silent = false) => { if (!silent) setLoading(true); try { const response = await fetch("/api/core/admin/presences", { cache: "no-store" }); if (!response.ok) throw new Error(); setItems((await response.json() as { items: Event[] }).items); setError(""); } catch { if (!silent) setError("Impossible de charger les présences."); } finally { if (!silent) setLoading(false); } }, []);
  useAdminRealtime((event) => { if (event.type === "attendance.recorded") void load(true); });
  return <div className="workspace"><section className="panel"><div className="panel-heading"><div><h2>Pointages confirmés</h2><p>Seuls les événements enregistrés par l’API sont affichés.</p></div><button className="secondary-button" onClick={() => void load()} disabled={loading}>{loading ? "Actualisation…" : "Actualiser"}</button></div>{loading ? <CompactDataLoader label="Actualisation des présences…" /> : null}{error ? <p className="form-message error-message" role="alert">{error}</p> : items.length ? <div className="table-wrap"><table><thead><tr><th>Employé</th><th>Type</th><th>Date et heure</th><th>Site</th><th>Terminal</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{item.employes?.display_name ?? "Compte indisponible"}<small>{item.employes?.matricule}</small></td><td>{item.event_type === "entree" ? "Entrée" : "Sortie"}</td><td>{new Intl.DateTimeFormat("fr-CI", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Abidjan" }).format(new Date(item.occurred_at))}</td><td>{item.sites?.name ?? "—"}</td><td>{item.terminaux?.name ?? "—"}</td></tr>)}</tbody></table></div> : <p>Aucun pointage confirmé.</p>}</section></div>;
}
