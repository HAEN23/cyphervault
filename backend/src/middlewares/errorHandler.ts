import type { Request, Response, NextFunction } from 'express';

/** Respuesta genérica: nunca se devuelven trazas ni detalles internos al cliente. */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'JSON mal formado' });
    return;
  }
  if (typeof err === 'object' && err !== null && 'type' in err && (err as { type: string }).type === 'entity.too.large') {
    res.status(413).json({ error: 'Petición demasiado grande' });
    return;
  }
  console.error('[CipherVault Error]:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}

export function notFound(_req: Request, res: Response) {
  res.status(404).json({ error: 'Ruta no encontrada' });
}
