'use client';

import { useMemo, useState } from 'react';
import {
  Package, Clock, CheckCircle2, XCircle, Wallet, Plus,
  TrendingUp, TrendingDown
} from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import type { Pedido } from '@/lib/types';
import StatCard from '@/components/dashboard/StatCard';
import PedidoCard from '@/components/dashboard/PedidoCard';
import PageHeader from '@/components/dashboard/PageHeader';
import EmptyState from '@/components/dashboard/EmptyState';
import FormularioPedido from '@/components/dashboard/FormularioPedido';
import WeeklyBarChart from '@/components/charts/WeeklyBarChart';
import WeeklyLineChart from '@/components/charts/WeeklyLineChart';

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const TZ = 'America/Santo_Domingo';

const STATUS_DOT_CLASS: Record<Pedido['status'], string> = {
  pending: 'bg-amber-400',
  pending_confirmation: 'bg-amber-400',
  approved: 'bg-emerald-500',
  rejected: 'bg-rose-500',
  cancelled: 'bg-slate-400',
};

/** yyyy-mm-dd for the given instant, as observed in TZ. */
function ymdInTZ(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(iso)
  );
}

/** 0=Mon..6=Sun for the given instant, as observed in TZ. */
function weekdayIndexInTZ(date: Date): number {
  const short = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[short] ?? 0;
}

/** The 7 yyyy-mm-dd date strings (Mon..Sun) of the week containing `reference`, in TZ. */
function weekDatesInTZ(reference: Date): string[] {
  const todayIdx = weekdayIndexInTZ(reference);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(reference.getTime() + (i - todayIdx) * 86400000);
    return ymdInTZ(d.toISOString());
  });
}

export default function DashboardPage() {
  const { pedidos, aprobarPedido, rechazarPedido, agregarPedido } = usePedidos();
  const [formOpen, setFormOpen] = useState(false);

  const pendientes = useMemo(() => pedidos.filter((p) => p.status === 'pending'), [pedidos]);
  const aprobados = useMemo(() => pedidos.filter((p) => p.status === 'approved'), [pedidos]);
  const rechazados = useMemo(() => pedidos.filter((p) => p.status === 'rejected'), [pedidos]);
  const totalVentas = useMemo(() => aprobados.reduce((sum, p) => sum + (p.total || 0), 0), [aprobados]);

  // Productos más vendidos
  const topProducts = useMemo(() => {
    const counts: Record<string, number> = {};
    aprobados.forEach((p) => p.items.forEach((i) => (counts[i.product] = (counts[i.product] || 0) + i.quantity)));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [aprobados]);

  // Ventas/Pedidos por día de la semana actual (Lun..Dom, America/Santo_Domingo), a partir de pedidos reales.
  const { ventasPorDia, pedidosPorDia, wowPercent } = useMemo(() => {
    const now = new Date();
    const thisWeek = weekDatesInTZ(now);
    const lastWeek = weekDatesInTZ(new Date(now.getTime() - 7 * 86400000));

    const ventas = Array(7).fill(0) as number[];
    const cuenta = Array(7).fill(0) as number[];
    let countThisWeek = 0;
    let countLastWeek = 0;

    pedidos.forEach((p) => {
      const day = ymdInTZ(p.created_at);
      const thisIdx = thisWeek.indexOf(day);
      if (thisIdx !== -1) {
        cuenta[thisIdx] += 1;
        countThisWeek += 1;
        if (p.status === 'approved') ventas[thisIdx] += p.total || 0;
        return;
      }
      if (lastWeek.indexOf(day) !== -1) countLastWeek += 1;
    });

    const wow = countLastWeek > 0 ? Math.round(((countThisWeek - countLastWeek) / countLastWeek) * 100) : null;
    return { ventasPorDia: ventas, pedidosPorDia: cuenta, wowPercent: wow };
  }, [pedidos]);

  const ultimos = (arr: Pedido[]) =>
    [...arr].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

  const ultimosPendientes = useMemo(() => ultimos(pendientes), [pendientes]);
  const ultimosAprobados = useMemo(() => ultimos(aprobados), [aprobados]);
  const ultimosRechazados = useMemo(() => ultimos(rechazados), [rechazados]);

  // Actividad reciente (todos los pedidos ordenados por fecha)
  const actividadReciente = useMemo(() => ultimos(pedidos), [pedidos]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Dashboard" subtitle="Resumen general de pedidos" count={pedidos.length} countLabel="pedidos" />

      {/* Tarjetas de estadísticas */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard icon={Package} label="Total Pedidos" value={pedidos.length} tone="slate" />
        <StatCard icon={Clock} label="Pendientes" value={pendientes.length} tone="amber" />
        <StatCard icon={CheckCircle2} label="Aprobados" value={aprobados.length} tone="emerald" />
        <StatCard icon={XCircle} label="Rechazados" value={rechazados.length} tone="rose" />
        <StatCard icon={Wallet} label="Ventas Totales" value={formatCurrency(totalVentas)} tone="brand" />
      </div>

      {/* Gráficos */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Ventas por Día</h3>
            <span className="text-xs text-slate-400">Esta semana</span>
          </div>
          <WeeklyBarChart labels={DIAS} values={ventasPorDia} />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Pedidos por Día</h3>
            {wowPercent !== null && (
              <span
                className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                  wowPercent >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                }`}
              >
                {wowPercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {wowPercent >= 0 ? '+' : ''}{wowPercent}% vs semana pasada
              </span>
            )}
          </div>
          <WeeklyLineChart labels={DIAS} values={pedidosPorDia} />
        </div>
      </div>

      {/* Productos más vendidos y Actividad reciente */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Productos más vendidos */}
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Productos Más Vendidos</h3>
          {topProducts.length === 0 ? (
            <EmptyState title="Sin productos vendidos aún" />
          ) : (
            <div className="space-y-3">
              {topProducts.map(([product, qty], index) => (
                <div key={product} className="flex items-center gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-500">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">{product}</span>
                      <span className="ml-2 shrink-0 text-slate-400">{qty} un.</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
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

        {/* Actividad Reciente */}
        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
          <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Actividad Reciente</h3>
          <div className="space-y-4">
            {actividadReciente.length === 0 ? (
              <EmptyState title="Sin actividad reciente" />
            ) : (
              actividadReciente.map((p) => (
                <div key={p.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${STATUS_DOT_CLASS[p.status]}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-600">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{p.customer_name || 'Cliente sin nombre'}</span> —{' '}
                      {p.status === 'pending' ? 'Pendiente' :
                       p.status === 'approved' ? 'Aprobado' :
                       p.status === 'rejected' ? 'Rechazado' :
                       p.status === 'cancelled' ? 'Cancelado' :
                       'Por confirmar'}
                    </p>
                    <p className="text-xs text-slate-400">{formatDateTime(p.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Últimos pedidos por estado */}
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
    <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} /> {title}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">{count}</span>
      </div>
      <div className="max-h-[520px] space-y-3 overflow-y-auto scroll-thin pr-1">{children}</div>
    </div>
  );
}
