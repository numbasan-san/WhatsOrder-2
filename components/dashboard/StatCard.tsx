import { LucideIcon } from 'lucide-react';

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  amber: 'bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  rose: 'bg-rose-100 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400',
  brand: 'bg-brand-100 text-brand-700 dark:bg-brand-950/40 dark:text-brand-400',
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: keyof typeof TONES;
}

export default function StatCard({ icon: Icon, label, value, tone = 'slate' }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white dark:bg-slate-800 p-4 shadow-card dark:shadow-card-dark ring-1 ring-slate-100 dark:ring-slate-700 transition hover:shadow-card-hover dark:hover:shadow-card-hover-dark">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="whitespace-nowrap text-lg font-bold leading-tight text-slate-900 dark:text-white xl:text-xl">{value}</p>
      </div>
    </div>
  );
}