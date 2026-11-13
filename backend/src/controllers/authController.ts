import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { signAccessToken } from '../services/tokenService.js';
import { AuditAction, logEvent } from '../services/auditService.js';
import { getPasswordErrors } from '../utils/passwordPolicy.js';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Hash ficticio para que un correo inexistente tarde lo mismo que uno real (evita enumerar usuarios)
const DUMMY_HASH = bcrypt.hashSync('cipher-vault-dummy-password', BCRYPT_ROUNDS);

const googleClient = new OAuth2Client();

function roleFor(email: string) {
  return env.adminEmails.includes(email) ? 'ADMIN' : 'USER';
}

function publicUser(user: { id: string; email: string; name: string; role: string }) {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254 ? email : null;
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
  if (errors.length > 0 || password.length > 128) {
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
    data: { email, name, passwordHash, role: roleFor(email) },
  });

  await logEvent(req, { action: AuditAction.REGISTER, userId: user.id, details: { method: 'local' } });
  res.status(201).json({ user: publicUser(user), accessToken: signAccessToken(user) });
};

/** POST /api/auth/login: verifica la contraseña con bcrypt y bloquea la cuenta tras 5 fallos. */
export const login = async (req: Request, res: Response): Promise<void> => {
  const email = normalizeEmail(req.body?.email);
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  const genericError = 'Correo o contraseña incorrectos';

  if (!email || !password) {
    res.status(400).json({ error: genericError });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await logEvent(req, { action: AuditAction.LOGIN_LOCKED, userId: user.id });
    res.status(423).json({ error: 'Cuenta bloqueada temporalmente por intentos fallidos. Intenta más tarde.' });
    return;
  }

  const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !user.passwordHash || !valid || !user.isActive) {
    if (user) {
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
    await logEvent(req, { action: AuditAction.LOGIN_FAILED, userId: user?.id, details: { email } });
    res.status(401).json({ error: genericError });
    return;
  }

  await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  await logEvent(req, { action: AuditAction.LOGIN_SUCCESS, userId: user.id, details: { method: 'local' } });
  res.status(200).json({ user: publicUser(user), accessToken: signAccessToken(user) });
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

  const user = await prisma.user.upsert({
    where: { email },
    update: {},
    create: { email, name, role: roleFor(email) },
  });

  if (!user.isActive) {
    await logEvent(req, { action: AuditAction.LOGIN_FAILED, userId: user.id, details: { method: 'google', reason: 'CUENTA_INACTIVA' } });
    res.status(403).json({ error: 'Cuenta desactivada' });
    return;
  }

  await logEvent(req, { action: AuditAction.LOGIN_SUCCESS, userId: user.id, details: { method: 'google' } });
  res.status(200).json({ user: publicUser(user), accessToken: signAccessToken(user) });
};

/** GET /api/auth/me */
export const me = async (req: Request, res: Response): Promise<void> => {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: req.user!.id } });
  res.status(200).json({ user: publicUser(user) });
};
