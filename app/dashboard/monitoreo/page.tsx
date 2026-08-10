'use client';

import { useMemo, useState } from 'react';
import { ShieldCheck, FilePlus2, CheckCircle2, XCircle, ListFilter } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { seededInt, seededPick } from '@/lib/utils/seededRandom';
import { AGENTES_CSR } from '@/lib/utils/constants';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'creacion', label: 'Creaciones' },
  { key: 'aprobacion', label: 'Aprobaciones' },
  { key: 'rechazo', label: 'Rechazos' },
];

const TYPE_STYLES: Record<string, string> = {
  creacion: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950/30 dark:text-sky-400 dark:ring-sky-500/20',
  aprobacion: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950/30 dark:text-emerald-400 dark:ring-emerald-500/20',
  rechazo: 'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-950/30 dark:text-rose-400 dark:ring-rose-500/20',
};

const TYPE_LABEL: Record<string, string> = {
  creacion: 'Creación',
  aprobacion: 'Aprobación',
  rechazo: 'Rechazo',
};

function MonitoreoContent() {
  const { pedidos } = usePedidos();
  const [filterType, setFilterType] = useState('all');

  const logs = useMemo(() => {
    const entries = pedidos.flatMap((p) => {
      const created = {
        id: `${p.id}-creacion`,
        orderId: p.id,
        customer: p.customer.name,
        action: 'Pedido creado',
        user: 'CSR-Admin',
        type: 'creacion',
        timestamp: p.created_at,
        ip: `192.168.${seededInt(`${p.id}-ip1`, 0, 255)}.${seededInt(`${p.id}-ip2`, 0, 255)}`,
      };

      const entries2 = [created];

      if (p.status === 'approved') {
        entries2.push({
          id: `${p.id}-aprobacion`,
          orderId: p.id,
          customer: p.customer.name,
          action: 'Pedido aprobado',
          user: p.approved_by || seededPick(`${p.id}-user`, AGENTES_CSR),
          type: 'aprobacion',
          timestamp: p.approved_at || p.created_at,
          ip: `192.168.${seededInt(`${p.id}-ip3`, 0, 255)}.${seededInt(`${p.id}-ip4`, 0, 255)}`,
        });
      } else if (p.status === 'rejected') {
        entries2.push({
          id: `${p.id}-rechazo`,
          orderId: p.id,
          customer: p.customer.name,
          action: 'Pedido rechazado',
          user: p.rejected_by || seededPick(`${p.id}-user`, AGENTES_CSR),
          type: 'rechazo',
          timestamp: p.rejected_at || p.created_at,
          ip: `192.168.${seededInt(`${p.id}-ip3`, 0, 255)}.${seededInt(`${p.id}-ip4`, 0, 255)}`,
        });
      } else {
        entries2.push({
          id: `${p.id}-pendiente`,
          orderId: p.id,
          customer: p.customer.name,
          action: 'Pendiente de acción',
          user: seededPick(`${p.id}-user`, AGENTES_CSR),
          type: 'creacion',
          timestamp: p.created_at,
          ip: `192.168.${seededInt(`${p.id}-ip3`, 0, 255)}.${seededInt(`${p.id}-ip4`, 0, 255)}`,
        });
      }

      return entries2;
    });

    return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [pedidos]);

  const filteredLogs = filterType === 'all' ? logs : logs.filter((l) => l.type === filterType);

  const stats = {
    total: logs.length,
    creaciones: logs.filter((l) => l.type === 'creacion').length,
    aprobaciones: logs.filter((l) => l.type === 'aprobacion').length,
    rechazos: logs.filter((l) => l.type === 'rechazo').length,
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Monitoreo — Auditoría" subtitle="Registro de actividad sobre los pedidos" count={stats.total} countLabel="registros" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Total" value={stats.total} tone="slate" />
        <StatCard icon={FilePlus2} label="Creaciones" value={stats.creaciones} tone="brand" />
        <StatCard icon={CheckCircle2} label="Aprobaciones" value={stats.aprobaciones} tone="emerald" />
        <StatCard icon={XCircle} label="Rechazos" value={stats.rechazos} tone="rose" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ListFilter className="h-4 w-4 text-slate-400 dark:text-slate-500" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterType(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filterType === f.key ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 ring-1 ring-slate-200 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white dark:bg-slate-800 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700">
        <div className="max-h-[600px] overflow-auto scroll-thin">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-xs uppercase tracking-wide text-slate-400 dark:text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Usuario</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fecha/Hora</th>
                <th className="px-4 py-3 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700">
              {filteredLogs.slice(0, 50).map((log) => (
                <tr key={log.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-500 dark:text-slate-400">#{log.orderId}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-200">{log.customer}</td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{log.action}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{log.user}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${TYPE_STYLES[log.type]}`}>
                      {TYPE_LABEL[log.type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                    {new Date(log.timestamp).toLocaleString('es-DO', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true,
                    })}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400 dark:text-slate-500">{log.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredLogs.length === 0 && (
            <div className="p-6">
              <EmptyState title="Sin registros para este filtro" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MonitoreoPage() {
  return (
    <PedidosProvider>
      <MonitoreoContent />
    </PedidosProvider>
  );
}