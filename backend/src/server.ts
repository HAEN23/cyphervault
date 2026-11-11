import 'dotenv/config'; // <--- Esto carga tu .env automáticamente
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createSecret, getSecrets, getAuditLogs } from './controllers/secretController.js';

const app = express();
const PORT = process.env.PORT || 3001;

// 1. SEGURIDAD PREVENTIVA: Protege cabeceras HTTP contra inyecciones y XSS
app.use(helmet());

// 2. MITIGACIÓN DE FUERZA BRUTA: Limita peticiones repetitivas (DoS)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Demasiadas peticiones desde esta IP. Por seguridad, intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', apiLimiter);

// 3. Middlewares de configuración estándar
app.use(cors({ origin: 'http://localhost:3000' })); 
app.use(express.json()); 

// 4. RUTAS DE LA API (Endpoints)
app.post('/api/secrets', createSecret);
app.get('/api/secrets', getSecrets);
app.get('/api/audit', getAuditLogs); // <--- Nueva ruta de auditoría

// Ruta de auditoría interna
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Servidor CipherVault seguro y operando bajo AES-256' });
});

// 5. Arranque del servidor
app.listen(PORT, () => {
  console.log(`[CipherVault] Servidor backend protegido inicializado en http://localhost:${PORT}`);
});