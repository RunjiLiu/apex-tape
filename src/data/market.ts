import type { UTCTimestamp } from 'lightweight-charts';
import { BARS_TABLE, DATA_SOURCE, FACTOR_TABLE, OSCILLATOR_TABLE, RAW_BARS, type RawBar } from './bars.ts';
import { UNIVERSE, type Bar, type FactorSnapshot, type MarketFrame } from '../types.ts';

export const DATA_NOTE = `${BARS_TABLE} · 日线`;
export { BARS_TABLE, DATA_SOURCE, FACTOR_TABLE, OSCILLATOR_TABLE };

function timestamp(isoDate: string): UTCTimestamp {
  return Math.floor(Date.parse(`${isoDate}T00:00:00.000Z`) / 1000) as UTCTimestamp;
}

function factorOf(row: RawBar): FactorSnapshot {
  return {
    ret1d: row.ret1d,
    ret5d: row.ret5d,
    ret20d: row.ret20d,
    ret60d: row.ret60d,
    rs5d: row.rs5d,
    rs20d: row.rs20d,
    atr14: row.atr14,
    atrPct: row.atrPct,
    atrPctRank20: row.atrPctRank20,
    atrPctRank60: row.atrPctRank60,
    atrPctRank252: row.atrPctRank252,
    distSma20Pct: row.distSma20Pct,
    distSma50Pct: row.distSma50Pct,
    distSma200Pct: row.distSma200Pct,
    distEma9Pct: row.distEma9Pct,
    distEma21Pct: row.distEma21Pct,
    volRatio20: row.volRatio20,
    trendTag: row.trendTag,
    volTag: row.volTag,
  };
}

function toBar(row: RawBar): Bar {
  return {
    time: timestamp(row.tradeDate),
    iso: row.tradeDate,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    factor: factorOf(row),
  };
}

function toFrame(symbol: string, name: string, rows: RawBar[]): MarketFrame {
  const bars = rows.map(toBar);
  return {
    symbol,
    name,
    timeframe: 'D',
    bars,
    macd: rows.map((row) => (
      row.macd == null || row.macdSignal == null || row.macdHist == null
        ? null
        : { macd: row.macd, signal: row.macdSignal, hist: row.macdHist }
    )),
    rsi: rows.map((row) => row.rsi14),
  };
}

function buildBooks(): Record<string, MarketFrame> {
  const grouped = new Map<string, RawBar[]>();
  for (const row of RAW_BARS) {
    const list = grouped.get(row.symbol) ?? [];
    list.push(row);
    grouped.set(row.symbol, list);
  }
  const books: Record<string, MarketFrame> = {};
  for (const item of UNIVERSE) {
    const rows = grouped.get(item.symbol);
    if (!rows || rows.length === 0) continue;
    books[item.symbol] = toFrame(item.symbol, item.name, rows);
  }
  return books;
}

export const BOOKS = buildBooks();

export function frameFor(symbol: string): MarketFrame {
  return BOOKS[symbol] ?? BOOKS.AAPL;
}
