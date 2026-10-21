export const MATRICULE_PATTERN = "[0-9]{3}-[0-9]{3}-[0-9]{3}";

export function formatMatriculeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 9);
  return digits.match(/.{1,3}/g)?.join("-") ?? "";
}

export function isValidMatricule(value: string) {
  return /^[0-9]{3}-[0-9]{3}-[0-9]{3}$/.test(value);
}
