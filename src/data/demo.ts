import { formatDateLabel, formatPrice, formatRsi, formatVolume } from '../lib/format';
import { RECENT_TRADING_DAYS, TIMEFRAME_LABEL, type Annotation, type AskResult, type Bar, type MarketFrame, type SelectionContext } from '../types';

const COLOR = {
  band: '#5c6b73',
  marker: '#2f5d50',
  hline: '#8a5a44',
  trend: '#3d5a80',
  vline: '#6d665c',
  rect: '#3f6f66',
  ellipse: '#6a5a78',
  label: '#3d4a45',
  link: '#8a8175',
  volume: '#3f5c57',
};

function tightBase(bars: Bar[]): { i0: number; i1: number } {
  const win = Math.max(15, Math.round(bars.length / 8));
  const lastStart = Math.max(0, bars.length - win - 3);
  let best = { i0: 0, i1: Math.min(bars.length - 1, win - 1), score: Number.POSITIVE_INFINITY };
  for (let start = 0; start <= lastStart; start += 1) {
    const end = Math.min(bars.length, start + win);
    const window = bars.slice(start, end);
    if (window.length < 4) continue;
    const high = Math.max(...window.map((bar) => bar.high));
    const low = Math.min(...window.map((bar) => bar.low));
    const mid = (high + low) / 2 || 1;
    const score = (high - low) / mid;
    if (score < best.score) best = { i0: start, i1: end - 1, score };
  }
  return best;
}

function findBreakout(bars: Bar[], after: number, ceiling: number): number {
  const start = Math.min(Math.max(after, 0), bars.length - 1);
  for (let index = start; index < bars.length; index += 1) {
    if (bars[index].close > ceiling) return index;
  }
  let peak = 0;
  for (let index = start; index < bars.length; index += 1) {
    if (bars[index].close > bars[peak].close) peak = index;
  }
  return peak;
}

function findCross(frame: MarketFrame, from: number, to: number): number {
  let nearest = -1;
  let nearestDist = Infinity;
  const focus = Math.min(frame.bars.length - 1, to);
  for (let index = Math.max(1, from); index <= focus; index += 1) {
    const prev = frame.macd[index - 1].hist;
    const next = frame.macd[index].hist;
    if (prev <= 0 && next > 0) {
      const dist = Math.abs(index - focus);
      if (dist < nearestDist) {
        nearest = index;
        nearestDist = dist;
      }
    }
  }
  if (nearest >= 0) return nearest;
  let best = from;
  let bestHist = -Infinity;
  for (let index = from; index <= focus; index += 1) {
    if (frame.macd[index].hist > bestHist) {
      bestHist = frame.macd[index].hist;
      best = index;
    }
  }
  return best;
}

function lowestLow(bars: Bar[], from: number, to: number): number {
  let best = from;
  for (let index = from; index <= to; index += 1) {
    if (bars[index].low < bars[best].low) best = index;
  }
  return best;
}

function lowestRsi(frame: MarketFrame, from: number, to: number): number {
  let best = -1;
  let value = Infinity;
  for (let index = from; index <= to; index += 1) {
    const rsi = frame.rsi[index];
    if (rsi != null && rsi < value) {
      value = rsi;
      best = index;
    }
  }
  return best;
}

function contextFor(frame: MarketFrame, fromIso: string, toIso: string, focusChart: string): SelectionContext {
  const from = frame.bars.findIndex((bar) => bar.iso === fromIso);
  const to = frame.bars.findIndex((bar) => bar.iso === toIso);
  const i0 = Math.min(from, to);
  const i1 = Math.max(from, to);
  const first = frame.bars[i0];
  const last = frame.bars[i1];
  const macd = frame.macd[i1];
  const rsi = frame.rsi[i1];
  const changePct = first.close === 0 ? null : ((last.close - first.close) / first.close) * 100;
  const volume = frame.bars.slice(i0, i1 + 1).reduce((sum, bar) => sum + bar.volume, 0);
  return {
    symbol: frame.symbol,
    name: frame.name,
    timeframe: frame.timeframe,
    timeframeLabel: TIMEFRAME_LABEL[frame.timeframe],
    fromIso: frame.bars[i0].iso,
    toIso: frame.bars[i1].iso,
    close: last.close,
    changePct,
    macd: frame.oscillators ? macd?.macd ?? null : null,
    signal: frame.oscillators ? macd?.signal ?? null : null,
    hist: frame.oscillators ? macd?.hist ?? null : null,
    rsi: frame.oscillators ? rsi : null,
    volume,
    focusChart,
  };
}

