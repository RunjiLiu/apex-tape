import type { UTCTimestamp } from 'lightweight-charts';
import { DATA_SOURCE, DATA_VIEW, RAW_BARS, type RawBar } from './bars.ts';
import { BAIDU_BARS, type BaiduBar } from './bars_baidu_qqq.ts';
import { UNIVERSE, type Bar, type FactorSnapshot, type FeedId, type MarketFrame } from '../types.ts';

export const DATA_NOTE = `${DATA_VIEW} · 日线`;
export { DATA_SOURCE, DATA_VIEW };

function timestamp(isoDate: string): UTCTimestamp {
  return Math.floor(Date.parse(`${isoDate}T00:00:00.000Z`) / 1000) as UTCTimestamp;
}

function emptyFactor(): FactorSnapshot {
  return {
    ret1d: null,
    ret5d: null,
    ret20d: null,
    ret60d: null,
    rs5d: null,
    rs20d: null,
    atr14: null,
    atrPct: null,
    atrPctRank20: null,
    atrPctRank60: null,
    atrPctRank252: null,
    distSma20Pct: null,
    distSma50Pct: null,
    distSma200Pct: null,
    distEma9Pct: null,
    distEma21Pct: null,
    volRatio20: null,
    trendTag: null,
    volTag: null,
    dsSource: null,
    adjustType: null,
  };
}

function factorOf(row: RawBar): FactorSnapshot {
  return {
    ...emptyFactor(),
    ret1d: row.ret1d,
    ret5d: row.ret5d,
    ret20d: row.ret20d,
    rs5d: row.rs5d,
    rs20d: row.rs20d,
    atr14: row.atr14,
    atrPct: row.atrPct,
    atrPctRank20: row.atrPctRank20,
    distSma20Pct: row.distSma20Pct,
    distSma50Pct: row.distSma50Pct,
    distEma9Pct: row.distEma9Pct,
    distEma21Pct: row.distEma21Pct,
    volRatio20: row.volRatio20,
    trendTag: row.trendTag,
    volTag: row.volTag,
    dsSource: row.dsSource,
  };
}

function baiduFactor(row: BaiduBar): FactorSnapshot {
  return {
    ...emptyFactor(),
    ret1d: row.ret1d,
    ret5d: row.ret5d,
    ret20d: row.ret20d,
    ret60d: row.ret60d,
    atr14: row.atr14,
    atrPct: row.atrPct,
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
    dsSource: row.dsSource,
    adjustType: row.adjustType,
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
    source: 'twelvedata',
    oscillators: true,
    bars,
    macd: rows.map((row) => ({
      macd: row.macd ?? 0,
      signal: row.macdSignal ?? 0,
      hist: row.macdHist ?? 0,
    })),
    rsi: rows.map((row) => row.rsi14),
  };
}

function baiduFrame(): MarketFrame {
  const name = UNIVERSE.find((item) => item.symbol === 'QQQ')?.name ?? 'QQQ';
  const bars: Bar[] = BAIDU_BARS.map((row) => ({
    time: timestamp(row.tradeDate),
    iso: row.tradeDate,
    open: row.open,
    high: row.high,
    low: row.low,
    close: row.close,
    volume: row.volume,
    factor: baiduFactor(row),
  }));
  return {
    symbol: 'QQQ',
    name,
    timeframe: 'D',
    source: 'baidu',
    oscillators: false,
    bars,
    macd: bars.map(() => ({ macd: 0, signal: 0, hist: 0 })),
    rsi: bars.map(() => null),
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

const BAIDU_BOOK = baiduFrame();

export function symbolsFor(feed: FeedId): { symbol: string; name: string }[] {
  if (feed === 'baidu') return [{ symbol: BAIDU_BOOK.symbol, name: BAIDU_BOOK.name }];
  return UNIVERSE;
}

export function frameFor(feed: FeedId, symbol: string): MarketFrame {
  if (feed === 'baidu') return BAIDU_BOOK;
  return BOOKS[symbol] ?? BOOKS.AAPL;
}
