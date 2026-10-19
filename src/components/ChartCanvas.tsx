import { useEffect, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { formatOsc, formatPct, formatPrice, formatRsi, formatTick, formatVolume, withAlpha } from '../lib/format';
import { barByTime } from '../lib/snap';
import type { ChartHandles, HistoryView, MarketFrame, MenuState } from '../types';
import { RECENT_TRADING_DAYS, TIMEFRAME_LONG } from '../types';
import styles from './ChartCanvas.module.css';

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const SIGNAL = '#a68462';
const RSI = '#6a5a78';

function readPalette() {
  const style = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    upMark: pick('--up-mark', '#1aaa6e'),
    down: pick('--down', '#9a4e46'),
    accent: pick('--accent', '#3d5a80'),
    panel: pick('--panel', '#fbfbfc'),
    muted: pick('--muted', '#5e646e'),
    line: pick('--line', '#e4e6eb'),
    grid: pick('--grid', '#eef0f3'),
    graphite: pick('--graphite', '#2a2e33'),
  };
}

interface ChartCanvasProps {
  frame: MarketFrame;
  history: HistoryView;
  selecting: 'price' | 'macd' | 'rsi' | null;
  compact: boolean;
  onReady: (handles: ChartHandles | null) => void;
  onContextMenu: (menu: MenuState) => void;
  onAnnotationClick: (id: string) => void;
  onBackgroundClick: () => void;
  onHover: (iso: string | null) => void;
}

function mountChart(container: HTMLElement, margins: { top: number; bottom: number }, intraday: boolean): IChartApi {
  const color = readPalette();
  return createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: color.panel },
      textColor: color.muted,
      fontFamily: FONT,
      fontSize: 11,
      attributionLogo: false,
      panes: {
        enableResize: false,
        separatorColor: color.line,
        separatorHoverColor: withAlpha(color.accent, 0.16),
      },
    },
    grid: {
      vertLines: { color: color.grid },
      horzLines: { color: color.grid },
    },
    rightPriceScale: {
      borderColor: color.line,
      minimumWidth: 76,
      scaleMargins: margins,
    },
    leftPriceScale: { visible: false },
    timeScale: {
      borderColor: color.line,
      rightOffset: 6,
      barSpacing: intraday ? 6 : 7,
      minBarSpacing: 0.1,
      tickMarkFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday, false) : ''),
    },
    localization: {
      locale: 'zh-CN',
      timeFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday) : ''),
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(70, 74, 82, 0.35)',
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: color.graphite,
      },
      horzLine: {
        color: 'rgba(70, 74, 82, 0.35)',
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: color.graphite,
      },
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      mouseWheel: true,
      pinch: true,
      axisPressedMouseMove: { time: true, price: true },
      axisDoubleClickReset: { time: true, price: true },
    },
  });
}

function applyFrame(
  frame: MarketFrame,
  candle: ISeriesApi<'Candlestick'>,
  volume: ISeriesApi<'Histogram'>,
  macdLine: ISeriesApi<'Line'>,
  macdSignal: ISeriesApi<'Line'>,
  macdHist: ISeriesApi<'Histogram'>,
  rsiLine: ISeriesApi<'Line'>,
): void {
  const color = readPalette();
  candle.setData(frame.bars.map((bar) => ({
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })));
  volume.setData(frame.bars.map((bar) => ({
    time: bar.time,
    value: bar.volume,
    color: bar.close >= bar.open ? withAlpha(color.upMark, 0.45) : withAlpha(color.down, 0.38),
  })));
  macdLine.setData(frame.bars.map((bar, index) => {
    const point = frame.macd[index];
    return point == null ? { time: bar.time } : { time: bar.time, value: point.macd };
  }));
  macdSignal.setData(frame.bars.map((bar, index) => {
    const point = frame.macd[index];
    return point == null ? { time: bar.time } : { time: bar.time, value: point.signal };
  }));
  macdHist.setData(frame.bars.map((bar, index) => {
    const point = frame.macd[index];
    if (point == null) return { time: bar.time };
    return {
      time: bar.time,
      value: point.hist,
      color: point.hist >= 0 ? withAlpha(color.upMark, 0.78) : withAlpha(color.down, 0.72),
    };
  }));
  rsiLine.setData(frame.bars.map((bar, index) => {
    const value = frame.rsi[index];
    return value == null ? { time: bar.time } : { time: bar.time, value };
  }));
}

