'use client';

import { useActionState } from 'react';
import { MessageCircle } from 'lucide-react';
import { login, type LoginState } from '@/app/auth/actions';

const initialState: LoginState = {};

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-500">
            <MessageCircle className="h-6 w-6 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-center">
            <h1 className="text-lg font-bold text-slate-900">WhatsOrder</h1>
            <p className="text-sm text-slate-500">Panel CSR</p>
          </div>
        </div>

        <form
          action={formAction}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card"
        >
          <h2 className="mb-1 text-base font-semibold text-slate-900">Iniciar sesión</h2>
          <p className="mb-6 text-sm text-slate-500">
            Ingresa con tu cuenta de CSR para acceder al panel.
          </p>

          <div className="mb-4">
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
              Correo electrónico
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="csr@whatsorder.demo"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div className="mb-5">
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              placeholder="••••••••"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {state?.error && (
            <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {state.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
