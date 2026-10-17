import { annotationFits } from '../lib/snap';
import type { Annotation, MarketFrame } from '../types';
import styles from './AnnotationLegend.module.css';

const CHART_ORDER = ['price', 'volume', 'macd', 'rsi'] as const;

const CHART_NAME: Record<string, string> = {
  price: '价格',
  volume: '成交量',
  macd: 'MACD',
  rsi: 'RSI',
};

const TYPE_NAME: Record<string, string> = {
  band: '区间',
  marker: '标记',
  hline: '水平线',
  trendline: '趋势线',
  vline: '垂直线',
  rect: '矩形',
  ellipse: '椭圆',
  label: '文字',
  link: '关联',
};

interface AnnotationLegendProps {
  frame: MarketFrame;
  annotations: readonly Annotation[];
  interpret: boolean;
  hiddenIds: Readonly<Record<string, boolean>>;
  hiddenCharts: Readonly<Record<string, boolean>>;
  highlight: ReadonlySet<string>;
  onToggleId: (id: string) => void;
  onToggleChart: (chart: string) => void;
  onActivate: (id: string) => void;
  onDemo: () => void;
}

export function AnnotationLegend({
  frame,
  annotations,
  interpret,
  hiddenIds,
  hiddenCharts,
  highlight,
  onToggleId,
  onToggleChart,
  onActivate,
  onDemo,
}: AnnotationLegendProps) {
  const visible = annotations.filter((annotation) => annotation.id !== 'selection');
  const groups = new Map<string, Annotation[]>();
  for (const annotation of visible) {
    const list = groups.get(annotation.chart) ?? [];
    list.push(annotation);
    groups.set(annotation.chart, list);
  }
  const ordered = [
    ...CHART_ORDER.filter((chart) => groups.has(chart)),
    ...[...groups.keys()].filter((chart) => !CHART_ORDER.includes(chart as typeof CHART_ORDER[number])),
  ];

  return (
    <aside className={styles.legend}>
      <div className={styles.heading}>
        <h2>标注</h2>
        {visible.length > 0 && <span>{visible.length}</span>}
      </div>
      {visible.length === 0 ? (
        <div className={styles.empty}>
          <p>还没有写到图上的解读。</p>
          <p>在蜡烛或指标上右键，可以框选一段时间，或针对某一根来问。也可以直接播放一段演示对话。</p>
          <button type="button" onClick={onDemo}>演示对话标注</button>
        </div>
      ) : (
        <>
          {!interpret && <p className={styles.note}>解读模式关着，标注先不画。打开之后会回到图上。</p>}
          {frame.timeframe === 'I' && <p className={styles.note}>分时只有当天，日线上的标注对不齐时会空着。</p>}
          <ul className={styles.groups}>
            {ordered.map((chart) => {
              const items = groups.get(chart);
              if (!items) return null;
              const chartHidden = Boolean(hiddenCharts[chart]);
              return (
                <li key={chart}>
                  <div className={styles.groupHead}>
                    <span>{CHART_NAME[chart] ?? chart}</span>
                    <button type="button" className={styles.eye} aria-pressed={!chartHidden} onClick={() => onToggleChart(chart)}>
                      {chartHidden ? '显示层' : '隐藏层'}
                    </button>
                  </div>
                  <ul className={styles.items}>
                    {items.map((annotation) => {
                      const placed = annotationFits(frame, annotation.from, annotation.to, annotation.points);
                      const hidden = chartHidden || Boolean(hiddenIds[annotation.id]);
                      const active = highlight.has(annotation.id);
                      return (
                        <li key={annotation.id}>
                          <button
                            type="button"
                            className={`${styles.row} ${active ? styles.rowOn : ''} ${hidden || !placed ? styles.dim : ''}`}
                            onClick={() => onActivate(annotation.id)}
                          >
                            <i style={{ background: annotation.style?.color ?? '#5c6b73' }} />
                            <span>{annotation.label || TYPE_NAME[annotation.type] || annotation.type}</span>
                            {!placed && <em>视野外</em>}
                          </button>
                          <button type="button" className={styles.eye} aria-pressed={!hidden} onClick={() => onToggleId(annotation.id)}>
                            {hidden ? '显示' : '隐藏'}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              );
            })}
          </ul>
        </>
      )}
      <p className={styles.credit}>
        图表由 <a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">TradingView Lightweight Charts</a> 绘制
      </p>
    </aside>
  );
}
