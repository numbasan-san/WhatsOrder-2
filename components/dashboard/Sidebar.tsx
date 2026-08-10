'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Clock,
  CheckCircle2,
  XCircle,
  Truck,
  Users,
  ShieldCheck,
  MessageCircle,
  ChevronLeft,
  LogOut,
} from 'lucide-react';
import ThemeToggle from '../ThemeToggle';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const NAV_ITEMS_DASHBOARD = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
];

const NAV_ITEMS_PEDIDOS = [
  { to: '/dashboard/pendientes', label: 'Pendientes', icon: Clock },
  { to: '/dashboard/aprobados', label: 'Aprobados', icon: CheckCircle2 },
  { to: '/dashboard/rechazados', label: 'Rechazados', icon: XCircle },
];

const NAV_ITEMS_GESTION = [
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
  const { user, profile, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const toggleCollapse = () => setCollapsed(!collapsed);

  const handleLogout = async () => {
    await signOut();
  };

  const renderNavItems = (items: typeof NAV_ITEMS_DASHBOARD) => {
    return items.map((item) => {
      const isActive = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to));
      return (
        <Link
          key={item.to}
          href={item.to}
          onClick={() => onClose()}
          className={`group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
            isActive
              ? 'bg-brand-500/15 text-white'
              : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
          } ${collapsed ? 'justify-center' : ''}`}
          title={collapsed ? item.label : undefined}
        >
          <item.icon
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${
              isActive ? 'text-brand-400' : 'text-slate-500 group-hover:text-slate-300'
            }`}
          />
          {!collapsed && (
            <>
              <span className="flex-1 truncate">{item.label}</span>
              {isActive && <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />}
            </>
          )}
        </Link>
      );
    });
  };

  // Obtener iniciales del usuario
  const userInitials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const userDisplayName = profile?.full_name || user?.email?.split('@')[0] || 'Usuario';
  
  const userRole = profile?.role === 'admin' ? 'Administrador' : 
                   profile?.role === 'supervisor' ? 'Supervisor' : 
                   'CSR';

  return (
    <>
      {/* Overlay para móvil */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 dark:bg-slate-950/80 lg:hidden animate-fade-in"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-full flex-col bg-slate-950 dark:bg-slate-900 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        } ${open ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}
      >
        {/* Logo y colapsar */}
        <div className={`flex items-center gap-2.5 px-5 py-5 shrink-0 ${collapsed ? 'justify-center' : ''}`}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-500">
            <MessageCircle className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold leading-none text-white">WhatsOrder</h2>
                <p className="mt-1 text-[11px] font-medium text-slate-500">Panel CSR</p>
              </div>
              <button
                onClick={toggleCollapse}
                className="rounded-lg p-1 text-slate-500 hover:bg-white/5 hover:text-slate-300 transition"
                aria-label="Colapsar sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        {/* Navegación */}
        <nav className="flex-1 overflow-y-auto scroll-thin px-3 py-2">
          {/* Grupo 1: Dashboard */}
          <div className="space-y-1">
            {renderNavItems(NAV_ITEMS_DASHBOARD)}
          </div>

          {/* Separador 1 */}
          <div className="my-3 border-t border-white/10 dark:border-white/5" />

          {/* Grupo 2: Pendientes + Aprobados + Rechazados */}
          <div className="space-y-1">
            {renderNavItems(NAV_ITEMS_PEDIDOS)}
          </div>

          {/* Separador 2 */}
          <div className="my-3 border-t border-white/10 dark:border-white/5" />

          {/* Grupo 3: Logística + Clientes + Monitoreo */}
          <div className="space-y-1">
            {renderNavItems(NAV_ITEMS_GESTION)}
          </div>
        </nav>

        {/* Footer del sidebar */}
        <div className={`border-t border-white/5 dark:border-slate-700/50 p-4 shrink-0 ${collapsed ? 'flex justify-center' : ''}`}>
          <div
            className={`flex items-center gap-3 rounded-lg bg-white/5 dark:bg-slate-800/50 px-3 py-2.5 transition-all ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-sm font-semibold text-brand-400">
              {userInitials}
            </div>
            {!collapsed && (
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">{userDisplayName}</p>
                <p className="truncate text-xs text-slate-500">{userRole}</p>
              </div>
            )}
            {!collapsed && (
              <div className="flex items-center gap-1">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
            {collapsed && (
              <div className="flex flex-col items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-slate-200 transition"
                  aria-label="Cerrar sesión"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Botón para expandir cuando está colapsado */}
        {collapsed && (
          <button
            onClick={toggleCollapse}
            className="absolute -right-3 top-1/2 hidden -translate-y-1/2 rounded-full bg-slate-800 p-1 text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition lg:block"
            aria-label="Expandir sidebar"
          >
            <ChevronLeft className="h-4 w-4 rotate-180" />
          </button>
        )}
      </aside>
    </>
  );
}