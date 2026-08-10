'use client';

import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, MessageCircle } from 'lucide-react';

export default function Home() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login attempt:', { email, password, rememberMe });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-brand-950/30 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo y título */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 shadow-lg shadow-brand-500/30">
              <MessageCircle className="h-8 w-8 text-white" strokeWidth={2.5} />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">WhatsOrder</h1>
          <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">Panel de Control CSR</p>
        </div>

        {/* Tarjeta de login */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50 p-8 ring-1 ring-slate-200/50 dark:ring-slate-700/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="csr@whatsorder.com"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 pl-10 pr-3 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 transition"
                  required
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Contraseña
                </label>
                <button
                  type="button"
                  className="text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition"
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 pl-10 pr-10 py-2.5 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:bg-white dark:focus:bg-slate-800 transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand-600 focus:ring-brand-500/20 focus:ring-2"
                />
                <span className="text-sm text-slate-600 dark:text-slate-400">Recordarme</span>
              </label>
            </div>

            {/* Botón de login */}
            <button
              type="submit"
              className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-600/30 hover:bg-brand-700 hover:shadow-brand-600/40 transition-all duration-200"
            >
              Iniciar sesión
            </button>

            {/* Enlace al dashboard */}
            <div className="text-center pt-2">
              <a
                href="/dashboard"
                className="text-xs text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition"
              >
                Acceso directo al dashboard (demo)
              </a>
            </div>
          </form>

          {/* Footer */}
          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-slate-700 text-center">
            <p className="text-xs text-slate-400 dark:text-slate-500">
              ¿No tienes una cuenta?{' '}
              <button
                type="button"
                className="font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300 transition"
              >
                Contacta con soporte
              </button>
            </p>
          </div>
        </div>

        {/* Versión */}
        <p className="mt-4 text-center text-[11px] text-slate-400 dark:text-slate-500">
          v1.0.0 · Sistema de gestión de pedidos
        </p>
      </div>
    </div>
  );
}