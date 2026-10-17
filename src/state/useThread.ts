import { useMemo, useRef, useState } from 'react';
import { buildDemo } from '../data/demo';
import { expandHighlight } from '../lib/highlight';
import type { Annotation, AskResult, ChatMessage, MarketFrame, SelectionContext } from '../types';

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function useThread() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [context, setContext] = useState<SelectionContext | null>(null);
  const [selection, setSelection] = useState<Annotation | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const [hiddenCharts, setHiddenCharts] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(true);
  const [interpret, setInterpret] = useState(true);
  const runRef = useRef(0);

  const annotations = useMemo(
    () => messages.flatMap((message) => message.annotations ?? []),
    [messages],
  );
  const highlight = useMemo(
    () => expandHighlight(annotations, highlightId),
    [annotations, highlightId],
  );
  const drawn = useMemo(() => {
    const visible = interpret
      ? annotations.filter((annotation) => !hiddenIds[annotation.id] && !hiddenCharts[annotation.chart])
      : [];
    return selection ? [...visible, selection] : visible;
  }, [annotations, hiddenCharts, hiddenIds, interpret, selection]);

  const activate = (id: string) => {
    setHighlightId((current) => (current === id ? null : id));
    setOpen(true);
  };

  const clearSelection = () => {
    setSelection(null);
    setContext(null);
  };

  const push = async (result: AskResult, mode: 'replace' | 'append') => {
    const run = ++runRef.current;
    setBusy(true);
    try {
    setInterpret(true);
    setOpen(true);
    setContext(result.context);
    setSelection(result.selection);
    setHighlightId(null);
    if (mode === 'replace') {
      setHiddenIds({});
      setHiddenCharts({});
    }
    const user: ChatMessage = { id: uid(), role: 'user', text: result.userText };
    setMessages((prev) => (mode === 'replace' ? [user] : [...prev, user]));
    setPending(true);
    await wait(680);
    if (runRef.current !== run) return;
    const assistantId = uid();
    const assistant: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      text: result.assistantText,
      annotations: mode === 'replace' ? [] : result.annotations,
    };
    setMessages((prev) => [...prev, assistant]);
    setPending(false);
    if (mode !== 'replace') {
      setHighlightId(result.annotations[0]?.id ?? null);
      return;
    }
    for (let index = 1; index <= result.annotations.length; index += 1) {
      await wait(210);
      if (runRef.current !== run) return;
      const slice = result.annotations.slice(0, index);
      setMessages((prev) => prev.map((message) => (
        message.id === assistantId ? { ...message, annotations: slice } : message
      )));
      setHighlightId(slice[slice.length - 1]?.id ?? null);
    }
    await wait(420);
    if (runRef.current === run) setHighlightId(null);
    } finally {
      if (runRef.current === run) setBusy(false);
    }
  };

  const reset = () => {
    runRef.current += 1;
    setMessages([]);
    setPending(false);
    setBusy(false);
    setContext(null);
    setSelection(null);
    setHighlightId(null);
    setHiddenIds({});
    setHiddenCharts({});
  };

  const playDemo = (frame: MarketFrame) => push(buildDemo(frame), 'replace');

  return {
    messages,
    pending,
    busy,
    context,
    annotations,
    drawn,
    highlight,
    hiddenIds,
    hiddenCharts,
    open,
    pinned,
    interpret,
    setInterpret,
    setOpen,
    setPinned,
    activate,
    clearHighlight: () => setHighlightId(null),
    clearSelection,
    toggleId: (id: string) => setHiddenIds((prev) => ({ ...prev, [id]: !prev[id] })),
    toggleChart: (chart: string) => setHiddenCharts((prev) => ({ ...prev, [chart]: !prev[chart] })),
    push,
    playDemo,
    reset,
  };
}
