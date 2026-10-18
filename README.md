# LMDA desk

A single-page chart. Candles, volume, and factors come from the daily tables. MACD and RSI are drawn where the indicator table has a row. A mock conversation can draw annotations back onto those series. Nothing here calls a language model.

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

One database, one path. The page does not offer a vendor switcher, and the sidebar does not show the raw `source` column.

`/cursor/stores/store-660504dc-3643-423f-8daa-b0df0ebd73a0/trading.duckdb`

- `bars_daily` — OHLC and volume. AAPL, GOOGL, and NVDA have 180 sessions (2026-01-30 through 2026-10-16). QQQ has 6945 sessions (1999-03-10 through 2026-10-16).
- `ds_indicators_daily` — factors joined on `symbol` + `trade_date`: returns, relative strength, ATR, `dist_sma20_pct`, `dist_sma50_pct`, `dist_sma200_pct`, `trend_tag`, `vol_tag`, and the related fields.
- `indicators_daily` — `rsi_14`, `macd`, `macd_signal`, `macd_hist` for the same four symbols on the short window only (720 rows). Older QQQ sessions leave those panes blank.

QQQ loads the full history and opens on about the last two years. **近2年** and **全部** switch that window, and the chart can be panned further back. The shorter symbols show every bar. Empty factor cells stay an em dash through warm-up.

The browser cannot open DuckDB, so `scripts/export_bars.py` joins those tables into `src/data/bars.ts`. If the store path is locked or missing, the script also looks at `/workspace/trading.duckdb` and, when the file is locked, copies it before reading.

```bash
python3 scripts/export_bars.py
```

Needs Python `duckdb`. Weekly and intraday chips stay disabled. `bars_1min` is not wired yet.

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
