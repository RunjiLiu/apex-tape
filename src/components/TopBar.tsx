import { formatPct, formatPrice } from '../lib/format';
import { FEEDS, TIMEFRAME_LABEL, type FeedId, type HistoryView, type Timeframe } from '../types';
import styles from './TopBar.module.css';

interface TopBarProps {
  symbol: string;
  name: string;
  symbols: { symbol: string; name: string }[];
  feed: FeedId;
  timeframe: Timeframe;
  last: number;
  change: number;
  span: string;
  history: HistoryView | null;
  interpret: boolean;
  playing: boolean;
  onFeed: (feed: FeedId) => void;
  onHistory: (history: HistoryView) => void;
  onSymbol: (symbol: string) => void;
  onInterpret: (value: boolean) => void;
  onDemo: () => void;
}

export function TopBar({
  symbol,
  name,
  symbols,
  feed,
  timeframe,
  last,
  change,
  span,
  history,
  interpret,
  playing,
  onFeed,
  onHistory,
  onSymbol,
  onInterpret,
  onDemo,
}: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.identity}>
        <h1>{symbol}</h1>
        <span className={styles.name}>{name}</span>
        <span className={styles.quote}>
          <span>{formatPrice(last)}</span>
          <span className={change >= 0 ? styles.up : styles.down}>{formatPct(change)}</span>
        </span>
        <span className={styles.note}>{span}</span>
      </div>
      <div className={styles.tools}>
        <div className={styles.chips} role="tablist" aria-label="数据源">
          {FEEDS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={feed === item.id}
              className={feed === item.id ? styles.chipOn : styles.chip}
              onClick={() => onFeed(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
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
        {history && (
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
        )}
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
        <button type="button" className={styles.demo} onClick={onDemo} disabled={playing}>
          {playing ? '正在标注…' : '演示对话标注'}
        </button>
      </div>
    </header>
  );
}
