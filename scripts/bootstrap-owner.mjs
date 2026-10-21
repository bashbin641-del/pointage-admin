import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

try { loadEnvFile(new URL("../.env.local", import.meta.url)); } catch {}
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.replace(/^--/, "").split("="); return [key, value.join("=")]; }));
const email = args.email?.trim().toLowerCase(); const name = args.name?.trim(); const matricule = args.matricule?.trim();
const password = process.env.BOOTSTRAP_OWNER_PASSWORD;
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !name || !/^[0-9]{3}-[0-9]{3}-[0-9]{3}$/.test(matricule) || !password || !url || !secret) { console.error("Usage: BOOTSTRAP_OWNER_PASSWORD=… npm run auth:bootstrap -- --email=proprietaire@inox.ci --name=Nom --matricule=900-000-001"); process.exit(1); }
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
let { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: name } });
if (error?.message?.toLowerCase().includes("already been registered")) {
  const users = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users.data.users.find((user) => user.email?.toLowerCase() === email);
  if (!existing) { console.error(error.message); process.exit(1); }
  const updated = await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true, user_metadata: { ...existing.user_metadata, display_name: name } });
  data = { user: updated.data.user }; error = updated.error;
}
if (error || !data.user) { console.error(error?.message ?? "Impossible de créer le propriétaire."); process.exit(1); }
const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { app_metadata: { ...data.user.app_metadata, inox_admin_active: true, inox_admin_role: "owner", inox_admin_display_name: name, inox_admin_matricule: matricule } });
if (updateError) { console.error(updateError.message); process.exit(1); }
console.log("Propriétaire initial configuré :", data.user.id);
