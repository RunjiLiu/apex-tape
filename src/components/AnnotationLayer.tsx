import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Annotation, ChartHandles, MarketFrame } from '../types';
import { buildLabels } from '../chart/geometry';
import { AnnotationPrimitive } from '../chart/annotationPrimitive';
import styles from './AnnotationLayer.module.css';

interface AnnotationLayerProps {
  handles: ChartHandles | null;
  frame: MarketFrame;
  annotations: readonly Annotation[];
  highlight: ReadonlySet<string>;
  onActivate: (id: string) => void;
}

export function AnnotationLayer({ handles, frame, annotations, highlight, onActivate }: AnnotationLayerProps) {
  const stateRef = useRef({ frame, annotations, highlight });
  const primitivesRef = useRef<AnnotationPrimitive[]>([]);
  const [viewTick, setViewTick] = useState(0);
  stateRef.current = { frame, annotations, highlight };

  useEffect(() => {
    if (!handles) return;
    const bindings: { id: string; series: ChartHandles['candle'] | NonNullable<ChartHandles['macdLine']> | ChartHandles['volume'] }[] = [
      { id: 'price', series: handles.candle },
      { id: 'volume', series: handles.volume },
    ];
    if (handles.macdLine) bindings.push({ id: 'macd', series: handles.macdLine });
    if (handles.rsiLine) bindings.push({ id: 'rsi', series: handles.rsiLine });
    const primitives = bindings.map((binding) => {
      const primitive = new AnnotationPrimitive(binding.id, () => stateRef.current);
      binding.series.attachPrimitive(primitive);
      return primitive;
    });
    primitivesRef.current = primitives;
    primitives.forEach((primitive) => primitive.refresh());
    return () => {
      bindings.forEach((binding, index) => {
        binding.series.detachPrimitive(primitives[index]);
      });
      primitivesRef.current = [];
    };
  }, [handles]);

  useEffect(() => {
    primitivesRef.current.forEach((primitive) => primitive.refresh());
  }, [frame, annotations, highlight]);

  useEffect(() => {
    if (!handles) return;
    const bump = () => setViewTick((value) => value + 1);
    const charts = [handles.priceChart, handles.macdChart, handles.rsiChart].filter((chart): chart is NonNullable<typeof chart> => chart != null);
    charts.forEach((chart) => {
      chart.timeScale().subscribeVisibleLogicalRangeChange(bump);
      chart.timeScale().subscribeSizeChange(bump);
    });
    return () => {
      charts.forEach((chart) => {
        chart.timeScale().unsubscribeVisibleLogicalRangeChange(bump);
        chart.timeScale().unsubscribeSizeChange(bump);
      });
    };
  }, [handles]);

  const labels = useMemo(() => {
    if (!handles) return [];
    return buildLabels(handles, frame, annotations, highlight);
  }, [handles, frame, annotations, highlight, viewTick]);

  if (!handles) return null;
  const groups = {
    price: labels.filter((label) => label.pane === 'price'),
    macd: labels.filter((label) => label.pane === 'macd'),
    rsi: labels.filter((label) => label.pane === 'rsi'),
  };

  return (
    <>
      {(Object.keys(groups) as Array<keyof typeof groups>).map((pane) => {
        const target = handles.panes[pane];
        if (!target) return null;
        return createPortal(
          <div className={styles.overlay}>
            {groups[pane].map((label) => (
              <button
                key={label.id}
                type="button"
                className={`${styles.label} ${styles[label.placement]} ${label.active ? styles.active : ''}`}
                style={{ left: label.x, top: label.placement === 'top' ? 8 : label.y, borderColor: label.color }}
                onClick={(event) => {
                  event.stopPropagation();
                  onActivate(label.id);
                }}
              >
                {label.text}
              </button>
            ))}
          </div>,
          target,
        );
      })}
    </>
  );
}
