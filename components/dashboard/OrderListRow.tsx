import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Pedido } from '@/types';

interface OrderListRowProps {
  pedido: Pedido;
  selected: boolean;
  onClick: () => void;
  rightSlot?: React.ReactNode;
}

export default function OrderListRow({ pedido, selected, onClick, rightSlot }: OrderListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-xl border px-3.5 py-3 text-left transition ${
        selected
          ? 'border-brand-500/40 bg-brand-50/70 dark:bg-brand-950/40 ring-1 ring-brand-500/30'
          : 'border-transparent bg-white dark:bg-slate-800 hover:border-slate-200 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
      } shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{pedido.customer.name}</p>
          <p className="truncate text-xs text-slate-400 dark:text-slate-500">{pedido.customer.phone}</p>
        </div>
        <span className="shrink-0 text-sm font-bold text-brand-800 dark:text-brand-400">{formatCurrency(pedido.total)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400 dark:text-slate-500">{formatDateTime(pedido.created_at)}</span>
        {rightSlot}
      </div>
    </button>
  );
}