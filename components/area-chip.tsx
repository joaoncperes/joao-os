import { AREA_COLOR } from '@/lib/area-color';
import type { Area } from '@/lib/supabase/types';

export function AreaChip({ area, label }: { area: Area; label?: string }) {
  const c = AREA_COLOR[area];
  return (
    <span className="bg-surface-2 border-border text-text-2 inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
      <span className={`h-[5px] w-[5px] shrink-0 rounded-full ${c.dot}`} />
      {label ?? c.label}
    </span>
  );
}

export function AreaDot({ area }: { area: Area }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${AREA_COLOR[area].dot}`} />;
}
