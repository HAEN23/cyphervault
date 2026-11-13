import crypto from 'crypto';
import type { Request } from 'express';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { sendMfaCode } from './mailService.js';
import { getClientIp } from './auditService.js';

export const MFA_MAX_ATTEMPTS = 5;
export const MFA_MAX_SENDS = 3;

/** Código de 6 dígitos con el generador criptográfico de Node. */
function generateCode(): string {
  return crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Se guarda solo el HMAC del código: si se filtra la base de datos, los códigos no se pueden usar. */
function hashCode(challengeId: string, code: string): string {
  return crypto.createHmac('sha256', env.jwtSecret).update(`${challengeId}:${code}`).digest('hex');
}

function expiry(): Date {
  return new Date(Date.now() + env.mfaCodeMinutes * 60 * 1000);
}

export interface MfaStartResult {
  challengeId: string;
  devCode?: string; // solo con MFA_DEV_EXPOSE_CODE=true (pruebas)
}

/** Crea un reto nuevo y manda el código por correo. Invalida los retos anteriores del usuario. */
export async function startChallenge(req: Request, user: { id: string; email: string; name: string }): Promise<MfaStartResult> {
  await prisma.mfaChallenge.updateMany({
    where: { userId: user.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const id = crypto.randomUUID();
  const code = generateCode();

  await prisma.mfaChallenge.create({
    data: { id, userId: user.id, codeHash: hashCode(id, code), expiresAt: expiry(), ipAddress: getClientIp(req) },
  });

  await sendMfaCode(user.email, user.name, code);
  return { challengeId: id, ...(env.mfaExposeCodeForTests ? { devCode: code } : {}) };
}

/** Reenvía un código nuevo para el mismo reto (máximo 3 envíos). */
export async function resendChallenge(challengeId: string): Promise<{ ok: boolean; devCode?: string }> {
  const challenge = await prisma.mfaChallenge.findUnique({ where: { id: challengeId }, include: { user: true } });
  if (!challenge || challenge.consumedAt || challenge.sends >= MFA_MAX_SENDS) return { ok: false };

  const code = generateCode();
  await prisma.mfaChallenge.update({
    where: { id: challenge.id },
    data: { codeHash: hashCode(challenge.id, code), expiresAt: expiry(), attempts: 0, sends: { increment: 1 } },
  });
  await sendMfaCode(challenge.user.email, challenge.user.name, code);
  return { ok: true, ...(env.mfaExposeCodeForTests ? { devCode: code } : {}) };
}

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'NO_EXISTE' | 'VENCIDO' | 'USADO' | 'DEMASIADOS_INTENTOS' | 'CODIGO_INCORRECTO'; userId?: string };

/** Comprueba el código. Cada reto se puede usar una sola vez y admite 5 intentos. */
export async function verifyChallenge(challengeId: string, code: string): Promise<VerifyResult> {
  const challenge = await prisma.mfaChallenge.findUnique({ where: { id: challengeId } });
  if (!challenge) return { ok: false, reason: 'NO_EXISTE' };
  if (challenge.consumedAt) return { ok: false, reason: 'USADO', userId: challenge.userId };
  if (challenge.expiresAt < new Date()) return { ok: false, reason: 'VENCIDO', userId: challenge.userId };
  if (challenge.attempts >= MFA_MAX_ATTEMPTS) return { ok: false, reason: 'DEMASIADOS_INTENTOS', userId: challenge.userId };

  const expected = Buffer.from(challenge.codeHash, 'hex');
  const received = Buffer.from(hashCode(challenge.id, code), 'hex');
  const valid = expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!valid) {
    const attempts = challenge.attempts + 1;
    await prisma.mfaChallenge.update({
      where: { id: challenge.id },
      // Al agotar los intentos el reto se cierra: hay que iniciar sesión de nuevo
      data: { attempts, ...(attempts >= MFA_MAX_ATTEMPTS ? { consumedAt: new Date() } : {}) },
    });
    return { ok: false, reason: attempts >= MFA_MAX_ATTEMPTS ? 'DEMASIADOS_INTENTOS' : 'CODIGO_INCORRECTO', userId: challenge.userId };
  }

  // Se marca como usado de forma atómica para que el mismo código no sirva dos veces
  const consumed = await prisma.mfaChallenge.updateMany({
    where: { id: challenge.id, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  if (consumed.count === 0) return { ok: false, reason: 'USADO', userId: challenge.userId };

  return { ok: true, userId: challenge.userId };
}
