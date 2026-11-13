"use client";
import { Copy, Server, AlertCircle, Eye, EyeOff, RotateCw, Trash2, ExternalLink } from "lucide-react";
import { useState } from "react";
import type { VaultSecret } from "@/lib/api";

const ENV_LABEL: Record<VaultSecret["environment"], string> = {
  PRODUCCION: "Producción",
  DESARROLLO: "Desarrollo",
  PERSONAL: "Personal",
};

interface SecretCardProps {
  secret: VaultSecret;
  /** Pide a la API descifrar este secreto (queda registrado como READ_SECRET). */
  onReveal: (id: string) => Promise<string>;
  onRotate: (secret: VaultSecret) => void;
  onDelete: (secret: VaultSecret) => void;
}

export default function SecretCard({ secret, onReveal, onRotate, onDelete }: SecretCardProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleCopy = async () => {
    setBusy(true);
    try {
      const password = await onReveal(secret.id);
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      // Se limpia el portapapeles a los 30 s para no dejar la contraseña expuesta
      setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), 30_000);
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async () => {
    if (visible !== null) {
      setVisible(null);
      return;
    }
    setBusy(true);
    try {
      setVisible(await onReveal(secret.id));
      // Se vuelve a ocultar sola a los 15 s
      setTimeout(() => setVisible(null), 15_000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-orange-500/50 transition-colors">
      <div className="flex justify-between items-start mb-4 gap-3">
        <div className="min-w-0">
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-500 shrink-0" />
            <span className="truncate">{secret.title}</span>
          </h3>
          {secret.url && (
            <a
              href={secret.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-orange-400 text-sm mt-1 flex items-center gap-1 truncate"
            >
              {secret.url} <ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          )}
          <p className="text-slate-500 text-xs mt-1">Último cambio hace {secret.daysSinceChange} días</p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${
            secret.environment === "PRODUCCION" ? "bg-orange-500/10 text-orange-500" : "bg-blue-500/10 text-blue-500"
          }`}
        >
          {ENV_LABEL[secret.environment]}
        </span>
      </div>

      {secret.isExpired && (
        <div className="flex items-center justify-between gap-2 text-red-400 bg-red-400/10 p-2 rounded-lg text-sm mb-4">
          <span className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Requiere rotación inmediata (&gt;90 días)
          </span>
          <button onClick={() => onRotate(secret)} className="underline cursor-pointer">
            Rotar
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 bg-slate-950 p-3 rounded-lg border border-slate-800">
        <span className="text-slate-500 tracking-widest font-mono text-sm truncate">
          {visible ?? "••••••••••••••••"}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          <IconButton title={visible ? "Ocultar" : "Mostrar"} onClick={handleToggle} disabled={busy}>
            {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </IconButton>
          <button
            onClick={handleCopy}
            disabled={busy}
            className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-700 cursor-pointer disabled:opacity-50"
          >
            <Copy className="w-4 h-4" />
            {copied ? "Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      <div className="flex justify-end gap-1 mt-3">
        <IconButton title="Rotar contraseña" onClick={() => onRotate(secret)}>
          <RotateCw className="w-4 h-4" />
        </IconButton>
        <IconButton title="Eliminar" onClick={() => onDelete(secret)} danger>
          <Trash2 className="w-4 h-4" />
        </IconButton>
      </div>
    </div>
  );
}

function IconButton({
  children, title, onClick, disabled, danger,
}: { children: React.ReactNode; title: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`p-1.5 rounded-md cursor-pointer disabled:opacity-50 transition-colors ${
        danger ? "text-slate-500 hover:text-red-400 hover:bg-red-500/10" : "text-slate-400 hover:text-white hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
