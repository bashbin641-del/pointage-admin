import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

try { loadEnvFile(new URL("../.env.local", import.meta.url)); } catch {}

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, "").split("=");
  return [key, value.join("=")];
}));
const email = args.email?.trim().toLowerCase();
const name = args.name?.trim();
const requestedHiredAt = args["hired-at"]?.trim();
const requestedMatricule = args.matricule?.trim().toUpperCase();
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !name || (requestedHiredAt && !/^\d{4}-\d{2}-\d{2}$/.test(requestedHiredAt)) || !password || !url || !secret) {
  console.error("Usage: BOOTSTRAP_OWNER_PASSWORD=… npm run auth:bootstrap -- --email=proprietaire@inox.ci --name=Nom [--hired-at=2026-01-15] [--matricule=INOX-ADMIN-2026-0001]");
  process.exit(1);
}

const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (users.error) { console.error(users.error.message); process.exit(1); }
const existing = users.data.users.find((user) => user.email?.toLowerCase() === email);
const hiredAt = requestedHiredAt || String(existing?.app_metadata.inox_admin_hired_at || new Date().toISOString().slice(0, 10));
const hiringYear = hiredAt.slice(0, 4);
const matriculePattern = new RegExp(`^INOX-ADMIN-${hiringYear}-(?!0000)[0-9]{4}$`);
if ((requestedMatricule && !matriculePattern.test(requestedMatricule)) || !/^\d{4}-\d{2}-\d{2}$/.test(hiredAt)) {
  console.error("La date d’embauche ou le matricule ne respecte pas le format demandé.");
  process.exit(1);
}
const occupied = new Set(users.data.users
  .filter((user) => user.id !== existing?.id)
  .map((user) => String(user.app_metadata.inox_admin_matricule || "")));
const existingMatricule = String(existing?.app_metadata.inox_admin_matricule || "");
let matricule = requestedMatricule || (matriculePattern.test(existingMatricule) ? existingMatricule : undefined);
if (!matricule) {
  for (let sequence = 1; sequence <= 9999; sequence += 1) {
    const candidate = `INOX-ADMIN-${hiringYear}-${String(sequence).padStart(4, "0")}`;
    if (!occupied.has(candidate)) { matricule = candidate; break; }
  }
}
if (!matricule || occupied.has(matricule)) { console.error("Le matricule demandé est déjà attribué ou la séquence annuelle est épuisée."); process.exit(1); }

let { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
if (error?.message?.toLowerCase().includes("already been registered")) {
  if (!existing) { console.error(error.message); process.exit(1); }
  const updated = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...existing.user_metadata, display_name: name } });
  data = { user: updated.data.user };
  error = updated.error;
}
if (error || !data.user) { console.error(error?.message ?? "Impossible de créer le propriétaire."); process.exit(1); }
const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, {
  app_metadata: {
    ...data.user.app_metadata,
    inox_admin_active: true,
    inox_admin_role: "owner",
    inox_admin_display_name: name,
    inox_admin_matricule: matricule,
    inox_admin_hired_at: hiredAt,
  },
});
if (updateError) { console.error(updateError.message); process.exit(1); }
console.log(`Propriétaire initial configuré : ${data.user.id} (${matricule})`);
