import type { Time } from 'lightweight-charts';
import type { Bar, MarketFrame, Timeframe } from '../types';

const MAX_GAP_SEC: Record<Timeframe, number> = {
  D: 5 * 24 * 3600,
  W: 12 * 24 * 3600,
  I: 30 * 60,
};

export function parseIso(iso: string): number | null {
  const normalized = iso.length === 10 ? `${iso}T00:00:00.000Z` : iso;
  const ms = Date.parse(normalized);
  return Number.isFinite(ms) ? ms : null;
}

export function snapBar(iso: string, bars: Bar[], timeframe: Timeframe): Bar | null {
  const ms = parseIso(iso);
  if (ms == null || bars.length === 0) return null;
  const target = ms / 1000;
  let best: Bar | null = null;
  let bestGap = Infinity;
  for (const bar of bars) {
    const gap = Math.abs(bar.time - target);
    if (gap < bestGap) {
      bestGap = gap;
      best = bar;
    }
  }
  if (!best || bestGap > MAX_GAP_SEC[timeframe]) return null;
  return best;
}

export function barByTime(time: Time | undefined, bars: Bar[]): Bar | null {
  if (typeof time !== 'number') return null;
  return bars.find((bar) => bar.time === time) ?? null;
}

export function indexOfIso(frame: MarketFrame, iso: string): number {
  const bar = snapBar(iso, frame.bars, frame.timeframe);
  if (!bar) return -1;
  return frame.bars.findIndex((item) => item.iso === bar.iso);
}

export interface Slice {
  i0: number;
  i1: number;
  bars: Bar[];
  macd: MarketFrame['macd'];
  rsi: MarketFrame['rsi'];
}

export function sliceRange(frame: MarketFrame, fromIso: string, toIso: string): Slice | null {
  const left = indexOfIso(frame, fromIso);
  const right = indexOfIso(frame, toIso);
  if (left < 0 || right < 0) return null;
  const i0 = Math.min(left, right);
  const i1 = Math.max(left, right);
  return {
    i0,
    i1,
    bars: frame.bars.slice(i0, i1 + 1),
    macd: frame.macd.slice(i0, i1 + 1),
    rsi: frame.rsi.slice(i0, i1 + 1),
  };
}

export function annotationFits(frame: MarketFrame, from?: string, to?: string, points?: { t: string }[]): boolean {
  const stamps = [from, to, ...(points?.map((point) => point.t) ?? [])].filter((value): value is string => Boolean(value));
  if (stamps.length === 0) return true;
  return stamps.every((iso) => snapBar(iso, frame.bars, frame.timeframe) != null);
}
