import type { Request, Response } from 'express';
import { Environment } from '@prisma/client';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { encryptData, decryptData } from '../utils/crypto.js';
import { getPasswordErrors } from '../utils/passwordPolicy.js';
import { AuditAction, logEvent } from '../services/auditService.js';

const ROTATION_MS = env.rotationDays * 24 * 60 * 60 * 1000;

function isExpired(passwordChangedAt: Date): boolean {
  return Date.now() - passwordChangedAt.getTime() > ROTATION_MS;
}

function parseEnvironment(value: unknown): Environment | null {
  if (typeof value !== 'string') return null;
  const upper = value.toUpperCase();
  return (Object.values(Environment) as string[]).includes(upper) ? (upper as Environment) : null;
}

function parseUrl(value: unknown): string | null | undefined {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 2048) return undefined;
  try {
    const url = new URL(value);
    // Solo http/https: evita guardar "javascript:" u otros esquemas peligrosos
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Formato público de un secreto: NUNCA incluye la contraseña. */
function toPublic(secret: {
  id: string; title: string; environment: Environment; url: string | null;
  createdAt: Date; updatedAt: Date; passwordChangedAt: Date;
}) {
  return {
    id: secret.id,
    title: secret.title,
    environment: secret.environment,
    url: secret.url,
    createdAt: secret.createdAt,
    updatedAt: secret.updatedAt,
    passwordChangedAt: secret.passwordChangedAt,
    daysSinceChange: Math.floor((Date.now() - secret.passwordChangedAt.getTime()) / 86_400_000),
    isExpired: isExpired(secret.passwordChangedAt),
  };
}

/** Busca un secreto activo del usuario autenticado; si no es suyo, registra el intento y responde 404. */
async function findOwnedSecret(req: Request, res: Response) {
  const id = String(req.params.id);
  const secret = await prisma.secret.findFirst({ where: { id, deletedAt: null } });

  if (!secret || secret.userId !== req.user!.id) {
    await logEvent(req, {
      action: AuditAction.ACCESS_DENIED,
      userId: req.user!.id,
      // Solo se enlaza el secreto si existe, para no romper la llave foránea
      secretId: secret?.id ?? null,
      details: { reason: secret ? 'NO_ES_DUENO' : 'NO_EXISTE', path: req.originalUrl },
    });
    res.status(404).json({ error: 'Credencial no encontrada' });
    return null;
  }
  return secret;
}

/** POST /api/secrets */
export const createSecret = async (req: Request, res: Response): Promise<void> => {
  const { title, environment, password, url } = req.body ?? {};

  const cleanTitle = typeof title === 'string' ? title.trim() : '';
  const parsedEnv = parseEnvironment(environment);
  const parsedUrl = parseUrl(url);

  if (!cleanTitle || cleanTitle.length > 120 || !parsedEnv || typeof password !== 'string') {
    res.status(400).json({ error: 'Faltan campos obligatorios o tienen un formato inválido' });
    return;
  }
  if (parsedUrl === undefined) {
    res.status(400).json({ error: 'La URL debe empezar con http:// o https://' });
    return;
  }
  const errors = getPasswordErrors(password);
  if (errors.length > 0 || password.length > 1024) {
    res.status(400).json({ error: 'Contraseña débil', details: errors });
    return;
  }

  const { iv, encryptedData } = encryptData(password);

  const secret = await prisma.secret.create({
    data: {
      title: cleanTitle,
      environment: parsedEnv,
      url: parsedUrl,
      encryptedData,
      iv,
      userId: req.user!.id,
    },
  });

  await logEvent(req, { action: AuditAction.CREATE_SECRET, userId: req.user!.id, secretId: secret.id });
  res.status(201).json({ message: 'Credencial cifrada con éxito', secret: toPublic(secret) });
};

/** GET /api/secrets: lista de credenciales activas del usuario, sin descifrar. */
export const getSecrets = async (req: Request, res: Response): Promise<void> => {
  const secrets = await prisma.secret.findMany({
    where: { userId: req.user!.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json({ secrets: secrets.map(toPublic) });
};

/** POST /api/secrets/:id/reveal: descifra UN secreto bajo demanda y deja rastro de quién lo vio. */
export const revealSecret = async (req: Request, res: Response): Promise<void> => {
  const secret = await findOwnedSecret(req, res);
  if (!secret) return;

  const password = decryptData(secret.encryptedData, secret.iv);
  await logEvent(req, { action: AuditAction.READ_SECRET, userId: req.user!.id, secretId: secret.id });

  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ password });
};

/** PUT /api/secrets/:id/rotate: reemplaza la contraseña (nuevo IV) y reinicia el contador de 90 días. */
export const rotateSecret = async (req: Request, res: Response): Promise<void> => {
  const secret = await findOwnedSecret(req, res);
  if (!secret) return;

  const password = req.body?.password;
  if (typeof password !== 'string') {
    res.status(400).json({ error: 'Falta la nueva contraseña' });
    return;
  }
  const errors = getPasswordErrors(password);
  if (errors.length > 0 || password.length > 1024) {
    res.status(400).json({ error: 'Contraseña débil', details: errors });
    return;
  }
  if (decryptData(secret.encryptedData, secret.iv) === password) {
    res.status(400).json({ error: 'La nueva contraseña debe ser distinta de la actual' });
    return;
  }

  const { iv, encryptedData } = encryptData(password);
  const updated = await prisma.secret.update({
    where: { id: secret.id },
    data: { encryptedData, iv, passwordChangedAt: new Date() },
  });

  await logEvent(req, { action: AuditAction.ROTATE_SECRET, userId: req.user!.id, secretId: secret.id });
  res.status(200).json({ message: 'Credencial rotada', secret: toPublic(updated) });
};

/** DELETE /api/secrets/:id: borrado lógico, se conserva el historial de auditoría. */
export const deleteSecret = async (req: Request, res: Response): Promise<void> => {
  const secret = await findOwnedSecret(req, res);
  if (!secret) return;

  await prisma.secret.update({
    where: { id: secret.id },
    // Se borra también el texto cifrado: ya no se podrá recuperar
    data: { deletedAt: new Date(), encryptedData: '', iv: '' },
  });

  await logEvent(req, { action: AuditAction.DELETE_SECRET, userId: req.user!.id, secretId: secret.id });
  res.status(204).end();
};
