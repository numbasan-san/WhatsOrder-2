'use client';

import { useMemo, useState } from 'react';
import { CheckCircle2, MousePointerClick } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import OrderListRow from '@/components/dashboard/OrderListRow';
import DetallePedido from '@/components/dashboard/DetallePedido';
import EmptyState from '@/components/dashboard/EmptyState';

function AprobadosContent() {
  const { pedidos } = usePedidos();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const aprobados = useMemo(
    () => [...pedidos.filter((p) => p.status === 'approved')].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [pedidos]
  );
  const selected = aprobados.find((p) => p.id === selectedId);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Pedidos Aprobados" subtitle="Historial de pedidos confirmados" count={aprobados.length} countLabel="pedidos" />

      <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
        <div className="max-h-[75vh] space-y-2.5 overflow-y-auto scroll-thin rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-100 lg:max-h-[calc(100vh-180px)]">
          {aprobados.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No hay pedidos aprobados" />
          ) : (
            aprobados.map((p) => (
              <OrderListRow key={p.id} pedido={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />
            ))
          )}
        </div>

        <div>
          {selected ? (
            <DetallePedido pedido={selected} />
          ) : (
            <EmptyState icon={MousePointerClick} title="Selecciona un pedido" description="Elige un pedido de la lista para ver sus detalles." />
          )}
        </div>
      </div>
    </div>
  );
}

export default function AprobadosPage() {
  return (
    <PedidosProvider>
      <AprobadosContent />
    </PedidosProvider>
  );
}