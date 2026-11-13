"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { Shield } from "lucide-react";
import { API_URL } from "@/lib/api";
import { getPasswordErrors } from "@/lib/password";
import MfaForm from "@/components/MfaForm";

export default function LoginScreen() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [challenge, setChallenge] = useState<{ challengeId: string; sentTo: string } | null>(null);

  const passwordErrors = mode === "register" && password ? getPasswordErrors(password) : [];

  // Paso 1: la API valida la contraseña (bcrypt) y manda el código por correo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const path = mode === "register" ? "/api/auth/register" : "/api/auth/login";
      const body = mode === "register" ? { name, email, password } : { email, password };
      const res = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.challengeId) {
        throw new Error(data.error ?? "No se pudo iniciar sesión");
      }
      setPassword("");
      setChallenge({ challengeId: data.challengeId, sentTo: data.sentTo });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado");
    } finally {
      setLoading(false);
    }
  };

  // Paso 2: escribir el código
  if (challenge) {
    return <MfaForm challengeId={challenge.challengeId} sentTo={challenge.sentTo} onCancel={() => setChallenge(null)} />;
  }

  const inputClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors";

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
        <Shield className="w-16 h-16 text-orange-500 mx-auto mb-6" />
        <h1 className="text-2xl font-bold text-white mb-2">CipherVault</h1>
        <p className="text-slate-400 mb-8 text-sm">Acceso Restringido. Identifícate para entrar a la bóveda corporativa.</p>

        <button
          onClick={() => signIn("google")}
          className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors cursor-pointer"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continuar con Google
        </button>

        <div className="flex items-center gap-3 my-6 text-slate-600 text-xs">
          <div className="h-px bg-slate-800 flex-1" /> o con tu correo <div className="h-px bg-slate-800 flex-1" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-left">
          {mode === "register" && (
            <input className={inputClass} placeholder="Nombre" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
          )}
          <input className={inputClass} type="email" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          <input
            className={inputClass}
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === "register" ? "new-password" : "current-password"}
          />
          {passwordErrors.length > 0 && (
            <p className="text-xs text-red-400">Te falta: {passwordErrors.join(", ")}</p>
          )}
          {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}
          <button
            type="submit"
            disabled={loading || passwordErrors.length > 0}
            className="w-full bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? "Verificando..." : mode === "login" ? "Iniciar sesión" : "Crear cuenta"}
          </button>
        </form>

        <button
          onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(null); }}
          className="text-sm text-slate-400 hover:text-orange-400 mt-4 cursor-pointer"
        >
          {mode === "login" ? "¿No tienes cuenta? Regístrate" : "¿Ya tienes cuenta? Inicia sesión"}
        </button>
      </div>
    </div>
  );
}
