import { useEffect, useRef } from 'react';
import { formatOsc, formatPrice, formatRangeLabel, formatRsi, formatVolume } from '../lib/format';
import type { ChatMessage, SelectionContext } from '../types';
import styles from './ChatPanel.module.css';

interface ChatPanelProps {
  messages: readonly ChatMessage[];
  pending: boolean;
  context: SelectionContext | null;
  highlight: ReadonlySet<string>;
  open: boolean;
  pinned: boolean;
  onToggleOpen: () => void;
  onTogglePin: () => void;
  onActivate: (id: string) => void;
  onAsk: (question: string) => void;
  onDemo: () => void;
  layout?: 'dock' | 'sheet';
  gesture?: 'context' | 'longpress';
}

const TOKEN = /\[\[([^\]|]+)\|([^\]]+)\]\]/g;

function RichText({
  text,
  highlight,
  onActivate,
}: {
  text: string;
  highlight: ReadonlySet<string>;
  onActivate: (id: string) => void;
}) {
  const nodes: Array<{ key: string; kind: 'text' | 'anchor'; value: string; id?: string }> = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(TOKEN)) {
    const start = match.index ?? 0;
    if (start > last) nodes.push({ key: `t-${index}`, kind: 'text', value: text.slice(last, start) });
    nodes.push({ key: `a-${index}`, kind: 'anchor', value: match[2], id: match[1] });
    last = start + match[0].length;
    index += 1;
  }
  if (last < text.length) nodes.push({ key: `t-end`, kind: 'text', value: text.slice(last) });
  return (
    <>
      {nodes.map((node) => node.kind === 'text' ? (
        <span key={node.key}>{node.value}</span>
      ) : (
        <button
          key={node.key}
          type="button"
          className={`${styles.anchor} ${node.id && highlight.has(node.id) ? styles.anchorOn : ''}`}
          data-anchor={node.id}
          onClick={() => node.id && onActivate(node.id)}
        >
          {node.value}
        </button>
      ))}
    </>
  );
}

export function ChatPanel({
  messages,
  pending,
  context,
  highlight,
  open,
  pinned,
  onToggleOpen,
  onTogglePin,
  onActivate,
  onAsk,
  onDemo,
  layout = 'dock',
  gesture = 'context',
}: ChatPanelProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || highlight.size === 0) return;
    const target = [...el.querySelectorAll<HTMLElement>('[data-anchor]')].find((node) => highlight.has(node.dataset.anchor ?? ''));
    target?.scrollIntoView({ block: 'nearest' });
  }, [highlight]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, pending, open]);

  const submit = () => {
    const value = inputRef.current?.value ?? '';
    if (!value.trim() || pending) return;
    onAsk(value.trim());
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <section
      className={`${styles.panel} ${open ? styles.open : ''} ${pinned ? styles.pinned : styles.floating} ${layout === 'sheet' ? styles.sheetLayout : ''}`}
      aria-label="解读对话"
    >
      <header className={styles.bar}>
        <button type="button" className={styles.barTitle} onClick={onToggleOpen}>
          解读
          {messages.length > 0 && <span className={styles.count}>{messages.length}</span>}
        </button>
        <div className={styles.barActions}>
          {layout !== 'sheet' && (
            <button type="button" className={pinned ? styles.pinOn : styles.pin} aria-pressed={pinned} onClick={onTogglePin}>
              {pinned ? '已固定' : '固定'}
            </button>
          )}
          <button type="button" className={styles.pin} onClick={onToggleOpen} aria-expanded={open}>
            {open ? '收起' : '展开'}
          </button>
        </div>
      </header>
      {open && (
        <>
          {context && (
            <div className={styles.strip}>
              <strong>{context.symbol}</strong>
              <span>{context.timeframeLabel}</span>
              <span>{formatRangeLabel(context.fromIso, context.toIso, context.timeframe)}</span>
              <span>收 {formatPrice(context.close)}</span>
              {context.macd != null && <span>MACD {formatOsc(context.macd)}</span>}
              {context.rsi != null && <span>RSI {formatRsi(context.rsi)}</span>}
              {context.volume != null && (
                <span>{context.fromIso === context.toIso ? '量' : '区间量'} {formatVolume(context.volume)}</span>
              )}
            </div>
          )}
          <div className={styles.scroll} ref={scrollerRef}>
            {messages.length === 0 && !pending && (
              <div className={styles.empty}>
                <p>{gesture === 'longpress' ? '长按价格或指标，把一段走势交给这里。' : '右键价格或指标，把一段走势交给这里。'}</p>
                <p>回答是本地写好的，会带上能画回图上的标注。</p>
                <button type="button" className={styles.demo} onClick={onDemo}>演示对话标注</button>
              </div>
            )}
            {messages.map((message) => (
              <article key={message.id} className={message.role === 'user' ? styles.user : styles.assistant}>
                <span className={styles.role}>{message.role === 'user' ? '你' : '解读'}</span>
                <p>
                  <RichText text={message.text} highlight={highlight} onActivate={onActivate} />
                </p>
              </article>
            ))}
            {pending && <p className={styles.pending}>正在对照图上的读数…</p>}
          </div>
          <form
            className={styles.form}
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <input
              ref={inputRef}
              className={styles.input}
              placeholder="按当前选区追问，回答仍是本地模拟"
              disabled={pending}
              aria-label="追问"
            />
            <button type="submit" className={styles.send} disabled={pending}>发送</button>
          </form>
        </>
      )}
    </section>
  );
}
