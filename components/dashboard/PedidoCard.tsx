'use client';

import { useState } from 'react';
import { CheckCircle2, Phone, XCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';
import RejectReasonModal from './RejectReasonModal';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Pedido } from '@/lib/types';

interface PedidoCardProps {
  pedido: Pedido;
  onAprobar?: (id: string) => Promise<void>;
  onRechazar?: (id: string, motivo: string) => Promise<void>;
}

export default function PedidoCard({ pedido, onAprobar, onRechazar }: PedidoCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const canAct = pedido.status === 'pending' && onAprobar && onRechazar;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-slate-700 dark:bg-slate-800 dark:shadow-card-dark dark:hover:shadow-card-hover-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{pedido.customer_name || 'Cliente sin nombre'}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Phone className="h-3 w-3" /> {pedido.customer_phone || '—'}
          </p>
        </div>
        <StatusBadge status={pedido.status} size="sm" />
      </div>

      <div className="mt-2.5 space-y-0.5 border-t border-slate-50 pt-2.5 dark:border-slate-700">
        {pedido.items.slice(0, 2).map((item, idx) => (
          <p key={idx} className="truncate text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">{item.quantity}×</span> {item.product}
          </p>
        ))}
        {pedido.items.length > 2 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">+{pedido.items.length - 2} más</p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 pt-2.5 dark:border-slate-700">
        <span className="text-sm font-bold text-brand-800 dark:text-brand-300">{formatCurrency(pedido.total)}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(pedido.created_at)}</span>
      </div>

      {/*canAct && (
        <div className="mt-2.5 flex gap-2 border-t border-slate-50 pt-2.5">
          <button
            type="button"
            onClick={() => onAprobar(pedido.id)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-emerald-50 py-1.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
          </button>
          <button
            type="button"
            onClick={() => setRejectOpen(true)}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-rose-50 py-1.5 text-xs font-semibold text-rose-600 ring-1 ring-inset ring-rose-200 transition hover:bg-rose-100"
          >
            <XCircle className="h-3.5 w-3.5" /> Rechazar
          </button>
        </div>
      )*/}

      <RejectReasonModal
        open={rejectOpen}
        onClose={() => setRejectOpen(false)}
        customerName={pedido.customer_name || 'Cliente sin nombre'}
        onConfirm={(motivo) => {
          onRechazar?.(pedido.id, motivo).catch(() => {});
          setRejectOpen(false);
        }}
      />
    </div>
  );
}