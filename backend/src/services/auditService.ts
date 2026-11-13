import type { Request } from 'express';
import { prisma } from '../config/prisma.js';

export const AuditAction = {
  REGISTER: 'REGISTER',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  CREATE_SECRET: 'CREATE_SECRET',
  READ_SECRET: 'READ_SECRET',
  ROTATE_SECRET: 'ROTATE_SECRET',
  DELETE_SECRET: 'DELETE_SECRET',
  ACCESS_DENIED: 'ACCESS_DENIED',
  RATE_LIMIT_BLOCKED: 'RATE_LIMIT_BLOCKED',
  ADMIN_UPDATE_USER: 'ADMIN_UPDATE_USER',
  MFA_CODE_SENT: 'MFA_CODE_SENT',
  MFA_SUCCESS: 'MFA_SUCCESS',
  MFA_FAILED: 'MFA_FAILED',
} as const;

export type AuditActionType = (typeof AuditAction)[keyof typeof AuditAction];

/** Acciones que cuentan como "intentos bloqueados" en el panel. */
export const BLOCKED_ACTIONS: AuditActionType[] = [
  AuditAction.LOGIN_FAILED,
  AuditAction.LOGIN_LOCKED,
  AuditAction.ACCESS_DENIED,
  AuditAction.RATE_LIMIT_BLOCKED,
  AuditAction.MFA_FAILED,
];

export function getClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || 'IP_DESCONOCIDA';
}

interface AuditInput {
  action: AuditActionType;
  userId?: string | null;
  secretId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Registra un evento en la bitácora. Nunca lanza error: si falla la escritura
 * se reporta en consola, pero no se interrumpe la petición del usuario.
 */
export async function logEvent(req: Request, input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: input.action,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'] ?? 'DESCONOCIDO',
        userId: input.userId ?? null,
        secretId: input.secretId ?? null,
        details: input.details ? JSON.stringify(input.details) : null,
      },
    });
  } catch (error) {
    console.error('[CipherVault Audit Error]:', error);
  }
}
