import type { IChartApi, ISeriesApi, Logical, SeriesType, UTCTimestamp } from 'lightweight-charts';
import type { Annotation, ChartHandles, MarketFrame } from '../types';
import { snapBar } from '../lib/snap';

export type ShapeKind = 'rect' | 'ellipse' | 'segment' | 'vline' | 'polyline' | 'marker';

export interface Shape {
  id: string;
  kind: ShapeKind;
  color: string;
  opacity: number;
  dash: boolean;
  fill: boolean;
  stroke: boolean;
  dimmed: boolean;
  highlighted: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  points?: { x: number; y: number }[];
}

export interface LabelModel {
  id: string;
  pane: 'price' | 'macd' | 'rsi';
  x: number;
  y: number;
  text: string;
  color: string;
  active: boolean;
  placement: 'above' | 'below' | 'top';
}

const DEFAULT_COLOR: Record<string, string> = {
  band: '#5c6b73',
  marker: '#2f5d50',
  hline: '#8a5a44',
  trendline: '#3d5a80',
  vline: '#6d665c',
  rect: '#3f6f66',
  ellipse: '#6a5a78',
  label: '#3d4a45',
  link: '#8a8175',
};

export function xOf(chart: IChartApi, time: UTCTimestamp): number | null {
  const direct = chart.timeScale().timeToCoordinate(time);
  if (direct != null) return direct;
  const index = chart.timeScale().timeToIndex(time, false);
  if (index == null) return null;
  const coordinate = chart.timeScale().logicalToCoordinate(index as unknown as Logical);
  return coordinate == null ? null : coordinate;
}

function yOf(series: ISeriesApi<SeriesType>, price: number): number | null {
  const coordinate = series.priceToCoordinate(price);
  return coordinate == null ? null : coordinate;
}

function colorOf(annotation: Annotation): string {
  return annotation.style?.color ?? DEFAULT_COLOR[annotation.type] ?? '#5c6b73';
}

function paneOf(chart: string): 'price' | 'macd' | 'rsi' | null {
  if (chart === 'price' || chart === 'volume') return 'price';
  if (chart === 'macd') return 'macd';
  if (chart === 'rsi') return 'rsi';
  return null;
}

function seriesFor(handles: ChartHandles, chart: string): ISeriesApi<SeriesType> | null {
  if (chart === 'price') return handles.candle;
  if (chart === 'volume') return handles.volume;
  if (chart === 'macd') return handles.macdLine;
  if (chart === 'rsi') return handles.rsiLine;
  return null;
}

function chartFor(handles: ChartHandles, chart: string): IChartApi | null {
  if (chart === 'price' || chart === 'volume') return handles.priceChart;
  if (chart === 'macd') return handles.macdChart;
  if (chart === 'rsi') return handles.rsiChart;
  return null;
}

interface Point {
  x: number;
  y: number;
}

function pointAt(
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  frame: MarketFrame,
  iso: string | undefined,
  price: number | undefined,
): Point | null {
  if (!iso || price == null) return null;
  const bar = snapBar(iso, frame.bars, frame.timeframe);
  if (!bar) return null;
  const x = xOf(chart, bar.time);
  const y = yOf(series, price);
  if (x == null || y == null) return null;
  return { x, y };
}

function flags(annotation: Annotation, highlight: ReadonlySet<string>): { dimmed: boolean; highlighted: boolean } {
  if (annotation.id === 'selection') return { dimmed: false, highlighted: false };
  const highlighted = highlight.has(annotation.id);
  const dimmed = highlight.size > 0 && !highlighted;
  return { dimmed, highlighted };
}

