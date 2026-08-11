'use client';

import { createContext, useCallback, useContext, useMemo, useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { TelegramAdapter } from '@/lib/adapters/telegram-adapter';
import { useAuth } from '@/context/AuthContext';

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
  const { user } = useAuth(); // Obtener el usuario autenticado

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

      console.log(`📦 Total de pedidos: ${data?.length || 0}`);

      if (!data || data.length === 0) {
        setPedidos([]);
        setLoading(false);
        return;
      }

      const mappedPedidos = data.map((p: any) => {
        let items = p.items;
        if (typeof p.items === 'string') {
          try {
            items = JSON.parse(p.items);
          } catch (e) {
            console.warn('Error parseando items para pedido:', p.id);
            items = [];
          }
        }

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
            instructions: p.delivery_instructions || p.notes || '',
          },
          items: Array.isArray(items) ? items.map((item: any) => ({
            product: item.product || item.name || item.id || 'Producto sin nombre',
            quantity: item.quantity || 0,
            subtotal: item.subtotal || (item.price * item.quantity) || 0,
          })) : [],
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

      console.log('✅ Pedidos mapeados:', mappedPedidos.length);
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
      console.log('🔍 === INICIANDO APROBACIÓN ===');
      console.log('📝 ID del pedido:', id);

      // Verificar que el usuario está autenticado
      if (!user) {
        console.error('❌ Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      // 1. Primero, verificar que el pedido existe
      const { data: existingOrder, error: checkError } = await supabase
        .from('pedidos')
        .select('id, status')
        .eq('id', id)
        .single();

      if (checkError) {
        console.error('❌ Error verificando pedido:', checkError);
        throw checkError;
      }

      if (!existingOrder) {
        console.error('❌ Pedido no encontrado:', id);
        throw new Error('Pedido no encontrado');
      }

      console.log('📊 Pedido encontrado, estado actual:', existingOrder.status);

      // 2. Actualizar el estado usando el UUID del usuario
      const updateData = {
        status: 'approved',
        approved_by: user.id, // Usar el UUID del usuario autenticado
        approved_at: new Date().toISOString(),
      };
      console.log('📝 Datos a actualizar:', updateData);

      // 3. Ejecutar la actualización
      const { error: updateError } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error al actualizar:', updateError);
        throw updateError;
      }

      console.log('✅ Pedido actualizado correctamente');

      // 4. Verificar que se actualizó
      const { data: updatedOrder, error: verifyError } = await supabase
        .from('pedidos')
        .select('id, status, approved_by')
        .eq('id', id)
        .single();

      if (verifyError) {
        console.error('❌ Error verificando actualización:', verifyError);
      } else {
        console.log('✅ Verificación - Nuevo estado:', updatedOrder?.status, 'Aprobado por:', updatedOrder?.approved_by);
      }

      // 5. Recargar pedidos
      await loadPedidos();

      console.log('✅ === APROBACIÓN COMPLETADA ===');
    } catch (error) {
      console.error('❌ Error en aprobarPedido:', error);
      throw error;
    }
  }, [supabase, loadPedidos, user]);

  const rechazarPedido = useCallback(async (id: string, motivo: string) => {
    try {
      console.log(`❌ Rechazando pedido ${id}...`);
      console.log(`📝 Motivo: ${motivo}`);

      // Verificar que el usuario está autenticado
      if (!user) {
        console.error('❌ Usuario no autenticado');
        throw new Error('Usuario no autenticado');
      }

      // 1. Verificar que el pedido existe
      const { data: existingOrder, error: checkError } = await supabase
        .from('pedidos')
        .select('id, status, customer_phone, customer_name, items, total, source')
        .eq('id', id)
        .single();

      if (checkError) {
        console.error('❌ Error verificando pedido:', checkError);
        throw checkError;
      }

      if (!existingOrder) {
        console.error('❌ Pedido no encontrado:', id);
        throw new Error('Pedido no encontrado');
      }

      console.log('📊 Pedido encontrado:', existingOrder);

      // 2. Actualizar el estado usando el UUID del usuario
      const updateData = {
        status: 'rejected',
        rejected_by: user.id, // Usar el UUID del usuario autenticado
        rejected_at: new Date().toISOString(),
        rejection_reason: motivo,
        notes: motivo,
      };

      const { error: updateError } = await supabase
        .from('pedidos')
        .update(updateData)
        .eq('id', id);

      if (updateError) {
        console.error('❌ Error al actualizar:', updateError);
        throw updateError;
      }

      console.log('❌ Pedido rechazado correctamente');

      // 3. Recargar pedidos
      await loadPedidos();

      // 4. Enviar notificación por Telegram si es necesario
      if (existingOrder?.source === 'telegram') {
        try {
          const telegram = new TelegramAdapter();
          const message = `❌ Pedido #${id.slice(0, 8)} RECHAZADO\n\n` +
            `📋 Detalles:\n` +
            `👤 Cliente: ${existingOrder.customer_name || 'Cliente'}\n` +
            `📝 Motivo: ${motivo}\n\n` +
            `🔄 Por favor, contacta a soporte para más información.`;

          await telegram.sendSimpleMessage(
            existingOrder.customer_phone,
            message
          );
        } catch (telegramError) {
          console.warn('⚠️ Error enviando notificación Telegram:', telegramError);
        }
      }
    } catch (error) {
      console.error('❌ Error rechazando pedido:', error);
      throw error;
    }
  }, [supabase, loadPedidos, user]);

  const agregarPedido = useCallback(async (datos: any) => {
    try {
      console.log('Agregando nuevo pedido...');

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
        created_by: user?.id || null, // Usar UUID del usuario o null
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('pedidos').insert(nuevoPedido);

      if (error) {
        console.error('Error en insert:', error);
        throw error;
      }

      console.log('Pedido agregado correctamente');
      await loadPedidos();
    } catch (error) {
      console.error('Error agregando pedido:', error);
    }
  }, [supabase, loadPedidos, user]);

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