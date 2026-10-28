# CipherVault

Monorepo con una aplicación frontend en Next.js y un backend en Node.js.

## Frontend

```powershell
npm install --prefix frontend
npm run dev --prefix frontend
```

La aplicación estará disponible en <http://localhost:3000>.

## Backend

```powershell
npm install --prefix backend
npm run dev --prefix backend
```

El backend usa el puerto `3001` de forma predeterminada. Configura los valores
locales en `backend/.env`; usa `backend/.env.example` como referencia.
