import type { CanvasRenderingTarget2D } from 'fancy-canvas';
import type {
  IChartApi,
  IPrimitivePaneRenderer,
  IPrimitivePaneView,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  SeriesType,
} from 'lightweight-charts';
import type { Annotation, MarketFrame } from '../types';
import { withAlpha } from '../lib/format';
import { buildShapes, type Shape } from './geometry';

interface ViewState {
  frame: MarketFrame;
  annotations: readonly Annotation[];
  highlight: ReadonlySet<string>;
}

class AnnotationRenderer implements IPrimitivePaneRenderer {
  private readonly shapes: readonly Shape[];

  constructor(shapes: readonly Shape[]) {
    this.shapes = shapes;
  }

  draw(target: CanvasRenderingTarget2D): void {
    if (this.shapes.length === 0) return;
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      for (const shape of this.shapes) {
        context.save();
        context.globalAlpha = shape.dimmed ? 0.28 : 1;
        context.lineJoin = 'round';
        context.lineCap = 'round';
        context.setLineDash(shape.dash ? [4, 3] : []);
        const strokeWidth = shape.highlighted ? 2.25 : 1.15;
        context.lineWidth = strokeWidth;
        const area = shape.kind === 'rect' || shape.kind === 'ellipse';
        const strokeAlpha = area
          ? (shape.highlighted ? 0.95 : 0.55)
          : (shape.highlighted ? 1 : Math.min(1, Math.max(shape.opacity, 0.75)));
        context.strokeStyle = withAlpha(shape.color, strokeAlpha);
        context.fillStyle = withAlpha(shape.color, shape.highlighted ? Math.min(0.34, shape.opacity + 0.12) : shape.opacity);
        if (shape.kind === 'rect' || shape.kind === 'ellipse') {
          drawArea(context, shape);
        } else if (shape.kind === 'segment') {
          context.beginPath();
          context.moveTo(shape.x1, shape.y1);
          context.lineTo(shape.x2, shape.y2);
          context.stroke();
        } else if (shape.kind === 'vline') {
          context.beginPath();
          context.moveTo(shape.x1, 6);
          context.lineTo(shape.x1, mediaSize.height - 4);
          context.stroke();
        } else if (shape.kind === 'polyline' && shape.points && shape.points.length > 1) {
          context.beginPath();
          context.moveTo(shape.points[0].x, shape.points[0].y);
          for (const point of shape.points.slice(1)) context.lineTo(point.x, point.y);
          context.stroke();
        } else if (shape.kind === 'marker') {
          const radius = shape.highlighted ? 5.5 : 4;
          context.beginPath();
          context.arc(shape.x1, shape.y1, radius, 0, Math.PI * 2);
          context.fillStyle = withAlpha(shape.color, shape.dimmed ? 0.45 : 0.95);
          context.fill();
          context.lineWidth = 1.5;
          context.strokeStyle = 'rgba(251, 251, 252, 0.95)';
          context.setLineDash([]);
          context.stroke();
          if (shape.highlighted) {
            context.beginPath();
            context.arc(shape.x1, shape.y1, radius + 3.5, 0, Math.PI * 2);
            context.strokeStyle = withAlpha(shape.color, 0.9);
            context.lineWidth = 1.25;
            context.stroke();
          }
        }
        context.restore();
      }
    });
  }
}

