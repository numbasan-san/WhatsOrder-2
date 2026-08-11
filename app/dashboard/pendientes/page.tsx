'use client';

import { useMemo, useState, useEffect } from 'react';
import { Inbox, MousePointerClick } from 'lucide-react';
import { usePedidos } from '@/context/PedidosContext';
import { PedidosProvider } from '@/context/PedidosContext';
import PageHeader from '@/components/dashboard/PageHeader';
import OrderListRow from '@/components/dashboard/OrderListRow';
import DetallePedido from '@/components/dashboard/DetallePedido';
import EmptyState from '@/components/dashboard/EmptyState';

function PendientesContent() {
  const { pedidos, loading, aprobarPedido, rechazarPedido, refreshPedidos } = usePedidos();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    refreshPedidos();
  }, []);

  // Limpiar feedback después de 3 segundos
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [actionFeedback]);

  const pendientes = useMemo(() => {
    const filtered = pedidos.filter((p) => p.status === 'pending');
    return filtered.sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [pedidos]);

  const selected = pendientes.find((p) => p.id === selectedId);

  const handleAprobar = async (id: string) => {
    console.log('🔄 handleAprobar llamado con ID:', id);
    console.log('📝 Tipo de ID:', typeof id);
    console.log('📝 Longitud del ID:', id?.length);
    
    try {
      await aprobarPedido(id);
      setActionFeedback({ type: 'success', message: '✅ Pedido aprobado correctamente' });
      setSelectedId(null);
      await refreshPedidos();
    } catch (error) {
      console.error('❌ Error en handleAprobar:', error);
      setActionFeedback({ type: 'error', message: '❌ Error al aprobar el pedido' });
    }
  };

  const handleRechazar = async (id: string, motivo: string) => {
    try {
      await rechazarPedido(id, motivo);
      setActionFeedback({ type: 'success', message: '✅ Pedido rechazado correctamente' });
      setSelectedId(null);
      // Recargar pedidos
      await refreshPedidos();
    } catch {
      setActionFeedback({ type: 'error', message: '❌ Error al rechazar el pedido' });
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-slate-500 dark:text-slate-400">Cargando pedidos...</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Pedidos Pendientes"
        subtitle={`${pendientes.length} pedidos esperando revision`}
        count={pendientes.length}
        countLabel="pedidos"
      />

      {/* Feedback de acciones */}
      {actionFeedback && (
        <div className={`mb-4 rounded-lg p-4 ${
          actionFeedback.type === 'success'
            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-200 dark:ring-emerald-500/30'
            : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 ring-1 ring-rose-200 dark:ring-rose-500/30'
        }`}>
          <p className="text-sm font-medium">{actionFeedback.message}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[380px,1fr]">
        <div className="max-h-[75vh] space-y-2.5 overflow-y-auto scroll-thin rounded-2xl bg-slate-50/70 dark:bg-slate-900/50 p-3 ring-1 ring-slate-100 dark:ring-slate-800 lg:max-h-[calc(100vh-180px)]">
          {pendientes.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No hay pedidos pendientes"
              description="Todos los pedidos han sido procesados. Buen trabajo!"
            />
          ) : (
            pendientes.map((p) => (
              <OrderListRow
                key={p.id}
                pedido={p}
                selected={selectedId === p.id}
                onClick={() => setSelectedId(p.id)}
              />
            ))
          )}
        </div>

        <div>
          {selected ? (
            <DetallePedido
              pedido={selected}
              onAprobar={handleAprobar}
              onRechazar={handleRechazar}
            />
          ) : (
            <EmptyState
              icon={MousePointerClick}
              title="Selecciona un pedido"
              description="Elige un pedido de la lista para ver sus detalles y tomar accion."
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default function PendientesPage() {
  return (
    <PedidosProvider>
      <PendientesContent />
    </PedidosProvider>
  );
}