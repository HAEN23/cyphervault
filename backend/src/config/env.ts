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

  // Verificación en dos pasos por correo (Gmail SMTP con contraseña de aplicación)
  smtp: {
    host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT ?? 465),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    from: process.env.MAIL_FROM ?? process.env.SMTP_USER ?? '',
  },
  mfaCodeMinutes: Number(process.env.MFA_CODE_MINUTES ?? 10),
  // SOLO para el entorno de pruebas/pentest: incluye el código en la respuesta de la API.
  mfaExposeCodeForTests: process.env.MFA_DEV_EXPOSE_CODE === 'true',
  isProduction: process.env.NODE_ENV === 'production',
};

if (env.isProduction && env.mfaExposeCodeForTests) {
  throw new Error('[CipherVault] MFA_DEV_EXPOSE_CODE no se puede activar en producción');
}
if (env.isProduction && (!env.smtp.user || !env.smtp.pass)) {
  throw new Error('[CipherVault] En producción se requieren SMTP_USER y SMTP_PASS para la verificación en dos pasos');
}