function focused(frame: MarketFrame): MarketFrame {
  if (frame.bars.length <= RECENT_TRADING_DAYS + 40) return frame;
  const start = frame.bars.length - RECENT_TRADING_DAYS;
  return {
    ...frame,
    bars: frame.bars.slice(start),
    macd: frame.macd.slice(start),
    rsi: frame.rsi.slice(start),
  };
}

export function buildDemo(source: MarketFrame): AskResult {
  const frame = focused(source);
  const bars = frame.bars;
  const windowNote = frame.bars.length < source.bars.length ? `默认视野里的 ${bars.length} 个交易日` : `这 ${bars.length} 个交易日`;
  const origin = frame.source === 'baidu'
    ? '行情是 Baidu QQQ 日线，成交量只来自这一源，因子在右侧。'
    : '行情来自 Twelve Data。';
  const base = tightBase(bars);
  const baseBars = bars.slice(base.i0, base.i1 + 1);
  const baseHigh = Math.max(...baseBars.map((bar) => bar.high));
  const baseLow = Math.min(...baseBars.map((bar) => bar.low));
  const breakoutIndex = findBreakout(bars, base.i1 + 1, baseHigh);
  const breakout = bars[breakoutIndex];
  const prior = bars.slice(Math.max(0, breakoutIndex - 20), breakoutIndex);
  const avgVol = prior.reduce((sum, bar) => sum + bar.volume, 0) / Math.max(1, prior.length);
  const volRatio = breakout.volume / avgVol;
  const swingA = lowestLow(bars, 0, Math.max(0, Math.floor(bars.length * 0.45)));
  const swingB = lowestLow(bars, Math.min(bars.length - 1, Math.floor(bars.length * 0.62)), bars.length - 1);
  const rising = bars[swingB].low > bars[swingA].low;
  const last = bars[bars.length - 1];
  let oscillatorNotes: Annotation[] = [];
  let oscillatorSentence = '这个来源没有 MACD 和 RSI，成交量与右侧因子仍是这一源自己的。';
  if (frame.oscillators) {
    const crossIndex = findCross(frame, base.i0, Math.min(bars.length - 1, breakoutIndex + 6));
    const cross = bars[crossIndex];
    const crossed = frame.macd[crossIndex - 1] != null && frame.macd[crossIndex - 1].hist <= 0 && frame.macd[crossIndex].hist > 0;
    const foundRsi = lowestRsi(frame, 0, bars.length - 1);
    const rsiIndex = foundRsi < 0 ? 0 : foundRsi;
    const rsiValue = frame.rsi[rsiIndex] ?? 50;
    let rsiEnd = Math.min(bars.length - 1, rsiIndex + 8);
    for (let index = rsiIndex; index < rsiEnd; index += 1) {
      const value = frame.rsi[index];
      if (value != null && value >= 55) {
        rsiEnd = index;
        break;
      }
    }
    const lastRsi = [...frame.rsi].reverse().find((value) => value != null) ?? 50;
    const histEnd = Math.min(bars.length - 1, crossIndex + 8);
    const histSlice = frame.macd.slice(Math.max(0, crossIndex - 2), histEnd + 1);
    const histLow = Math.min(...histSlice.map((point) => Math.min(point.hist, point.macd, point.signal)));
    const histHigh = Math.max(...histSlice.map((point) => Math.max(point.hist, point.macd, point.signal)));
    const ellipseLow = Math.max(8, rsiValue - 6);
    const ellipseHigh = Math.min(92, Math.max(ellipseLow + 8, (frame.rsi[rsiEnd] ?? rsiValue) + 6));
    oscillatorNotes = [
      {
        id: 'cross',
        type: 'marker',
        chart: 'macd',
        from: cross.iso,
        price: frame.macd[crossIndex].macd,
        label: crossed ? '金叉' : '柱峰',
        style: { color: COLOR.rect },
        linkTo: ['mk', 'hist'],
        messageAnchor: 'cross',
      },
      {
        id: 'hist',
        type: 'rect',
        chart: 'macd',
        from: bars[Math.max(0, crossIndex - 2)].iso,
        to: bars[histEnd].iso,
        price: histLow,
        price2: histHigh,
        label: '柱体',
        style: { color: COLOR.rect, opacity: 0.14 },
        linkTo: ['cross'],
        messageAnchor: 'hist',
      },
      {
        id: 'rsi',
        type: 'ellipse',
        chart: 'rsi',
        from: bars[rsiIndex].iso,
        to: bars[rsiEnd].iso,
        price: ellipseLow,
        price2: ellipseHigh,
        label: '修复',
        style: { color: COLOR.ellipse, opacity: 0.14 },
        messageAnchor: 'rsi',
      },
    ];
    const rsiSentence = rsiValue < 35
      ? `RSI 在 ${formatDateLabel(bars[rsiIndex].iso)} 曾到 ${formatRsi(rsiValue)}，接近超卖。椭圆 [[rsi|修复]] 覆盖它回到中性区的那段。`
      : rsiValue < 45
        ? `RSI 在 ${formatDateLabel(bars[rsiIndex].iso)} 下到 ${formatRsi(rsiValue)}，属于偏低但不极端。椭圆 [[rsi|修复]] 标的是随后抬回去的过程。`
        : `这段没有真正进入超卖。RSI 的低点在 ${formatDateLabel(bars[rsiIndex].iso)}，读数 ${formatRsi(rsiValue)}，椭圆 [[rsi|修复]] 只是把这段低位圈出来。`;
    const crossSentence = crossed
      ? `MACD 在 [[cross|${formatDateLabel(cross.iso)}]] 附近金叉，柱体由负转正。矩形 [[hist|柱体]] 框住随后的扩张。`
      : `MACD 在突破前后没有留下干净的金叉。标记放在柱体相对更强的 [[cross|${formatDateLabel(cross.iso)}]]，矩形 [[hist|柱体]] 是它周围的读数。`;
    oscillatorSentence = `${crossSentence}${rsiSentence}当前 RSI ${formatRsi(lastRsi)}。`;
  }

  const annotations: Annotation[] = [
    {
      id: 'band',
      type: 'band',
      chart: 'price',
      from: bars[base.i0].iso,
      to: bars[base.i1].iso,
      price: baseLow,
      price2: baseHigh,
      label: '平台',
      style: { color: COLOR.band, opacity: 0.16 },
      messageAnchor: 'band',
    },
    {
      id: 'mk',
      type: 'marker',
      chart: 'price',
      from: breakout.iso,
      price: breakout.high,
      label: '突破',
      style: { color: COLOR.marker },
      linkTo: frame.oscillators ? ['cross', 'vol'] : ['vol'],
      messageAnchor: 'mk',
    },
    {
      id: 'vl',
      type: 'vline',
      chart: 'price',
      from: breakout.iso,
      style: { color: COLOR.vline, dash: true, opacity: 0.7 },
      linkTo: ['mk'],
    },
    {
      id: 'vol',
      type: 'marker',
      chart: 'volume',
      from: breakout.iso,
      price: breakout.volume,
      label: '放量',
      style: { color: COLOR.volume },
      linkTo: ['mk'],
      messageAnchor: 'vol',
    },
    ...oscillatorNotes,
    {
      id: 'trend',
      type: 'trendline',
      chart: 'price',
      points: [
        { t: bars[swingA].iso, p: bars[swingA].low },
        { t: bars[swingB].iso, p: bars[swingB].low },
      ],
      label: rising ? '趋势' : '低点',
      style: { color: COLOR.trend, opacity: 0.95 },
      messageAnchor: 'trend',
    },
    {
      id: 'cap',
      type: 'hline',
      chart: 'price',
      from: bars[base.i0].iso,
      to: bars[Math.min(bars.length - 1, breakoutIndex + 18)].iso,
      price: baseHigh,
      label: '上沿',
      style: { color: COLOR.hline, dash: true, opacity: 0.9 },
      messageAnchor: 'cap',
    },
    {
      id: 'link',
      type: 'link',
      chart: 'price',
      points: [
        { t: bars[base.i1].iso, p: baseHigh },
        { t: breakout.iso, p: breakout.close },
      ],
      style: { color: COLOR.link, dash: true, opacity: 0.85 },
      linkTo: ['mk'],
    },
    {
      id: 'last',
      type: 'label',
      chart: 'price',
      from: last.iso,
      price: last.high,
      label: `收 ${formatPrice(last.close)}`,
      style: { color: COLOR.label },
      messageAnchor: 'last',
    },
  ];

  const trendSentence = rising
    ? `[[trend|趋势线]]连接 ${formatDateLabel(bars[swingA].iso)} 与 ${formatDateLabel(bars[swingB].iso)} 的两个低点，后一个更高。`
    : `[[trend|低点连线]]从 ${formatDateLabel(bars[swingA].iso)} 拉到 ${formatDateLabel(bars[swingB].iso)}。后一个低点并没有抬高，所以它只是参照，不是上升趋势。`;

  const broke = breakout.close > baseHigh;
  const breakSentence = broke
    ? `[[mk|突破]]出现在 ${formatDateLabel(breakout.iso)}，收盘 ${formatPrice(breakout.close)}，站上平台上沿。成交量约是前 ${prior.length} 日的 ${volRatio.toFixed(1)} 倍，成交量图上记了 [[vol|放量]]。`
    : `后段最高的收盘在 ${formatDateLabel(breakout.iso)}（${formatPrice(breakout.close)}），并没有干净地离开平台上沿。我仍把这一根标成 [[mk|突破]] 候选，成交量是前 ${prior.length} 日的 ${volRatio.toFixed(1)} 倍。`;

  const assistantText = [
    `${frame.name}（${frame.symbol}）${windowNote}里，主线是一段平台，然后是 ${formatDateLabel(breakout.iso)} 前后的抬升。句子里的标记和图表是同一套编号。${origin}这段话仍是本地写好的。`,
    '',
    `[[band|平台]]大约从 ${formatDateLabel(bars[base.i0].iso)} 到 ${formatDateLabel(bars[base.i1].iso)}，价格落在 ${formatPrice(baseLow)}–${formatPrice(baseHigh)}。${breakSentence}`,
    '',
    oscillatorSentence,
    '',
    `${trendSentence}平台上沿 [[cap|${formatPrice(baseHigh)}]] 可以当作回撤时的对照，不是一条必然守住的线。最近一根收在 [[last|${formatPrice(last.close)}]]，当日成交 ${formatVolume(last.volume)}。`,
  ].join('\n');

  return {
    userText: frame.oscillators
      ? `请按日线把 ${frame.symbol} 这段行情讲清楚，并把依据标在价格、成交量、MACD 和 RSI 上。`
      : `请按日线把 ${frame.symbol} 这段行情讲清楚，并把依据标在价格和成交量上。`,
    context: contextFor(frame, bars[base.i0].iso, last.iso, 'price'),
    assistantText,
    annotations,
    selection: null,
  };
}
