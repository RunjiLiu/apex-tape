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

export type HistoryView = 'recent' | 'all';

/** About two years of sessions. A longer symbol opens on this window. */
export const RECENT_TRADING_DAYS = 504;

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
  bars: Bar[];
  macd: Array<MacdPoint | null>;
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
  touch?: boolean;
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
  macdChart: IChartApi;
  rsiChart: IChartApi;
  candle: ISeriesApi<'Candlestick'>;
  volume: ISeriesApi<'Histogram'>;
  macdLine: ISeriesApi<'Line'>;
  macdSignal: ISeriesApi<'Line'>;
  macdHist: ISeriesApi<'Histogram'>;
  rsiLine: ISeriesApi<'Line'>;
  panes: {
    price: HTMLDivElement;
    macd: HTMLDivElement;
    rsi: HTMLDivElement;
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
