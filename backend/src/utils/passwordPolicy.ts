/**
 * Política de contraseñas robustas (la misma que valida el frontend en tiempo real).
 * Se repite en el servidor porque la validación del navegador se puede saltar
 * llamando a la API directamente.
 */
export function getPasswordErrors(value: string): string[] {
  const errors: string[] = [];
  if (value.length < 12) errors.push('12 caracteres mínimo');
  if (!/[A-Z]/.test(value)) errors.push('1 mayúscula');
  if (!/[a-z]/.test(value)) errors.push('1 minúscula');
  if (!/[0-9]/.test(value)) errors.push('1 número');
  if (!/[^A-Za-z0-9]/.test(value)) errors.push('1 carácter especial');
  return errors;
}
