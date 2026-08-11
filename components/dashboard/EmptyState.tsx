import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
}

export default function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center dark:border-slate-700 dark:bg-slate-800/40">
      {Icon && (
        <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-600 dark:ring-slate-700">
          <Icon className="h-5 w-5" />
        </div>
      )}
      <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{title}</p>
      {description && <p className="max-w-xs text-xs text-slate-400 dark:text-slate-500">{description}</p>}
    </div>
  );
}