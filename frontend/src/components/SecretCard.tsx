"use client";
import { Copy, Server, AlertCircle } from 'lucide-react';
import { useState } from 'react';

interface SecretCardProps {
  title: string;
  environment: string;
  url: string;
  isExpired?: boolean;
}

export default function SecretCard({ title, environment, url, isExpired }: SecretCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    // Aquí después conectaremos tu API (el backend) para desencriptar la contraseña real
    navigator.clipboard.writeText("contraseña_desencriptada_aqui");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl hover:border-orange-500/50 transition-colors">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-white font-semibold text-lg flex items-center gap-2">
            <Server className="w-5 h-5 text-orange-500" />
            {title}
          </h3>
          <p className="text-slate-400 text-sm mt-1">{url}</p>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full font-medium ${
          environment === 'Producción' ? 'bg-orange-500/10 text-orange-500' : 'bg-blue-500/10 text-blue-500'
        }`}>
          {environment}
        </span>
      </div>

      {isExpired && (
        <div className="flex items-center gap-2 text-red-400 bg-red-400/10 p-2 rounded-lg text-sm mb-4">
          <AlertCircle className="w-4 h-4" />
          <span>Requiere rotación inmediata (&gt;90 días)</span>
        </div>
      )}

      <div className="flex items-center justify-between bg-slate-950 p-3 rounded-lg border border-slate-800">
        <span className="text-slate-500 tracking-widest">••••••••••••••••</span>
        <button 
          onClick={handleCopy}
          className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm bg-slate-800 px-3 py-1.5 rounded-md hover:bg-slate-700"
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}