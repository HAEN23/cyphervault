"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch, type AdminUser } from "@/lib/api";

interface Props {
  token: string;
  /** Correo del ADMIN con sesión: su propia fila no se puede editar (la API también lo impide). */
  currentEmail: string | null;
  /** Se llama tras un cambio para refrescar la bitácora (queda ADMIN_UPDATE_USER). */
  onChanged: () => void;
}

const STATUS_BADGE: Record<AdminUser["status"], { label: string; className: string }> = {
  PENDING: { label: "Pendiente", className: "bg-amber-500/10 text-amber-400" },
  APPROVED: { label: "Activa", className: "bg-emerald-500/10 text-emerald-400" },
  REJECTED: { label: "Rechazada", className: "bg-red-500/10 text-red-400" },
};

/** Solo ADMIN: aceptar/rechazar cuentas nuevas, cambiar rol y activar/desactivar (/api/admin/users). */
export default function UserAdminTable({ token, currentEmail, onChanged }: Props) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showError = (err: unknown) => setError(err instanceof Error ? err.message : "No se pudieron cargar los usuarios");
  const fetchUsers = useCallback(
    () => apiFetch<{ users: AdminUser[] }>("/api/admin/users", token).then((d) => d.users),
    [token],
  );

  const load = async () => {
    try {
      setUsers(await fetchUsers());
      setError(null);
    } catch (err) {
      showError(err);
    }
  };

  useEffect(() => {
    let cancelled = false;
    fetchUsers()
      .then((list) => { if (!cancelled) { setUsers(list); setError(null); } })
      .catch((err) => { if (!cancelled) showError(err); });
    return () => { cancelled = true; };
  }, [fetchUsers]);

  const update = async (user: AdminUser, changes: Partial<Pick<AdminUser, "role" | "isActive" | "status">>) => {
    if (changes.status === "REJECTED" && !window.confirm(`¿Rechazar la solicitud de ${user.email}? No podrá entrar.`)) return;
    if (changes.isActive === false && !window.confirm(`¿Desactivar la cuenta de ${user.email}? No podrá iniciar sesión.`)) return;
    if (changes.role && !window.confirm(`¿Cambiar el rol de ${user.email} a ${changes.role}?`)) return;
    setBusyId(user.id);
    try {
      await apiFetch(`/api/admin/users/${user.id}`, token, { method: "PATCH", body: JSON.stringify(changes) });
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el usuario");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {error && <p className="mb-4 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-x-auto">
        <table className="w-full text-left text-sm text-slate-300">
          <thead className="bg-slate-950 text-slate-400">
            <tr>
              <th className="px-6 py-4 font-medium">Usuario</th>
              <th className="px-6 py-4 font-medium">Rol</th>
              <th className="px-6 py-4 font-medium">Estado</th>
              <th className="px-6 py-4 font-medium">Secretos</th>
              <th className="px-6 py-4 font-medium">Alta</th>
              <th className="px-6 py-4 font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50">
            {users.map((u) => {
              const isSelf = u.email === currentEmail;
              const disabled = isSelf || busyId === u.id;
              return (
                <tr key={u.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-white">{u.name}{isSelf && <span className="text-slate-500 font-normal"> (tú)</span>}</p>
                    <p className="text-xs text-slate-400">{u.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    <select
                      aria-label={`Rol de ${u.email}`}
                      value={u.role}
                      disabled={disabled}
                      onChange={(e) => update(u, { role: e.target.value as AdminUser["role"] })}
                      className="bg-slate-950 border border-slate-800 rounded-md px-2 py-1 text-white disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <option value="USER">USER</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    {u.status === "APPROVED" && !u.isActive ? (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-500/10 text-red-400">Desactivada</span>
                    ) : (
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold ${STATUS_BADGE[u.status].className}`}>
                        {STATUS_BADGE[u.status].label}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">{u._count.secrets}</td>
                  <td className="px-6 py-4 text-slate-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    {u.status !== "APPROVED" ? (
                      <div className="flex gap-2">
                        <button
                          disabled={disabled}
                          onClick={() => update(u, { status: "APPROVED" })}
                          className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        >
                          Aceptar
                        </button>
                        {u.status === "PENDING" && (
                          <button
                            disabled={disabled}
                            onClick={() => update(u, { status: "REJECTED" })}
                            className="px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            Rechazar
                          </button>
                        )}
                      </div>
                    ) : (
                    <button
                      disabled={disabled}
                      onClick={() => update(u, { isActive: !u.isActive })}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed ${
                        u.isActive ? "bg-red-500/10 text-red-400 hover:bg-red-500/20" : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      }`}
                    >
                      {u.isActive ? "Desactivar" : "Activar"}
                    </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {users.length === 0 && !error && (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Cargando usuarios...</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
