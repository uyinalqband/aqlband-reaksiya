export function formatMs(timeMs: number): string {
  return Math.round(timeMs).toLocaleString('en-US');
}

export function averageMs(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
