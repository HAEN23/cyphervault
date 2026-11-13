import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuditAction, logEvent } from '../services/auditService.js';

/** GET /api/admin/users (solo ADMIN) */
export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, isActive: true, createdAt: true,
      _count: { select: { secrets: { where: { deletedAt: null } } } },
    },
    orderBy: { createdAt: 'asc' },
  });
  res.status(200).json({ users });
};

/** PATCH /api/admin/users/:id (solo ADMIN): cambiar rol o activar/desactivar una cuenta. */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { role, isActive } = req.body ?? {};

  if (id === req.user!.id) {
    res.status(400).json({ error: 'No puedes modificar tu propia cuenta de administrador' });
    return;
  }
  if (role !== undefined && role !== 'ADMIN' && role !== 'USER') {
    res.status(400).json({ error: 'Rol inválido' });
    return;
  }
  if (isActive !== undefined && typeof isActive !== 'boolean') {
    res.status(400).json({ error: 'isActive debe ser booleano' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role, isActive },
    select: { id: true, email: true, role: true, isActive: true },
  });

  await logEvent(req, {
    action: AuditAction.ADMIN_UPDATE_USER,
    userId: req.user!.id,
    details: { targetUserId: id, role, isActive },
  });
  res.status(200).json({ user });
};
