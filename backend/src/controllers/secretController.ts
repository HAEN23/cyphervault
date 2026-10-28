import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { encryptSecret, decryptSecret } from '../utils/crypto.js'

const prisma = new PrismaClient();

export const createSecret = async (req: Request, res: Response) => {
  try {
    const { title, environment, category, plainPassword, ownerId } = req.body;
    
    // Cifrar antes de guardar
    const encryptedPassword = encryptSecret(plainPassword);

    const newSecret = await prisma.secret.create({
      data: { title, environment, category, encryptedPassword, ownerId }
    });

    res.status(201).json({ message: 'Secreto guardado con éxito', secretId: newSecret.id });
  } catch (error) {
    res.status(500).json({ error: 'Error al procesar el secreto' });
  }
};