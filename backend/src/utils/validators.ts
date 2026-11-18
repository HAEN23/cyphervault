/**
 * Validadores de entrada SIN expresiones regulares.
 * Todo lo que llega de req.body se revisa primero por tipo y longitud y después
 * carácter por carácter, en tiempo lineal. Así no hay ReDoS ni inyección de regex.
 */

export const MAX_EMAIL_LENGTH = 254;

function isDigit(c: number): boolean {
  return c >= 48 && c <= 57; // 0-9
}

function isHex(c: number): boolean {
  return isDigit(c) || (c >= 97 && c <= 102) || (c >= 65 && c <= 70); // a-f, A-F
}

function isWhitespace(ch: string): boolean {
  return ch.trim() === '';
}

/** usuario@dominio.tld: una sola @, sin espacios, y un punto en el dominio que no esté en los extremos. */
export function isEmail(value: unknown): value is string {
  if (typeof value !== 'string' || value.length < 5 || value.length > MAX_EMAIL_LENGTH) return false;
  const at = value.indexOf('@');
  if (at < 1 || at !== value.lastIndexOf('@')) return false;
  for (const ch of value) {
    if (isWhitespace(ch)) return false;
  }
  const domain = value.slice(at + 1);
  const dot = domain.lastIndexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

/** UUID con el formato 8-4-4-4-12 (los ids que genera Prisma con uuid()). */
export function isUuid(value: unknown): value is string {
  if (typeof value !== 'string' || value.length !== 36) return false;
  for (let i = 0; i < 36; i++) {
    const c = value.charCodeAt(i);
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      if (c !== 45) return false; // '-'
    } else if (!isHex(c)) {
      return false;
    }
  }
  return true;
}

/** Exactamente `length` dígitos (el código de verificación por correo). */
export function isNumericCode(value: unknown, length = 6): value is string {
  if (typeof value !== 'string' || value.length !== length) return false;
  for (let i = 0; i < value.length; i++) {
    if (!isDigit(value.charCodeAt(i))) return false;
  }
  return true;
}