function applyRange(chart: IChartApi, count: number, history: HistoryView): void {
  const showAll = history === 'all' || count <= RECENT_TRADING_DAYS + 8;
  const long = count > RECENT_TRADING_DAYS + 8;
  chart.timeScale().applyOptions({
    minBarSpacing: showAll && long ? 0.05 : 1.2,
    barSpacing: showAll && long ? 0.4 : 6,
    rightOffset: 4,
  });
  if (showAll) chart.timeScale().fitContent();
  else chart.timeScale().setVisibleLogicalRange({ from: count - RECENT_TRADING_DAYS, to: count + 2 });
}

export function ChartCanvas({
  frame,
  history,
  selecting,
  compact,
  onReady,
  onContextMenu,
  onAnnotationClick,
  onBackgroundClick,
  onHover,
}: ChartCanvasProps) {
  const pricePaneRef = useRef<HTMLDivElement>(null);
  const macdPaneRef = useRef<HTMLDivElement>(null);
  const rsiPaneRef = useRef<HTMLDivElement>(null);
  const priceHostRef = useRef<HTMLDivElement>(null);
  const macdHostRef = useRef<HTMLDivElement>(null);
  const rsiHostRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(frame);
  const historyRef = useRef(history);
  const readyRef = useRef<ChartHandles | null>(null);
  const onReadyRef = useRef(onReady);
  const onMenuRef = useRef(onContextMenu);
  const onAnnRef = useRef(onAnnotationClick);
  const onBgRef = useRef(onBackgroundClick);
  const onHoverRef = useRef(onHover);
  const selectingRef = useRef(selecting);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  frameRef.current = frame;
  historyRef.current = history;
  onReadyRef.current = onReady;
  onMenuRef.current = onContextMenu;
  onAnnRef.current = onAnnotationClick;
  onBgRef.current = onBackgroundClick;
  onHoverRef.current = onHover;
  selectingRef.current = selecting;

  useEffect(() => {
    const priceHost = priceHostRef.current;
    const macdHost = macdHostRef.current;
    const rsiHost = rsiHostRef.current;
    const pricePane = pricePaneRef.current;
    const macdPane = macdPaneRef.current;
    const rsiPane = rsiPaneRef.current;
    if (!priceHost || !macdHost || !rsiHost || !pricePane || !macdPane || !rsiPane) return;

    const intraday = frameRef.current.timeframe === 'I';
    const priceChart = mountChart(priceHost, { top: 0.08, bottom: 0.26 }, intraday);
    const macdChart = mountChart(macdHost, { top: 0.16, bottom: 0.16 }, intraday);
    const rsiChart = mountChart(rsiHost, { top: 0.16, bottom: 0.16 }, intraday);

    const tone = readPalette();
    const candle = priceChart.addSeries(CandlestickSeries, {
      upColor: tone.upMark,
      downColor: tone.down,
      borderUpColor: tone.upMark,
      borderDownColor: tone.down,
      wickUpColor: tone.upMark,
      wickDownColor: tone.down,
      priceLineWidth: 1,
    });
    const volume = priceChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    priceChart.priceScale('').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    const macdHist = macdChart.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const macdSignal = macdChart.addSeries(LineSeries, {
      color: SIGNAL,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    });
    const macdLine = macdChart.addSeries(LineSeries, {
      color: tone.accent,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    macdLine.createPriceLine({
      price: 0,
      color: 'rgba(90, 86, 78, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });

    const rsiLine = rsiChart.addSeries(LineSeries, {
      color: RSI,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    });
    for (const level of [30, 70]) {
      rsiLine.createPriceLine({
        price: level,
        color: 'rgba(90, 86, 78, 0.28)',
        lineWidth: 1,
        lineStyle: LineStyle.Dashed,
        axisLabelVisible: true,
        title: '',
      });
    }

    const handles: ChartHandles = {
      priceChart,
      macdChart,
      rsiChart,
      candle,
      volume,
      macdLine,
      macdSignal,
      macdHist,
      rsiLine,
      panes: { price: pricePane, macd: macdPane, rsi: rsiPane },
    };
    readyRef.current = handles;

    const charts: Array<{ chart: IChartApi; priceAt: (time: UTCTimestamp) => number | null; series: ISeriesApi<'Candlestick' | 'Line'> }> = [
      {
        chart: priceChart,
        series: candle,
        priceAt: (time) => frameRef.current.bars.find((bar) => bar.time === time)?.close ?? null,
      },
      {
        chart: macdChart,
        series: macdLine,
        priceAt: (time) => {
          const index = frameRef.current.bars.findIndex((bar) => bar.time === time);
          return index < 0 ? null : frameRef.current.macd[index]?.macd ?? null;
        },
      },
      {
        chart: rsiChart,
        series: rsiLine,
        priceAt: (time) => {
          const index = frameRef.current.bars.findIndex((bar) => bar.time === time);
          return index < 0 ? null : frameRef.current.rsi[index];
        },
      },
    ];

    let syncingRange = false;
    for (const source of charts) {
      source.chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
        if (syncingRange || !range) return;
        syncingRange = true;
        for (const other of charts) {
          if (other.chart !== source.chart) other.chart.timeScale().setVisibleLogicalRange(range);
        }
        syncingRange = false;
      });
    }

    let syncingCross = false;
    for (const source of charts) {
      source.chart.subscribeCrosshairMove((param) => {
        if (syncingCross) return;
        setHoverTime(typeof param.time === 'number' ? param.time : null);
        syncingCross = true;
        for (const other of charts) {
          if (other.chart === source.chart) continue;
          if (typeof param.time !== 'number') {
            other.chart.clearCrosshairPosition();
            continue;
          }
          const price = other.priceAt(param.time);
          if (price == null) other.chart.clearCrosshairPosition();
          else other.chart.setCrosshairPosition(price, param.time, other.series);
        }
        syncingCross = false;
      });
    }

    const onClick = (param: MouseEventParams) => {
      const id = param.hoveredInfo?.objectId ?? param.hoveredObjectId;
      if (typeof id === 'string' && id && id !== 'selection') onAnnRef.current(id);
      else onBgRef.current();
    };
    const listenMenu = (chartId: MenuState['chart'], pane: HTMLDivElement, chart: IChartApi, series: ISeriesApi<'Candlestick' | 'Line'>) => {
      const openAt = (clientX: number, clientY: number, touch: boolean) => {
        const rect = pane.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const time = chart.timeScale().coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        const bar = barByTime(time ?? undefined, frameRef.current.bars);
        onMenuRef.current({
          x: clientX,
          y: clientY,
          chart: chartId,
          iso: bar?.iso ?? null,
          price: price == null ? null : price,
          touch,
        });
      };
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        openAt(event.clientX, event.clientY, false);
      };
      let pressTimer = 0;
      let suppressClick = false;
      let origin = { x: 0, y: 0, id: -1 };
      const cancelPress = () => {
        if (!pressTimer) return;
        window.clearTimeout(pressTimer);
        pressTimer = 0;
      };
      const onPointerDown = (event: PointerEvent) => {
        if (event.pointerType === 'mouse' || selectingRef.current) return;
        if (!event.isPrimary) {
          cancelPress();
          return;
        }
        origin = { x: event.clientX, y: event.clientY, id: event.pointerId };
        cancelPress();
        pressTimer = window.setTimeout(() => {
          pressTimer = 0;
          suppressClick = true;
          openAt(origin.x, origin.y, true);
        }, 480);
      };
      const onPointerMove = (event: PointerEvent) => {
        if (!pressTimer || event.pointerId !== origin.id) return;
        if (Math.hypot(event.clientX - origin.x, event.clientY - origin.y) > 10) cancelPress();
      };
      const onPointerEnd = (event: PointerEvent) => {
        if (event.pointerId !== origin.id) return;
        cancelPress();
        if (suppressClick) window.setTimeout(() => { suppressClick = false; }, 500);
      };
      const wrappedClick = (param: MouseEventParams) => {
        if (suppressClick) {
          suppressClick = false;
          return;
        }
        onClick(param);
      };
      pane.addEventListener('contextmenu', handler);
      pane.addEventListener('pointerdown', onPointerDown);
      pane.addEventListener('pointermove', onPointerMove);
      pane.addEventListener('pointerup', onPointerEnd);
      pane.addEventListener('pointercancel', onPointerEnd);
      chart.subscribeClick(wrappedClick);
      return () => {
        cancelPress();
        pane.removeEventListener('contextmenu', handler);
        pane.removeEventListener('pointerdown', onPointerDown);
        pane.removeEventListener('pointermove', onPointerMove);
        pane.removeEventListener('pointerup', onPointerEnd);
        pane.removeEventListener('pointercancel', onPointerEnd);
        chart.unsubscribeClick(wrappedClick);
      };
    };
    const removeMenus = [
      listenMenu('price', pricePane, priceChart, candle),
      listenMenu('macd', macdPane, macdChart, macdLine),
      listenMenu('rsi', rsiPane, rsiChart, rsiLine),
    ];

    applyFrame(frameRef.current, candle, volume, macdLine, macdSignal, macdHist, rsiLine);
    applyRange(priceChart, frameRef.current.bars.length, historyRef.current);
    onReadyRef.current(handles);

    return () => {
      removeMenus.forEach((remove) => remove());
      readyRef.current = null;
      onReadyRef.current(null);
      priceChart.remove();
      macdChart.remove();
      rsiChart.remove();
    };
  }, []);

  useEffect(() => {
    const api = readyRef.current;
    if (!api) return;
    applyFrame(frame, api.candle, api.volume, api.macdLine, api.macdSignal, api.macdHist, api.rsiLine);
    const intraday = frame.timeframe === 'I';
    const yearly = frame.bars.length > 400;
    const options = {
      timeScale: {
        tickMarkFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday, yearly) : ''),
      },
      localization: {
        locale: 'zh-CN',
        timeFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday, yearly) : ''),
      },
    };
    api.priceChart.applyOptions(options);
    api.macdChart.applyOptions(options);
    api.rsiChart.applyOptions(options);
    applyRange(api.priceChart, frame.bars.length, history);
    setHoverTime(null);
  }, [frame, history]);

  useEffect(() => {
    const api = readyRef.current;
    if (!api) return;
    const scale = { rightPriceScale: { minimumWidth: compact ? 62 : 76 } };
    api.priceChart.applyOptions(scale);
    api.macdChart.applyOptions(scale);
    api.rsiChart.applyOptions(scale);
  }, [compact]);

  useEffect(() => {
    if (hoverTime == null) {
      onHoverRef.current(null);
      return;
    }
    const match = frameRef.current.bars.find((item) => item.time === hoverTime);
    onHoverRef.current(match?.iso ?? null);
  }, [hoverTime]);

  const bar = (hoverTime == null ? frame.bars[frame.bars.length - 1] : frame.bars.find((item) => item.time === hoverTime)) ?? frame.bars[frame.bars.length - 1];
  const index = frame.bars.findIndex((item) => item.iso === bar.iso);
  const previous = index > 0 ? frame.bars[index - 1] : null;
  const change = previous ? ((bar.close - previous.close) / previous.close) * 100 : 0;
  const macd = frame.macd[index];
  const rsi = frame.rsi[index];

  return (
    <div className={`${styles.stack} ${compact ? styles.compact : ''}`}>
      <section
        ref={pricePaneRef}
        className={`${styles.pane} ${styles.price} ${selecting === 'price' ? styles.selecting : ''}`}
        aria-label="价格与成交量"
      >
        <div ref={priceHostRef} className={styles.host} />
        <div className={styles.readout}>
          <span>{TIMEFRAME_LONG[frame.timeframe]}</span>
          <span>开 {formatPrice(bar.open)}</span>
          <span>高 {formatPrice(bar.high)}</span>
          <span>低 {formatPrice(bar.low)}</span>
          <span className={change >= 0 ? styles.up : styles.down}>收 {formatPrice(bar.close)} {formatPct(change)}</span>
          <span>量 {formatVolume(bar.volume)}</span>
        </div>
      </section>
      <section
        ref={macdPaneRef}
        className={`${styles.pane} ${styles.sub} ${selecting === 'macd' ? styles.selecting : ''}`}
        aria-label="MACD"
      >
        <div ref={macdHostRef} className={styles.host} />
        <div className={styles.readout}>
          <span>MACD 12 · 26 · 9</span>
          {macd && (
            <>
              <span>{formatOsc(macd.macd)}</span>
              <span>信号 {formatOsc(macd.signal)}</span>
              <span>柱 {formatOsc(macd.hist)}</span>
            </>
          )}
        </div>
      </section>
      <section
        ref={rsiPaneRef}
        className={`${styles.pane} ${styles.sub} ${selecting === 'rsi' ? styles.selecting : ''}`}
        aria-label="RSI"
      >
        <div ref={rsiHostRef} className={styles.host} />
        <div className={styles.readout}>
          <span>RSI 14</span>
          <span>{rsi == null ? '—' : formatRsi(rsi)}</span>
        </div>
      </section>
    </div>
  );
}
