import rateLimit from 'express-rate-limit';
import type { Request, Response } from 'express';
import { AuditAction, logEvent } from '../services/auditService.js';
import { verifyAccessToken } from '../services/tokenService.js';

/** Intenta saber quién hizo la petición bloqueada (si traía un token válido). */
function userIdFromRequest(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  try {
    return verifyAccessToken(header.slice(7)).sub;
  } catch {
    return null;
  }
}

function blockedHandler(message: string) {
  return async (req: Request, res: Response) => {
    // Cada bloqueo queda en la bitácora y alimenta el indicador "Intentos bloqueados"
    await logEvent(req, {
      action: AuditAction.RATE_LIMIT_BLOCKED,
      userId: userIdFromRequest(req),
      details: { path: req.originalUrl, method: req.method },
    });
    res.status(429).json({ error: message });
  };
}

/** Límite general de la API: 100 peticiones por IP cada 15 minutos. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: blockedHandler('Demasiadas peticiones desde esta IP. Por seguridad, intenta de nuevo en 15 minutos.'),
});

/** Límite estricto para el inicio de sesión y registro: 5 intentos por IP cada 15 minutos. */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: blockedHandler('Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'),
});

/** Límite propio para la verificación del código: 10 intentos por IP cada 15 minutos. */
export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: blockedHandler('Demasiados intentos de verificación. Intenta de nuevo en 15 minutos.'),
});
