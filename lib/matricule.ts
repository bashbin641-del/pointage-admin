export const EMPLOYEE_MATRICULE_PATTERN = "INOX-EMP-[0-9]{4}-(?!0000)[0-9]{4}";
export const ADMIN_MATRICULE_PATTERN = "INOX-ADMIN-[0-9]{4}-(?!0000)[0-9]{4}";

export function formatMatriculeInput(value: string) {
  return value.toUpperCase().replace(/\s/g, "").slice(0, 24);
}

export function isValidAdminMatricule(value: string, hiredAt: string) {
  const year = hiredAt.slice(0, 4);
  return new RegExp(`^INOX-ADMIN-${year}-(?!0000)[0-9]{4}$`).test(value);
}
