'use client';

import { useState } from 'react';
import { CheckCircle2, Phone, XCircle } from 'lucide-react';
import StatusBadge from './StatusBadge';
import RejectReasonModal from './RejectReasonModal';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Pedido } from '@/types';

interface PedidoCardProps {
  pedido: Pedido;
  onAprobar?: (id: string) => void;
  onRechazar?: (id: string, motivo: string) => void;
}

export default function PedidoCard({ pedido, onAprobar, onRechazar }: PedidoCardProps) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const canAct = pedido.status === 'pending' && onAprobar && onRechazar;

  return (
    <div className="rounded-xl border border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-card-hover dark:hover:shadow-card-hover-dark">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{pedido.customer.name}</p>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
            <Phone className="h-3 w-3" /> {pedido.customer.phone}
          </p>
        </div>
        <StatusBadge status={pedido.status} size="sm" />
      </div>

      <div className="mt-2.5 space-y-0.5 border-t border-slate-50 dark:border-slate-700 pt-2.5">
        {pedido.items.slice(0, 2).map((item, idx) => (
          <p key={idx} className="truncate text-xs text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-600 dark:text-slate-300">{item.quantity}×</span> {item.product}
          </p>
        ))}
        {pedido.items.length > 2 && (
          <p className="text-xs text-slate-400 dark:text-slate-500">+{pedido.items.length - 2} más</p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between border-t border-slate-50 dark:border-slate-700 pt-2.5">
        <span className="text-sm font-bold text-brand-800 dark:text-brand-400">{formatCurrency(pedido.total)}</span>
        <span className="text-[11px] text-slate-400 dark:text-slate-500">{formatDateTime(pedido.created_at)}</span>
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