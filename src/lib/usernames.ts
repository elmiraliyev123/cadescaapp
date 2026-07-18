export const CADESCA_RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "cadesca",
  "help",
  "login",
  "logout",
  "merchant",
  "moderator",
  "profile",
  "register",
  "root",
  "settings",
  "signup",
  "support",
  "system",
  "wallet"
]);

const CADESCA_USERNAME_PATTERN = /^[a-z0-9_][a-z0-9_.]{1,28}[a-z0-9_]$/;

export type CadescaUsernameValidationError = "username_required" | "invalid_username" | "reserved_username";

export function normalizeCadescaUsername(value: string) {
  return value.trim().toLowerCase().replace(/^@+/, "");
}

export function cadescaUsernameValidationError(value: string): CadescaUsernameValidationError | null {
  const username = normalizeCadescaUsername(value);
  if (!username) return "username_required";
  if (username.length < 3 || username.length > 30) return "invalid_username";
  if (!CADESCA_USERNAME_PATTERN.test(username) || username.includes("..")) return "invalid_username";
  if (CADESCA_RESERVED_USERNAMES.has(username)) return "reserved_username";
  return null;
}

export function isValidCadescaUsername(value: string) {
  return cadescaUsernameValidationError(value) === null;
}

export function validateCadescaUsername(value: string) {
  const error = cadescaUsernameValidationError(value);
  if (error) throw new Error(error);
  return normalizeCadescaUsername(value);
}
