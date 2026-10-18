import type { Timeframe } from '../types.ts';

export function formatPrice(value: number): string {
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

export function formatVolume(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(2)}亿`;
  if (value >= 10_000) return `${(value / 10_000).toFixed(0)}万`;
  return Math.round(value).toString();
}

export function formatOsc(value: number): string {
  return value.toFixed(2);
}

export function formatRsi(value: number): string {
  return value.toFixed(1);
}

export function formatDateLabel(iso: string): string {
  const [date, time] = iso.split('T');
  const parts = date.split('-');
  if (parts.length < 3) return iso;
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (!time) return `${month}月${day}日`;
  const [hh, mm] = time.split(':');
  return `${month}月${day}日 ${hh}:${mm}`;
}

export function formatRangeLabel(fromIso: string, toIso: string, timeframe: Timeframe): string {
  if (fromIso === toIso) return formatDateLabel(fromIso);
  if (timeframe === 'I' && fromIso.slice(0, 10) === toIso.slice(0, 10)) {
    const start = fromIso.split('T')[1]?.slice(0, 5) ?? '';
    const end = toIso.split('T')[1]?.slice(0, 5) ?? '';
    return `${formatDateLabel(fromIso.slice(0, 10))} ${start}–${end}`;
  }
  return `${formatDateLabel(fromIso)} – ${formatDateLabel(toIso)}`;
}

export function formatTick(time: number, intraday: boolean, yearly = false): string {
  const date = new Date(time * 1000);
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  if (intraday) {
    const hh = String(date.getUTCHours()).padStart(2, '0');
    const mm = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }
  if (yearly) return `${date.getUTCFullYear()}/${month}`;
  return `${month}/${day}`;
}

export function withAlpha(color: string, alpha: number): string {
  const hex = color.trim();
  if (!hex.startsWith('#')) return color;
  const raw = hex.slice(1);
  const full = raw.length === 3 ? raw.split('').map((part) => part + part).join('') : raw;
  if (full.length < 6) return color;
  const value = Number.parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(value)) return color;
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
