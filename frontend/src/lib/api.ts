import { signOut } from "next-auth/react";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: string[]) {
    super(message);
  }
}

/** fetch hacia la API que siempre adjunta el JWT en la cabecera Authorization. */
export async function apiFetch<T>(path: string, token: string | undefined, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
    cache: "no-store",
  });

  if (res.status === 401) {
    // Token vencido o inválido: se cierra la sesión del frontend
    await signOut({ callbackUrl: "/" });
    throw new ApiError(401, "Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  if (res.status === 204) return undefined as T;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Error de la API", data.details);
  }
  return data as T;
}

export interface VaultSecret {
  id: string;
  title: string;
  environment: "PRODUCCION" | "DESARROLLO" | "PERSONAL";
  url: string | null;
  createdAt: string;
  passwordChangedAt: string;
  daysSinceChange: number;
  isExpired: boolean;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  ipAddress: string;
  userAgent: string | null;
  createdAt: string;
  user: { email: string; name: string } | null;
  secret: { id: string; title: string } | null;
}

export interface Stats {
  totalProtected: number;
  atRisk: number;
  blockedAttempts: number;
  access24h: number;
  scope: "personal" | "global";
}

export interface DashboardData {
  secrets: VaultSecret[];
  logs: AuditLogEntry[];
  stats: Stats;
}

/** Trae en paralelo todo lo que muestra el panel. */
export async function loadDashboard(token: string, globalAudit: boolean): Promise<DashboardData> {
  const auditPath = globalAudit ? "/api/admin/audit?limit=100" : "/api/audit?limit=50";
  const [s, a, stats] = await Promise.all([
    apiFetch<{ secrets: VaultSecret[] }>("/api/secrets", token),
    apiFetch<{ logs: AuditLogEntry[] }>(auditPath, token),
    apiFetch<Stats>("/api/stats", token),
  ]);
  return { secrets: s.secrets, logs: a.logs, stats };
}
