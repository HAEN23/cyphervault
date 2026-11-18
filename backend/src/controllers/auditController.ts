import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { BLOCKED_ACTIONS } from '../services/auditService.js';
import { countByBucket, secretDailySeries, STEP } from '../utils/statsSeries.js';

const auditSelect = {
  id: true,
  action: true,
  ipAddress: true,
  userAgent: true,
  details: true,
  createdAt: true,
  user: { select: { email: true, name: true } },
  secret: { select: { id: true, title: true } },
} satisfies Prisma.AuditLogSelect;

function pageSize(req: Request) {
  const n = Number(req.query.limit ?? 50);
  return Number.isFinite(n) ? Math.min(Math.max(Math.trunc(n), 1), 200) : 50;
}

/** GET /api/audit: historial del usuario autenticado. */
export const getMyAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const logs = await prisma.auditLog.findMany({
    where: { userId: req.user!.id },
    select: auditSelect,
    orderBy: { createdAt: 'desc' },
    take: pageSize(req),
  });
  res.status(200).json({ logs });
};

/** GET /api/admin/audit: bitácora global (solo ADMIN). Filtros opcionales ?action=&ip= */
export const getAllAuditLogs = async (req: Request, res: Response): Promise<void> => {
  const where: Prisma.AuditLogWhereInput = {};
  if (typeof req.query.action === 'string') where.action = req.query.action;
  if (typeof req.query.ip === 'string') where.ipAddress = req.query.ip;

  const logs = await prisma.auditLog.findMany({
    where,
    select: auditSelect,
    orderBy: { createdAt: 'desc' },
    take: pageSize(req),
  });
  res.status(200).json({ logs });
};

/**
 * GET /api/stats: indicadores del panel.
 * - USER: datos de sus propias credenciales y eventos.
 * - ADMIN: los bloqueos y accesos se cuentan para toda la plataforma.
 */
export const getStats = async (req: Request, res: Response): Promise<void> => {
  const isAdmin = req.user!.role === 'ADMIN';
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rotationLimit = new Date(Date.now() - env.rotationDays * 24 * 60 * 60 * 1000);
  const scope: Prisma.AuditLogWhereInput = isAdmin ? {} : { userId: req.user!.id };

  const now = new Date();
  const [secrets, events] = await Promise.all([
    prisma.secret.findMany({
      where: { userId: req.user!.id, OR: [{ deletedAt: null }, { deletedAt: { gte: new Date(now.getTime() - 14 * STEP.DAY) } }] },
      select: { createdAt: true, deletedAt: true, passwordChangedAt: true },
    }),
    // shortcut: trae los eventos de 24 h a memoria para agruparlos por hora; si la bitácora global crece mucho, agrupar en SQL con date_trunc
    prisma.auditLog.findMany({ where: { ...scope, createdAt: { gte: since24h } }, select: { action: true, createdAt: true } }),
  ]);

  const active = secrets.filter((s) => !s.deletedAt);
  const blocked = events.filter((e) => (BLOCKED_ACTIONS as string[]).includes(e.action));
  const { protectedSeries, atRiskSeries } = secretDailySeries(secrets, now, 14, env.rotationDays);

  res.status(200).json({
    totalProtected: active.length,
    atRisk: active.filter((s) => s.passwordChangedAt < rotationLimit).length,
    blockedAttempts: blocked.length,
    access24h: events.length,
    scope: isAdmin ? 'global' : 'personal',
    // Series para las gráficas del panel: 14 días (secretos) y 24 horas (eventos)
    history: {
      totalProtected: protectedSeries,
      atRisk: atRiskSeries,
      blockedAttempts: countByBucket(blocked.map((e) => e.createdAt), now, 24, STEP.HOUR),
      access24h: countByBucket(events.map((e) => e.createdAt), now, 24, STEP.HOUR),
    },
  });
};
