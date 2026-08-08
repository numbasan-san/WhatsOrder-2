export function formatCurrency(amount: number): string {
  const value = Number(amount) || 0;
  return `RD$ ${value.toLocaleString('es-DO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDateTime(iso: string, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-DO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    ...opts,
  });
}

export function formatLongDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('es-DO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}