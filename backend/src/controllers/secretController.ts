import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encryptData, decryptData } from '../utils/crypto.js';

const prisma = new PrismaClient();

export const createSecret = async (req: Request, res: Response): Promise<void> => {
  try {
    const { title, environment, password, userId } = req.body;

    if (!title || !environment || !password || !userId) {
      res.status(400).json({ error: 'Faltan campos obligatorios' });
      return;
    }

   
    const user = await prisma.user.upsert({
      where: { email: userId },
      update: {},
      create: {
        email: userId,
        name: userId.split('@')[0], 
        role: 'USER'
      }
    });

    
    const { iv, encryptedData } = encryptData(password);

    
    const newSecret = await prisma.secret.create({
      data: {
        title,
        environment,
        encryptedData,
        iv,
        userId: user.id
      }
    });

    
    const ipAddress = req.ip || req.socket.remoteAddress || 'IP_DESCONOCIDA';
    const userAgent = req.headers['user-agent'] || 'DESCONOCIDO';

    await prisma.auditLog.create({
      data: {
        action: 'CREATE_SECRET',
        ipAddress,
        userAgent,
        userId: user.id,
        secretId: newSecret.id
      }
    });

    res.status(201).json({ message: 'Credencial cifrada con éxito', secret: newSecret });
    
  } catch (error) {
    console.error('[CipherVault Error]:', error);
    res.status(500).json({ error: 'Error interno del servidor criptográfico' });
  }
};

export const getSecrets = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.query;

    if (!userId || typeof userId !== 'string') {
      res.status(400).json({ error: 'Falta el identificador del usuario' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email: userId } });

    if (!user) {
      res.status(200).json({ secrets: [] });
      return;
    }

    const secrets = await prisma.secret.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });

    const decryptedSecrets = secrets.map(secret => ({
      id: secret.id,
      title: secret.title,
      environment: secret.environment,
      password: decryptData(secret.encryptedData, secret.iv),
      createdAt: secret.createdAt
    }));

    res.status(200).json({ secrets: decryptedSecrets });
  } catch (error) {
    console.error('[CipherVault Error]:', error);
    res.status(500).json({ error: 'Error interno al recuperar los secretos' });
  }
};