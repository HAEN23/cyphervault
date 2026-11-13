import { env } from './config/env.js'; // Valida las variables de entorno antes de arrancar
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { apiLimiter } from './middlewares/rateLimiters.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { router } from './routes/index.js';

const app = express();

// IP real del cliente cuando la API está detrás de un proxy (nginx, balanceador)
app.set('trust proxy', env.trustProxy);
app.disable('x-powered-by');

// 1. SEGURIDAD PREVENTIVA: cabeceras HTTP contra XSS, clickjacking y sniffing
app.use(helmet());

// 2. CORS restringido al frontend (va antes del rate limit para que el 429 llegue al navegador)
app.use(cors({
  origin: env.frontendUrl,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// 3. MITIGACIÓN DE FUERZA BRUTA / DoS: 100 peticiones por IP cada 15 minutos
app.use('/api/', apiLimiter);

// 4. Cuerpo JSON con tamaño máximo para evitar abusos
app.use(express.json({ limit: '10kb' }));

// 5. Rutas de la API
app.use('/api', router);

// 6. Errores
app.use(notFound);
app.use(errorHandler);

app.listen(env.port, () => {
  console.log(`[CipherVault] API protegida escuchando en http://localhost:${env.port}`);
});
