'use client';

import { useMemo, useState } from 'react';
import { 
  Package, Clock, CheckCircle2, XCircle, Wallet, Plus,
  TrendingUp 
} from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { seededInt } from '@/lib/utils/seededRandom';
import StatCard from '@/components/dashboard/StatCard';
import PedidoCard from '@/components/dashboard/PedidoCard';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import FormularioPedido from '@/components/dashboard/FormularioPedido';
import WeeklyBarChart from '@/components/charts/WeeklyBarChart';
import WeeklyLineChart from '@/components/charts/WeeklyLineChart';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function DashboardPage() {
  const { pedidos, aprobarPedido, rechazarPedido, agregarPedido } = usePedidos();
  const [formOpen, setFormOpen] = useState(false);

  const pendientes = useMemo(() => pedidos.filter((p) => p.status === 'pending'), [pedidos]);
  const aprobados = useMemo(() => pedidos.filter((p) => p.status === 'approved'), [pedidos]);
  const rechazados = useMemo(() => pedidos.filter((p) => p.status === 'rejected'), [pedidos]);
  const totalVentas = useMemo(() => aprobados.reduce((sum, p) => sum + (p.total || 0), 0), [aprobados]);

  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    aprobados.forEach((p) => p.items.forEach((i: any) => (counts[i.product] = (counts[i.product] || 0) + i.quantity)));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [aprobados]);

  const { ventasPorDia, pedidosPorDia } = useMemo(() => {
    const ventas = DIAS.map((_: string, i: number) => seededInt(`ventas-${i}`, 500, 3500));
    const cuenta = DIAS.map((_: string, i: number) => seededInt(`pedidos-dia-${i}`, 2, 10));
    return { ventasPorDia: ventas, pedidosPorDia: cuenta };
  }, []);

  const ultimos = (arr: any[]) =>
    [...arr].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const ultimosPendientes = useMemo(() => ultimos(pendientes), [pendientes]);
  const ultimosAprobados = useMemo(() => ultimos(aprobados), [aprobados]);
  const ultimosRechazados = useMemo(() => ultimos(rechazados), [rechazados]);
  const actividadReciente = useMemo(() => ultimos(pedidos), [pedidos]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Dashboard" subtitle="Resumen general de pedidos" count={pedidos.length} countLabel="pedidos">
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" /> Nuevo Pedido
        </button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Package} label="Total Pedidos" value={pedidos.length} tone="slate" />
        <StatCard icon={Clock} label="Pendientes" value={pendientes.length} tone="amber" />
        <StatCard icon={CheckCircle2} label="Aprobados" value={aprobados.length} tone="emerald" />
        <StatCard icon={XCircle} label="Rechazados" value={rechazados.length} tone="rose" />
        <StatCard icon={Wallet} label="Ventas Totales" value={formatCurrency(totalVentas)} tone="brand" />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ventas por Día</h3>
            <span className="text-xs text-slate-400 dark:text-slate-500">Esta semana</span>
          </div>
          <WeeklyBarChart labels={DIAS} values={ventasPorDia} />
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pedidos por Día</h3>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="h-3 w-3" /> +12% vs semana pasada
            </span>
          </div>
          <WeeklyLineChart labels={DIAS} values={pedidosPorDia} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Productos Más Vendidos</h3>
          {topProducts.length === 0 ? (
            <EmptyState title="Sin productos vendidos aún" />
          ) : (
            <div className="space-y-3">
              {topProducts.map(([product, qty], index) => (
                <div key={product} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-500 dark:text-slate-400">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{product}</span>
                      <span className="ml-2 shrink-0 text-slate-400 dark:text-slate-500">{qty} un.</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div
                        className="h-full rounded-full bg-brand-500"
                        style={{ width: `${(qty / topProducts[0][1]) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividad Reciente</h3>
          <div className="space-y-4">
            {actividadReciente.length === 0 ? (
              <EmptyState title="Sin actividad reciente" />
            ) : (
              actividadReciente.map((p) => (
                <div key={p.id} className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      p.status === 'pending' ? 'bg-amber-400' : 
                      p.status === 'approved' ? 'bg-emerald-500' : 
                      'bg-rose-500'
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-600 dark:text-slate-400">
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{p.customer.name}</span> —{' '}
                      {p.status === 'pending' ? 'Pendiente' : 
                       p.status === 'approved' ? 'Aprobado' : 
                       'Rechazado'}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(p.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <BoardColumn title="Últimos Pendientes" count={pendientes.length} dotClass="bg-amber-400">
          {ultimosPendientes.length === 0 ? (
            <EmptyState title="No hay pedidos pendientes" />
          ) : (
            ultimosPendientes.map((p) => (
              <PedidoCard key={p.id} pedido={p} onAprobar={aprobarPedido} onRechazar={rechazarPedido} />
            ))
          )}
        </BoardColumn>

        <BoardColumn title="Últimos Aprobados" count={aprobados.length} dotClass="bg-emerald-500">
          {ultimosAprobados.length === 0 ? (
            <EmptyState title="No hay pedidos aprobados" />
          ) : (
            ultimosAprobados.map((p) => <PedidoCard key={p.id} pedido={p} />)
          )}
        </BoardColumn>

        <BoardColumn title="Últimos Rechazados" count={rechazados.length} dotClass="bg-rose-500">
          {ultimosRechazados.length === 0 ? (
            <EmptyState title="No hay pedidos rechazados" />
          ) : (
            ultimosRechazados.map((p) => <PedidoCard key={p.id} pedido={p} />)
          )}
        </BoardColumn>
      </div>

      <FormularioPedido open={formOpen} onClose={() => setFormOpen(false)} onAgregar={agregarPedido} />
    </div>
  );
}

function BoardColumn({ title, count, dotClass, children }: any) {
  return (
    <div className="rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} /> {title}
        </span>
        <span className="rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-xs font-semibold text-slate-500 dark:text-slate-400">{count}</span>
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto scroll-thin pr-1">{children}</div>
    </div>
  );
} 