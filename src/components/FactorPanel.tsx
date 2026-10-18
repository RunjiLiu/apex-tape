import { formatDateLabel, formatPct, formatPrice } from '../lib/format';
import type { Bar } from '../types';
import styles from './FactorPanel.module.css';

interface FactorPanelProps {
  bar: Bar;
  following: boolean;
}

const TREND: Record<string, string> = {
  up: '上行',
  down: '下行',
  sideways: '盘整',
};

const VOL: Record<string, string> = {
  low: '偏低',
  mid: '中等',
  high: '偏高',
};

function pct(value: number | null): string {
  if (value == null) return '—';
  return formatPct(value * 100);
}

function plain(value: number | null, digits = 2): string {
  if (value == null) return '—';
  return value.toFixed(digits);
}

function tag(value: string | null, table: Record<string, string>): string {
  if (!value) return '—';
  return table[value] ?? value;
}

export function FactorPanel({ bar, following }: FactorPanelProps) {
  const factor = bar.factor;
  const tone = factor.trendTag === 'up' ? styles.up : factor.trendTag === 'down' ? styles.down : undefined;
  const cells: { label: string; value: string; tone?: string }[] = [
    { label: 'trend_tag', value: tag(factor.trendTag, TREND), tone },
    { label: 'vol_tag', value: tag(factor.volTag, VOL) },
    { label: 'rs_5d', value: pct(factor.rs5d) },
    { label: 'rs_20d', value: pct(factor.rs20d) },
    { label: 'dist_sma20_pct', value: pct(factor.distSma20Pct) },
    { label: 'dist_sma50_pct', value: pct(factor.distSma50Pct) },
    { label: 'dist_sma200_pct', value: pct(factor.distSma200Pct) },
    { label: 'atr_pct_rank_20', value: factor.atrPctRank20 == null ? '—' : String(Math.round(factor.atrPctRank20)) },
    { label: 'atr_pct_rank_60', value: factor.atrPctRank60 == null ? '—' : String(Math.round(factor.atrPctRank60)) },
    { label: 'atr_pct_rank_252', value: factor.atrPctRank252 == null ? '—' : String(Math.round(factor.atrPctRank252)) },
    { label: 'ret_1d', value: pct(factor.ret1d) },
    { label: 'ret_5d', value: pct(factor.ret5d) },
    { label: 'ret_20d', value: pct(factor.ret20d) },
    { label: 'ret_60d', value: pct(factor.ret60d) },
    { label: 'atr_pct', value: pct(factor.atrPct) },
    { label: 'vol_ratio_20', value: factor.volRatio20 == null ? '—' : `${plain(factor.volRatio20)}×` },
    { label: 'dist_ema9_pct', value: pct(factor.distEma9Pct) },
    { label: 'dist_ema21_pct', value: pct(factor.distEma21Pct) },
    { label: 'atr_14', value: factor.atr14 == null ? '—' : formatPrice(factor.atr14) },
  ];

  return (
    <section className={styles.panel} aria-label="当日因子">
      <header className={styles.head}>
        <h2>因子</h2>
        <span>{formatDateLabel(bar.iso)}</span>
        <em>{following ? '十字线' : '最新'}</em>
      </header>
      <dl className={styles.grid}>
        {cells.map((cell) => (
          <div key={cell.label} className={styles.cell}>
            <dt>{cell.label}</dt>
            <dd className={cell.tone}>{cell.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
