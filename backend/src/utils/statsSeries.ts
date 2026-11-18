const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export interface SeriesPoint {
  t: string; // fin del intervalo (ISO)
  v: number;
}

/** Cuenta eventos en `buckets` intervalos de `stepMs` que terminan en `now`. */
export function countByBucket(dates: Date[], now: Date, buckets: number, stepMs: number): SeriesPoint[] {
  const start = now.getTime() - buckets * stepMs;
  const counts = new Array<number>(buckets).fill(0);
  for (const d of dates) {
    const i = Math.ceil((d.getTime() - start) / stepMs) - 1; // intervalos (inicio, fin]
    if (i >= 0 && i < buckets) counts[i]++;
  }
  return counts.map((v, i) => ({ t: new Date(start + (i + 1) * stepMs).toISOString(), v }));
}

interface SecretDates {
  createdAt: Date;
  deletedAt: Date | null;
  passwordChangedAt: Date;
}

/**
 * Para cada uno de los últimos `days` días: cuántos secretos estaban activos al cierre del día
 * y cuántos de ellos ya superaban `rotationDays` sin rotar.
 * shortcut: solo se guarda la última rotación, así que antes de ella el secreto cuenta como "no en riesgo";
 * si se necesita exactitud histórica, leer las fechas de ROTATE_SECRET en la auditoría.
 */
export function secretDailySeries(secrets: SecretDates[], now: Date, days: number, rotationDays: number) {
  const protectedSeries: SeriesPoint[] = [];
  const atRiskSeries: SeriesPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const end = now.getTime() - i * DAY;
    const limit = end - rotationDays * DAY;
    let active = 0;
    let risk = 0;
    for (const s of secrets) {
      if (s.createdAt.getTime() > end || (s.deletedAt && s.deletedAt.getTime() <= end)) continue;
      active++;
      if (s.passwordChangedAt.getTime() < limit) risk++;
    }
    const t = new Date(end).toISOString();
    protectedSeries.push({ t, v: active });
    atRiskSeries.push({ t, v: risk });
  }
  return { protectedSeries, atRiskSeries };
}

export const STEP = { HOUR, DAY };
