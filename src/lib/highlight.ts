import type { Annotation } from '../types';

export function expandHighlight(annotations: readonly Annotation[], id: string | null): Set<string> {
  const set = new Set<string>();
  if (!id || id === 'selection') return set;
  set.add(id);
  let grew = true;
  while (grew) {
    grew = false;
    for (const annotation of annotations) {
      const linked = annotation.linkTo?.some((item) => set.has(item)) ?? false;
      const hit = set.has(annotation.id) || (annotation.messageAnchor != null && set.has(annotation.messageAnchor));
      if (!hit && !linked) continue;
      if (!set.has(annotation.id)) {
        set.add(annotation.id);
        grew = true;
      }
      if (annotation.messageAnchor && !set.has(annotation.messageAnchor)) {
        set.add(annotation.messageAnchor);
        grew = true;
      }
      for (const item of annotation.linkTo ?? []) {
        if (!set.has(item)) {
          set.add(item);
          grew = true;
        }
      }
    }
  }
  return set;
}
