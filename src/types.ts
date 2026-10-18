import type { IChartApi, ISeriesApi, UTCTimestamp } from 'lightweight-charts';

export type Timeframe = 'D' | 'W' | 'I';

export type AnnotationType =
  | 'band'
  | 'marker'
  | 'hline'
  | 'trendline'
  | 'vline'
  | 'rect'
  | 'ellipse'
  | 'label'
  | 'link';

export interface AnnotationStyle {
  color?: string;
  opacity?: number;
  dash?: boolean;
}

export interface Annotation {
  id: string;
  type: AnnotationType;
  chart: 'price' | 'volume' | 'macd' | 'rsi' | string;
  from?: string;
  to?: string;
  price?: number;
  price2?: number;
  points?: { t: string; p: number }[];
  label?: string;
  style?: AnnotationStyle;
  linkTo?: string[];
  messageAnchor?: string;
}

export type FeedId = 'twelvedata' | 'baidu';

export type HistoryView = 'recent' | 'all';

/** About two years of sessions. Long histories open on this window. */
export const RECENT_TRADING_DAYS = 504;

export const FEEDS: { id: FeedId; label: string }[] = [
  { id: 'twelvedata', label: 'Twelve Data (4 symbols, 180d)' },
  { id: 'baidu', label: 'Baidu QQQ (long history)' },
];

export interface FactorSnapshot {
  ret1d: number | null;
  ret5d: number | null;
  ret20d: number | null;
  ret60d: number | null;
  rs5d: number | null;
  rs20d: number | null;
  atr14: number | null;
  atrPct: number | null;
  atrPctRank20: number | null;
  atrPctRank60: number | null;
  atrPctRank252: number | null;
  distSma20Pct: number | null;
  distSma50Pct: number | null;
  distSma200Pct: number | null;
  distEma9Pct: number | null;
  distEma21Pct: number | null;
  volRatio20: number | null;
  trendTag: string | null;
  volTag: string | null;
  dsSource: string | null;
  adjustType: string | null;
}

export interface Bar {
  time: UTCTimestamp;
  iso: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  factor: FactorSnapshot;
}

export interface MacdPoint {
  macd: number;
  signal: number;
  hist: number;
}

export interface MarketFrame {
  symbol: string;
  name: string;
  timeframe: Timeframe;
  source: FeedId;
  oscillators: boolean;
  bars: Bar[];
  macd: MacdPoint[];
  rsi: Array<number | null>;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  annotations?: Annotation[];
}

export interface SelectionContext {
  symbol: string;
  name: string;
  timeframe: Timeframe;
  timeframeLabel: string;
  fromIso: string;
  toIso: string;
  close: number;
  changePct: number | null;
  macd: number | null;
  signal: number | null;
  hist: number | null;
  rsi: number | null;
  volume: number | null;
  focusChart: string;
}

export interface MenuState {
  x: number;
  y: number;
  chart: 'price' | 'macd' | 'rsi';
  iso: string | null;
  price: number | null;
}

export type MenuAction =
  | 'select-trend'
  | 'select-indicator'
  | 'ask-point'
  | 'explain'
  | 'clear';

export interface SelectMode {
  chart: 'price' | 'macd' | 'rsi';
  purpose: 'trend' | 'indicator';
}

export interface ChartHandles {
  priceChart: IChartApi;
  macdChart: IChartApi | null;
  rsiChart: IChartApi | null;
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  macdLine: ISeriesApi<'Line'> | null;
  macdSignal: ISeriesApi<'Line'> | null;
  macdHist: ISeriesApi<'Histogram'> | null;
  rsiLine: ISeriesApi<'Line'> | null;
  panes: {
    price: HTMLDivElement;
    macd: HTMLDivElement | null;
    rsi: HTMLDivElement | null;
  };
}

export interface AskResult {
  userText: string;
  context: SelectionContext;
  assistantText: string;
  annotations: Annotation[];
  selection: Annotation | null;
}

export const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  D: '日',
  W: '周',
  I: '分时',
};

export const TIMEFRAME_LONG: Record<Timeframe, string> = {
  D: '日线',
  W: '周线',
  I: '分时',
};

export const UNIVERSE: { symbol: string; name: string }[] = [
  { symbol: 'AAPL', name: 'Apple' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'NVDA', name: 'NVIDIA' },
  { symbol: 'QQQ', name: 'Invesco QQQ' },
];
