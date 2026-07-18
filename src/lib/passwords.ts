export function isStrongCadescaPassword(value: string) {
  return value.length >= 8 &&
    /[A-Za-z]/.test(value) &&
    /\d/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
}
