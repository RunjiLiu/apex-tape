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
import { formatOsc, formatPct, formatPrice, formatRsi, formatTick, formatVolume } from '../lib/format';
import { barByTime } from '../lib/snap';
import type { ChartHandles, HistoryView, MarketFrame, MenuState } from '../types';
import { RECENT_TRADING_DAYS, TIMEFRAME_LONG } from '../types';
import styles from './ChartCanvas.module.css';

const FONT = '"Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", sans-serif';
const UP = '#2c6b58';
const DOWN = '#9a4e46';

interface ChartCanvasProps {
  frame: MarketFrame;
  history: HistoryView;
  selecting: 'price' | 'macd' | 'rsi' | null;
  onReady: (handles: ChartHandles | null) => void;
  onContextMenu: (menu: MenuState) => void;
  onAnnotationClick: (id: string) => void;
  onBackgroundClick: () => void;
  onHover: (iso: string | null) => void;
}

function mountChart(container: HTMLElement, margins: { top: number; bottom: number }, intraday: boolean, yearly: boolean): IChartApi {
  return createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: '#fbfaf7' },
      textColor: '#6a706b',
      fontFamily: FONT,
      fontSize: 11,
      attributionLogo: false,
      panes: {
        enableResize: false,
        separatorColor: '#e6e1d8',
        separatorHoverColor: 'rgba(47, 79, 74, 0.16)',
      },
    },
    grid: {
      vertLines: { color: '#efeae2' },
      horzLines: { color: '#efeae2' },
    },
    rightPriceScale: {
      borderColor: '#e6e1d8',
      minimumWidth: 76,
      scaleMargins: margins,
    },
    leftPriceScale: { visible: false },
    timeScale: {
      borderColor: '#e6e1d8',
      rightOffset: 6,
      barSpacing: intraday ? 6 : 7,
      minBarSpacing: 0.1,
      tickMarkFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday, yearly) : ''),
    },
    localization: {
      locale: 'zh-CN',
      timeFormatter: (time: Time) => (typeof time === 'number' ? formatTick(time, intraday, yearly) : ''),
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        color: 'rgba(90, 86, 78, 0.35)',
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: '#2f4f4a',
      },
      horzLine: {
        color: 'rgba(90, 86, 78, 0.35)',
        width: 1,
        style: LineStyle.Dashed,
        labelBackgroundColor: '#2f4f4a',
      },
    },
  });
}

function applyFrame(frame: MarketFrame, api: ChartHandles): void {
  api.candle.setData(frame.bars.map((bar) => ({
    time: bar.time,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  })));
  api.volume.setData(frame.bars.map((bar) => ({
    time: bar.time,
    value: bar.volume,
    color: bar.close >= bar.open ? 'rgba(44, 107, 88, 0.38)' : 'rgba(154, 78, 70, 0.34)',
  })));
  if (!frame.oscillators || !api.macdLine || !api.macdSignal || !api.macdHist || !api.rsiLine) return;
  api.macdLine.setData(frame.bars.map((bar, index) => ({ time: bar.time, value: frame.macd[index].macd })));
  api.macdSignal.setData(frame.bars.map((bar, index) => ({ time: bar.time, value: frame.macd[index].signal })));
  api.macdHist.setData(frame.bars.map((bar, index) => {
    const hist = frame.macd[index].hist;
    return {
      time: bar.time,
      value: hist,
      color: hist >= 0 ? 'rgba(47, 111, 102, 0.72)' : 'rgba(154, 78, 70, 0.68)',
    };
  }));
  api.rsiLine.setData(frame.bars.map((bar, index) => {
    const value = frame.rsi[index];
    return value == null ? { time: bar.time } : { time: bar.time, value };
  }));
}

function applyRange(chart: IChartApi, count: number, history: HistoryView): void {
  const showAll = history === 'all' || count <= RECENT_TRADING_DAYS + 8;
  chart.timeScale().applyOptions({
    minBarSpacing: showAll && count > RECENT_TRADING_DAYS ? 0.12 : 2.5,
    barSpacing: showAll && count > RECENT_TRADING_DAYS ? 0.4 : 6,
    rightOffset: 4,
  });
  if (showAll) chart.timeScale().fitContent();
  else chart.timeScale().setVisibleLogicalRange({ from: count - RECENT_TRADING_DAYS, to: count + 2 });
}

