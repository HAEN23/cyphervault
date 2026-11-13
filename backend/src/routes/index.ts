import { Router } from 'express';
import { verifyToken, requireRole } from '../middlewares/authMiddleware.js';
import { authLimiter } from '../middlewares/rateLimiters.js';
import { register, login, googleLogin, me } from '../controllers/authController.js';
import { createSecret, getSecrets, revealSecret, rotateSecret, deleteSecret } from '../controllers/secretController.js';
import { getMyAuditLogs, getAllAuditLogs, getStats } from '../controllers/auditController.js';
import { listUsers, updateUser } from '../controllers/adminController.js';

export const router = Router();

// --- Públicas (con límite estricto contra fuerza bruta) ---
router.post('/auth/register', authLimiter, register);
router.post('/auth/login', authLimiter, login);
router.post('/auth/google', authLimiter, googleLogin);

router.get('/health', (_req, res) => {
  res.status(200).json({ status: 'OK' });
});

// --- Todo lo de abajo exige JWT válido ---
router.use(verifyToken);

router.get('/auth/me', me);

router.get('/secrets', getSecrets);
router.post('/secrets', createSecret);
router.post('/secrets/:id/reveal', revealSecret);
router.put('/secrets/:id/rotate', rotateSecret);
router.delete('/secrets/:id', deleteSecret);

router.get('/audit', getMyAuditLogs);
router.get('/stats', getStats);

// --- Solo ADMIN (RBAC) ---
router.get('/admin/audit', requireRole('ADMIN'), getAllAuditLogs);
router.get('/admin/users', requireRole('ADMIN'), listUsers);
router.patch('/admin/users/:id', requireRole('ADMIN'), updateUser);
