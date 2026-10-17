# LMDA desk

A single-page chart for one symbol. Candles, volume, MACD, and RSI come from a DuckDB view. A mock conversation can draw annotations back onto those series. Nothing here calls a language model.

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

Default source is the read-only database:

`/cursor/stores/store-660504dc-3643-423f-8daa-b0df0ebd73a0/trading.duckdb`

View: `v_ds_bars_indicators`.

Symbols: AAPL, GOOGL, NVDA, QQQ. 180 daily bars each (720 rows), 2026-01-30 through 2026-10-16. The chart loads the full series; it does not clip to the last month. OHLC, volume, `rsi_14`, `macd`, `macd_signal`, and `macd_hist` are plotted as stored. The right-hand factor list shows `trend_tag`, `vol_tag`, `rs_5d`, `rs_20d`, returns, ATR, moving-average distance, `vol_ratio_20`, and `ds_source` for the latest bar, or the bar under the crosshair. `ret_20d` and `dist_sma50_pct` stay empty during the warm-up and then fill in; the sidebar prints an em dash until a value exists.

The browser cannot open DuckDB, so `scripts/export_bars.py` snapshots the view into `src/data/bars.ts`. That file is what the page imports. If the store path is missing, the script also looks at `/workspace/trading.duckdb`.

```bash
python3 scripts/export_bars.py
```

Needs Python `duckdb`. Weekly and intraday chips stay disabled: this view is daily only.

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
