import 'dotenv/config'; // <--- Esto carga tu .env automáticamente
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createSecret, getSecrets } from './controllers/secretController.js';

const app = express();
const PORT = process.env.PORT || 3001;


app.use(helmet());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100, 
  message: { error: 'Demasiadas peticiones desde esta IP. Por seguridad, intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});


app.use('/api/', apiLimiter);


app.use(cors({ origin: 'http://localhost:3000' })); 
app.use(express.json()); 


app.post('/api/secrets', createSecret);
app.get('/api/secrets', getSecrets);


app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Servidor CipherVault seguro y operando bajo AES-256' });
});


app.listen(PORT, () => {
  console.log(`[CipherVault] Servidor backend protegido inicializado en http://localhost:${PORT}`);
});