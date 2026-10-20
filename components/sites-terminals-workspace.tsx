"use client";

import { useCallback, useEffect, useState } from "react";
import CompactDataLoader from "@/components/compact-data-loader";
import { useAdminRealtime } from "@/lib/use-admin-realtime";

type Site = { id: string; name: string; active: boolean };
type Terminal = {
  id: string;
  name: string;
  active: boolean;
  last_seen_at: string | null;
  activation_expires_at: string | null;
  session_expires_at: string | null;
  sites: { name: string } | null;
};
type Activation = { terminalId: string; terminalName: string; code: string; expiresAt: string };
type ActivationResponse = { terminal?: Terminal; activationCode?: string; activationExpiresAt?: string };

type Props = {
  initialSites: Site[];
  initialTerminals: Terminal[];
  initialError?: string;
};

function timeLabel(value: string) {
  return new Intl.DateTimeFormat("fr-CI", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Africa/Abidjan",
  }).format(new Date(value));
}

function remainingLabel(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${String(remainder).padStart(2, "0")} s`;
}

export default function SitesTerminalsWorkspace({ initialSites, initialTerminals, initialError = "" }: Props) {
  const [sites, setSites] = useState<Site[]>(initialSites);
  const [terminals, setTerminals] = useState<Terminal[]>(initialTerminals);
  const [activation, setActivation] = useState<Activation | null>(null);
  const [copyStatus, setCopyStatus] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [sitesResponse, terminalsResponse] = await Promise.all([
        fetch("/api/core/admin/sites", { cache: "no-store" }),
        fetch("/api/core/admin/terminaux", { cache: "no-store" }),
      ]);
      if (!sitesResponse.ok || !terminalsResponse.ok) throw new Error();
      setSites((await sitesResponse.json() as { items: Site[] }).items);
      setTerminals((await terminalsResponse.json() as { items: Terminal[] }).items);
      setError("");
    } catch {
      if (!silent) setError("Impossible de charger les sites et les terminaux.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useAdminRealtime((event) => {
    if (["site.created", "terminal.activated", "terminal.created", "terminal.session_revoked"].includes(event.type)) {
      void load(true);
    }
  });

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const remainingSeconds = activation
    ? Math.max(0, Math.ceil((new Date(activation.expiresAt).getTime() - now) / 1_000))
    : 0;
  const activationExpired = Boolean(activation && remainingSeconds === 0);

  async function copyActivationCode() {
    if (!activation || activationExpired) return;
    try {
      await navigator.clipboard.writeText(activation.code);
      setCopyStatus("Code copié dans le presse-papiers.");
    } catch {
      setCopyStatus("Copie automatique impossible. Sélectionnez le code ci-dessus puis copiez-le manuellement.");
    }
  }

  function showActivation(result: ActivationResponse) {
    if (!result.terminal || !result.activationCode || !result.activationExpiresAt) throw new Error();
    setActivation({
      terminalId: result.terminal.id,
      terminalName: result.terminal.name,
      code: result.activationCode,
      expiresAt: result.activationExpiresAt,
    });
    setNow(Date.now());
    setCopyStatus("");
  }

  async function createSite(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true); setError(""); setMessage("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/core/admin/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name") }),
      });
      if (!response.ok) throw new Error();
      setMessage("Site créé.");
      formElement.reset();
      await load();
    } catch {
      setMessage("");
      setError("Le site n’a pas été créé. Vérifiez son nom.");
    } finally {
      setPending(false);
    }
  }

  async function createTerminal(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    setPending(true); setError(""); setMessage(""); setActivation(null); setCopyStatus("");
    const form = new FormData(formElement);
    try {
      const response = await fetch("/api/core/admin/terminaux", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), siteId: form.get("siteId") }),
      });
      const result = await response.json() as ActivationResponse;
      if (!response.ok) throw new Error();
      showActivation(result);
      setMessage("Terminal créé. Activez-le avant l’expiration du code.");
      formElement.reset();
      await load();
    } catch {
      setActivation(null);
      setMessage("");
      setError("Le terminal n’a pas été créé. Vérifiez le site et le nom.");
    } finally {
      setPending(false);
    }
  }

  async function renewActivationCode(terminal: Terminal) {
    setPending(true); setError(""); setMessage(""); setCopyStatus("");
    try {
      const response = await fetch(`/api/core/admin/terminaux/${terminal.id}/code-activation`, { method: "POST" });
      const result = await response.json() as ActivationResponse;
      if (!response.ok) throw new Error();
      showActivation(result);
      setMessage(`Nouveau code généré pour ${terminal.name}.`);
      await load();
    } catch {
      setError("Le nouveau code n’a pas été généré. Réessayez.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="workspace two-panels">
      <section className="panel">
        <h2>Sites</h2>
        <form className="admin-form compact" onSubmit={createSite}>
          <label>Nom du site<input name="name" required minLength={2} /></label>
          <button className="primary-button" disabled={pending}>Créer le site</button>
        </form>
        <ul className="record-list">{sites.map((site) => <li key={site.id}><strong>{site.name}</strong><span>{site.active ? "Actif" : "Inactif"}</span></li>)}</ul>
      </section>

      <section className="panel">
        <h2>Terminaux de pointage</h2>
        {sites.length ? (
          <form className="admin-form compact" onSubmit={createTerminal}>
            <label>Nom du terminal<input name="name" required minLength={2} /></label>
            <label>Site<select name="siteId" required defaultValue=""><option value="" disabled>Choisir un site</option>{sites.filter((site) => site.active).map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
            <button className="primary-button" disabled={pending}>Créer un terminal</button>
          </form>
        ) : <p>Créez d’abord un site.</p>}

        {activation ? (
          <section className={`activation-code-panel ${activationExpired ? "expired" : ""}`} aria-labelledby="activation-code-title">
            <h3 id="activation-code-title">Code d’activation — {activation.terminalName}</h3>
            {activationExpired ? (
              <>
                <p className="status-expired" role="alert">Ce code a expiré. Il ne peut plus activer le terminal.</p>
                <button className="secondary-button" type="button" disabled={pending} onClick={() => {
                  const terminal = terminals.find((item) => item.id === activation.terminalId);
                  if (terminal) void renewActivationCode(terminal);
                }}>Générer un nouveau code</button>
              </>
            ) : (
              <>
                <p>Expire à {timeLabel(activation.expiresAt)} — temps restant : <strong>{remainingLabel(remainingSeconds)}</strong></p>
                <label htmlFor="terminal-activation-code">Code à saisir sur le terminal</label>
                <div className="activation-copy-row">
                  <input id="terminal-activation-code" value={activation.code} readOnly onFocus={(event) => event.currentTarget.select()} />
                  <button className="secondary-button" type="button" onClick={() => void copyActivationCode()}>Copier le code</button>
                </div>
                {copyStatus ? <p className="copy-status" role="status">{copyStatus}</p> : null}
              </>
            )}
          </section>
        ) : null}

        <ul className="record-list terminal-list">{terminals.map((terminal) => {
          const sessionActive = Boolean(terminal.session_expires_at && new Date(terminal.session_expires_at).getTime() > now);
          const codePending = Boolean(terminal.activation_expires_at && new Date(terminal.activation_expires_at).getTime() > now);
          const codeExpired = Boolean(terminal.activation_expires_at && !codePending);
          const status = sessionActive ? "Activé" : codePending ? `Activation en attente jusqu’à ${timeLabel(terminal.activation_expires_at!)}` : codeExpired ? "Code expiré" : "Activation requise";
          const localCodeVisible = activation?.terminalId === terminal.id && !activationExpired;
          return (
            <li key={terminal.id}>
              <div><strong>{terminal.name}</strong><span>{terminal.sites?.name} · {terminal.active ? status : "Inactif"}</span></div>
              {terminal.active && !sessionActive && !localCodeVisible ? <button className="secondary-button" type="button" disabled={pending} onClick={() => void renewActivationCode(terminal)}>{codePending ? "Remplacer le code" : "Générer un nouveau code"}</button> : null}
            </li>
          );
        })}</ul>
      </section>

      {loading ? <div className="data-loading-row"><CompactDataLoader label="Actualisation des sites et terminaux…" /></div> : null}
      {error ? <p className="form-message error-message" role="alert">{error}</p> : null}
      {message ? <p className="form-message success-message activation-message" role="status">{message}</p> : null}
    </div>
  );
}
