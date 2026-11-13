import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { verifyAccessToken } from '../services/tokenService.js';
import { AuditAction, logEvent } from '../services/auditService.js';

/**
 * Verifica el JWT enviado en "Authorization: Bearer <token>".
 * La identidad del usuario sale SOLO del token, nunca del body ni de la query.
 */
export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    return;
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    await logEvent(req, { action: AuditAction.ACCESS_DENIED, details: { reason: 'TOKEN_INVALIDO', path: req.originalUrl } });
    res.status(401).json({ error: 'Token inválido o expirado.' });
    return;
  }

  // Se consulta la base de datos para respetar cambios de rol o cuentas desactivadas al instante
  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || !user.isActive) {
    await logEvent(req, { action: AuditAction.ACCESS_DENIED, userId: user?.id, details: { reason: 'CUENTA_INACTIVA' } });
    res.status(401).json({ error: 'Cuenta inexistente o desactivada.' });
    return;
  }

  req.user = { id: user.id, email: user.email, role: user.role };
  next();
};

/** RBAC: permite el paso solo a los roles indicados. Usar siempre después de verifyToken. */
export const requireRole = (...roles: Role[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      await logEvent(req, {
        action: AuditAction.ACCESS_DENIED,
        userId: req.user?.id,
        details: { reason: 'ROL_INSUFICIENTE', required: roles, path: req.originalUrl },
      });
      res.status(403).json({ error: 'No tienes permisos para esta operación.' });
      return;
    }
    next();
  };
};
