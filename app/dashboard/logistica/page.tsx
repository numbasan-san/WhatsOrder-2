'use client';

import { useMemo, useState } from 'react';
import { Truck, MapPin, PackageCheck, PackageX, PackageSearch } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import StatCard from '@/components/dashboard/StatCard';
import EmptyState from '@/components/dashboard/EmptyState';

const FILTERS = [
  { key: 'all', label: 'Todos' },
  { key: 'En ruta', label: 'En Ruta' },
  { key: 'Entregado', label: 'Entregados' },
  { key: 'Pendiente de entrega', label: 'Pendientes' },
];

const STATUS_STYLES: Record<string, string> = {
  Entregado: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  'En ruta': 'bg-amber-50 text-amber-700 ring-amber-600/20',
  'Pendiente de entrega': 'bg-sky-50 text-sky-700 ring-sky-600/20',
  'No asignado': 'bg-slate-100 text-slate-500 ring-slate-300/40',
};

function LogisticaContent() {
  const { pedidos } = usePedidos();
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const entregas = useMemo(
    () =>
      pedidos.map((p) => ({
        ...p,
        deliveryStatus: p.delivery_status || (p.status === 'approved' ? 'Pendiente de entrega' : 'No asignado'),
        deliveryZone: p.delivery?.zone || 'Sin zona',
        deliveryTime: p.delivery_eta || '—',
        assignedTo: p.delivery_assigned_to || 'Sin asignar',
      })),
    [pedidos]
  );

  const filtered = filter === 'all' ? entregas : entregas.filter((e) => e.deliveryStatus === filter);
  const selected = entregas.find((e) => e.id === selectedId);

  const stats = {
    total: entregas.length,
    enRuta: entregas.filter((e) => e.deliveryStatus === 'En ruta').length,
    entregado: entregas.filter((e) => e.deliveryStatus === 'Entregado').length,
    pendiente: entregas.filter((e) => e.deliveryStatus === 'Pendiente de entrega').length,
  };

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Logística — Entregas" subtitle="Seguimiento de despachos y repartidores" count={stats.total} countLabel="pedidos" />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={Truck} label="Total" value={stats.total} tone="slate" />
        <StatCard icon={PackageSearch} label="En Ruta" value={stats.enRuta} tone="amber" />
        <StatCard icon={PackageCheck} label="Entregados" value={stats.entregado} tone="emerald" />
        <StatCard icon={PackageX} label="Pendientes" value={stats.pendiente} tone="rose" />
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
                  <th className="px-4 py-3 font-medium">Pedido</th>
                  <th className="px-4 py-3 font-medium">Cliente</th>
                  <th className="px-4 py-3 font-medium">Zona</th>
                  <th className="px-4 py-3 font-medium">Repartidor</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium">Tiempo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`cursor-pointer transition ${selectedId === p.id ? 'bg-brand-50/60' : 'hover:bg-slate-50'}`}
                  >
                    <td className="px-4 py-3 font-medium text-slate-500">#{p.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.customer.name}</td>
                    <td className="px-4 py-3 text-slate-500">{p.deliveryZone}</td>
                    <td className="px-4 py-3 text-slate-500">{p.assignedTo}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[p.deliveryStatus]}`}>
                        {p.deliveryStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{p.deliveryTime}</td>
                  </tr>
                ))}
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
            <MapPin className="h-4 w-4 text-brand-600" /> Mapa de Entregas
          </h3>
          {selected ? (
            <div className="animate-fade-in">
              <div className="overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-100">
                <svg viewBox="0 0 400 260" className="h-full w-full">
                  <rect width="400" height="260" fill="#f1f5f9" />
                  <g stroke="#e2e8f0" strokeWidth="2">
                    <line x1="80" y1="0" x2="80" y2="260" />
                    <line x1="200" y1="0" x2="200" y2="260" />
                    <line x1="320" y1="0" x2="320" y2="260" />
                    <line x1="0" y1="90" x2="400" y2="90" />
                    <line x1="0" y1="180" x2="400" y2="180" />
                  </g>
                  <circle cx="200" cy="135" r="24" fill="#25D366" opacity="0.15" />
                  <circle cx="200" cy="135" r="10" fill="#16a34a" />
                  <circle cx="200" cy="135" r="10" fill="none" stroke="#16a34a" strokeWidth="1.5" opacity="0.5">
                    <animate attributeName="r" values="10;24;10" dur="2.4s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
                  </circle>
                  <text x="200" y="168" fontSize="11" fontWeight="700" fill="#1e293b" textAnchor="middle">
                    Pedido #{selected.id}
                  </text>
                  <text x="200" y="184" fontSize="9.5" fill="#64748b" textAnchor="middle">
                    {selected.customer.name}
                  </text>
                  <text x="200" y="198" fontSize="9.5" fill="#64748b" textAnchor="middle">
                    {selected.deliveryZone}
                  </text>
                </svg>
              </div>
              <div className="mt-4 space-y-2 text-sm">
                <p className="flex justify-between text-slate-500">
                  <span>Pedido</span> <span className="font-medium text-slate-800">#{selected.id}</span>
                </p>
                <p className="flex justify-between text-slate-500">
                  <span>Zona</span> <span className="font-medium text-slate-800">{selected.deliveryZone}</span>
                </p>
                <p className="flex justify-between text-slate-500">
                  <span>Estado</span> <span className="font-medium text-slate-800">{selected.deliveryStatus}</span>
                </p>
                <p className="flex justify-between text-slate-500">
                  <span>Tiempo estimado</span> <span className="font-medium text-slate-800">{selected.deliveryTime}</span>
                </p>
              </div>
            </div>
          ) : (
            <EmptyState icon={MapPin} title="Selecciona un pedido" description="Elige un pedido de la lista para ver su ubicación." />
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