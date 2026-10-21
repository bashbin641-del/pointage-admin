export const adminRoles = ["owner", "administrator", "maintainer"] as const;
export type AdminRole = (typeof adminRoles)[number];
export type AdminIdentity = { userId: string; sessionId: string; email: string; displayName: string; matricule: string; role: AdminRole };
export function isAdminRole(value: unknown): value is AdminRole { return typeof value === "string" && adminRoles.includes(value as AdminRole); }
export function canManageAccounts(role: AdminRole) { return role === "owner" || role === "administrator"; }
export function canInviteMembers(role: AdminRole) { return canManageAccounts(role); }
export function canManageAttendance(role: AdminRole) { return adminRoles.includes(role); }
export function canCreateInfrastructure(role: AdminRole) { return adminRoles.includes(role); }
export function canDeleteInfrastructure(role: AdminRole) { return canManageAccounts(role); }
export function adminRoleLabel(role: AdminRole) {
  if (role === "owner") return "Propriétaire";
  if (role === "administrator") return "Administrateur";
  return "Mainteneur";
}
