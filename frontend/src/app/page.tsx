"use client";
import { Shield, AlertTriangle, Lock, Activity, Plus, LogOut } from 'lucide-react';
import SecretCard from '@/components/SecretCard';
import { useSession, signIn, signOut } from 'next-auth/react';

export default function Dashboard() {
  // Extraemos los datos de la sesión actual
  const { data: session, status } = useSession();

  // 1. Pantalla de carga mientras verifica los tokens criptográficos
  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-orange-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-mono tracking-widest text-sm">VERIFICANDO IDENTIDAD...</p>
      </div>
    );
  }

  // 2. Pantalla de Login si el usuario no está autenticado
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <Shield className="w-16 h-16 text-orange-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">CipherVault</h1>
          <p className="text-slate-400 mb-8 text-sm">Acceso Restringido. Identifícate para entrar a la bóveda corporativa.</p>
          <button
            onClick={() => signIn('google')}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors"
          >
            {/* Ícono de Google */}
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              <path fill="none" d="M1 1h22v22H1z" />
            </svg>
            Continuar con Google
          </button>
        </div>
      </div>
    );
  }

  // 3. Dashboard Principal (Solo visible si estás autenticado)
  return (
    <main className="min-h-screen bg-slate-950 p-8 font-sans selection:bg-orange-500/30">
      <header className="flex justify-between items-center mb-10 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Shield className="w-8 h-8 text-orange-500" />
            CipherVault
          </h1>
          <p className="text-slate-400 mt-2 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Sesión activa: <span className="text-orange-400 font-medium">{session.user?.name}</span> ({session.user?.email})
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button className="bg-orange-500 hover:bg-orange-600 text-white px-5 py-2.5 rounded-lg font-medium flex items-center gap-2 transition-colors">
            <Plus className="w-5 h-5" />
            Nuevo Secreto
          </button>
          <button 
            onClick={() => signOut()}
            title="Cerrar sesión"
            className="bg-slate-900 border border-slate-800 hover:border-red-500/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 p-2.5 rounded-lg transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<Lock />} title="Total Protegidas" value="142" color="text-emerald-500" />
        <StatCard icon={<AlertTriangle />} title="Credenciales en Riesgo" value="3" color="text-red-500" />
        <StatCard icon={<Shield />} title="Intentos Bloqueados" value="12" color="text-orange-500" />
        <StatCard icon={<Activity />} title="Accesos 24h" value="45" color="text-blue-500" />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-6">Tus Secretos Activos</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <SecretCard title="Servidor AWS EC2 Principal" environment="Producción" url="console.aws.amazon.com" />
          <SecretCard title="Base de Datos RDS" environment="Producción" url="postgres-prod.cluster-xyz.us-east-1.rds.amazonaws.com" isExpired={true} />
          <SecretCard title="API Stripe Pagos" environment="Desarrollo" url="dashboard.stripe.com" />
        </div>
      </section>
    </main>
  );
}

function StatCard({ icon, title, value, color }: { icon: React.ReactNode, title: string, value: string, color: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-slate-950 border border-slate-800 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
    </div>
  );
}