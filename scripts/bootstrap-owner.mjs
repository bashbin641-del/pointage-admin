import { loadEnvFile } from "node:process";
import { createClient } from "@supabase/supabase-js";

try { loadEnvFile(new URL("../.env.local", import.meta.url)); } catch {}
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, ...value] = arg.replace(/^--/, "").split("="); return [key, value.join("=")]; }));
const email = args.email?.trim().toLowerCase(); const name = args.name?.trim();
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!email || !name || !url || !secret) { console.error("Usage: npm run auth:bootstrap -- --email=proprietaire@inox.ci --name=Nom"); process.exit(1); }
const supabase = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: `${process.env.NEXT_PUBLIC_ADMIN_URL || "http://localhost:3003"}/auth/callback`, data: { display_name: name } } });
if (error || !data.user || !data.properties?.action_link) { console.error(error?.message ?? "Impossible de créer le propriétaire."); process.exit(1); }
const { error: updateError } = await supabase.auth.admin.updateUserById(data.user.id, { app_metadata: { ...data.user.app_metadata, inox_admin_active: true, inox_admin_role: "owner", inox_admin_display_name: name } });
if (updateError) { console.error(updateError.message); process.exit(1); }
console.log("Propriétaire initial créé :", data.user.id); console.log(data.properties.action_link);
