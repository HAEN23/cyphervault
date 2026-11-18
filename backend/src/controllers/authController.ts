import type { Request, Response } from 'express';
import type { AccountStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { signAccessToken } from '../services/tokenService.js';
import { AuditAction, logEvent } from '../services/auditService.js';
import { getPasswordErrors } from '../utils/passwordPolicy.js';
import { isEmail, isNumericCode, isUuid, MAX_EMAIL_LENGTH } from '../utils/validators.js';
import { startChallenge, resendChallenge, verifyChallenge } from '../services/mfaService.js';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Hash ficticio para que un correo inexistente tarde lo mismo que uno real (evita enumerar usuarios)
const DUMMY_HASH = bcrypt.hashSync('cipher-vault-dummy-password', BCRYPT_ROUNDS);

const googleClient = new OAuth2Client();

function roleFor(email: string) {
  return env.adminEmails.includes(email) ? 'ADMIN' : 'USER';
}

/** Los correos de ADMIN_EMAILS entran directo; el resto espera la aprobación de un ADMIN. */
function initialStatus(email: string): AccountStatus {
  return roleFor(email) === 'ADMIN' ? 'APPROVED' : 'PENDING';
}

const STATUS_MESSAGES: Record<Exclude<AccountStatus, 'APPROVED'>, string> = {
  PENDING: 'Tu cuenta está en espera de aprobación por un administrador.',
  REJECTED: 'Tu solicitud de acceso fue rechazada por un administrador.',
};

/**
 * Solo se llama cuando la identidad ya se comprobó (contraseña o Google), así que
 * decir el estado no permite enumerar cuentas. Devuelve true si cortó la petición.
 */
async function blockIfNotApproved(
  req: Request,
  res: Response,
  user: { id: string; status: AccountStatus },
  method: 'local' | 'google',
): Promise<boolean> {
  if (user.status === 'APPROVED') return false;
  await logEvent(req, { action: AuditAction.LOGIN_FAILED, userId: user.id, details: { method, reason: `CUENTA_${user.status}` } });
  res.status(403).json({ error: STATUS_MESSAGES[user.status], status: user.status });
  return true;
}

/** Suma un intento fallido (contraseña o código) y bloquea la cuenta al llegar a 5. */
async function registerFailedAttempt(user: { id: string; failedLoginAttempts: number }): Promise<void> {
  const attempts = user.failedLoginAttempts + 1;
  const lock = attempts >= MAX_FAILED_ATTEMPTS;
  await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: lock ? 0 : attempts,
      lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
    },
  });
}

function isLocked(user: { lockedUntil: Date | null }): boolean {
  return Boolean(user.lockedUntil && user.lockedUntil > new Date());
}

/**
 * bcrypt solo usa los primeros 72 bytes: una contraseña más larga se aceptaría
 * aunque el final fuera distinto. Se rechaza al registrarse.
 */
const BCRYPT_MAX_BYTES = 72;

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** h***@gmail.com: se muestra al usuario a dónde se mandó el código sin exponer el correo completo. */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

/**
 * Paso 1 superado (contraseña o Google): se manda el código por correo y se responde
 * con el reto. El JWT de la API solo se entrega en el paso 2 (/api/auth/mfa/verify).
 */
async function requireSecondFactor(
  req: Request,
  res: Response,
  user: { id: string; email: string; name: string },
  status = 200,
): Promise<void> {
  const { challengeId, devCode } = await startChallenge(req, user);
  await logEvent(req, { action: AuditAction.MFA_CODE_SENT, userId: user.id });
  res.status(status).json({
    mfaRequired: true,
    challengeId,
    sentTo: maskEmail(user.email),
    ...(devCode ? { devCode } : {}),
  });
}

function normalizeEmail(value: unknown): string | null {
  // Se corta la longitud antes de cualquier otra operación sobre la entrada del usuario
  if (typeof value !== 'string' || value.length > MAX_EMAIL_LENGTH + 64) return null;
  const email = value.trim().toLowerCase();
  return isEmail(email) ? email : null;
}

/** POST /api/auth/register: alta local con contraseña cifrada con bcrypt. */
export const register = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !name) {
    res.status(400).json({ error: 'Correo o nombre inválidos' });
    return;
  }
  const errors = getPasswordErrors(password);
  if (Buffer.byteLength(password, 'utf8') > BCRYPT_MAX_BYTES) errors.push(`${BCRYPT_MAX_BYTES} bytes máximo`);
  if (errors.length > 0) {
    res.status(400).json({ error: 'Contraseña débil', details: errors });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    // No se permite "reclamar" con contraseña una cuenta que ya existe (p. ej. una de Google)
    res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, name, passwordHash, role: roleFor(email), status: initialStatus(email) },
  });

  await logEvent(req, { action: AuditAction.REGISTER, userId: user.id, details: { method: 'local', status: user.status } });
  if (user.status === 'PENDING') {
    // El código por correo se pedirá en su primer inicio de sesión, ya aprobado
    res.status(201).json({ pending: true, status: user.status, message: STATUS_MESSAGES.PENDING });
    return;
  }
  // El primer código también comprueba que el correo realmente es de quien se registra
  await requireSecondFactor(req, res, user, 201);
};

