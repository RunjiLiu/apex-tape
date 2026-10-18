# LMDA desk

A single-page chart. Candles and volume come from one selected DuckDB source at a time. Twelve Data also supplies MACD and RSI. A mock conversation can draw annotations back onto those series. Nothing here calls a language model.

## Run

```bash
npm install
npm run dev
```

The dev server listens on [http://127.0.0.1:4327](http://127.0.0.1:4327).

```bash
npm run build
```

## Data

Both sources are read from the same database, and the page never mixes their volumes:

`/cursor/stores/store-660504dc-3643-423f-8daa-b0df0ebd73a0/trading.duckdb`

The top bar switches sources.

**Twelve Data (4 symbols, 180d)** is the default. View: `v_ds_bars_indicators`. Symbols: AAPL, GOOGL, NVDA, QQQ. 180 daily bars each (720 rows), 2026-01-30 through 2026-10-16. The chart shows the full series. OHLC, volume, `rsi_14`, `macd`, `macd_signal`, and `macd_hist` are plotted as stored. The sidebar shows `trend_tag`, `vol_tag`, `rs_5d`, `rs_20d`, returns, ATR, moving-average distance, `vol_ratio_20`, and `ds_source` for the latest bar, or the bar under the crosshair. `ret_20d` and `dist_sma50_pct` stay empty during the warm-up and then fill in; the sidebar prints an em dash until a value exists.

```bash
python3 scripts/export_bars.py
```

That writes `src/data/bars.ts`.

**Baidu QQQ (long history)** is QQQ only. Bars: `v_bars_baidu_daily` (also `bars_baidu`), 6945 rows, 1999-03-10 through 2026-10-16, `adjust_type=split_only`. Factors: `ds_baidu_qqq_daily`, joined on `symbol` + `trade_date` + `ts_et`. The sidebar uses those fields, including `ret_60d`, `dist_sma200_pct`, `atr_pct_rank_60`, `atr_pct_rank_252`, `trend_tag`, and `vol_tag`. This table has no MACD or RSI, so those panes stay off and their volumes are not borrowed from Twelve Data. The chart loads every bar and opens on about the last two years; **近2年** and **全部** switch the window, and you can pan into the rest of the history.

```bash
python3 scripts/export_bars_baidu.py
```

That writes `src/data/bars_baidu_qqq.ts`.

The browser cannot open DuckDB, so the page imports those snapshots. If the store path is missing, each script also looks at `/workspace/trading.duckdb`. Needs Python `duckdb`. Weekly and intraday chips stay disabled: both feeds are daily only.

## Annotation schema

```ts
type AnnotationType = 'band' | 'marker' | 'hline' | 'trendline' | 'vline' | 'rect' | 'ellipse' | 'label' | 'link';

interface Annotation {
  id: string;
  type: AnnotationType;
  chart: 'price' | 'volume' | 'macd' | 'rsi' | string;
  from?: string; // ISO
  to?: string;
  price?: number;
  price2?: number;
  points?: { t: string; p: number }[];
  label?: string;
  style?: { color?: string; opacity?: number; dash?: boolean };
  linkTo?: string[];
  messageAnchor?: string;
}
```

Bands, horizontal lines, trend lines, vertical lines, rectangles, ellipses, links, and markers are drawn by a lightweight-charts series primitive on the pane canvas, in media coordinates, so they stay attached to time and price while you pan or zoom. Rectangles and ellipses are real geometry (`roundRect` / `ctx.ellipse` inside the time-price box), not a stand-in made of a band plus markers. Fills sit behind the series; strokes, lines, and markers sit in front. Markers are circles from that same primitive, not the built-in series-markers plugin, so highlight and dimming match the other layers. Labels are HTML buttons positioned with `timeToCoordinate` / `priceToCoordinate`, so a click on a label and a click on a message anchor highlight each other. Volume annotations use the volume series scale.

MACD zero and RSI 30/70 are ordinary price lines, separate from the annotation list.

## What is mocked

The chat replies, including **演示对话标注**, are local templates. They return prose plus an `annotations` array. No API key and no model. Right-click the chart for 框选走势, 框选指标, 对此点提问, 解释该指标, or 清除选区. 解读模式 hides or shows the overlay. The price series underneath stays the DuckDB data.

Charts are [TradingView Lightweight Charts](https://www.tradingview.com/) (Apache-2.0). A link sits at the bottom of the sidebar.
