'use client';

import { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, FilePlus2, CheckCircle2, XCircle, ListFilter } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import { createClient } from '@/lib/supabase/client';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';
import { formatDateTime } from '@/lib/utils/format';

type ActorType = 'csr' | 'customer' | 'bot' | 'system';

interface AuditRow {
  id: string;
  pedido_id: string | null;
  actor_type: ActorType;
  actor_id: string | null;
  action: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_LABEL: Record<string, string> = {
  created: 'Pedido creado',
  confirmed: 'Pedido confirmado',
  approved: 'Pedido aprobado',
  rejected: 'Pedido rechazado',
  cancelled: 'Pedido cancelado',
  assigned_delivery: 'Entrega asignada',
};

const ACTION_STYLES: Record<string, string> = {
  created: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  confirmed: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  approved: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  rejected: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  cancelled: 'bg-slate-100 text-slate-500 ring-slate-300/40',
  assigned_delivery: 'bg-brand-50 text-brand-700 ring-brand-600/20',
};

const ACTOR_LABEL: Record<ActorType, string> = {
  csr: 'CSR',
  customer: 'Cliente',
  bot: 'Bot Telegram',
  system: 'Sistema',
};

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'created', label: 'Creaciones' },
  { key: 'approved', label: 'Aprobaciones' },
  { key: 'rejected', label: 'Rechazos' },
  { key: 'assigned_delivery', label: 'Entregas' },
];

function MonitoreoContent() {
  const { pedidos } = usePedidos();
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('all');

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    setLoading(true);
    Promise.all([
      supabase.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200),
      supabase.from('user_profiles').select('id, full_name'),
    ]).then(([logsRes, profilesRes]) => {
      if (!active) return;
      if (!logsRes.error && logsRes.data) setLogs(logsRes.data as AuditRow[]);
      if (!profilesRes.error && profilesRes.data) {
        const map: Record<string, string> = {};
        (profilesRes.data as { id: string; full_name: string | null }[]).forEach((p) => {
          if (p.full_name) map[p.id] = p.full_name;
        });
        setProfiles(map);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const pedidoNameById = useMemo(() => {
    const map: Record<string, string> = {};
    pedidos.forEach((p) => {
      map[p.id] = p.customer_name || 'Cliente sin nombre';
    });
    return map;
  }, [pedidos]);

  const actorLabel = (log: AuditRow) => {
    if (log.actor_type === 'csr' && log.actor_id) {
      return profiles[log.actor_id] || ACTOR_LABEL.csr;
    }
    return ACTOR_LABEL[log.actor_type];
  };

  const filteredLogs = filterAction === 'all' ? logs : logs.filter((l) => l.action === filterAction);

  const stats = {
    total: logs.length,
    creaciones: logs.filter((l) => l.action === 'created').length,
    aprobaciones: logs.filter((l) => l.action === 'approved').length,
    rechazos: logs.filter((l) => l.action === 'rejected').length,
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Monitoreo — Auditoría" subtitle="Registro real de actividad sobre los pedidos" count={stats.total} countLabel="registros" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={ShieldCheck} label="Total" value={stats.total} tone="slate" />
        <StatCard icon={FilePlus2} label="Creaciones" value={stats.creaciones} tone="brand" />
        <StatCard icon={CheckCircle2} label="Aprobaciones" value={stats.aprobaciones} tone="emerald" />
        <StatCard icon={XCircle} label="Rechazos" value={stats.rechazos} tone="rose" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <ListFilter className="h-4 w-4 text-slate-400" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilterAction(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filterAction === f.key ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-400 dark:ring-slate-700 dark:hover:bg-slate-700'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100 dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700">
        <div className="max-h-[600px] overflow-auto scroll-thin">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400 dark:bg-slate-700/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-medium">Pedido</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Acción</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Fecha/Hora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
                  <td className="px-4 py-3 font-medium text-slate-500">
                    {log.pedido_id ? `#${log.pedido_id.slice(0, 8)}` : '—'}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                    {log.pedido_id ? pedidoNameById[log.pedido_id] || '—' : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{ACTION_LABEL[log.action] || log.action}</td>
                  <td className="px-4 py-3 text-slate-500">{actorLabel(log)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        ACTION_STYLES[log.action] || 'bg-slate-100 text-slate-500 ring-slate-300/40'
                      }`}
                    >
                      {ACTOR_LABEL[log.actor_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDateTime(log.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filteredLogs.length === 0 && (
            <div className="p-6">
              <EmptyState title="Sin registros para este filtro" />
            </div>
          )}
          {loading && (
            <div className="p-6 text-center text-sm text-slate-400">Cargando auditoría…</div>
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
