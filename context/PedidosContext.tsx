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
      console.log('🔄 Cargando pedidos desde Supabase...');

      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error en la consulta:', error);
        throw error;
      }

      console.log('✅ Datos recibidos:', data);
      console.log(`📦 Total de pedidos: ${data?.length || 0}`);

      if (!data || data.length === 0) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      // Mapear los datos correctamente
      const mappedPedidos = data.map((p: any) => {
        // Transformar items: de {id, price, quantity, subtotal} a {product, quantity, subtotal}
        const mappedItems = (p.items || []).map((item: any) => ({
          product: item.id || item.product || 'Producto sin nombre', // ← Cambio clave: "id" → "product"
          quantity: item.quantity || 0,
          subtotal: item.subtotal || item.price * item.quantity || 0,
        }));

        return {
          id: p.id,
          customer: {
            name: p.customer_name || 'Cliente sin nombre',
            phone: p.customer_phone || '',
            email: p.customer_email || null,
            cedula: p.customer_cedula || null,
          },
          delivery: {
            address: p.delivery_address || 'Sin dirección',
            city: p.delivery_city || 'Santo Domingo',
            zone: p.delivery_zone || 'Zona sin asignar',
            instructions: p.delivery_instructions || p.notes || '',
          },
          items: mappedItems, // ← Items transformados
          total: p.total || 0,
          status: p.status || 'pending',
          created_by: p.created_by || 'Sistema',
          created_at: p.created_at || new Date().toISOString(),
          approved_by: p.approved_by || null,
          approved_at: p.approved_at || null,
          rejected_by: p.rejected_by || null,
          rejected_at: p.rejected_at || null,
          rejection_reason: p.rejection_reason || null,
          delivery_assigned_to: p.delivery_assigned_to || null,
          delivery_status: p.delivery_status || null,
          delivery_eta: p.delivery_eta || null,
          source: p.source || 'telegram',
          notes: p.notes || null,
        };
      });

      console.log('✅ Pedidos mapeados:', mappedPedidos);
      setPedidos(mappedPedidos);
    } catch (error) {
      console.error('❌ Error cargando pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadPedidos();
  }, [loadPedidos]);

  const aprobarPedido = useCallback(async (id: string) => {
    try {
      console.log(`✅ Aprobando pedido ${id}...`);
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'approved',
          approved_by: 'CSR-Admin',
          approved_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      console.log('✅ Pedido aprobado');
      await loadPedidos();
    } catch (error) {
      console.error('❌ Error aprobando pedido:', error);
    }
  }, [supabase, loadPedidos]);

  const rechazarPedido = useCallback(async (id: string, motivo: string) => {
    try {
      console.log(`❌ Rechazando pedido ${id}...`);
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
      console.log('✅ Pedido rechazado');
      await loadPedidos();
    } catch (error) {
      console.error('❌ Error rechazando pedido:', error);
    }
  }, [supabase, loadPedidos]);

  const agregarPedido = useCallback(async (datos: any) => {
    try {
      console.log('📝 Agregando nuevo pedido...');
      console.log('📝 Datos recibidos:', datos);

      const items = datos.items.map((i: any) => ({
        product: i.product,
        quantity: Number(i.quantity),
        subtotal: (i.price || 0) * Number(i.quantity) || 0,
      }));

      const total = items.reduce((sum: number, i: any) => sum + (i.subtotal || 0), 0);

      const nuevoPedido = {
        customer_name: datos.customer_name,
        customer_phone: datos.customer_phone,
        delivery_address: datos.delivery_address || 'Sin dirección',
        items: items,
        total: total,
        status: 'pending',
        source: 'dashboard',
        notes: datos.delivery_instructions || '',
        created_by: 'CSR-Admin',
        created_at: new Date().toISOString(),
      };

      console.log('📝 Insertando en Supabase:', nuevoPedido);

      const { error } = await supabase
        .from('pedidos')
        .insert(nuevoPedido);

      if (error) {
        console.error('❌ Error en insert:', error);
        throw error;
      }

      console.log('✅ Pedido agregado correctamente');
      await loadPedidos();
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