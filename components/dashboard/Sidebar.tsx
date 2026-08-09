'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Users,
  ShieldCheck,
  MessageCircle,
  LogOut,
} from 'lucide-react';
import { logout } from '@/app/auth/actions';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/dashboard/pendientes', label: 'Pendientes', icon: Clock },
  { to: '/dashboard/aprobados', label: 'Aprobados', icon: CheckCircle2 },
  { to: '/dashboard/rechazados', label: 'Rechazados', icon: XCircle },
  { to: '/dashboard/logistica', label: 'Logística', icon: Truck },
  { to: '/dashboard/clientes', label: 'Clientes', icon: Users },
  { to: '/dashboard/monitoreo', label: 'Monitoreo', icon: ShieldCheck },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-slate-900/50 lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col bg-slate-950 transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-500">
            <MessageCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-base font-bold leading-none text-white">WhatsOrder</h2>
            <p className="mt-1 text-[11px] font-medium text-slate-500">Panel CSR</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto scroll-thin px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to));
            return (
              <a
                key={item.to}
                href={item.to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-brand-500/15 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`}
              >
                <item.icon
                  className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                    isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
                  }`}
                />
                <span>{item.label}</span>
                {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand-400" />}
              </a>
            );
          })}
        </nav>

        <div className="border-t border-white/5 p-4">
          <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-400">
              CA
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-100">CSR Admin</p>
              <p className="truncate text-xs text-slate-500">Supervisor</p>
            </div>
            <form action={logout}>
              <button
                type="submit"
                title="Cerrar sesión"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-slate-100"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}