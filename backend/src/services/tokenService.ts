import jwt from 'jsonwebtoken';
import type { Role } from '@prisma/client';
import { env } from '../config/env.js';

export interface TokenPayload {
  sub: string; // id del usuario
  email: string;
  role: Role;
}

export function signAccessToken(user: { id: string; email: string; role: Role }): string {
  const payload: TokenPayload = { sub: user.id, email: user.email, role: user.role };
  return jwt.sign(payload, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    issuer: 'ciphervault-api',
  });
}

export function verifyAccessToken(token: string): TokenPayload {
  // Se fija el algoritmo para evitar ataques de "alg: none" o confusión de algoritmos
  return jwt.verify(token, env.jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'ciphervault-api',
  }) as TokenPayload;
}
