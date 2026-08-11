'use client';

import { useMemo, useState } from 'react';
import { Users, MousePointerClick, Phone, IdCard, Mail } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import type { Pedido } from '@/lib/types';

interface Customer {
  key: string;
  name: string;
  phone: string | null;
  telegramChatId: string | null;
  email: string | null;
  cedula: string | null;
  orders: Pedido[];
  orderCount: number;
  totalSpent: number;
  lastOrderAt: string;
}

function ClientesContent() {
  const { pedidos } = usePedidos();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const customers = useMemo<Customer[]>(() => {
    const map: Record<string, Customer> = {};

    pedidos.forEach((p) => {
      const key = p.customer_phone || p.telegram_chat_id || p.id;
      if (!map[key]) {
        map[key] = {
          key,
          name: p.customer_name || 'Cliente sin nombre',
          phone: p.customer_phone,
          telegramChatId: p.telegram_chat_id,
          email: p.customer_email,
          cedula: p.customer_cedula,
          orders: [],
          orderCount: 0,
          totalSpent: 0,
          lastOrderAt: p.created_at,
        };
      }
      const c = map[key];
      c.orders.push(p);
      c.orderCount += 1;
      if (p.status === 'approved') c.totalSpent += p.total || 0;
      if (new Date(p.created_at).getTime() > new Date(c.lastOrderAt).getTime()) {
        c.lastOrderAt = p.created_at;
        // Prefer the most recent non-null contact info for display.
        if (p.customer_name) c.name = p.customer_name;
        if (p.customer_email) c.email = p.customer_email;
        if (p.customer_cedula) c.cedula = p.customer_cedula;
      }
    });

    Object.values(map).forEach((c) => {
      c.orders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });

    return Object.values(map).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [pedidos]);

  const selected = customers.find((c) => c.key === selectedKey);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Análisis de Clientes" subtitle="Historial de compra y valor por cliente" count={customers.length} countLabel="clientes" />

      <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
        <div className="max-h-[75vh] space-y-2 overflow-y-auto scroll-thin rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-100 dark:bg-slate-800/40 dark:ring-slate-700 lg:max-h-[calc(100vh-180px)]">
          {customers.length === 0 ? (
            <EmptyState icon={Users} title="Sin clientes registrados" />
          ) : (
            customers.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setSelectedKey(c.key)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left shadow-sm transition ${
                  selectedKey === c.key
                    ? 'border-brand-500/40 bg-brand-50/70 ring-1 ring-brand-500/30'
                    : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:hover:border-slate-600 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{c.name}</p>
                    <p className="truncate text-xs text-slate-400">{c.phone || '—'}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-brand-800">{formatCurrency(c.totalSpent)}</p>
                    <p className="text-[11px] text-slate-400">{c.orderCount} pedidos</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <div className="animate-fade-in rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-700">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selected.phone || '—'}
                    </span>
                    {selected.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" /> {selected.email}
                      </span>
                    )}
                    {selected.cedula && (
                      <span className="flex items-center gap-1">
                        <IdCard className="h-3 w-3" /> {selected.cedula}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 py-5">
                <div className="rounded-xl bg-slate-50 p-3.5 text-center dark:bg-slate-700/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Total Pedidos</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{selected.orderCount}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 text-center dark:bg-slate-700/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Gasto Total (aprobados)</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(selected.totalSpent)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3.5 text-center dark:bg-slate-700/40">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Último Pedido</p>
                  <p className="mt-1 text-sm font-bold text-slate-900 dark:text-slate-100">{formatDateTime(selected.lastOrderAt)}</p>
                </div>
              </div>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Historial de Pedidos</h3>
              <div className="max-h-[420px] space-y-2 overflow-y-auto scroll-thin pr-1">
                {selected.orders.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-700">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-600">{o.items.map((i) => i.product).join(', ') || 'Sin productos'}</p>
                      <p className="text-xs text-slate-400">{formatDateTime(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={o.status} size="sm" />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-100">{formatCurrency(o.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState icon={MousePointerClick} title="Selecciona un cliente" description="Elige un cliente de la lista para ver su historial completo." />
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClientesPage() {
  return (
    <PedidosProvider>
      <ClientesContent />
    </PedidosProvider>
  );
}
