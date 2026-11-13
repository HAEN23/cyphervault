import { PrismaClient } from '@prisma/client';

// Una sola instancia compartida por toda la API
export const prisma = new PrismaClient();
