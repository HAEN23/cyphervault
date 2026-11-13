/** Misma política que valida la API (backend/src/utils/passwordPolicy.ts). */
export function getPasswordErrors(value: string): string[] {
  const errors: string[] = [];
  if (value.length < 12) errors.push("12 caracteres mínimo");
  if (!/[A-Z]/.test(value)) errors.push("1 mayúscula");
  if (!/[a-z]/.test(value)) errors.push("1 minúscula");
  if (!/[0-9]/.test(value)) errors.push("1 número");
  if (!/[^A-Za-z0-9]/.test(value)) errors.push("1 carácter especial (!@#$%)");
  return errors;
}

const LOWER = "abcdefghijklmnopqrstuvwxyz";
const UPPER = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const DIGITS = "0123456789";
const SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/~";
const ALL = LOWER + UPPER + DIGITS + SYMBOLS;

/** Entero aleatorio en [0, max) con el generador criptográfico del navegador y sin sesgo de módulo. */
function secureRandomInt(max: number): number {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do {
    crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % max;
}

function pick(chars: string): string {
  return chars[secureRandomInt(chars.length)];
}

/** Genera una contraseña robusta con crypto.getRandomValues (no Math.random). */
export function generateSecurePassword(length = 20): string {
  // Garantiza al menos un carácter de cada tipo y el resto al azar
  const chars = [pick(LOWER), pick(UPPER), pick(DIGITS), pick(SYMBOLS)];
  while (chars.length < length) chars.push(pick(ALL));

  // Mezcla Fisher-Yates con aleatoriedad criptográfica
  for (let i = chars.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}
