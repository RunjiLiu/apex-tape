import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { IChartApi } from 'lightweight-charts';
import { barByTime } from '../lib/snap';
import type { ChartHandles, MarketFrame, SelectMode } from '../types';
import styles from './SelectionBridge.module.css';

interface SelectionBridgeProps {
  handles: ChartHandles | null;
  frame: MarketFrame;
  mode: SelectMode | null;
  onComplete: (range: { fromIso: string; toIso: string; chart: SelectMode['chart'] }) => void;
  onCancel: () => void;
}

interface Drag {
  chart: SelectMode['chart'];
  x0: number;
  x1: number;
}

function chartOf(handles: ChartHandles, chart: SelectMode['chart']): IChartApi {
  if (chart === 'macd') return handles.macdChart;
  if (chart === 'rsi') return handles.rsiChart;
  return handles.priceChart;
}

export function SelectionBridge({ handles, frame, mode, onComplete, onCancel }: SelectionBridgeProps) {
  const [drag, setDrag] = useState<Drag | null>(null);
  const frameRef = useRef(frame);
  const completeRef = useRef(onComplete);
  const cancelRef = useRef(onCancel);
  frameRef.current = frame;
  completeRef.current = onComplete;
  cancelRef.current = onCancel;

  useEffect(() => {
    if (!handles || !mode) return;
    const pane = handles.panes[mode.chart];
    const chart = chartOf(handles, mode.chart);
    chart.applyOptions({ handleScroll: false, handleScale: false });
    let startX = 0;
    let currentX = 0;
    let dragging = false;

    const localX = (event: PointerEvent) => event.clientX - pane.getBoundingClientRect().left;

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const x = localX(event);
      const plot = chart.timeScale().width();
      if (x < 0 || x > plot) return;
      event.preventDefault();
      event.stopPropagation();
      dragging = true;
      startX = x;
      currentX = x;
      pane.setPointerCapture(event.pointerId);
      setDrag({ chart: mode.chart, x0: x, x1: x });
    };
    const onMove = (event: PointerEvent) => {
      if (!dragging) return;
      currentX = localX(event);
      setDrag({ chart: mode.chart, x0: startX, x1: currentX });
    };
    const finish = () => {
      if (!dragging) return;
      dragging = false;
      const left = Math.min(startX, currentX);
      const right = Math.max(startX, currentX);
      const span = Math.max(right, left + 1);
      const start = chart.timeScale().coordinateToTime(left) ?? chart.timeScale().coordinateToTime(span);
      const end = chart.timeScale().coordinateToTime(right) ?? start;
      setDrag(null);
      const from = barByTime(start ?? undefined, frameRef.current.bars);
      const to = barByTime(end ?? undefined, frameRef.current.bars);
      if (!from || !to) {
        cancelRef.current();
        return;
      }
      completeRef.current({ fromIso: from.iso, toIso: to.iso, chart: mode.chart });
    };

    pane.addEventListener('pointerdown', onDown, true);
    pane.addEventListener('pointermove', onMove, true);
    pane.addEventListener('pointerup', finish, true);
    pane.addEventListener('pointercancel', finish, true);
    return () => {
      chart.applyOptions({
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
      pane.removeEventListener('pointerdown', onDown, true);
      pane.removeEventListener('pointermove', onMove, true);
      pane.removeEventListener('pointerup', finish, true);
      pane.removeEventListener('pointercancel', finish, true);
      setDrag(null);
    };
  }, [handles, mode]);

  if (!handles || !drag) return null;
  const pane = handles.panes[drag.chart];
  const chart = chartOf(handles, drag.chart);
  const bottom = chart.timeScale().height();
  const left = Math.min(drag.x0, drag.x1);
  const width = Math.max(1, Math.abs(drag.x1 - drag.x0));
  return createPortal(
    <div className={styles.band} style={{ left, width, bottom }} />,
    pane,
  );
}