export function buildShapes(
  chartId: string,
  chart: IChartApi,
  series: ISeriesApi<SeriesType>,
  frame: MarketFrame,
  annotations: readonly Annotation[],
  highlight: ReadonlySet<string>,
): Shape[] {
  const width = chart.timeScale().width();
  if (width <= 0) return [];
  const shapes: Shape[] = [];
  for (const annotation of annotations) {
    if (annotation.chart !== chartId) continue;
    const color = colorOf(annotation);
    const opacity = annotation.style?.opacity ?? (annotation.type === 'band' || annotation.type === 'rect' || annotation.type === 'ellipse' ? 0.16 : 0.9);
    const dash = Boolean(annotation.style?.dash);
    const { dimmed, highlighted } = flags(annotation, highlight);
    const base = { id: annotation.id, color, opacity, dash, dimmed, highlighted, x1: 0, y1: 0, x2: 0, y2: 0 };

    if (annotation.type === 'band' || annotation.type === 'rect' || annotation.type === 'ellipse') {
      if (annotation.price == null || annotation.price2 == null || !annotation.from || !annotation.to) continue;
      const left = pointAt(chart, series, frame, annotation.from, annotation.price);
      const right = pointAt(chart, series, frame, annotation.to, annotation.price2);
      if (!left || !right) continue;
      shapes.push({
        ...base,
        kind: annotation.type === 'ellipse' ? 'ellipse' : 'rect',
        fill: true,
        stroke: true,
        x1: left.x,
        y1: left.y,
        x2: right.x,
        y2: right.y,
      });
      continue;
    }

    if (annotation.type === 'hline') {
      if (annotation.price == null) continue;
      const y = yOf(series, annotation.price);
      if (y == null) continue;
      const from = annotation.from ? pointAt(chart, series, frame, annotation.from, annotation.price) : null;
      const to = annotation.to ? pointAt(chart, series, frame, annotation.to, annotation.price) : null;
      shapes.push({
        ...base,
        kind: 'segment',
        fill: false,
        stroke: true,
        x1: from?.x ?? 0,
        x2: to?.x ?? width,
        y1: y,
        y2: y,
      });
      continue;
    }

    if (annotation.type === 'vline') {
      if (!annotation.from) continue;
      const bar = snapBar(annotation.from, frame.bars, frame.timeframe);
      if (!bar) continue;
      const x = xOf(chart, bar.time);
      if (x == null) continue;
      shapes.push({ ...base, kind: 'vline', fill: false, stroke: true, x1: x, x2: x, y1: 0, y2: 0 });
      continue;
    }

    if (annotation.type === 'trendline' || annotation.type === 'link') {
      const raw = annotation.points ?? [];
      const points = raw
        .map((point) => pointAt(chart, series, frame, point.t, point.p))
        .filter((point): point is Point => point != null);
      if (points.length < 2 && annotation.from && annotation.to && annotation.price != null && annotation.price2 != null) {
        const start = pointAt(chart, series, frame, annotation.from, annotation.price);
        const end = pointAt(chart, series, frame, annotation.to, annotation.price2);
        if (start && end) points.push(start, end);
      }
      if (points.length < 2) continue;
      shapes.push({
        ...base,
        kind: 'polyline',
        fill: false,
        stroke: true,
        dash: annotation.type === 'link' ? true : dash,
        points,
        x1: points[0].x,
        y1: points[0].y,
        x2: points[points.length - 1].x,
        y2: points[points.length - 1].y,
      });
      continue;
    }

    if (annotation.type === 'marker' || annotation.type === 'label') {
      const spot = pointAt(chart, series, frame, annotation.from, annotation.price);
      if (!spot) continue;
      shapes.push({
        ...base,
        kind: 'marker',
        fill: true,
        stroke: false,
        opacity: annotation.type === 'label' ? Math.min(opacity, 0.85) : opacity,
        x1: spot.x,
        y1: spot.y,
        x2: spot.x,
        y2: spot.y,
      });
    }
  }
  return shapes;
}

function pushLabel(list: LabelModel[], label: LabelModel | null): void {
  if (label && label.text.trim()) list.push(label);
}

export function buildLabels(
  handles: ChartHandles,
  frame: MarketFrame,
  annotations: readonly Annotation[],
  highlight: ReadonlySet<string>,
): LabelModel[] {
  const labels: LabelModel[] = [];
  for (const annotation of annotations) {
    if (!annotation.label || annotation.id === 'selection') continue;
    const pane = paneOf(annotation.chart);
    const chart = chartFor(handles, annotation.chart);
    const series = seriesFor(handles, annotation.chart);
    if (!pane || !chart || !series) continue;
    const active = highlight.has(annotation.id);
    const color = colorOf(annotation);
    const text = annotation.label;

    if (annotation.type === 'vline' && annotation.from) {
      const bar = snapBar(annotation.from, frame.bars, frame.timeframe);
      const x = bar ? xOf(chart, bar.time) : null;
      if (x == null) continue;
      pushLabel(labels, { id: annotation.id, pane, x, y: 8, text, color, active, placement: 'top' });
      continue;
    }

    if ((annotation.type === 'trendline' || annotation.type === 'link') && annotation.points && annotation.points.length > 0) {
      const last = annotation.points[annotation.points.length - 1];
      const spot = pointAt(chart, series, frame, last.t, last.p);
      if (!spot) continue;
      pushLabel(labels, { id: annotation.id, pane, x: spot.x, y: spot.y, text, color, active, placement: 'above' });
      continue;
    }

    if ((annotation.type === 'band' || annotation.type === 'rect' || annotation.type === 'ellipse') && annotation.from && annotation.to && annotation.price != null && annotation.price2 != null) {
      const startBar = snapBar(annotation.from, frame.bars, frame.timeframe);
      const endBar = snapBar(annotation.to, frame.bars, frame.timeframe);
      if (!startBar || !endBar) continue;
      const xStart = xOf(chart, startBar.time);
      const xEnd = xOf(chart, endBar.time);
      const y = yOf(series, Math.max(annotation.price, annotation.price2));
      if (xStart == null || xEnd == null || y == null) continue;
      const x = annotation.type === 'band' ? xStart + (xEnd - xStart) * 0.28 : (xStart + xEnd) / 2;
      pushLabel(labels, { id: annotation.id, pane, x, y, text, color, active, placement: 'above' });
      continue;
    }

    const iso = annotation.to ?? annotation.from;
    const price = annotation.price;
    if (!iso || price == null) continue;
    const spot = pointAt(chart, series, frame, iso, price);
    if (!spot) continue;
    pushLabel(labels, { id: annotation.id, pane, x: spot.x, y: spot.y, text, color, active, placement: 'above' });
  }

  const occupied = new Map<LabelModel['pane'], { x: number; y: number }[]>();
  for (const label of labels) {
    const pile = occupied.get(label.pane) ?? [];
    if (label.placement === 'above' && label.y < 22) label.placement = 'below';
    let guard = 0;
    while (pile.some((item) => Math.abs(item.x - label.x) < 58 && Math.abs(item.y - label.y) < 18) && guard < 5) {
      label.y += label.placement === 'top' ? 16 : 18;
      guard += 1;
    }
    pile.push({ x: label.x, y: label.y });
    occupied.set(label.pane, pile);
  }
  return labels;
}
