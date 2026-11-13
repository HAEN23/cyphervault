"use client";
import type { AuditLogEntry } from "@/lib/api";

const DANGER = new Set(["LOGIN_FAILED", "LOGIN_LOCKED", "ACCESS_DENIED", "RATE_LIMIT_BLOCKED", "DELETE_SECRET"]);
const WARN = new Set(["READ_SECRET", "ROTATE_SECRET", "ADMIN_UPDATE_USER"]);

function badge(action: string) {
  if (DANGER.has(action)) return "bg-red-500/10 text-red-400";
  if (WARN.has(action)) return "bg-amber-500/10 text-amber-400";
  return "bg-emerald-500/10 text-emerald-400";
}

/** Resume el user-agent a "Navegador · Sistema" para la tabla. */
function shortAgent(ua: string | null): string {
  if (!ua) return "Desconocido";
  const browser = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox"
    : /Safari\//.test(ua) ? "Safari" : /curl|PostmanRuntime|python|Wget/i.test(ua) ? ua.split(" ")[0] : "Otro";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS"
    : /Mac OS/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "";
  return os ? `${browser} · ${os}` : browser;
}

export default function AuditTable({ logs, showUser }: { logs: AuditLogEntry[]; showUser: boolean }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="bg-slate-950 text-slate-400">
          <tr>
            <th className="px-6 py-4 font-medium">Acción</th>
            {showUser && <th className="px-6 py-4 font-medium">Usuario</th>}
            <th className="px-6 py-4 font-medium">Servicio Afectado</th>
            <th className="px-6 py-4 font-medium">Dirección IP</th>
            <th className="px-6 py-4 font-medium">Navegador</th>
            <th className="px-6 py-4 font-medium">Fecha y Hora</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {logs.length > 0 ? (
            logs.map((log) => (
              <tr key={log.id} className="hover:bg-slate-800/50 transition-colors">
                <td className="px-6 py-4">
                  <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${badge(log.action)}`}>{log.action}</span>
                </td>
                {showUser && <td className="px-6 py-4 text-slate-400">{log.user?.email ?? "Anónimo"}</td>}
                <td className="px-6 py-4 font-medium text-white">{log.secret?.title ?? "—"}</td>
                <td className="px-6 py-4 font-mono text-xs">{log.ipAddress}</td>
                <td className="px-6 py-4 text-xs text-slate-400" title={log.userAgent ?? ""}>{shortAgent(log.userAgent)}</td>
                <td className="px-6 py-4 text-slate-400">{new Date(log.createdAt).toLocaleString()}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={showUser ? 6 : 5} className="px-6 py-8 text-center text-slate-500">
                No hay registros de auditoría recientes.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
