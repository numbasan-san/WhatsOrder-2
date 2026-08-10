'use client';

import { useMemo, useState } from 'react';
import { Truck, MapPin, PackageCheck, PackageX, PackageSearch } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';
import type { DeliveryStatus, Pedido } from '@/lib/types';

const FILTERS: { key: 'all' | NonNullable<DeliveryStatus>; label: string }[] = [
  { key: 'all', label: 'Todos' },
  { key: 'pending', label: 'Pendientes' },
  { key: 'assigned', label: 'Asignados' },
  { key: 'in_transit', label: 'En Tránsito' },
  { key: 'delivered', label: 'Entregados' },
];

const STATUS_LABEL: Record<NonNullable<DeliveryStatus>, string> = {
  pending: 'Pendiente',
  assigned: 'Asignado',
  in_transit: 'En tránsito',
  delivered: 'Entregado',
};

const STATUS_STYLES: Record<NonNullable<DeliveryStatus>, string> = {
  pending: 'bg-sky-50 text-sky-700 ring-sky-600/20',
  assigned: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  in_transit: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
};

function LogisticaContent() {
  const { pedidos, error, asignarEntrega } = usePedidos();
  const [filter, setFilter] = useState<'all' | NonNullable<DeliveryStatus>>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ assigned_to: string; delivery_status: NonNullable<DeliveryStatus>; delivery_eta: string }>({
    assigned_to: '',
    delivery_status: 'pending',
    delivery_eta: '',
  });
  const [saving, setSaving] = useState(false);

  const aprobados = useMemo(
    () => pedidos.filter((p) => p.status === 'approved').sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [pedidos]
  );

  const filtered = filter === 'all' ? aprobados : aprobados.filter((p) => (p.delivery_status ?? 'pending') === filter);
  const selected = aprobados.find((p) => p.id === selectedId);

  const stats = {
    total: aprobados.length,
    pendiente: aprobados.filter((p) => (p.delivery_status ?? 'pending') === 'pending').length,
    enRuta: aprobados.filter((p) => p.delivery_status === 'assigned' || p.delivery_status === 'in_transit').length,
    entregado: aprobados.filter((p) => p.delivery_status === 'delivered').length,
  };

  const selectPedido = (p: Pedido) => {
    setSelectedId(p.id);
    setDraft({
      assigned_to: p.delivery_assigned_to ?? '',
      delivery_status: (p.delivery_status ?? 'pending') as NonNullable<DeliveryStatus>,
      delivery_eta: p.delivery_eta ?? '',
    });
  };

  const handleSave = async () => {
    if (!selected) return;
    if (!draft.assigned_to.trim()) return;
    setSaving(true);
    try {
      await asignarEntrega(selected.id, {
        assigned_to: draft.assigned_to.trim(),
        delivery_status: draft.delivery_status,
        delivery_eta: draft.delivery_eta.trim() || null,
      });
    } catch {
      // context.error already carries the message; the banner above renders it.
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Logística — Entregas" subtitle="Asigna repartidor, estado y ETA a pedidos aprobados" count={stats.total} countLabel="pedidos" />

      {error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-2.5 text-sm text-rose-600 ring-1 ring-inset ring-rose-100">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Truck} label="Total Aprobados" value={stats.total} tone="slate" />
        <StatCard icon={PackageSearch} label="Sin Asignar" value={stats.pendiente} tone="amber" />
        <StatCard icon={PackageX} label="En Ruta" value={stats.enRuta} tone="brand" />
        <StatCard icon={PackageCheck} label="Entregados" value={stats.entregado} tone="emerald" />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              filter === f.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-5 lg:grid-cols-[1.4fr,1fr]">
        <div className="overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-slate-100">
          <div className="max-h-[560px] overflow-auto scroll-thin">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Zona</th>
                  <th className="px-4 py-3 font-medium">Repartidor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">ETA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => {
                  const status = (p.delivery_status ?? 'pending') as NonNullable<DeliveryStatus>;
                  return (
                    <tr
                      key={p.id}
                      onClick={() => selectPedido(p)}
                      className={`cursor-pointer transition ${selectedId === p.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                    >
                      <td className="px-4 py-3 font-medium text-slate-800">{p.customer_name || 'Cliente sin nombre'}</td>
                      <td className="px-4 py-3 text-slate-500">{p.delivery_zone || 'Sin zona'}</td>
                      <td className="px-4 py-3 text-slate-500">{p.delivery_assigned_to || 'Sin asignar'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}>
                          {STATUS_LABEL[status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.delivery_eta || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="p-6">
                <EmptyState title="Sin resultados para este filtro" />
              </div>
            )}
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-slate-100">
          <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
            <MapPin className="h-4 w-4 text-brand-600" /> Asignar Entrega
          </h3>
          {selected ? (
            <div className="animate-fade-in space-y-4">
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-semibold text-slate-800">{selected.customer_name || 'Cliente sin nombre'}</p>
                <p className="text-xs text-slate-500">{selected.delivery_address || 'Sin dirección registrada'}</p>
                <p className="text-xs text-slate-400">{selected.delivery_zone || 'Zona sin asignar'}</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Repartidor</label>
                <input
                  type="text"
                  value={draft.assigned_to}
                  onChange={(e) => setDraft({ ...draft, assigned_to: e.target.value })}
                  placeholder="Nombre del repartidor"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Estado de entrega</label>
                <select
                  value={draft.delivery_status}
                  onChange={(e) => setDraft({ ...draft, delivery_status: e.target.value as NonNullable<DeliveryStatus> })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  {(Object.keys(STATUS_LABEL) as NonNullable<DeliveryStatus>[]).map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">ETA / tiempo estimado</label>
                <input
                  type="text"
                  value={draft.delivery_eta}
                  onChange={(e) => setDraft({ ...draft, delivery_eta: e.target.value })}
                  placeholder="Ej. 30 min"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !draft.assigned_to.trim()}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? 'Guardando…' : 'Guardar entrega'}
              </button>
            </div>
          ) : (
            <EmptyState icon={MapPin} title="Selecciona un pedido" description="Elige un pedido aprobado de la lista para asignar su entrega." />
          )}
        </div>
      </div>
    </div>
  );
}

export default function LogisticaPage() {
  return (
    <PedidosProvider>
      <LogisticaContent />
    </PedidosProvider>
  );
}
