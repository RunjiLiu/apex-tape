import { useEffect, useRef, useState } from 'react';
import { frameFor, symbolsFor } from './data/market';
import { replyToExplain, replyToPoint, replyToSelection, replyToText } from './data/reply';
import { AnnotationLayer } from './components/AnnotationLayer';
import { AnnotationLegend } from './components/AnnotationLegend';
import { ChartCanvas } from './components/ChartCanvas';
import { ChatPanel } from './components/ChatPanel';
import { ContextMenu } from './components/ContextMenu';
import { FactorPanel } from './components/FactorPanel';
import { SelectionBridge } from './components/SelectionBridge';
import { TopBar } from './components/TopBar';
import { useThread } from './state/useThread';
import { RECENT_TRADING_DAYS, type ChartHandles, type FeedId, type HistoryView, type MenuAction, type MenuState, type SelectMode } from './types';
import styles from './App.module.css';

const HINT: Record<SelectMode['chart'], string> = {
  price: '价格',
  macd: 'MACD',
  rsi: 'RSI',
};

export default function App() {
  const [feed, setFeed] = useState<FeedId>('twelvedata');
  const [symbol, setSymbol] = useState('AAPL');
  const [history, setHistory] = useState<HistoryView>('recent');
  const [hoverIso, setHoverIso] = useState<string | null>(null);
  const [handles, setHandles] = useState<ChartHandles | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [selectMode, setSelectMode] = useState<SelectMode | null>(null);
  const twelveSymbol = useRef('AAPL');
  const thread = useThread();
  const frame = frameFor(feed, symbol);
  const symbols = symbolsFor(feed);
  const longHistory = frame.bars.length > RECENT_TRADING_DAYS + 8;
  const last = frame.bars[frame.bars.length - 1];
  const prev = frame.bars[frame.bars.length - 2];
  const change = prev ? ((last.close - prev.close) / prev.close) * 100 : 0;
  const focus = (hoverIso ? frame.bars.find((bar) => bar.iso === hoverIso) : null) ?? last;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setMenu(null);
      setSelectMode(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const choose = (action: MenuAction) => {
    if (!menu) return;
    if (action === 'clear') {
      thread.clearSelection();
      setSelectMode(null);
      setMenu(null);
      return;
    }
    if (action === 'select-trend') {
      setSelectMode({ chart: 'price', purpose: 'trend' });
      setMenu(null);
      return;
    }
    if (action === 'select-indicator') {
      setSelectMode({ chart: menu.chart === 'price' ? 'macd' : menu.chart, purpose: 'indicator' });
      setMenu(null);
      return;
    }
    setMenu(null);
    setSelectMode(null);
    if (action === 'ask-point' && menu.iso) {
      void thread.push(replyToPoint(frame, menu.chart, menu.iso), 'append');
      return;
    }
    if (action === 'explain') {
      void thread.push(replyToExplain(frame, menu.chart, menu.iso), 'append');
    }
  };

  const playDemo = () => {
    setSelectMode(null);
    setMenu(null);
    void thread.playDemo(frame);
  };

  return (
    <div className={styles.app}>
      <TopBar
        symbol={frame.symbol}
        name={frame.name}
        symbols={symbols}
        feed={feed}
        timeframe={frame.timeframe}
        last={last.close}
        change={change}
        span={`${frame.bars.length} 日 · ${frame.bars[0].iso} – ${last.iso}`}
        history={longHistory ? history : null}
        interpret={thread.interpret}
        playing={thread.busy}
        onFeed={(next) => {
          if (next === feed) return;
          setHoverIso(null);
          setSelectMode(null);
          setMenu(null);
          setHistory('recent');
          thread.reset();
          if (next === 'baidu') {
            if (feed === 'twelvedata') twelveSymbol.current = symbol;
            setSymbol('QQQ');
          } else {
            setSymbol(twelveSymbol.current);
          }
          setFeed(next);
        }}
        onHistory={(next) => {
          setHistory(next);
          setHoverIso(null);
        }}
        onSymbol={(next) => {
          if (feed === 'twelvedata') twelveSymbol.current = next;
          setSymbol(next);
          setHoverIso(null);
          setSelectMode(null);
          setMenu(null);
          thread.reset();
        }}
        onInterpret={thread.setInterpret}
        onDemo={playDemo}
      />
      {selectMode && (
        <div className={styles.hint}>
          在{HINT[selectMode.chart]}图上按住拖拽，框选一段时间。
          <button type="button" onClick={() => setSelectMode(null)}>取消</button>
        </div>
      )}
      <div className={styles.body}>
        <div className={styles.stage}>
          <ChartCanvas
            frame={frame}
            history={longHistory ? history : 'all'}
            selecting={selectMode?.chart ?? null}
            onReady={setHandles}
            onContextMenu={(next) => {
              setSelectMode(null);
              setMenu(next);
            }}
            onAnnotationClick={thread.activate}
            onBackgroundClick={thread.clearHighlight}
            onHover={setHoverIso}
          />
          <AnnotationLayer
            handles={handles}
            frame={frame}
            annotations={thread.drawn}
            highlight={thread.highlight}
            onActivate={thread.activate}
          />
          <SelectionBridge
            handles={handles}
            frame={frame}
            mode={selectMode}
            onComplete={({ fromIso, toIso, chart }) => {
              const purpose = selectMode?.purpose ?? 'trend';
              setSelectMode(null);
              void thread.push(replyToSelection(frame, chart, purpose, fromIso, toIso), 'append');
            }}
            onCancel={() => setSelectMode(null)}
          />
        </div>
        <div className={styles.side}>
          <FactorPanel bar={focus} feed={frame.source} following={hoverIso != null && focus.iso === hoverIso} />
          <AnnotationLegend
            frame={frame}
            annotations={thread.annotations}
            interpret={thread.interpret}
            hiddenIds={thread.hiddenIds}
            hiddenCharts={thread.hiddenCharts}
            highlight={thread.highlight}
            onToggleId={thread.toggleId}
            onToggleChart={thread.toggleChart}
            onActivate={thread.activate}
            onDemo={playDemo}
          />
          <ChatPanel
            messages={thread.messages}
            pending={thread.pending}
            context={thread.context}
            highlight={thread.highlight}
            open={thread.open}
            pinned={thread.pinned}
            onToggleOpen={() => thread.setOpen(!thread.open)}
            onTogglePin={() => thread.setPinned(!thread.pinned)}
            onActivate={thread.activate}
            onAsk={(question) => {
              void thread.push(replyToText(frame, question, thread.context), 'append');
            }}
            onDemo={playDemo}
          />
        </div>
      </div>
      {menu && (
        <ContextMenu
          menu={menu}
          canClear={thread.context != null}
          indicators={frame.oscillators}
          onChoose={choose}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  );
}
