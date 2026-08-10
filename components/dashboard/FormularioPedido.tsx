'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from './Modal';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils/format';
import type { Producto } from '@/lib/types';
import type { ManualOrderInput } from '@/context/PedidosContext';

const EMPTY_ITEM = { sku: '', quantity: 1 };

const initialForm = {
  customer_name: '',
  customer_phone: '',
  delivery_address: '',
  items: [{ ...EMPTY_ITEM }],
};

interface FormularioPedidoProps {
  open: boolean;
  onClose: () => void;
  onAgregar: (datos: ManualOrderInput) => Promise<void>;
}

export default function FormularioPedido({ open, onClose, onAgregar }: FormularioPedidoProps) {
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [catalogo, setCatalogo] = useState<Producto[]>([]);
  const [catalogoLoading, setCatalogoLoading] = useState(false);

  useEffect(() => {
    if (!open || catalogo.length > 0) return;
    let active = true;
    setCatalogoLoading(true);
    const supabase = createClient();

    const load = async () => {
      const { data, error: fetchError } = await supabase
        .from('productos')
        .select('*')
        .eq('active', true)
        .order('name', { ascending: true });
      if (!active) return;
      if (!fetchError && data) setCatalogo(data as Producto[]);
      setCatalogoLoading(false);
    };
    load();

    return () => {
      active = false;
    };
  }, [open, catalogo.length]);

  const precioPorSku = (sku: string) => catalogo.find((p) => p.sku === sku)?.price ?? 0;
  const nombrePorSku = (sku: string) => catalogo.find((p) => p.sku === sku)?.name ?? '';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleItemChange = (index: number, field: 'sku' | 'quantity', value: string) => {
    const items = form.items.map((it, i) => (i === index ? { ...it, [field]: value } : it));
    setForm({ ...form, items });
  };

  const addItemRow = () => setForm({ ...form, items: [...form.items, { ...EMPTY_ITEM }] });
  const removeItemRow = (index: number) => setForm({ ...form, items: form.items.filter((_, i) => i !== index) });

  const itemsValidos = form.items.filter((i) => i.sku && Number(i.quantity) > 0);
  const total = itemsValidos.reduce((sum, i) => sum + precioPorSku(i.sku) * Number(i.quantity), 0);

  const resetAndClose = () => {
    setForm(initialForm);
    setError('');
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim() || !form.customer_phone.trim()) {
      setError('Nombre y teléfono son obligatorios.');
      return;
    }
    if (itemsValidos.length === 0) {
      setError('Agrega al menos un producto con cantidad válida.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await onAgregar({
        customer_name: form.customer_name.trim(),
        customer_phone: form.customer_phone.trim(),
        delivery_address: form.delivery_address.trim(),
        items: itemsValidos.map((i) => ({ sku: i.sku, quantity: Number(i.quantity) })),
      });
      resetAndClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creando pedido');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={resetAndClose} title="Nuevo pedido" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Nombre del cliente *</label>
            <input
              type="text"
              name="customer_name"
              value={form.customer_name}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="Ej. María Rodríguez"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">Teléfono *</label>
            <input
              type="text"
              name="customer_phone"
              value={form.customer_phone}
              onChange={handleChange}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
              placeholder="809-555-1234"
            />
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-slate-500">Dirección de entrega</label>
          <input
            type="text"
            name="delivery_address"
            value={form.delivery_address}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
            placeholder="Calle, número, sector"
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500">Productos</span>
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800"
            >
              <Plus className="h-3.5 w-3.5" /> Agregar producto
            </button>
          </div>

          <div className="space-y-2">
            {form.items.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={item.sku}
                  onChange={(e) => handleItemChange(idx, 'sku', e.target.value)}
                  disabled={catalogoLoading}
                  className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                >
                  <option value="">{catalogoLoading ? 'Cargando catálogo…' : 'Seleccionar producto'}</option>
                  {catalogo.map((p) => (
                    <option key={p.sku} value={p.sku}>
                      {p.name} — {formatCurrency(p.price)}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                  className="w-16 rounded-lg border border-slate-200 px-2 py-2 text-center text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
                />
                {form.items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {itemsValidos.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-400">
              {itemsValidos.map((i, idx) => (
                <li key={idx}>
                  {i.quantity}× {nombrePorSku(i.sku)} — {formatCurrency(precioPorSku(i.sku) * Number(i.quantity))}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <span className="text-sm font-medium text-slate-500">Total estimado</span>
          <span className="text-lg font-bold text-slate-900">{formatCurrency(total)}</span>
        </div>

        {error && (
          <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600 ring-1 ring-inset ring-rose-100">
            {error}
          </p>
        )}

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creando…' : 'Crear pedido'}
          </button>
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-lg bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-200"
          >
            Cancelar
          </button>
        </div>
      </form>
    </Modal>
  );
}
