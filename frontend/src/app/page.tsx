"use client";
import { useCallback, useEffect, useState } from 'react';
import { Shield, AlertTriangle, Lock, Activity, Plus, LogOut, X, ArrowLeft, Eye, EyeOff, RefreshCw } from 'lucide-react';
import SecretCard from '@/components/SecretCard';
import { useSession, signIn, signOut } from 'next-auth/react';

interface VaultSecret {
  id: string;
  title: string;
  environment: string;
  password: string;
  url?: string | null;
  createdAt: string;
}

export default function Dashboard() {
  const { data: session, status } = useSession();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Estados para controlar los inputs y evitar el autocompletado del navegador
  const [serviceName, setServiceName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<string[]>([]);
  const [environment, setEnvironment] = useState('PRODUCCION');
  const [isSaving, setIsSaving] = useState(false);

  const [secretos, setSecretos] = useState<VaultSecret[]>([]);

  const fetchSecrets = useCallback(async () => {
    const userId = session?.user?.email;
    if (!userId) return;

    const res = await fetch(`http://localhost:3001/api/secrets?userId=${encodeURIComponent(userId)}`);
    const data = await res.json() as { secrets?: VaultSecret[]; error?: string };

    if (!res.ok) {
      throw new Error(data.error || 'No se pudieron cargar las credenciales');
    }
    if (!Array.isArray(data.secrets)) {
      throw new Error('El servidor devolvió una lista de credenciales inválida');
    }

    setSecretos(data.secrets);
  }, [session?.user?.email]);

  useEffect(() => {
    if (!session?.user?.email) return;

    fetchSecrets().catch((error: unknown) => {
      console.error('Error al cargar las credenciales:', error);
    });
  }, [fetchSecrets, session?.user?.email]);

  const handleSaveSecret = async () => {
    console.log("¡Botón presionado! Intentando enviar:", {
      title: serviceName,
      environment,
      passwordLength: password.length,
      user: session?.user?.email
    });

    setIsSaving(true);
    try {
      const res = await fetch('http://localhost:3001/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: serviceName,
          environment: environment.toUpperCase(),
          password,
          userId: session?.user?.email
        })
      });

      if (res.ok) {
        alert('🔒 ¡Credencial cifrada con AES-256 y guardada en tu bóveda!');
        setIsModalOpen(false);
        try {
          await fetchSecrets();
        } catch (error) {
          console.error('Error al actualizar la lista de credenciales:', error);
          alert('La credencial se guardó, pero no se pudo actualizar la lista.');
        }
      } else {
        const errorData = await res.json() as { error?: string };
        console.error("Error del backend:", errorData);
        alert('Error: ' + (errorData.error || 'No se pudo guardar la credencial'));
      }
    } catch (error) {
      console.error("Error del frontend:", error);
      alert('Error de conexión con el servidor backend.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (!value) {
      setPasswordErrors([]);
      return;
    }
    const errors = [];
    if (value.length < 12) errors.push("12 caracteres mínimo");
    if (!/[A-Z]/.test(value)) errors.push("1 mayúscula");
    if (!/[a-z]/.test(value)) errors.push("1 minúscula");
    if (!/[0-9]/.test(value)) errors.push("1 número");
    if (!/[^A-Za-z0-9]/.test(value)) errors.push("1 carácter especial (!@#$%)");
    
    setPasswordErrors(errors);
  };

  const generateSecurePassword = () => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+~|}{[]:;?><,./-=";
    let newPass = "";
    for (let i = 0; i < 16; i++) {
      newPass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    newPass = newPass.slice(0, 12) + "A" + "a" + "1" + "!";
    newPass = newPass.split('').sort(() => 0.5 - Math.random()).join('');
    
    handlePasswordChange(newPass);
    setShowPassword(true);
  };

  // Función para resetear el formulario al abrir el modal
  const openNewSecretModal = () => {
    setServiceName('');
    setPassword('');
    setPasswordErrors([]);
    setShowPassword(false);
    setIsModalOpen(true);
  };

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Shield className="w-16 h-16 text-orange-500 animate-pulse mb-4" />
        <p className="text-slate-400 font-mono tracking-widest text-sm">VERIFICANDO IDENTIDAD...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
          <Shield className="w-16 h-16 text-orange-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-white mb-2">CipherVault</h1>
          <p className="text-slate-400 mb-8 text-sm">Acceso Restringido. Identifícate para entrar a la bóveda corporativa.</p>
          <button
            onClick={() => signIn('google')}
            className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-3 px-4 rounded-lg flex items-center justify-center gap-3 transition-colors cursor-pointer"
          >
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

  return (
    <main className="min-h-screen bg-slate-950 p-8 font-sans selection:bg-orange-500/30 relative">
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
          <button 
            onClick={openNewSecretModal}
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

      <section className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <StatCard icon={<Lock />} title="Total Protegidas" value="0" color="text-emerald-500" />
        <StatCard icon={<AlertTriangle />} title="Credenciales en Riesgo" value="0" color="text-red-500" />
        <StatCard icon={<Shield />} title="Intentos Bloqueados" value="0" color="text-orange-500" />
        <StatCard icon={<Activity />} title="Accesos 24h" value="0" color="text-blue-500" />
      </section>

      <section>
        <h2 className="text-xl font-semibold text-white mb-6">Tus Secretos Activos</h2>
        {secretos.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {secretos.map((secreto) => (
              <SecretCard
                key={secreto.id}
                title={secreto.title}
                environment={secreto.environment}
                url={secreto.url ?? ''}
                password={secreto.password}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-12 border-2 border-dashed border-slate-800 rounded-2xl bg-slate-900/30">
            <Lock className="w-12 h-12 text-slate-700 mb-4" />
            <h3 className="text-lg font-medium text-slate-300">Bóveda vacía</h3>
            <p className="text-slate-500 mt-2 text-center max-w-md">
              No tienes ninguna credencial guardada. Haz clic en "Nuevo Secreto" para registrar tu primera contraseña cifrada.
            </p>
          </div>
        )}
      </section>

      {/* Modal / Ventana Emergente */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          {/* form en lugar de div para controlar el autocompletado general */}
          <form 
            autoComplete="off"
            onSubmit={(e) => e.preventDefault()} 
            className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200"
          >
            
            <div className="p-6 border-b border-slate-800 flex items-center gap-3">
              <button 
                type="button"
                onClick={() => setIsModalOpen(false)} 
                className="text-slate-400 hover:text-white transition-colors cursor-pointer bg-slate-800/50 hover:bg-slate-800 p-2 rounded-lg"
                title="Regresar"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-xl font-bold text-white flex items-center gap-2 flex-1">
                <Lock className="w-5 h-5 text-orange-500" />
                Registrar Credencial
              </h2>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Nombre del Servicio / Sistema</label>
                <input 
                  type="text" 
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  autoComplete="off"
                  data-lpignore="true"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors" 
                  placeholder="Ej. Servidor Linux Producción" 
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Entorno</label>
                <select
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors appearance-none"
                >
                  <option value="produccion">Producción</option>
                  <option value="desarrollo">Desarrollo</option>
                  <option value="personal">Personal</option>
                </select>
              </div>

              <div>
                <div className="flex justify-between items-end mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Contraseña Maestra a Proteger</label>
                  <button 
                    type="button"
                    onClick={generateSecurePassword}
                    className="text-xs text-orange-500 hover:text-orange-400 font-medium flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-3.5 h-3.5" /> Generar segura
                  </button>
                </div>
                
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    autoComplete="new-password"
                    data-lpignore="true"
                    className={`w-full bg-slate-950 border ${passwordErrors.length > 0 && password.length > 0 ? 'border-red-500/50' : 'border-slate-800'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500 transition-colors pr-12`}
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

                {passwordErrors.length > 0 && password.length > 0 && (
                  <div className="mt-2 text-xs text-red-400 flex flex-col gap-1">
                    <span className="font-semibold flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> 
                      Para ser segura, te falta incluir:
                    </span>
                    <ul className="list-disc list-inside ml-1">
                      {passwordErrors.map((error, index) => (
                        <li key={index}>{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <button 
                type="button"
                onClick={handleSaveSecret}
                disabled={isSaving || (passwordErrors.length > 0 && password.length > 0) || password.length === 0 || serviceName.length === 0}
                className={`w-full font-semibold py-3.5 rounded-lg mt-2 transition-colors flex justify-center items-center gap-2 cursor-pointer ${
                  isSaving || (passwordErrors.length > 0 && password.length > 0) || password.length === 0 || serviceName.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                    : 'bg-orange-500 hover:bg-orange-600 text-white'
                }`}
              >
                <Shield className="w-5 h-5" />
                {isSaving ? 'Cifrando...' : 'Cifrar con AES-256 y Guardar'}
              </button>
            </div>

          </form>
        </div>
      )}
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