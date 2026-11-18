"use client";
import { ArrowLeft, Clock, ShieldX } from "lucide-react";

export type AccountStatus = "PENDING" | "REJECTED";

/** Se muestra cuando la cuenta todavía no fue aceptada por un ADMIN, o fue rechazada. */
export default function PendingScreen({ status, onBack }: { status: AccountStatus; onBack: () => void }) {
  const pending = status === "PENDING";
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
        {pending ? (
          <Clock className="w-16 h-16 text-amber-400 mx-auto mb-6" />
        ) : (
          <ShieldX className="w-16 h-16 text-red-400 mx-auto mb-6" />
        )}
        <h1 className="text-2xl font-bold text-white mb-3">
          {pending ? "Cuenta en espera de aprobación" : "Solicitud rechazada"}
        </h1>
        <p className="text-slate-400 text-sm mb-8" role="status">
          {pending
            ? "Tu cuenta se creó correctamente, pero un administrador de CipherVault tiene que aceptarla antes de que puedas entrar. Cuando te acepte, inicia sesión de nuevo y te enviaremos el código de verificación a tu correo."
            : "Un administrador de CipherVault rechazó tu solicitud de acceso. Si crees que es un error, comunícate con el administrador de tu organización."}
        </p>
        <button
          onClick={onBack}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" /> Volver al inicio de sesión
        </button>
      </div>
    </div>
  );
}
