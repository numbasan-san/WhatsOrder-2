'use client';

import { useState } from 'react';
import { CheckCircle2, MapPin, Phone, User, XCircle, Mail, IdCard, StickyNote } from 'lucide-react';
import StatusBadge from './StatusBadge';
import RejectReasonModal from './RejectReasonModal';
import { formatCurrency, formatLongDate } from '@/lib/utils/format';
import { Pedido } from '@/types';

function Field({ icon: Icon, label, value }: any) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</p>
        <p className="truncate text-sm font-medium text-slate-700 dark:text-slate-300">{value}</p>
      </div>
    </div>
  );
}

interface DetallePedidoProps {
  pedido: Pedido;
  onAprobar?: (id: string) => void;
  onRechazar?: (id: string, motivo: string) => void;
}

export default function DetallePedido({ pedido, onAprobar, onRechazar }: DetallePedidoProps) {
  const [rejectOpen, setRejectOpen] = useState(false);

  return (
    <div className="animate-fade-in rounded-2xl bg-white dark:bg-slate-800 p-5 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-700 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pedido #{pedido.id}</h2>
          <p className="text-xs text-slate-400 dark:text-slate-500">{formatLongDate(pedido.created_at)}</p>
        </div>
        <StatusBadge status={pedido.status} />
      </div>

      <div className="grid gap-6 py-5 sm:grid-cols-2">
        <div className="space-y-3.5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Cliente</h3>
          <Field icon={User} label="Nombre" value={pedido.customer.name} />
          <Field icon={Phone} label="Teléfono" value={pedido.customer.phone} />
          <Field icon={Mail} label="Email" value={pedido.customer.email} />
          <Field icon={IdCard} label="Cédula" value={pedido.customer.cedula} />

          {pedido.status === 'rejected' && (
            <div className="mt-2 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/30 p-3">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-rose-500 dark:text-rose-400">
                <XCircle className="h-3.5 w-3.5" /> Razón de rechazo
              </p>
              <p className="mt-1 text-sm text-rose-700 dark:text-rose-300">
                {pedido.rejection_reason || 'Producto sin stock disponible en la sucursal solicitada.'}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Productos</h3>
          <div className="divide-y divide-slate-50 dark:divide-slate-700 rounded-lg border border-slate-100 dark:border-slate-700">
            {pedido.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="text-slate-600 dark:text-slate-400">
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{item.quantity}×</span> {item.product}
                </span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{formatCurrency(item.subtotal || 0)}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-900 dark:bg-slate-950 px-4 py-3">
            <span className="text-sm font-medium text-slate-300">Total</span>
            <span className="text-lg font-bold text-white">{formatCurrency(pedido.total)}</span>
          </div>

          {pedido.status === 'pending' && onAprobar && onRechazar && (
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => onAprobar(pedido.id)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" /> Aprobar
              </button>
              <button
                type="button"
                onClick={() => setRejectOpen(true)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 px-4 py-2.5 text-sm font-semibold text-rose-600 dark:text-rose-400 ring-1 ring-inset ring-rose-200 dark:ring-rose-500/30 transition hover:bg-rose-100 dark:hover:bg-rose-950/60"
              >
                <XCircle className="h-4 w-4" /> Rechazar
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
          <MapPin className="h-3.5 w-3.5" /> Ubicación de entrega
        </h3>
        <div className="grid gap-4 sm:grid-cols-[1.1fr,1fr]">
          <div className="overflow-hidden rounded-xl bg-slate-50 dark:bg-slate-900 ring-1 ring-slate-100 dark:ring-slate-700">
            <svg viewBox="0 0 400 220" className="h-full w-full">
              <rect width="400" height="220" fill="#f1f5f9" className="dark:fill-slate-900" />
              <g stroke="#e2e8f0" className="dark:stroke-slate-700" strokeWidth="2">
                <line x1="70" y1="0" x2="70" y2="220" />
                <line x1="180" y1="0" x2="180" y2="220" />
                <line x1="300" y1="0" x2="300" y2="220" />
                <line x1="0" y1="70" x2="400" y2="70" />
                <line x1="0" y1="150" x2="400" y2="150" />
              </g>
              <circle cx="200" cy="110" r="22" fill="#25D366" opacity="0.15" />
              <circle cx="200" cy="110" r="9" fill="#16a34a" />
              <circle cx="200" cy="110" r="9" fill="none" stroke="#16a34a" strokeWidth="1.5" opacity="0.5">
                <animate attributeName="r" values="9;20;9" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2.4s" repeatCount="indefinite" />
              </circle>
              <text x="200" y="140" fontSize="11" fontWeight="600" fill="#334155" className="dark:fill-slate-300" textAnchor="middle">
                {pedido.delivery?.zone || 'Zona sin asignar'}
              </text>
            </svg>
          </div>
          <div className="space-y-2.5 text-sm">
            <Field icon={MapPin} label="Dirección" value={pedido.delivery?.address} />
            <Field icon={StickyNote} label="Referencia / instrucciones" value={pedido.delivery?.instructions} />
            <Field icon={MapPin} label="Zona" value={pedido.delivery?.zone} />
          </div>
        </div>
      </div>

      <RejectReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        customerName={pedido.customer.name}
        onConfirm={(motivo) => {
          onRechazar?.(pedido.id, motivo);
          setRejectOpen(false);
        }}
      />
    </div>
  );
}