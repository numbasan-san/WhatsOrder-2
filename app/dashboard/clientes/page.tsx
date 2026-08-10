'use client';

import { useMemo, useState } from 'react';
import { Users, MousePointerClick, Phone, IdCard } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import StatusBadge from '@/components/dashboard/StatusBadge';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { seededInt, seededPick } from '@/lib/utils/seededRandom';
import { CATALOGO, PRECIOS } from '@/lib/utils/constants';

const STATUS_POOL = ['pending', 'approved', 'approved', 'approved', 'rejected'];

function buildHistorial(cliente: string, pedidosReales: any[]) {
  const extra = seededInt(`${cliente}-extra`, 2, 6);
  const historial = [...pedidosReales];

  for (let i = 0; i < extra; i++) {
    const seed = `${cliente}-hist-${i}`;
    const numProductos = seededInt(`${seed}-n`, 1, 3);
    const items: any[] = [];
    const usados = new Set();
    for (let j = 0; j < numProductos; j++) {
      const producto = seededPick(`${seed}-p${j}`, CATALOGO).nombre;
      if (usados.has(producto)) continue;
      usados.add(producto);
      const cantidad = seededInt(`${seed}-q${j}`, 1, 4);
      items.push({ product: producto, quantity: cantidad, subtotal: PRECIOS[producto] * cantidad });
    }
    const total = items.reduce((sum, it) => sum + it.subtotal, 0);
    const diasAtras = seededInt(`${seed}-d`, 1, 45);
    historial.push({
      id: `h-${seed}`,
      status: seededPick(`${seed}-s`, STATUS_POOL),
      total,
      items,
      created_at: new Date(Date.now() - diasAtras * 86400000).toISOString(),
    });
  }

  return historial.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function ClientesContent() {
  const { pedidos } = usePedidos();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const customers = useMemo(() => {
    const map: Record<string, any> = {};
    pedidos.forEach((p) => {
      const key = p.customer.name;
      if (!map[key]) {
        map[key] = { name: p.customer.name, phone: p.customer.phone, cedula: p.customer.cedula, orders: [] };
      }
      map[key].orders.push(p);
    });

    return Object.values(map)
      .map((c) => {
        const orders = buildHistorial(c.name, c.orders);
        const totalSpent = orders.reduce((sum, o) => sum + (o.total || 0), 0);
        return { ...c, orders, totalOrders: orders.length, totalSpent };
      })
      .sort((a, b) => b.totalSpent - a.totalSpent);
  }, [pedidos]);

  const selected = customers.find((c) => c.name === selectedName);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Análisis de Clientes" subtitle="Historial de compra y valor por cliente" count={customers.length} countLabel="clientes" />

      <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
        <div className="max-h-[75vh] space-y-2 overflow-y-auto scroll-thin rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 p-3 ring-1 ring-slate-100 dark:ring-slate-800 lg:max-h-[calc(100vh-180px)]">
          {customers.length === 0 ? (
            <EmptyState icon={Users} title="Sin clientes registrados" />
          ) : (
            customers.map((c) => (
              <button
                key={c.name}
                type="button"
                onClick={() => setSelectedName(c.name)}
                className={`w-full rounded-xl border px-3.5 py-3 text-left shadow-sm transition ${
                  selectedName === c.name
                    ? 'border-brand-500/40 bg-brand-50/70 dark:bg-brand-950/40 ring-1 ring-brand-500/30'
                    : 'border-transparent bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="truncate text-xs text-slate-400 dark:text-slate-500">{c.phone}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-brand-800 dark:text-brand-400">{formatCurrency(c.totalSpent)}</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">{c.totalOrders} pedidos</p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        <div>
          {selected ? (
            <div className="animate-fade-in rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {selected.phone}
                    </span>
                    {selected.cedula && (
                      <span className="flex items-center gap-1">
                        <IdCard className="h-3 w-3" /> {selected.cedula}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 py-5">
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Total Pedidos</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{selected.totalOrders}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Gasto Total</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(selected.totalSpent)}</p>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900 p-3.5 text-center">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">Ticket Promedio</p>
                  <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selected.totalSpent / selected.totalOrders)}
                  </p>
                </div>
              </div>

              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Historial de Pedidos</h3>
              <div className="max-h-[420px] space-y-2 overflow-y-auto scroll-thin pr-1">
                {selected.orders.map((o: any, idx: number) => (
                  <div key={o.id ?? idx} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-700 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                        {o.items.map((i: any) => i.product).join(', ')}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(o.created_at)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <StatusBadge status={o.status} size="sm" />
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{formatCurrency(o.total)}</span>
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