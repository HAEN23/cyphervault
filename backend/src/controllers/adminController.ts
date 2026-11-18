import type { Request, Response } from 'express';
import { prisma } from '../config/prisma.js';
import { AuditAction, logEvent } from '../services/auditService.js';

/** GET /api/admin/users (solo ADMIN) */
export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  const users = await prisma.user.findMany({
    select: {
      id: true, email: true, name: true, role: true, isActive: true, status: true, createdAt: true,
      _count: { select: { secrets: { where: { deletedAt: null } } } },
    },
    // Las solicitudes pendientes van primero (orden del enum: PENDING, APPROVED, REJECTED)
    orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
  });
  res.status(200).json({ users });
};

/** PATCH /api/admin/users/:id (solo ADMIN): aceptar/rechazar, cambiar rol o activar/desactivar una cuenta. */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const id = String(req.params.id);
  const { role, isActive, status } = req.body ?? {};

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

  if (status !== undefined && status !== 'APPROVED' && status !== 'REJECTED') {
    res.status(400).json({ error: 'Estado inválido' });
    return;
  }

  const exists = await prisma.user.findUnique({ where: { id } });
  if (!exists) {
    res.status(404).json({ error: 'Usuario no encontrado' });
    return;
  }

  const user = await prisma.user.update({
    where: { id },
    data: { role, isActive, status },
    select: { id: true, email: true, role: true, isActive: true, status: true },
  });

  const action = status === 'APPROVED' ? AuditAction.ADMIN_APPROVE_USER
    : status === 'REJECTED' ? AuditAction.ADMIN_REJECT_USER
    : AuditAction.ADMIN_UPDATE_USER;
  await logEvent(req, {
    action,
    userId: req.user!.id,
    details: { targetUserId: id, targetEmail: exists.email, role, isActive, status },
  });
  res.status(200).json({ user });
};
