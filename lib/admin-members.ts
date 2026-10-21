import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type AdministratorMember = {
  userId: string;
  email: string;
  displayName: string;
  matricule: string;
  role: "owner" | "administrator";
  status: "active" | "pending" | "blocked";
  createdAt: string;
};

export async function listAdministratorMembers(): Promise<AdministratorMember[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw new Error("ADMIN_MEMBERS_UNAVAILABLE");

  return data.users.flatMap((user) => {
    const metadata = user.app_metadata;
    const role = metadata.inox_admin_role;
    if (role !== "owner" && role !== "administrator") return [];

    return [{
      userId: user.id,
      email: user.email ?? "Adresse indisponible",
      displayName: String(metadata.inox_admin_display_name || user.email?.split("@")[0] || "Administrateur INOX"),
      matricule: String(metadata.inox_admin_matricule || "Non attribué"),
      role,
      status: metadata.inox_admin_active !== true ? "blocked" : user.last_sign_in_at ? "active" : "pending",
      createdAt: user.created_at,
    } satisfies AdministratorMember];
  }).sort((first, second) => first.displayName.localeCompare(second.displayName, "fr"));
}
