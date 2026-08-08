'use client';

interface WeeklyLineChartProps {
  labels: string[];
  values: number[];
}

export default function WeeklyLineChart({ labels, values }: WeeklyLineChartProps) {
  const max = Math.max(...values, 1);
  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * 280 + 10;
    const y = 108 - (v / max) * 84;
    return [x, y];
  });
  const linePath = points.map(([x, y]) => `${x},${y}`).join(' ');
  const areaPath = `M${points[0][0]},110 L${linePath.split(' ').join(' L')} L${points[points.length - 1][0]},110 Z`;

  return (
    <svg viewBox="0 0 300 130" className="h-40 w-full">
      <defs>
        <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#25D366" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#25D366" stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="10" y1="110" x2="290" y2="110" stroke="#e2e8f0" strokeWidth="1" />
      <path d={areaPath} fill="url(#lineFill)" />
      <polyline points={linePath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="3.5" fill="#16a34a" stroke="white" strokeWidth="2" />
      ))}
      {labels.map((label, i) => {
        const x = (i / (labels.length - 1)) * 280 + 10;
        return (
          <text key={label} x={x} y="126" fontSize="9.5" fill="#94a3b8" textAnchor="middle">
            {label}
          </text>
        );
      })}
    </svg>
  );
}