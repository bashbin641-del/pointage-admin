"use client";

import Image from "next/image";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Enrollment = { factorId: string; qrCode: string; secret: string };

const TOTP_DISPLAY_NAME = "INOX.techs Pointage admin";

export default function MfaEnrollment({
  email,
  requiresPassword,
}: {
  email: string;
  requiresPassword: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [passwordConfigured, setPasswordConfigured] = useState(!requiresPassword);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordConfigured && (password.length < 12 || password !== confirm)) {
      setError(password.length < 12 ? "Le mot de passe doit contenir au moins 12 caractères." : "Les mots de passe ne correspondent pas.");
      return;
    }

    setPending(true);
    setError("");
    try {
      const supabase = await createClient();
      if (!passwordConfigured) {
        const { error: passwordError } = await supabase.auth.updateUser({ password });
        if (passwordError && passwordError.code !== "same_password") throw passwordError;
        setPasswordConfigured(true);
        setPassword("");
        setConfirm("");
      }

      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: TOTP_DISPLAY_NAME,
        issuer: TOTP_DISPLAY_NAME,
      });
      if (enrollError) throw enrollError;
      setEnrollment({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
    } catch {
      setError("L’activation n’a pas pu démarrer. Réessayez dans quelques instants.");
    } finally {
      setPending(false);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!enrollment) return;
    setPending(true);
    setError("");
    try {
      const supabase = await createClient();
      const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollment.factorId });
      if (challengeError) throw challengeError;
      const { error: verifyError } = await supabase.auth.mfa.verify({ factorId: enrollment.factorId, challengeId: challenge.id, code });
      if (verifyError) throw verifyError;
      router.replace("/");
      router.refresh();
    } catch {
      setError("Code incorrect ou expiré. Vérifiez l’heure de votre téléphone et réessayez.");
    } finally {
      setPending(false);
    }
  }

  if (!enrollment) {
    return (
      <form className="auth-form" onSubmit={prepare}>
        <div className="auth-account"><span>{requiresPassword ? "Compte invité" : "Compte propriétaire"}</span><strong>{email}</strong></div>
        {!passwordConfigured ? (
          <>
            <label>Créer un mot de passe<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label>Confirmer le mot de passe<input type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label>
          </>
        ) : <p className="auth-help">Votre mot de passe est déjà configuré. Créez maintenant votre QR TOTP personnel.</p>}
        {error ? <p className="auth-error" role="alert">{error}</p> : null}
        <button className="auth-submit" disabled={pending}>{pending ? "Préparation…" : "Créer mon QR personnel"}</button>
      </form>
    );
  }

  return (
    <form className="auth-form" onSubmit={verify}>
      <div className="enrollment-qr"><Image src={enrollment.qrCode} alt={`QR TOTP personnel ${TOTP_DISPLAY_NAME}`} width={220} height={220} unoptimized priority /></div>
      <p className="auth-help">Scannez ce QR dans Google Authenticator, Microsoft Authenticator ou 1Password. Il s’agit de votre secret personnel, jamais du QR d’invitation.</p>
      <details><summary>Afficher la clé manuelle</summary><code>{enrollment.secret}</code></details>
      <label>Code TOTP<input className="otp-input" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} placeholder="000000" /></label>
      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      <button className="auth-submit" disabled={pending || code.length !== 6}>{pending ? "Activation…" : "Activer le 2FA"}</button>
    </form>
  );
}
