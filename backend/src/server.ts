import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createSecret } from './controllers/secretController.js';
import { verifyToken } from './middlewares/authMiddleware.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Demasiadas peticiones. Bloqueo temporal.' }
});

// Rutas
app.post('/api/secrets', apiLimiter, verifyToken, createSecret);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`🛡️ Servidor seguro ejecutándose en puerto ${PORT}`);
});