/** POST /api/auth/login: verifica la contraseña con bcrypt y bloquea la cuenta tras 5 fallos. */
export const login = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  // Mismo mensaje para correo inexistente, contraseña mala y cuenta bloqueada: no se puede enumerar cuentas
  const genericError = 'Correo o contraseña incorrectos. Tras 5 intentos fallidos la cuenta se bloquea 15 minutos.';

  if (!email || !password) {
    res.status(400).json({ error: genericError });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  // bcrypt se ejecuta siempre (también si la cuenta está bloqueada) para que el tiempo de respuesta no delate nada
  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (user && isLocked(user)) {
    // Durante el bloqueo no se dice si la contraseña era correcta (evita adivinarla mientras dura)
    await logEvent(req, { action: AuditAction.LOGIN_LOCKED, userId: user.id });
    res.status(401).json({ error: genericError });
    return;
  }

  if (!user || !user.passwordHash || !valid || !user.isActive) {
    if (user) await registerFailedAttempt(user);
    await logEvent(req, { action: AuditAction.LOGIN_FAILED, userId: user?.id, details: { email } });
    res.status(401).json({ error: genericError });
    return;
  }

  // El contador de fallos se reinicia hasta pasar también el código (ver verifyMfa)
  if (await blockIfNotApproved(req, res, user, 'local')) return;
  await requireSecondFactor(req, res, user);
};

/**
 * POST /api/auth/google: el frontend (NextAuth) envía el id_token de Google.
 * La API lo verifica con Google y emite su propio JWT con el rol del usuario.
 */
export const googleLogin = async (req: Request, res: Response): Promise<void> => {
  const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken : '';
  if (!idToken || !env.googleClientId) {
    res.status(400).json({ error: 'Token de Google no proporcionado' });
    return;
  }

  let email: string | null = null;
  let name = '';
  try {
    const ticket = await googleClient.verifyIdToken({ idToken, audience: env.googleClientId });
    const payload = ticket.getPayload();
    if (payload?.email && payload.email_verified) {
      email = payload.email.toLowerCase();
      name = payload.name ?? email.split('@')[0];
    }
  } catch {
    email = null;
  }

  if (!email) {
    await logEvent(req, { action: AuditAction.LOGIN_FAILED, details: { method: 'google' } });
    res.status(401).json({ error: 'Token de Google inválido' });
    return;
  }

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({ data: { email, name, role: roleFor(email), status: initialStatus(email) } });
    await logEvent(req, { action: AuditAction.REGISTER, userId: user.id, details: { method: 'google', status: user.status } });
  }

  if (!user.isActive) {
    await logEvent(req, { action: AuditAction.LOGIN_FAILED, userId: user.id, details: { method: 'google', reason: 'CUENTA_INACTIVA' } });
    res.status(403).json({ error: 'Cuenta desactivada' });
    return;
  }
  if (await blockIfNotApproved(req, res, user, 'google')) return;

  await requireSecondFactor(req, res, user);
};

/** POST /api/auth/mfa/verify: paso 2. Si el código es correcto, entrega el JWT de la API. */
export const verifyMfa = async (req: Request, res: Response): Promise<void> => {
  const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
  const code = typeof req.body?.code === 'string' && req.body.code.length <= 32 ? req.body.code.trim() : '';

  if (!isUuid(challengeId) || !isNumericCode(code)) {
    res.status(400).json({ error: 'Código inválido' });
    return;
  }

  const result = await verifyChallenge(challengeId, code);
  if (!result.ok) {
    await logEvent(req, { action: AuditAction.MFA_FAILED, userId: result.userId, details: { reason: result.reason } });
    // Los códigos incorrectos también cuentan para el bloqueo de la cuenta (no solo por IP)
    if (result.reason === 'CODIGO_INCORRECTO' || result.reason === 'DEMASIADOS_INTENTOS') {
      const owner = await prisma.user.findUnique({ where: { id: result.userId! } });
      if (owner) await registerFailedAttempt(owner);
    }
    const messages: Record<typeof result.reason, string> = {
      NO_EXISTE: 'El código ya no es válido. Inicia sesión de nuevo.',
      USADO: 'El código ya no es válido. Inicia sesión de nuevo.',
      VENCIDO: 'El código venció. Pide uno nuevo o inicia sesión de nuevo.',
      DEMASIADOS_INTENTOS: 'Demasiados intentos. Inicia sesión de nuevo.',
      CODIGO_INCORRECTO: 'Código incorrecto',
    };
    res.status(401).json({ error: messages[result.reason], reason: result.reason });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: result.userId } });
  if (user && isLocked(user)) {
    await logEvent(req, { action: AuditAction.LOGIN_LOCKED, userId: user.id, details: { step: 'mfa' } });
    res.status(401).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Inicia sesión más tarde.' });
    return;
  }
  if (!user || !user.isActive || user.status !== 'APPROVED') {
    res.status(403).json({ error: 'Cuenta desactivada' });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  await logEvent(req, { action: AuditAction.MFA_SUCCESS, userId: user.id });
  await logEvent(req, { action: AuditAction.LOGIN_SUCCESS, userId: user.id, details: { mfa: 'email' } });
  res.status(200).json({ user: publicUser(user), accessToken: signAccessToken(user) });
};

/** POST /api/auth/mfa/resend: manda un código nuevo para el mismo reto (máximo 3 envíos). */
export const resendMfa = async (req: Request, res: Response): Promise<void> => {
  const challengeId = typeof req.body?.challengeId === 'string' ? req.body.challengeId : '';
  if (!isUuid(challengeId)) {
    res.status(400).json({ error: 'Reto inválido' });
    return;
  }
  const result = await resendChallenge(challengeId);
  if (!result.ok) {
    res.status(400).json({ error: 'No se puede reenviar el código. Inicia sesión de nuevo.' });
    return;
  }
  res.status(200).json({ message: 'Código reenviado', ...(result.devCode ? { devCode: result.devCode } : {}) });
};

/** GET /api/auth/me */
export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.status(200).json({ user: publicUser(user) });
};
