import 'dotenv/config';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`[CipherVault] Falta la variable de entorno ${name}`);
  }
  return value;
}

const encryptionKey = required('ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
  // AES-256 exige una llave de exactamente 32 bytes (64 caracteres hexadecimales)
  throw new Error('[CipherVault] ENCRYPTION_KEY debe tener 64 caracteres hexadecimales (32 bytes)');
}

const jwtSecret = required('JWT_SECRET');
if (jwtSecret.length < 32) {
  throw new Error('[CipherVault] JWT_SECRET debe tener al menos 32 caracteres');
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  encryptionKey: Buffer.from(encryptionKey, 'hex'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
  // Correos que reciben el rol ADMIN al crearse su cuenta (separados por coma)
  adminEmails: (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
  // Número de proxies delante de la API (0 si se expone directo). Necesario para registrar la IP real.
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
  rotationDays: Number(process.env.ROTATION_DAYS ?? 90),
};