function drawArea(context: CanvasRenderingContext2D, shape: Shape): void {
  const left = Math.min(shape.x1, shape.x2);
  const right = Math.max(shape.x1, shape.x2);
  const top = Math.min(shape.y1, shape.y2);
  const bottom = Math.max(shape.y1, shape.y2);
  const width = Math.max(1, right - left);
  const height = Math.max(1, bottom - top);
  context.beginPath();
  if (shape.kind === 'ellipse') {
    context.ellipse(left + width / 2, top + height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (typeof context.roundRect === 'function') {
    context.roundRect(left, top, width, height, 4);
  } else {
    context.rect(left, top, width, height);
  }
  if (shape.fill) context.fill();
  if (shape.stroke) context.stroke();
}

class AnnotationPaneView implements IPrimitivePaneView {
  private readonly layer: 'back' | 'front';
  private drawing: AnnotationRenderer = new AnnotationRenderer([]);

  constructor(layer: 'back' | 'front') {
    this.layer = layer;
  }

  zOrder(): 'bottom' | 'top' {
    return this.layer === 'back' ? 'bottom' : 'top';
  }

  renderer(): IPrimitivePaneRenderer {
    return this.drawing;
  }

  setShapes(shapes: readonly Shape[]): void {
    const filtered = shapes.flatMap((shape) => {
      const area = shape.kind === 'rect' || shape.kind === 'ellipse';
      if (this.layer === 'back') return area && shape.fill ? [{ ...shape, stroke: false }] : [];
      if (!area) return [shape];
      return shape.stroke ? [{ ...shape, fill: false }] : [];
    });
    this.drawing = new AnnotationRenderer(filtered);
  }
}

function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = dx * dx + dy * dy;
  if (length === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / length));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function hitShape(shape: Shape, x: number, y: number): { distance: number; priority: number } | null {
  if (shape.kind === 'marker') {
    const distance = Math.hypot(x - shape.x1, y - shape.y1);
    return distance <= 8 ? { distance, priority: 2 } : null;
  }
  if (shape.kind === 'vline') {
    return Math.abs(x - shape.x1) <= 5 ? { distance: Math.abs(x - shape.x1), priority: 1 } : null;
  }
  if (shape.kind === 'segment') {
    const distance = distanceToSegment(x, y, shape.x1, shape.y1, shape.x2, shape.y2);
    return distance <= 6 ? { distance, priority: 1 } : null;
  }
  if (shape.kind === 'polyline' && shape.points) {
    let best = Infinity;
    for (let index = 1; index < shape.points.length; index += 1) {
      const previous = shape.points[index - 1];
      const current = shape.points[index];
      best = Math.min(best, distanceToSegment(x, y, previous.x, previous.y, current.x, current.y));
    }
    return best <= 6 ? { distance: best, priority: 1 } : null;
  }
  const left = Math.min(shape.x1, shape.x2);
  const right = Math.max(shape.x1, shape.x2);
  const top = Math.min(shape.y1, shape.y2);
  const bottom = Math.max(shape.y1, shape.y2);
  if (shape.kind === 'ellipse') {
    const rx = Math.max(1, (right - left) / 2);
    const ry = Math.max(1, (bottom - top) / 2);
    const cx = left + rx;
    const cy = top + ry;
    const inside = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.08;
    return inside ? { distance: 0, priority: 0 } : null;
  }
  const inside = x >= left && x <= right && y >= top && y <= bottom;
  return inside ? { distance: 0, priority: 0 } : null;
}

export class AnnotationPrimitive implements ISeriesPrimitive {
  private readonly chartId: string;
  private readonly getState: () => ViewState;
  private chart: IChartApi | null = null;
  private series: ISeriesApi<SeriesType> | null = null;
  private requestUpdate: (() => void) | null = null;
  private readonly back = new AnnotationPaneView('back');
  private readonly front = new AnnotationPaneView('front');
  private readonly views = [this.back, this.front];
  private shapes: Shape[] = [];

  constructor(chartId: string, getState: () => ViewState) {
    this.chartId = chartId;
    this.getState = getState;
  }

  attached(param: SeriesAttachedParameter): void {
    this.chart = param.chart;
    this.series = param.series;
    this.requestUpdate = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdate = null;
  }

  updateAllViews(): void {
    if (!this.chart || !this.series) {
      this.shapes = [];
    } else {
      const state = this.getState();
      this.shapes = buildShapes(this.chartId, this.chart, this.series, state.frame, state.annotations, state.highlight);
    }
    this.back.setShapes(this.shapes);
    this.front.setShapes(this.shapes);
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return this.views;
  }

  hitTest(x: number, y: number) {
    let best: { id: string; distance: number; priority: number } | null = null;
    for (const shape of this.shapes) {
      const hit = hitShape(shape, x, y);
      if (!hit) continue;
      if (!best || hit.priority > best.priority || (hit.priority === best.priority && hit.distance < best.distance)) {
        best = { id: shape.id, distance: hit.distance, priority: hit.priority };
      }
    }
    if (!best) return null;
    return {
      externalId: best.id,
      zOrder: 'top' as const,
      cursorStyle: 'pointer',
      distance: best.distance,
      hitTestPriority: best.priority,
      itemType: best.priority >= 2 ? ('marker' as const) : ('primitive' as const),
    };
  }

  refresh(): void {
    this.requestUpdate?.();
  }
}
