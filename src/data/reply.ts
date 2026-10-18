import { formatDateLabel, formatOsc, formatPct, formatPrice, formatRsi, formatVolume } from '../lib/format';
import { sliceRange } from '../lib/snap';
import {
  TIMEFRAME_LABEL,
  TIMEFRAME_LONG,
  type Annotation,
  type AskResult,
  type MacdPoint,
  type MarketFrame,
  type SelectionContext,
} from '../types';

function presentMacd(points: Array<MacdPoint | null | undefined>): MacdPoint[] {
  return points.filter((point): point is MacdPoint => point != null);
}

const COLOR = {
  high: '#8a5a44',
  low: '#3d5a80',
  marker: '#2f5d50',
  macd: '#3f6f66',
  rsi: '#6a5a78',
  band: '#5c6b73',
  selection: '#5e6a64',
};

let sequence = 1;

function aid(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence.toString(36)}`;
}

function lastRsi(frame: MarketFrame, index: number): number | null {
  for (let cursor = index; cursor >= 0; cursor -= 1) {
    const value = frame.rsi[cursor];
    if (value != null) return value;
  }
  return null;
}

function buildContext(frame: MarketFrame, fromIso: string, toIso: string, focusChart: string): SelectionContext | null {
  const slice = sliceRange(frame, fromIso, toIso);
  if (!slice) return null;
  const first = slice.bars[0];
  const last = slice.bars[slice.bars.length - 1];
  const macd = slice.macd[slice.macd.length - 1];
  const volume = slice.bars.reduce((sum, bar) => sum + bar.volume, 0);
  return {
    symbol: frame.symbol,
    name: frame.name,
    timeframe: frame.timeframe,
    timeframeLabel: TIMEFRAME_LABEL[frame.timeframe],
    fromIso: first.iso,
    toIso: last.iso,
    close: last.close,
    changePct: first.close === 0 ? null : ((last.close - first.close) / first.close) * 100,
    macd: macd?.macd ?? null,
    signal: macd?.signal ?? null,
    hist: macd?.hist ?? null,
    rsi: lastRsi(frame, slice.i1),
    volume,
    focusChart,
  };
}

function selectionRect(frame: MarketFrame, fromIso: string, toIso: string, chart: 'price' | 'macd' | 'rsi'): Annotation | null {
  const slice = sliceRange(frame, fromIso, toIso);
  if (!slice) return null;
  let price = 0;
  let price2 = 0;
  if (chart === 'price') {
    price = Math.min(...slice.bars.map((bar) => bar.low));
    price2 = Math.max(...slice.bars.map((bar) => bar.high));
  } else if (chart === 'macd') {
    const points = presentMacd(slice.macd);
    if (points.length === 0) return null;
    price = Math.min(...points.flatMap((point) => [point.macd, point.signal, point.hist]));
    price2 = Math.max(...points.flatMap((point) => [point.macd, point.signal, point.hist]));
  } else {
    const values = slice.rsi.filter((value): value is number => value != null);
    if (values.length === 0) return null;
    price = Math.min(...values);
    price2 = Math.max(...values);
  }
  return {
    id: 'selection',
    type: 'rect',
    chart,
    from: slice.bars[0].iso,
    to: slice.bars[slice.bars.length - 1].iso,
    price,
    price2,
    style: { color: COLOR.selection, opacity: 0.12, dash: true },
  };
}

function miss(frame: MarketFrame, userText: string): AskResult {
  const last = frame.bars[frame.bars.length - 1];
  return {
    userText,
    context: {
      symbol: frame.symbol,
      name: frame.name,
      timeframe: frame.timeframe,
      timeframeLabel: TIMEFRAME_LABEL[frame.timeframe],
      fromIso: last.iso,
      toIso: last.iso,
      close: last.close,
      changePct: null,
      macd: frame.macd[frame.macd.length - 1]?.macd ?? null,
      signal: frame.macd[frame.macd.length - 1]?.signal ?? null,
      hist: frame.macd[frame.macd.length - 1]?.hist ?? null,
      rsi: lastRsi(frame, frame.bars.length - 1),
      volume: last.volume,
      focusChart: 'price',
    },
    assistantText: '这个位置对不上当前图上的 K 线。可以换到日线，或在图内重新框一次。',
    annotations: [],
    selection: null,
  };
}

export function replyToSelection(
  frame: MarketFrame,
  chart: 'price' | 'macd' | 'rsi',
  purpose: 'trend' | 'indicator',
  fromIso: string,
  toIso: string,
): AskResult {
  const slice = sliceRange(frame, fromIso, toIso);
  const context = buildContext(frame, fromIso, toIso, chart);
  if (!slice || !context) return miss(frame, '框选一段走势。');
  const first = slice.bars[0];
  const last = slice.bars[slice.bars.length - 1];
  const high = Math.max(...slice.bars.map((bar) => bar.high));
  const low = Math.min(...slice.bars.map((bar) => bar.low));
  const highBar = slice.bars.reduce((best, bar) => (bar.high > best.high ? bar : best), slice.bars[0]);
  const lowBar = slice.bars.reduce((best, bar) => (bar.low < best.low ? bar : best), slice.bars[0]);
  const rangeLabel = `${formatDateLabel(first.iso)} – ${formatDateLabel(last.iso)}`;
  const selection = selectionRect(frame, first.iso, last.iso, chart);
  const change = context.changePct == null ? '持平' : formatPct(context.changePct);

  if (purpose === 'indicator' && chart !== 'price') {
    if (chart === 'macd') {
      const points = presentMacd(slice.macd);
      if (points.length === 0) {
        return {
          userText: `框选 ${rangeLabel} 的 MACD。`,
          context,
          selection,
          annotations: [],
          assistantText: '这段还没有 MACD。往右框到已经算出指标的区间。',
        };
      }
      const peak = slice.macd.reduce((best, point, index) => {
        if (!point) return best;
        if (!best.point || Math.abs(point.hist) > Math.abs(best.point.hist)) return { point, index };
        return best;
      }, { point: null as MacdPoint | null, index: 0 });
      if (!peak.point) return miss(frame, '框选一段 MACD。');
      const markerId = aid('m');
      const rectId = aid('r');
      const annotations: Annotation[] = [
        {
          id: rectId,
          type: 'rect',
          chart: 'macd',
          from: first.iso,
          to: last.iso,
          price: Math.min(...points.flatMap((point) => [point.macd, point.signal, point.hist])),
          price2: Math.max(...points.flatMap((point) => [point.macd, point.signal, point.hist])),
          label: '区间',
          style: { color: COLOR.macd, opacity: 0.14 },
          messageAnchor: rectId,
        },
        {
          id: markerId,
          type: 'marker',
          chart: 'macd',
          from: slice.bars[peak.index].iso,
          price: peak.point.macd,
          label: '柱峰',
          style: { color: COLOR.macd },
          linkTo: [rectId],
          messageAnchor: markerId,
        },
      ];
      return {
        userText: `框选 ${rangeLabel} 的 MACD，帮我看这段动量。`,
        context,
        selection,
        annotations,
        assistantText: `${rangeLabel} 的 MACD 从 ${formatOsc(points[0].macd)} 到 ${formatOsc(points[points.length - 1].macd)}，最后一根柱体 ${formatOsc(points[points.length - 1].hist)}。柱体绝对值最大在 [[${markerId}|${formatDateLabel(slice.bars[peak.index].iso)}]]，读数 ${formatOsc(peak.point.hist)}。矩形 [[${rectId}|区间]] 覆盖你框住的整段。`,
      };
    }
    const values = slice.rsi.map((value, index) => ({ value, index })).filter((item): item is { value: number; index: number } => item.value != null);
    if (values.length === 0 || context.rsi == null) {
      return {
        userText: `框选 ${rangeLabel} 的 RSI。`,
        context,
        selection,
        annotations: [],
        assistantText: '这段还没有足够的 K 线来计算 RSI。往右多框几根，或换到已经走出来的区间。',
      };
    }
    const min = values.reduce((best, item) => (item.value < best.value ? item : best), values[0]);
    const max = values.reduce((best, item) => (item.value > best.value ? item : best), values[0]);
    const lineId = aid('h');
    const markerId = aid('m');
    const annotations: Annotation[] = [
      {
        id: lineId,
        type: 'hline',
        chart: 'rsi',
        from: first.iso,
        to: last.iso,
        price: context.rsi ?? min.value,
        label: '收束',
        style: { color: COLOR.rsi, dash: true },
        messageAnchor: lineId,
      },
      {
        id: markerId,
        type: 'marker',
        chart: 'rsi',
        from: slice.bars[min.index].iso,
        price: min.value,
        label: '低点',
        style: { color: COLOR.rsi },
        messageAnchor: markerId,
      },
    ];
    return {
      userText: `框选 ${rangeLabel} 的 RSI。`,
      context,
      selection,
      annotations,
      assistantText: values.length === 0
        ? '这段还没有足够的 K 线来计算 RSI。'
        : `${rangeLabel} 的 RSI 在 ${formatRsi(min.value)}–${formatRsi(max.value)} 之间，结束时 ${context.rsi == null ? '还没有读数' : formatRsi(context.rsi)}。低点在 [[${markerId}|${formatDateLabel(slice.bars[min.index].iso)}]]。水平线 [[${lineId}|收束]] 标的是区间结束时的读数。30 和 70 是图上原有的参照，不是这次新加的判断。`,
    };
  }

  const up = last.close >= first.close;
  const extreme = up ? highBar : lowBar;
  const highId = aid('h');
  const lowId = aid('l');
  const markerId = aid('m');
  const annotations: Annotation[] = [
    {
      id: highId,
      type: 'hline',
      chart: 'price',
      from: first.iso,
      to: last.iso,
      price: high,
      label: '高',
      style: { color: COLOR.high, dash: true },
      messageAnchor: highId,
    },
    {
      id: lowId,
      type: 'hline',
      chart: 'price',
      from: first.iso,
      to: last.iso,
      price: low,
      label: '低',
      style: { color: COLOR.low, dash: true },
      messageAnchor: lowId,
    },
    {
      id: markerId,
      type: 'marker',
      chart: 'price',
      from: extreme.iso,
      price: up ? extreme.high : extreme.low,
      label: up ? '高点' : '低点',
      style: { color: COLOR.marker },
      messageAnchor: markerId,
    },
  ];
  const amplitude = first.close === 0 ? 0 : ((high - low) / first.close) * 100;
  return {
    userText: `框选了 ${rangeLabel} 的走势，请对照价格看这段。`,
    context,
    selection,
    annotations,
    assistantText: `${rangeLabel}，收盘从 ${formatPrice(first.close)} 到 ${formatPrice(last.close)}（${change}）。区间高 ${formatPrice(high)}、低 ${formatPrice(low)}，振幅约 ${amplitude.toFixed(1)}%。[[${highId}|高]] 和 [[${lowId}|低]] 是这两条边，[[${markerId}|${up ? '高点' : '低点'}]] 标在极值那一根上。结束时 MACD ${context.macd == null ? '—' : formatOsc(context.macd)}，RSI ${context.rsi == null ? '—' : formatRsi(context.rsi)}。`,
  };
}

export function replyToPoint(frame: MarketFrame, chart: 'price' | 'macd' | 'rsi', iso: string): AskResult {
  const slice = sliceRange(frame, iso, iso);
  const context = buildContext(frame, iso, iso, chart);
  if (!slice || !context) return miss(frame, '看这一根。');
  const bar = slice.bars[0];
  const index = slice.i0;
  const previous = index > 0 ? frame.bars[index - 1] : null;
  const change = previous ? ((bar.close - previous.close) / previous.close) * 100 : null;
  const macd = frame.macd[index];
  const rsi = frame.rsi[index];
  const markerId = aid('p');
  const linkId = aid('r');
  const annotations: Annotation[] = [
    {
      id: markerId,
      type: 'marker',
      chart,
      from: bar.iso,
      price: chart === 'price' ? bar.close : chart === 'macd' ? (macd?.macd ?? 0) : (rsi ?? 50),
      label: '此点',
      style: { color: chart === 'rsi' ? COLOR.rsi : chart === 'macd' ? COLOR.macd : COLOR.marker },
      messageAnchor: markerId,
      linkTo: chart === 'price' && rsi != null ? [linkId] : undefined,
    },
  ];
  if (chart === 'price' && rsi != null) {
    annotations.push({
      id: linkId,
      type: 'marker',
      chart: 'rsi',
      from: bar.iso,
      price: rsi,
      label: 'RSI',
      style: { color: COLOR.rsi },
      linkTo: [markerId],
      messageAnchor: linkId,
    });
  }
  const where = formatDateLabel(bar.iso);
  const delta = change == null ? '没有前一根可对照' : `较前一根 ${formatPct(change)}`;
  const indicator = chart === 'macd'
    ? (macd ? `MACD ${formatOsc(macd.macd)}，信号 ${formatOsc(macd.signal)}，柱 ${formatOsc(macd.hist)}。` : '这一根还没有 MACD。')
    : chart === 'rsi'
      ? `RSI ${rsi == null ? '还没有读数' : formatRsi(rsi)}。`
      : `MACD 柱 ${macd ? formatOsc(macd.hist) : '—'}，RSI ${rsi == null ? '—' : formatRsi(rsi)}。`;
  return {
    userText: `看一下 ${where} 这一根。`,
    context,
    selection: null,
    annotations,
    assistantText: `${where} ${TIMEFRAME_LONG[frame.timeframe]}开 ${formatPrice(bar.open)}、高 ${formatPrice(bar.high)}、低 ${formatPrice(bar.low)}、收 ${formatPrice(bar.close)}，${delta}，成交 ${formatVolume(bar.volume)}。${indicator}标记 [[${markerId}|此点]] 放在这根上${chart === 'price' && rsi != null ? `，RSI 上的 [[${linkId}|对应读数]] 和它连在一起` : ''}。`,
  };
}

export function replyToExplain(frame: MarketFrame, chart: 'price' | 'macd' | 'rsi', iso: string | null): AskResult {
  const focusIso = iso ?? frame.bars[frame.bars.length - 1].iso;
  const context = buildContext(frame, focusIso, focusIso, chart) ?? buildContext(frame, frame.bars[0].iso, frame.bars[frame.bars.length - 1].iso, chart);
  if (!context) return miss(frame, '解释一下这个指标。');

  if (chart === 'macd') {
    const known = presentMacd(frame.macd);
    if (known.length === 0) {
      return {
        userText: '解释一下 MACD。',
        context,
        selection: null,
        annotations: [],
        assistantText: '这张图上还没有 MACD。指标只覆盖已经算出来的近期日线。',
      };
    }
    let cross = -1;
    for (let index = frame.macd.length - 1; index >= 1; index -= 1) {
      const prev = frame.macd[index - 1];
      const next = frame.macd[index];
      if (prev && next && prev.hist <= 0 && next.hist > 0) {
        cross = index;
        break;
      }
    }
    let peakIndex = cross;
    if (peakIndex < 0) {
      let bestHist = -Infinity;
      frame.macd.forEach((point, index) => {
        if (point && point.hist > bestHist) {
          bestHist = point.hist;
          peakIndex = index;
        }
      });
    }
    const peak = frame.macd[peakIndex];
    if (!peak) return miss(frame, '解释一下 MACD。');
    const end = Math.min(frame.bars.length - 1, peakIndex + 10);
    const window = presentMacd(frame.macd.slice(Math.max(0, peakIndex - 1), end + 1));
    const markerId = aid('c');
    const rectId = aid('box');
    const annotations: Annotation[] = [
      {
        id: markerId,
        type: 'marker',
        chart: 'macd',
        from: frame.bars[peakIndex].iso,
        price: peak.macd,
        label: cross >= 0 ? '金叉' : '柱峰',
        style: { color: COLOR.macd },
        messageAnchor: markerId,
      },
      {
        id: rectId,
        type: 'rect',
        chart: 'macd',
        from: frame.bars[Math.max(0, peakIndex - 1)].iso,
        to: frame.bars[end].iso,
        price: Math.min(...window.flatMap((point) => [point.hist, point.macd])),
        price2: Math.max(...window.flatMap((point) => [point.hist, point.macd])),
        label: '附近',
        style: { color: COLOR.macd, opacity: 0.12 },
        linkTo: [markerId],
        messageAnchor: rectId,
      },
    ];
    const latest = [...frame.macd].reverse().find((point) => point != null) ?? peak;
    return {
      userText: '解释一下 MACD。',
      context,
      selection: null,
      annotations,
      assistantText: `MACD（12, 26, 9）是快慢两条均线的差。柱体是 MACD 减去信号线：零轴上方通常表示短线动量偏强，金叉是柱体从负转正的那一根。当前 MACD ${formatOsc(latest.macd)}，信号 ${formatOsc(latest.signal)}，柱 ${formatOsc(latest.hist)}。图上 [[${markerId}|${cross >= 0 ? '最近一次金叉' : '柱体高点'}]] 在 ${formatDateLabel(frame.bars[peakIndex].iso)}，矩形 [[${rectId}|附近]] 是它随后的几根。零轴是指标图里原有的参照线。`,
    };
  }

  if (chart === 'rsi') {
    const start = Math.max(14, frame.bars.length - 40);
    let lowIndex = start;
    let lowValue = Infinity;
    for (let index = start; index < frame.bars.length; index += 1) {
      const value = frame.rsi[index];
      if (value != null && value < lowValue) {
        lowValue = value;
        lowIndex = index;
      }
    }
    let end = Math.min(frame.bars.length - 1, lowIndex + 12);
    for (let index = lowIndex; index <= end; index += 1) {
      const value = frame.rsi[index];
      if (value != null && value >= 55) {
        end = index;
        break;
      }
    }
    const ellipseId = aid('e');
    const labelId = aid('n');
    const current = lastRsi(frame, frame.bars.length - 1) ?? lowValue;
    const annotations: Annotation[] = [
      {
        id: ellipseId,
        type: 'ellipse',
        chart: 'rsi',
        from: frame.bars[lowIndex].iso,
        to: frame.bars[end].iso,
        price: Math.max(5, lowValue - 5),
        price2: Math.min(95, Math.max(lowValue + 10, (frame.rsi[end] ?? lowValue) + 4)),
        label: '低位',
        style: { color: COLOR.rsi, opacity: 0.16 },
        messageAnchor: ellipseId,
      },
      {
        id: labelId,
        type: 'label',
        chart: 'rsi',
        from: frame.bars[frame.bars.length - 1].iso,
        price: current,
        label: `RSI ${formatRsi(current)}`,
        style: { color: COLOR.rsi },
        messageAnchor: labelId,
      },
    ];
    return {
      userText: '解释一下 RSI。',
      context,
      selection: null,
      annotations,
      assistantText: `RSI(14) 比较近 14 根的涨跌幅度。30 以下常被当作偏冷，70 以上偏热，中间是常态；这两条线是图上固定的参照。当前 [[${labelId}|${formatRsi(current)}]]。椭圆 [[${ellipseId}|低位]] 圈出最近一段里 RSI 最低的附近，低点 ${formatRsi(lowValue)} 在 ${formatDateLabel(frame.bars[lowIndex].iso)}。`,
    };
  }

  const start = Math.max(0, frame.bars.length - 20);
  const window = frame.bars.slice(start);
  const high = Math.max(...window.map((bar) => bar.high));
  const low = Math.min(...window.map((bar) => bar.low));
  const bandId = aid('b');
  const markerId = aid('m');
  const last = frame.bars[frame.bars.length - 1];
  const annotations: Annotation[] = [
    {
      id: bandId,
      type: 'band',
      chart: 'price',
      from: window[0].iso,
      to: last.iso,
      price: low,
      price2: high,
      label: '近20根',
      style: { color: COLOR.band, opacity: 0.14 },
      messageAnchor: bandId,
    },
    {
      id: markerId,
      type: 'marker',
      chart: 'price',
      from: last.iso,
      price: last.close,
      label: '最新',
      style: { color: COLOR.marker },
      messageAnchor: markerId,
    },
  ];
  const pos = high === low ? 0.5 : (last.close - low) / (high - low);
  return {
    userText: '解释一下这张价格图。',
    context,
    selection: null,
    annotations,
    assistantText: `上面是${TIMEFRAME_LONG[frame.timeframe]}蜡烛，下面叠着成交量。实体是开盘到收盘，影线是最高和最低。带状区域 [[${bandId}|近20根]] 的高低是 ${formatPrice(low)}–${formatPrice(high)}。最新收盘 [[${markerId}|${formatPrice(last.close)}]]，大约处在这段区间的 ${(pos * 100).toFixed(0)}% 位置。成交量只说明参与多少，不单独决定方向。`,
  };
}

export function replyToText(frame: MarketFrame, question: string, current: SelectionContext | null): AskResult {
  const fromIso = current?.fromIso ?? frame.bars[Math.max(0, frame.bars.length - 20)].iso;
  const toIso = current?.toIso ?? frame.bars[frame.bars.length - 1].iso;
  const base = replyToSelection(frame, 'price', 'trend', fromIso, toIso);
  const clipped = question.trim().slice(0, 80);
  return {
    ...base,
    userText: clipped || '按当前图上的区间看一眼。',
    assistantText: `这一版没有接入模型。你问的是「${clipped || '当前区间'}」。下面按图上的数据回答：\n\n${base.assistantText}`,
  };
}
