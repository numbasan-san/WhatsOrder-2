'use client';

import { useMemo, useState } from 'react';
import { XCircle, MousePointerClick } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import OrderListRow from '@/components/dashboard/OrderListRow';
import DetallePedido from '@/components/dashboard/DetallePedido';
import EmptyState from '@/components/dashboard/EmptyState';

function RechazadosContent() {
  const { pedidos } = usePedidos();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const rechazados = useMemo(() => {
    return [...pedidos.filter((p) => p.status === 'rejected')].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [pedidos]);
  const selected = rechazados.find((p) => p.id === selectedId);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title="Pedidos Rechazados" subtitle="Pedidos que no fueron confirmados" count={rechazados.length} countLabel="pedidos" />

      <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
        <div className="max-h-[75vh] space-y-2.5 overflow-y-auto scroll-thin rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-100 dark:bg-slate-800/40 dark:ring-slate-700 lg:max-h-[calc(100vh-180px)]">
          {rechazados.length === 0 ? (
            <EmptyState icon={XCircle} title="No hay pedidos rechazados" />
          ) : (
            rechazados.map((p) => (
              <OrderListRow key={p.id} pedido={p} selected={selectedId === p.id} onClick={() => setSelectedId(p.id)} />
            ))
          )}
        </div>

        <div>
          {selected ? (
            <DetallePedido pedido={selected} />
          ) : (
            <EmptyState icon={MousePointerClick} title="Selecciona un pedido" description="Elige un pedido de la lista para ver el motivo del rechazo." />
          )}
        </div>
      </div>
    </div>
  );
}

export default function RechazadosPage() {
  return (
    <PedidosProvider>
      <RechazadosContent />
    </PedidosProvider>
  );
}