/**
 * Política de contraseñas robustas (la misma que valida el frontend en tiempo real).
 * Se repite en el servidor porque la validación del navegador se puede saltar
 * llamando a la API directamente.
 *
 * Se recorre la cadena una sola vez, sin expresiones regulares, y con un tope de
 * longitud ANTES de revisarla, para que una entrada enorme no consuma CPU.
 */
export const MIN_PASSWORD_LENGTH = 12;

export function getPasswordErrors(value: unknown, maxLength = 128): string[] {
  if (typeof value !== 'string') return ['La contraseña es obligatoria'];
  if (value.length > maxLength) return [`${maxLength} caracteres máximo`];

  let upper = false;
  let lower = false;
  let digit = false;
  let special = false;
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);
    if (c >= 65 && c <= 90) upper = true; // A-Z
    else if (c >= 97 && c <= 122) lower = true; // a-z
    else if (c >= 48 && c <= 57) digit = true; // 0-9
    else special = true;
  }

  const errors: string[] = [];
  if (value.length < MIN_PASSWORD_LENGTH) errors.push(`${MIN_PASSWORD_LENGTH} caracteres mínimo`);
  if (!upper) errors.push('1 mayúscula');
  if (!lower) errors.push('1 minúscula');
  if (!digit) errors.push('1 número');
  if (!special) errors.push('1 carácter especial');
  return errors;
}
