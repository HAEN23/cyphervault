# CipherVault

Bóveda web de credenciales con cifrado AES-256, autenticación JWT con verificación en dos pasos por correo, control de acceso por roles (RBAC) y auditoría de accesos.

- `frontend/`: Next.js + React + Tailwind CSS (login con Google o con correo y contraseña).
- `backend/`: API RESTful en Express + TypeScript + Prisma.
- `docker-compose.yml`: PostgreSQL 15 y la API en contenedores.
- `pentest/`: script para Kali Linux y colección de Postman.

## Puesta en marcha con Docker (base de datos + API)

```bash
cp .env.example .env              # llenar los valores (ver comentarios dentro)
docker compose up -d --build      # aplica las migraciones al arrancar
```

## Desarrollo local

```bash
# Base de datos
docker compose up -d db

# API
cp backend/.env.example backend/.env    # llenar DATABASE_URL, ENCRYPTION_KEY, JWT_SECRET, GOOGLE_CLIENT_ID
npm install --prefix backend
npx --prefix backend prisma migrate dev
npm run dev --prefix backend            # http://localhost:3001

# Frontend
cp frontend/.env.example frontend/.env.local   # llenar NEXTAUTH_SECRET y credenciales de Google
npm install --prefix frontend
npm run dev --prefix frontend           # http://localhost:3000
```

Cada inicio de sesión pide un código de 6 dígitos enviado por correo. Configura `SMTP_USER` y `SMTP_PASS` (contraseña de aplicación de Gmail) en `backend/.env`; si están vacíos, en desarrollo el código aparece en la consola del backend.

Los correos listados en `ADMIN_EMAILS` se crean con rol ADMIN y pueden ver la auditoría de toda la plataforma.

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/google` | Público (5 intentos / 15 min). Mandan el código por correo, no dan token |
| POST | `/api/auth/mfa/verify`, `/api/auth/mfa/resend` | Público (10 intentos / 15 min). Con el código correcto entrega el JWT |
| GET | `/api/auth/me` | JWT |
| GET, POST | `/api/secrets` | JWT |
| POST | `/api/secrets/:id/reveal` | JWT, solo el dueño |
| PUT | `/api/secrets/:id/rotate` | JWT, solo el dueño |
| DELETE | `/api/secrets/:id` | JWT, solo el dueño |
| GET | `/api/audit`, `/api/stats` | JWT |
| GET | `/api/admin/audit`, `/api/admin/users` | ADMIN |
| PATCH | `/api/admin/users/:id` | ADMIN |

## Pruebas de seguridad

Ver [pentest/README.md](pentest/README.md).
