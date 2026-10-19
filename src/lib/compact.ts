import { useEffect, useState } from 'react';

/** Phones in portrait (~360–430) and short landscape. Desktop widths stay on the side-panel layout. */
export const COMPACT_QUERY = '(max-width: 840px), ((max-height: 520px) and (orientation: landscape))';

export function useCompact(): boolean {
  const [compact, setCompact] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(COMPACT_QUERY).matches,
  );

  useEffect(() => {
    const media = window.matchMedia(COMPACT_QUERY);
    const apply = () => setCompact(media.matches);
    apply();
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, []);

  return compact;
}
