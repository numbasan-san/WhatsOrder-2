import { CheckCircle2, Clock, XCircle, Ban, LucideIcon } from 'lucide-react';
import type { OrderStatus } from '@/lib/types';

const CONFIG: Record<OrderStatus, { label: string; className: string; Icon: LucideIcon }> = {
  pending_confirmation: {
    label: 'Por confirmar',
    className: 'bg-sky-50 text-sky-700 ring-sky-600/20',
    Icon: Clock,
  },
  pending: {
    label: 'Pendiente',
    className: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    Icon: Clock,
  },
  approved: {
    label: 'Aprobado',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    Icon: CheckCircle2,
  },
  rejected: {
    label: 'Rechazado',
    className: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    Icon: XCircle,
  },
  cancelled: {
    label: 'Cancelado',
    className: 'bg-slate-100 text-slate-500 ring-slate-300/40',
    Icon: Ban,
  },
};

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const cfg = CONFIG[status] || CONFIG.pending;
  const { Icon } = cfg;
  const sizeClasses = size === 'sm' ? 'text-xs px-2 py-0.5 gap-1' : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ring-1 ring-inset whitespace-nowrap ${sizeClasses} ${cfg.className}`}
    >
      <Icon className={size === 'sm' ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
      {cfg.label}
    </span>
  );
}