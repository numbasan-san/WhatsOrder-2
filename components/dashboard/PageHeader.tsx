interface PageHeaderProps {
  title: string;
  subtitle?: string;
  count?: number;
  countLabel?: string;
  children?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, count, countLabel = 'registros', children }: PageHeaderProps) {
  return (
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {typeof count === 'number' && (
          <span className="inline-flex items-center rounded-full bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
            {count} {countLabel}
          </span>
        )}
        {children}
      </div>
    </header>
  );
} 