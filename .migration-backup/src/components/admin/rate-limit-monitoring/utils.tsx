export function formatWindowMinutes(windowMs: number): number {
  if (!Number.isFinite(windowMs) || windowMs <= 0) {
    return 0;
  }
  return Math.round(windowMs / 60000);
}

export function formatDateTime(value: string | null): string {
  if (!value) {
    return 'No expiry';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date';
  }
  return date.toLocaleString();
}

export function toDateTimeLocalInput(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function formatNumber(num: number): string {
  if (!Number.isFinite(num)) {
    return '0';
  }
  return new Intl.NumberFormat().format(num);
}

export function formatPercentage(num: number): string {
  if (!Number.isFinite(num)) {
    return '0%';
  }
  return `${num.toFixed(1)}%`;
}