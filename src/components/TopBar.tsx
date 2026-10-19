import { useEffect, useRef, useState } from 'react';
import { formatPct, formatPrice } from '../lib/format';
import { TIMEFRAME_LABEL, type HistoryView, type Timeframe } from '../types';
import styles from './TopBar.module.css';

interface TopBarProps {
  symbol: string;
  name: string;
  symbols: { symbol: string; name: string }[];
  timeframe: Timeframe;
  last: number;
  change: number;
  span: string;
  history: HistoryView | null;
  interpret: boolean;
  playing: boolean;
  compact: boolean;
  onHistory: (history: HistoryView) => void;
  onSymbol: (symbol: string) => void;
  onInterpret: (value: boolean) => void;
  onDemo: () => void;
}

export function TopBar({
  symbol,
  name,
  symbols,
  timeframe,
  last,
  change,
  span,
  history,
  interpret,
  playing,
  compact,
  onHistory,
  onSymbol,
  onInterpret,
  onDemo,
}: TopBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreKey, setMoreKey] = useState(`${symbol}:${compact}`);
  const moreRef = useRef<HTMLDivElement>(null);
  const nextMoreKey = `${symbol}:${compact}`;
  if (nextMoreKey !== moreKey) {
    setMoreKey(nextMoreKey);
    setMoreOpen(false);
  }

  useEffect(() => {
    if (!moreOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
    };
  }, [moreOpen]);

  const symbolsControl = (
    <div className={styles.chips} role="tablist" aria-label="标的">
      {symbols.map((item) => (
        <button
          key={item.symbol}
          type="button"
          role="tab"
          aria-selected={symbol === item.symbol}
          className={symbol === item.symbol ? styles.chipOn : styles.chip}
          onClick={() => onSymbol(item.symbol)}
        >
          {item.symbol}
        </button>
      ))}
    </div>
  );

  const timeframeControl = (
    <div className={styles.chips} role="tablist" aria-label="周期">
      <button type="button" role="tab" aria-selected={timeframe === 'D'} className={styles.chipOn}>
        {TIMEFRAME_LABEL.D}
      </button>
      <button type="button" className={styles.chip} disabled title="视图里只有日线">
        {TIMEFRAME_LABEL.W}
      </button>
      <button type="button" className={styles.chip} disabled title="视图里只有日线">
        {TIMEFRAME_LABEL.I}
      </button>
    </div>
  );

  const historyControl = history && (
    <div className={styles.chips} role="tablist" aria-label="视野">
      <button
        type="button"
        role="tab"
        aria-selected={history === 'recent'}
        className={history === 'recent' ? styles.chipOn : styles.chip}
        onClick={() => onHistory('recent')}
      >
        近2年
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={history === 'all'}
        className={history === 'all' ? styles.chipOn : styles.chip}
        onClick={() => onHistory('all')}
      >
        全部
      </button>
    </div>
  );

  const interpretControl = (
    <button
      type="button"
      role="switch"
      aria-checked={interpret}
      className={interpret ? styles.switchOn : styles.switch}
      onClick={() => onInterpret(!interpret)}
    >
      <span className={styles.knob} />
      解读模式
    </button>
  );

  const demoControl = (
    <button type="button" className={styles.demo} onClick={onDemo} disabled={playing}>
      {playing ? '正在标注…' : '演示对话标注'}
    </button>
  );

  return (
    <header className={`${styles.bar} ${compact ? styles.compact : ''}`}>
      <div className={styles.identity}>
        <h1>{symbol}</h1>
        <span className={styles.name}>{name}</span>
        <span className={styles.quote}>
          <span>{formatPrice(last)}</span>
          <span className={change >= 0 ? styles.up : styles.down}>{formatPct(change)}</span>
        </span>
        {!compact && <span className={styles.note}>{span}</span>}
      </div>
      {compact ? (
        <div className={styles.compactRow} ref={moreRef}>
          <div className={styles.symbolRow}>{symbolsControl}</div>
          <button
            type="button"
            className={moreOpen ? `${styles.more} ${styles.moreOn}` : styles.more}
            aria-expanded={moreOpen}
            aria-haspopup="true"
            onClick={() => setMoreOpen((open) => !open)}
          >
            更多
          </button>
          {moreOpen && (
            <div className={styles.morePanel}>
              <span className={styles.spanNote}>{span}</span>
              {timeframeControl}
              {historyControl}
              {interpretControl}
              {demoControl}
            </div>
          )}
        </div>
      ) : (
        <div className={styles.tools}>
          {symbolsControl}
          {timeframeControl}
          {historyControl}
          {interpretControl}
          {demoControl}
        </div>
      )}
    </header>
  );
}
