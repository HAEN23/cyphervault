"use client";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { MailCheck } from "lucide-react";
import { API_URL } from "@/lib/api";

interface Props {
  challengeId: string;
  sentTo: string;
  /** Vuelve a la pantalla de inicio de sesión (cancela el reto). */
  onCancel: () => void;
}

/** Paso 2: el usuario escribe el código de 6 dígitos que le llegó por correo. */
export default function MfaForm({ challengeId, sentTo, onCancel }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setLoading(true);
    setError(null);
    const result = await signIn("mfa", { challengeId, code, redirect: false });
    setLoading(false);
    if (!result || result.error) {
      setError(result?.error ?? "Código incorrecto");
      setCode("");
    }
  };

  const handleResend = async () => {
    setError(null);
    setInfo(null);
    const res = await fetch(`${API_URL}/api/auth/mfa/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ challengeId }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setInfo("Te enviamos un código nuevo.");
    else setError(data.error ?? "No se pudo reenviar el código");
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        autoComplete="off"
        className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl"
      >
        <MailCheck className="w-14 h-14 text-orange-500 mx-auto mb-5" />
        <h1 className="text-2xl font-bold text-white mb-2">Verificación en dos pasos</h1>
        <p className="text-slate-400 mb-6 text-sm">
          Enviamos un código de 6 dígitos a <span className="text-orange-400">{sentTo}</span>. Revisa tu bandeja de entrada y spam.
        </p>

        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          placeholder="000000"
          aria-label="Código de verificación"
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white text-center text-3xl tracking-[0.5em] font-mono focus:outline-none focus:border-orange-500"
        />

        {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg mt-4">{error}</p>}
        {info && <p className="text-sm text-emerald-400 bg-emerald-500/10 p-3 rounded-lg mt-4">{info}</p>}

        <button
          type="submit"
          disabled={loading || code.length !== 6}
          className="w-full mt-5 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-800 disabled:text-slate-500 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer"
        >
          {loading ? "Verificando..." : "Verificar"}
        </button>

        <div className="flex justify-between mt-4 text-sm">
          <button type="button" onClick={handleResend} className="text-slate-400 hover:text-orange-400 cursor-pointer">
            Reenviar código
          </button>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-red-400 cursor-pointer">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