export function ChartCanvas({
  frame,
  history,
  selecting,
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
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  frameRef.current = frame;
  historyRef.current = history;
  onReadyRef.current = onReady;
  onMenuRef.current = onContextMenu;
  onAnnRef.current = onAnnotationClick;
  onBgRef.current = onBackgroundClick;
  onHoverRef.current = onHover;

  useEffect(() => {
    const priceHost = priceHostRef.current;
    const pricePane = pricePaneRef.current;
    const withOsc = frameRef.current.oscillators;
    const macdHost = macdHostRef.current;
    const rsiHost = rsiHostRef.current;
    const macdPane = macdPaneRef.current;
    const rsiPane = rsiPaneRef.current;
    if (!priceHost || !pricePane) return;
    if (withOsc && (!macdHost || !rsiHost || !macdPane || !rsiPane)) return;

    const intraday = frameRef.current.timeframe === 'I';
    const yearly = frameRef.current.bars.length > 400;
    const priceChart = mountChart(priceHost, { top: 0.08, bottom: 0.26 }, intraday, yearly);
    const macdChart = withOsc && macdHost ? mountChart(macdHost, { top: 0.16, bottom: 0.16 }, intraday, yearly) : null;
    const rsiChart = withOsc && rsiHost ? mountChart(rsiHost, { top: 0.16, bottom: 0.16 }, intraday, yearly) : null;

    const candle = priceChart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceLineWidth: 1,
    });
    const volume = priceChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
      priceLineVisible: false,
      lastValueVisible: false,
    });
    priceChart.priceScale('').applyOptions({ scaleMargins: { top: 0.78, bottom: 0 } });

    const macdHist = macdChart?.addSeries(HistogramSeries, {
      priceLineVisible: false,
      lastValueVisible: false,
    }) ?? null;
    const macdSignal = macdChart?.addSeries(LineSeries, {
      color: '#a68462',
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
    }) ?? null;
    const macdLine = macdChart?.addSeries(LineSeries, {
      color: '#3f5c57',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    }) ?? null;
    macdLine?.createPriceLine({
      price: 0,
      color: 'rgba(90, 86, 78, 0.35)',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: false,
      title: '',
    });

    const rsiLine = rsiChart?.addSeries(LineSeries, {
      color: '#5c5270',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      crosshairMarkerVisible: false,
    }) ?? null;
    if (rsiLine) {
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
    ];
    if (macdChart && macdLine) {
      charts.push({
        chart: macdChart,
        series: macdLine,
        priceAt: (time) => {
          const index = frameRef.current.bars.findIndex((bar) => bar.time === time);
          return index < 0 ? null : frameRef.current.macd[index]?.macd ?? null;
        },
      });
    }
    if (rsiChart && rsiLine) {
      charts.push({
        chart: rsiChart,
        series: rsiLine,
        priceAt: (time) => {
          const index = frameRef.current.bars.findIndex((bar) => bar.time === time);
          return index < 0 ? null : frameRef.current.rsi[index];
        },
      });
    }

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
    priceChart.subscribeClick(onClick);
    macdChart?.subscribeClick(onClick);
    rsiChart?.subscribeClick(onClick);

    const listenMenu = (chartId: MenuState['chart'], pane: HTMLDivElement, chart: IChartApi, series: ISeriesApi<'Candlestick' | 'Line'>) => {
      const handler = (event: MouseEvent) => {
        event.preventDefault();
        const rect = pane.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const time = chart.timeScale().coordinateToTime(x);
        const price = series.coordinateToPrice(y);
        const bar = barByTime(time ?? undefined, frameRef.current.bars);
        onMenuRef.current({
          x: event.clientX,
          y: event.clientY,
          chart: chartId,
          iso: bar?.iso ?? null,
          price: price == null ? null : price,
        });
      };
      pane.addEventListener('contextmenu', handler);
      return () => pane.removeEventListener('contextmenu', handler);
    };
    const removeMenus = [
      listenMenu('price', pricePane, priceChart, candle),
    ];
    if (macdPane && macdChart && macdLine) removeMenus.push(listenMenu('macd', macdPane, macdChart, macdLine));
    if (rsiPane && rsiChart && rsiLine) removeMenus.push(listenMenu('rsi', rsiPane, rsiChart, rsiLine));

    applyFrame(frameRef.current, handles);
    applyRange(priceChart, frameRef.current.bars.length, historyRef.current);
    onReadyRef.current(handles);

    return () => {
      removeMenus.forEach((remove) => remove());
      readyRef.current = null;
      onReadyRef.current(null);
      priceChart.remove();
      macdChart?.remove();
      rsiChart?.remove();
    };
  }, [frame.oscillators]);

  useEffect(() => {
    const api = readyRef.current;
    if (!api) return;
    applyFrame(frame, api);
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
    api.macdChart?.applyOptions(options);
    api.rsiChart?.applyOptions(options);
    applyRange(api.priceChart, frame.bars.length, history);
    setHoverTime(null);
  }, [frame, history]);

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
    <div className={styles.stack}>
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
          {!frame.oscillators && <span>无 MACD / RSI</span>}
        </div>
      </section>
      {frame.oscillators && (
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
      )}
      {frame.oscillators && (
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
      )}
    </div>
  );
}
