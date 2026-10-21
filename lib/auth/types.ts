export const adminRoles = ["owner", "administrator", "moderator", "editor", "viewer"] as const;
export type AdminRole = (typeof adminRoles)[number];
export type AdminIdentity = { userId: string; sessionId: string; email: string; displayName: string; matricule: string; role: AdminRole };
export function isAdminRole(value: unknown): value is AdminRole { return typeof value === "string" && adminRoles.includes(value as AdminRole); }
export function canInviteMembers(role: AdminRole) { return role === "owner" || role === "administrator"; }
