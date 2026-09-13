const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export function formatConsistencyPercent(index: number | null): string {
  return index === null ? '—' : percentFormatter.format(index);
}
