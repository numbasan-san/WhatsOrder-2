'use client';

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface PedidosContextType {
  pedidos: any[];
  loading: boolean;
  aprobarPedido: (id: string) => Promise<void>;
  rechazarPedido: (id: string, motivo: string) => Promise<void>;
  agregarPedido: (datos: any) => Promise<void>;
  refreshPedidos: () => Promise<void>;
}

const PedidosContext = createContext<PedidosContextType | null>(null);

export function PedidosProvider({ children }: { children: React.ReactNode }) {
  const [pedidos, setPedidos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      // Mapear los datos
      const mappedPedidos = data.map((p: any) => ({
        id: p.id,
        customer: {
          name: p.customer_name || 'Cliente sin nombre',
          phone: p.customer_phone || '',
          email: null,
          cedula: null,
        },
        delivery: {
          address: p.delivery_address || 'Sin dirección',
          city: 'Santo Domingo',
          zone: 'Zona sin asignar',
          instructions: p.notes || '',
        },
        items: p.items || [],
        total: p.total || 0,
        status: p.status || 'pending',
        created_by: p.created_by || 'Sistema',
        created_at: p.created_at || new Date().toISOString(),
        approved_by: p.approved_by || null,
        approved_at: p.approved_at || null,
        rejected_by: null,
        rejected_at: null,
        rejection_reason: p.notes || null,
        delivery_assigned_to: null,
        delivery_status: null,
        delivery_eta: null,
        source: p.source || 'telegram',
        notes: p.notes || null,
      }));

      setPedidos(mappedPedidos);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const aprobarPedido = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'approved',
          approved_by: 'CSR-Admin',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      await loadPedidos();
    } catch (error) {
    }
  }, [supabase, loadPedidos]);

  const rechazarPedido = useCallback(async (id: string, motivo: string) => {
    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'rejected',
          notes: motivo,
          approved_by: 'CSR-Admin',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      await loadPedidos();
    } catch (error) {
      console.error('❌ Error rechazando pedido:', error);
    }
  }, [supabase, loadPedidos]);

  const agregarPedido = useCallback(async (datos: any) => {
    try {
      const items = datos.items.map((i: any) => ({
        product: i.product,
        quantity: Number(i.quantity),
        subtotal: i.subtotal || 0,
      }))
    } catch (error) {
      console.error('❌ Error agregando pedido:', error);
    }
  }, [supabase, loadPedidos]);

  const refreshPedidos = useCallback(async () => {
    await loadPedidos();
  }, [loadPedidos]);

  const value = useMemo(
    () => ({
      pedidos,
      loading,
      aprobarPedido,
      rechazarPedido,
      agregarPedido,
      refreshPedidos,
    }),
    [pedidos, loading, aprobarPedido, rechazarPedido, agregarPedido, refreshPedidos]
  );

  return <PedidosContext.Provider value={value}>{children}</PedidosContext.Provider>;
}

export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error('usePedidos debe usarse dentro de <PedidosProvider>');
  return ctx;
}