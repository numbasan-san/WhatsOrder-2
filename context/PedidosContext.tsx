'use client';

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { DeliveryStatus, Pedido } from '@/lib/types';

export interface ManualOrderInput {
  customer_name: string;
  customer_phone: string;
  delivery_address: string;
  items: { sku: string; quantity: number }[];
}

export interface AsignarEntregaInput {
  assigned_to: string;
  delivery_status: DeliveryStatus;
  delivery_eta: string | null;
}

interface PedidosContextType {
  pedidos: Pedido[];
  loading: boolean;
  error: string | null;
  aprobarPedido: (id: string) => Promise<void>;
  rechazarPedido: (id: string, motivo: string) => Promise<void>;
  asignarEntrega: (id: string, input: AsignarEntregaInput) => Promise<void>;
  agregarPedido: (datos: ManualOrderInput) => Promise<void>;
  refreshPedidos: () => Promise<void>;
}

const PedidosContext = createContext<PedidosContextType | null>(null);

async function extractError(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    if (typeof body?.error === 'string') return body.error;
  } catch {
    // response wasn't JSON — fall through to the generic message
  }
  return fallback;
}

export function PedidosProvider({ children }: { children: React.ReactNode }) {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  const loadPedidos = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error: readError } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (readError) throw readError;

      const mapped: Pedido[] = (data ?? []).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        customer_name: (p.customer_name as string | null) ?? null,
        customer_phone: (p.customer_phone as string | null) ?? null,
        telegram_chat_id: (p.telegram_chat_id as string | null) ?? null,
        customer_email: (p.customer_email as string | null) ?? null,
        customer_cedula: (p.customer_cedula as string | null) ?? null,
        items: (p.items as Pedido['items']) ?? [],
        total: (p.total as number) ?? 0,
        status: p.status as Pedido['status'],
        source: (p.source as string | null) ?? null,
        delivery_address: (p.delivery_address as string | null) ?? null,
        delivery_city: (p.delivery_city as string | null) ?? null,
        delivery_zone: (p.delivery_zone as string | null) ?? null,
        delivery_instructions: (p.delivery_instructions as string | null) ?? null,
        delivery_assigned_to: (p.delivery_assigned_to as string | null) ?? null,
        delivery_status: (p.delivery_status as DeliveryStatus) ?? null,
        delivery_eta: (p.delivery_eta as string | null) ?? null,
        notes: (p.notes as string | null) ?? null,
        created_by: (p.created_by as string | null) ?? null,
        created_at: p.created_at as string,
        confirmed_at: (p.confirmed_at as string | null) ?? null,
        approved_by: (p.approved_by as string | null) ?? null,
        approved_at: (p.approved_at as string | null) ?? null,
        rejected_by: (p.rejected_by as string | null) ?? null,
        rejected_at: (p.rejected_at as string | null) ?? null,
        rejection_reason: (p.rejection_reason as string | null) ?? null,
      }));

      setPedidos(mapped);
    } catch (error) {
      console.error('Error loading pedidos:', error);
      setPedidos([]);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const aprobarPedido = useCallback(async (id: string) => {
    let res: Response;
    try {
      res = await fetch(`/api/orders/${id}/approve`, { method: 'POST' });
    } catch {
      const message = 'Error de red aprobando pedido';
      setError(message);
      throw new Error(message);
    }
    if (!res.ok) {
      const message = await extractError(res, 'Error aprobando pedido');
      setError(message);
      throw new Error(message);
    }
    setError(null);
    await loadPedidos();
  }, [loadPedidos]);

  const rechazarPedido = useCallback(async (id: string, motivo: string) => {
    let res: Response;
    try {
      res = await fetch(`/api/orders/${id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: motivo }),
      });
    } catch {
      const message = 'Error de red rechazando pedido';
      setError(message);
      throw new Error(message);
    }
    if (!res.ok) {
      const message = await extractError(res, 'Error rechazando pedido');
      setError(message);
      throw new Error(message);
    }
    setError(null);
    await loadPedidos();
  }, [loadPedidos]);

  const asignarEntrega = useCallback(async (id: string, input: AsignarEntregaInput) => {
    let res: Response;
    try {
      res = await fetch(`/api/orders/${id}/delivery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
    } catch {
      const message = 'Error de red asignando entrega';
      setError(message);
      throw new Error(message);
    }
    if (!res.ok) {
      const message = await extractError(res, 'Error asignando entrega');
      setError(message);
      throw new Error(message);
    }
    setError(null);
    await loadPedidos();
  }, [loadPedidos]);

  const agregarPedido = useCallback(async (datos: ManualOrderInput) => {
    let res: Response;
    try {
      res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      });
    } catch {
      const message = 'Error de red creando pedido';
      setError(message);
      throw new Error(message);
    }
    if (!res.ok) {
      const message = await extractError(res, 'Error creando pedido');
      setError(message);
      throw new Error(message);
    }
    setError(null);
    await loadPedidos();
  }, [loadPedidos]);

  const refreshPedidos = useCallback(async () => {
    await loadPedidos();
  }, [loadPedidos]);

  const value = useMemo(
    () => ({
      pedidos,
      loading,
      error,
      aprobarPedido,
      rechazarPedido,
      asignarEntrega,
      agregarPedido,
      refreshPedidos,
    }),
    [pedidos, loading, error, aprobarPedido, rechazarPedido, asignarEntrega, agregarPedido, refreshPedidos]
  );

  return <PedidosContext.Provider value={value}>{children}</PedidosContext.Provider>;
}

export function usePedidos() {
  const ctx = useContext(PedidosContext);
  if (!ctx) throw new Error('usePedidos debe usarse dentro de <PedidosProvider>');
  return ctx;
}
