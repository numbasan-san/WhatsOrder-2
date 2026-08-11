import { LucideIcon } from 'lucide-react';

const TONES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-600',
  amber: 'bg-amber-100 text-amber-600',
  emerald: 'bg-emerald-100 text-emerald-600',
  rose: 'bg-rose-100 text-rose-600',
  brand: 'bg-brand-100 text-brand-700',
};

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone?: keyof typeof TONES;
}

export default function StatCard({ icon: Icon, label, value, tone = 'slate' }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-100 transition hover:shadow-card-hover dark:bg-slate-800 dark:shadow-card-dark dark:ring-slate-700 dark:hover:shadow-card-hover-dark">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONES[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
        <p className="whitespace-nowrap text-lg font-bold leading-tight text-slate-900 dark:text-slate-100 xl:text-xl">{value}</p>
      </div>
    </div>
  );
}