"use client";
import { useState } from "react";
import { AlertTriangle, ArrowLeft, Eye, EyeOff, Lock, RefreshCw, Shield } from "lucide-react";
import { generateSecurePassword, getPasswordErrors } from "@/lib/password";
import type { VaultSecret } from "@/lib/api";

export interface SecretFormValues {
  title: string;
  environment: VaultSecret["environment"];
  url: string;
  password: string;
}

interface Props {
  /** Si se pasa un secreto, el modal sirve para ROTAR su contraseña. */
  rotating?: VaultSecret | null;
  onClose: () => void;
  onSubmit: (values: SecretFormValues) => Promise<void>;
}

export default function SecretFormModal({ rotating, onClose, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [environment, setEnvironment] = useState<VaultSecret["environment"]>("PRODUCCION");
  const [url, setUrl] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordErrors = password ? getPasswordErrors(password) : [];
  const isRotation = Boolean(rotating);
  const canSave = !saving && password.length > 0 && passwordErrors.length === 0 && (isRotation || title.trim().length > 0);

  const handleGenerate = () => {
    setPassword(generateSecurePassword());
    setShowPassword(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), environment, url: url.trim(), password });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors";

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <form
        autoComplete="off"
        onSubmit={handleSubmit}
        className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        <div className="p-6 border-b border-slate-800 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-800/50 hover:bg-slate-800 p-2 rounded-lg"
            title="Regresar"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-1">
            <Lock className="w-5 h-5 text-orange-500" />
            {isRotation ? `Rotar: ${rotating!.title}` : "Registrar Credencial"}
          </h2>
        </div>

        <div className="p-6 space-y-5">
          {!isRotation && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre del Servicio / Sistema</label>
                <input
                  type="text"
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  className={inputClass}
                  placeholder="Ej. Servidor Linux Producción"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">URL (opcional)</label>
                <input
                  type="url"
                  value={url}
                  maxLength={2048}
                  onChange={(e) => setUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://panel.miempresa.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Entorno</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value as VaultSecret["environment"])}
                  className={`${inputClass} appearance-none`}
                >
                  <option value="PRODUCCION">Producción</option>
                  <option value="DESARROLLO">Desarrollo</option>
                  <option value="PERSONAL">Personal</option>
                </select>
              </div>
            </>
          )}

          <div>
            <div className="flex justify-between items-end mb-1.5">
              <label className="block text-sm font-medium text-slate-400">
                {isRotation ? "Nueva contraseña" : "Contraseña a Proteger"}
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-xs text-orange-500 hover:text-orange-400 font-medium flex items-center gap-1 cursor-pointer transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Generar segura
              </button>
            </div>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                data-lpignore="true"
                className={`${inputClass} pr-12 ${passwordErrors.length > 0 ? "border-red-500/50" : ""}`}
                placeholder="••••••••••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer p-1"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {passwordErrors.length > 0 && (
              <div className="mt-2 text-xs text-red-400 flex flex-col gap-1">
                <span className="font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Para ser segura, te falta incluir:
                </span>
                <ul className="list-disc list-inside ml-1">
                  {passwordErrors.map((err) => (
                    <li key={err}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg">{error}</p>}

          <button
            type="submit"
            disabled={!canSave}
            className={`w-full font-semibold py-3.5 rounded-lg mt-2 transition-colors flex justify-center items-center gap-2 ${
              canSave ? "bg-orange-500 hover:bg-orange-600 text-white cursor-pointer" : "bg-slate-800 text-slate-500 cursor-not-allowed"
            }`}
          >
            <Shield className="w-5 h-5" />
            {saving ? "Cifrando..." : isRotation ? "Rotar y cifrar con AES-256" : "Cifrar con AES-256 y Guardar"}
          </button>
        </div>
      </form>
    </div>
  );
}
