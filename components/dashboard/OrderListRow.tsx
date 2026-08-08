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
          ? 'border-brand-500/40 bg-brand-50/70 ring-1 ring-brand-500/30'
          : 'border-transparent bg-white hover:border-slate-200 hover:bg-slate-50'
      } shadow-sm`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">{pedido.customer.name}</p>
          <p className="truncate text-xs text-slate-400">{pedido.customer.phone}</p>
        </div>
        <span className="shrink-0 text-sm font-bold text-brand-800">{formatCurrency(pedido.total)}</span>
      </div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-slate-400">{formatDateTime(pedido.created_at)}</span>
        {rightSlot}
      </div>
    </button>
  );
}