'use client';

interface WeeklyBarChartProps {
  labels: string[];
  values: number[];
  weekendIndexes?: number[];
}

export default function WeeklyBarChart({ labels, values, weekendIndexes = [5, 6] }: WeeklyBarChartProps) {
  const max = Math.max(...values, 1);

  return (
    <div className="flex h-40 items-end gap-2.5 sm:gap-3">
      {labels.map((label, index) => {
        const heightPct = (values[index] / max) * 100;
        const isWeekend = weekendIndexes.includes(index);
        return (
          <div key={label} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end overflow-hidden rounded-md bg-slate-50">
              <div
                className={`w-full rounded-t-md transition-all duration-500 ${
                  isWeekend ? 'bg-slate-300' : 'bg-gradient-to-t from-brand-600 to-brand-400'
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
            <span className="text-[11px] font-medium text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}