"use client";
import { useCallback, useEffect, useState } from "react";
import { Shield, AlertTriangle, Lock, Activity, Plus, LogOut, Globe, User } from "lucide-react";
import { useSession, signOut } from "next-auth/react";
import SecretCard from "@/components/SecretCard";
import SecretFormModal, { type SecretFormValues } from "@/components/SecretFormModal";
import LoginScreen from "@/components/LoginScreen";
import MfaForm from "@/components/MfaForm";
import AuditTable from "@/components/AuditTable";
import { apiFetch, loadDashboard, type AuditLogEntry, type DashboardData, type Stats, type VaultSecret } from "@/lib/api";

export default function Dashboard() {
  const { data: session, status } = useSession();
  const token = session?.accessToken;
  const isAdmin = session?.user?.role === "ADMIN";

  const [secretos, setSecretos] = useState<VaultSecret[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [globalAudit, setGlobalAudit] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; rotating: VaultSecret | null }>({ open: false, rotating: null });
  const [error, setError] = useState<string | null>(null);

  // Si el JWT de la API venció, se cierra la sesión
  useEffect(() => {
    if (session?.error === "TokenExpired") signOut({ callbackUrl: "/" });
  }, [session?.error]);

  const applyData = useCallback((data: DashboardData) => {
    setSecretos(data.secrets);
    setAuditLogs(data.logs);
    setStats(data.stats);
    setError(null);
  }, []);

  const showError = (err: unknown) => setError(err instanceof Error ? err.message : "No se pudo cargar la bóveda");

  /** Vuelve a pedir los datos a la API (después de crear, revelar, rotar o borrar). */
  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      applyData(await loadDashboard(token, isAdmin && globalAudit));
    } catch (err) {
      showError(err);
    }
  }, [token, isAdmin, globalAudit, applyData]);

  // Carga inicial y cada vez que cambia la sesión o la vista de auditoría
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    loadDashboard(token, isAdmin && globalAudit)
      .then((data) => { if (!cancelled) applyData(data); })
      .catch((err) => { if (!cancelled) showError(err); });
    return () => { cancelled = true; };
  }, [token, isAdmin, globalAudit, applyData]);

  const revealSecret = useCallback(
    async (id: string) => {
      const { password } = await apiFetch<{ password: string }>(`/api/secrets/${id}/reveal`, token, { method: "POST" });
      refresh(); // la lectura queda en la bitácora: se actualiza la tabla
      return password;
    },
    [token, refresh],
  );

  const handleSubmit = async (values: SecretFormValues) => {
    if (modal.rotating) {
      await apiFetch(`/api/secrets/${modal.rotating.id}/rotate`, token, {
        method: "PUT",
        body: JSON.stringify({ password: values.password }),
      });
    } else {
      await apiFetch("/api/secrets", token, {
        method: "POST",
        body: JSON.stringify({
          title: values.title,
          environment: values.environment,
          url: values.url || null,
          password: values.password,
        }),
      });
    }
    setModal({ open: false, rotating: null });
    await refresh();
  };

  const handleDelete = async (secret: VaultSecret) => {
    if (!window.confirm(`¿Eliminar "${secret.title}"? Esta acción no se puede deshacer.`)) return;
    try {
      await apiFetch(`/api/secrets/${secret.id}`, token, { method: "DELETE" });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar");
    }
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-orange-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-mono tracking-widest text-sm">VERIFICANDO IDENTIDAD...</p>
      </div>
    );
  }

  // Entró con Google pero falta el código que llegó por correo
  if (session && !token && session.mfaChallengeId) {
    return (
      <MfaForm
        challengeId={session.mfaChallengeId}
        sentTo={session.mfaSentTo ?? "tu correo"}
        onCancel={() => signOut({ callbackUrl: "/" })}
      />
    );
  }

  if (!session || !token) {
    return <LoginScreen />;
  }

  return (
    <main className="min-h-screen bg-slate-950 p-4 md:p-8 font-sans selection:bg-orange-500/30 relative">
      <header className="flex flex-wrap gap-4 justify-between items-center mb-10 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-orange-500" />
            CipherVault
          </h1>
          <p className="text-slate-400 mt-2 text-sm flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sesión activa: <span className="text-orange-400 font-medium">{session.user?.name}</span> ({session.user?.email})
            <span className={`text-xs px-2 py-0.5 rounded-full ${isAdmin ? "bg-purple-500/10 text-purple-400" : "bg-slate-800 text-slate-400"}`}>
              {session.user?.role}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setModal({ open: true, rotating: null })}
            className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Plus className="w-5 h-5" />
            Nuevo Secreto
          </button>
          <button
            onClick={() => signOut()}
            title="Cerrar sesión"
            className="bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 p-2.5 rounded-lg transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {error && <p className="mb-6 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}

      {/* Indicadores calculados por la API (/api/stats) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<Lock />} title="Total Protegidas" value={stats?.totalProtected} color="text-emerald-500" />
        <StatCard icon={<AlertTriangle />} title="Credenciales en Riesgo" value={stats?.atRisk} color="text-red-500" hint="Más de 90 días sin rotar" />
        <StatCard icon={<Shield />} title="Intentos Bloqueados" value={stats?.blockedAttempts} color="text-orange-500" hint={stats?.scope === "global" ? "Últimas 24 h · toda la plataforma" : "Últimas 24 h"} />
        <StatCard icon={<Activity />} title="Accesos 24h" value={stats?.access24h} color="text-blue-500" hint={stats?.scope === "global" ? "Toda la plataforma" : undefined} />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-6">Tus Secretos Activos</h2>
        {secretos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {secretos.map((secreto) => (
              <SecretCard
                key={secreto.id}
                secret={secreto}
                onReveal={revealSecret}
                onRotate={(s) => setModal({ open: true, rotating: s })}
                onDelete={handleDelete}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <Lock className="w-12 h-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">Bóveda vacía</h3>
            <p className="text-slate-500 mt-2 text-center max-w-md">
              No tienes ninguna credencial guardada. Haz clic en &quot;Nuevo Secreto&quot; para registrar tu primera contraseña cifrada.
            </p>
          </div>
        )}
      </section>

      <div className="mt-12">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h2 className="text-xl font-bold text-white">Registro de Auditoría (Logs)</h2>
          {isAdmin && (
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 text-sm">
              <button
                onClick={() => setGlobalAudit(false)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${!globalAudit ? "bg-slate-800 text-white" : "text-slate-400"}`}
              >
                <User className="w-4 h-4" /> Mis eventos
              </button>
              <button
                onClick={() => setGlobalAudit(true)}
                className={`px-3 py-1.5 rounded-md flex items-center gap-1.5 cursor-pointer ${globalAudit ? "bg-slate-800 text-white" : "text-slate-400"}`}
              >
                <Globe className="w-4 h-4" /> Toda la plataforma
              </button>
            </div>
          )}
        </div>
        <AuditTable logs={auditLogs} showUser={isAdmin && globalAudit} />
      </div>

      {modal.open && (
        <SecretFormModal
          rotating={modal.rotating}
          onClose={() => setModal({ open: false, rotating: null })}
          onSubmit={handleSubmit}
        />
      )}
    </main>
  );
}

function StatCard({ icon, title, value, color, hint }: { icon: React.ReactNode; title: string; value?: number; color: string; hint?: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-slate-950 border border-slate-800 ${color}`}>{icon}</div>
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value ?? "—"}</p>
        {hint && <p className="text-xs text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}
