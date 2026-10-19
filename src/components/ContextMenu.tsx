import { useEffect, useRef } from 'react';
import type { MenuAction, MenuState } from '../types';
import styles from './ContextMenu.module.css';

const ITEMS: Array<{ id: MenuAction; label: string; hint: string }> = [
  { id: 'select-trend', label: '框选走势', hint: '在价格图上拖一段' },
  { id: 'select-indicator', label: '框选指标', hint: '在 MACD 或 RSI 上拖一段' },
  { id: 'ask-point', label: '对此点提问', hint: '就这一根问' },
  { id: 'explain', label: '解释该指标', hint: '说明当前这张图' },
  { id: 'clear', label: '清除选区', hint: '去掉虚线框' },
];

interface ContextMenuProps {
  menu: MenuState;
  canClear: boolean;
  onChoose: (action: MenuAction) => void;
  onClose: () => void;
}

export function ContextMenu({ menu, canClear, onChoose, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onPointer);
    };
  }, [onClose]);

  useEffect(() => {
    const node = ref.current;
    if (!node || !menu.touch) return;
    node.style.pointerEvents = 'none';
    const timer = window.setTimeout(() => {
      node.style.pointerEvents = '';
    }, 320);
    return () => window.clearTimeout(timer);
  }, [menu.touch]);

  const disabled = (action: MenuAction): boolean => {
    if (action === 'clear') return !canClear;
    if (action === 'select-trend') return menu.chart !== 'price';
    if (action === 'ask-point') return menu.iso == null;
    return false;
  };

  const left = Math.max(8, Math.min(menu.x, window.innerWidth - 220));
  const top = Math.max(8, Math.min(menu.y, window.innerHeight - 300));

  return (
    <div ref={ref} className={styles.menu} style={{ left, top }} role="menu">
      {ITEMS.map((item, index) => (
        <div key={item.id}>
          {index === ITEMS.length - 1 && <div className={styles.sep} />}
          <button
            type="button"
            role="menuitem"
            className={styles.item}
            disabled={disabled(item.id)}
            onClick={() => onChoose(item.id)}
          >
            <span>{item.label}</span>
            <span className={styles.hint}>{item.hint}</span>
          </button>
        </div>
      ))}
    </div>
  );
}
