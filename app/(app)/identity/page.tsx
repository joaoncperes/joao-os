import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { AreaDot } from '@/components/area-chip';
import { computeIdentityClaims } from '@/lib/identity/claims';
import { addDays } from '@/lib/date';
import type { Area } from '@/lib/supabase/types';

export const metadata = { title: 'Identity — Pedro OS' };
export const dynamic = 'force-dynamic';

const AREA_ORDER: Area[] = [
  'professional',
  'health',
  'family',
  'marriage',
  'cross_cutting',
];

const AREA_LABEL: Record<Area, string> = {
  professional: 'Professional + Studies',
  health: 'Health',
  family: 'Family',
  marriage: 'Marriage',
  cross_cutting: 'Cross-cutting',
};

interface CoreValue {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  starred: boolean;
}

interface Standard {
  id: string;
  name: string;
  area: Area;
  rule: string;
  leading_indicator: string | null;
  active: boolean;
}

interface VisionEntry {
  id: string;
  horizon: '5y' | '10y' | 'annual';
  area: string | null;
  body: string;
  effective_from: string;
}

export default async function IdentityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Pull identity tables in parallel + the data needed to build "You are…" claims.
  const today = new Date().toISOString().slice(0, 10);
  const ninetyAgo = addDays(today, -90);

  const [valuesRes, standardsRes, visionRes, habitsRes, logsRes, journalsRes, todayRes] =
    await Promise.all([
      supabase
        .from('core_values')
        .select('id, name, description, sort_order, starred')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('sort_order', { ascending: true }),
      supabase
        .from('standards')
        .select('id, name, area, rule, leading_indicator, active')
        .eq('user_id', user.id)
        .eq('active', true)
        .order('area', { ascending: true })
        .order('name', { ascending: true }),
      supabase
        .from('vision_entries')
        .select('id, horizon, area, body, effective_from')
        .eq('user_id', user.id)
        .is('superseded_at', null)
        .order('horizon', { ascending: true }),
      supabase
        .from('habits')
        .select('id, name, area')
        .eq('user_id', user.id)
        .eq('archived', false),
      supabase
        .from('habit_logs')
        .select('habit_id, log_date, completed_at')
        .eq('user_id', user.id)
        .gte('log_date', ninetyAgo),
      supabase
        .from('journals')
        .select('journal_date, gabi_call_depth')
        .eq('user_id', user.id)
        .gte('journal_date', ninetyAgo),
      supabase.rpc('today_in_user_tz'),
    ]);

  const values = (valuesRes.data ?? []) as CoreValue[];
  const standards = (standardsRes.data ?? []) as Standard[];
  const visions = (visionRes.data ?? []) as VisionEntry[];
  const todayInTz = (todayRes.data as string | null) ?? today;

  const claims = computeIdentityClaims({
    habits: (habitsRes.data ?? []) as { id: string; name: string; area: Area }[],
    habitLogs: (logsRes.data ?? []) as {
      habit_id: string;
      log_date: string;
      completed_at: string | null;
    }[],
    journals: (journalsRes.data ?? []) as {
      journal_date: string;
      gabi_call_depth: number | null;
    }[],
    todayInTz,
  });

  const standardsByArea = new Map<Area, Standard[]>();
  for (const s of standards) {
    const arr = standardsByArea.get(s.area) ?? [];
    arr.push(s);
    standardsByArea.set(s.area, arr);
  }

  const vision5y = visions.find((v) => v.horizon === '5y');
  const vision10y = visions.find((v) => v.horizon === '10y');

  return (
    <div className="flex flex-col gap-10">
      <header>
        <div className="text-text-3 mb-1.5 text-[13px] font-medium uppercase tracking-[0.02em]">
          Identity
        </div>
        <h1 className="text-text text-[30px] font-semibold leading-[1.1] tracking-[-0.02em]">
          Who you are
        </h1>
        <p className="text-text-2 mt-2 max-w-prose text-[14px] leading-relaxed">
          Read-mostly mirror of your Brain. Values rotate one a day on Today.
          Standards drive drift alerts. Vision sets the long arc. Edits live
          in <code className="bg-surface-2 rounded px-1 py-0.5 text-[12px]">brain/identity/</code>{' '}
          and re-seed via migration.
        </p>
      </header>

      {/* You are… (claims block) */}
      {claims.length > 0 ? (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">You are</h2>
            <span className="text-text-3 text-[11px]">Derived from your logs.</span>
          </div>
          <ul className="bg-surface border-border flex flex-col rounded-xl border">
            {claims.map((c) => (
              <li
                key={c.id}
                className="border-border flex items-start gap-3 border-t px-5 py-3.5 first:border-t-0"
              >
                <span className="mt-2 shrink-0">
                  <AreaDot area={c.area} />
                </span>
                <div className="leading-tight">
                  <div className="text-text text-[14px] font-medium">{c.statement}</div>
                  <div className="text-text-3 mt-0.5 text-[12px]">{c.evidence}</div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Values */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">
            Values · the {values.length} non-negotiables
          </h2>
          <span className="text-text-3 text-[11px]">One rotates onto Today daily.</span>
        </div>
        {values.length === 0 ? (
          <EmptyState text="No values seeded yet. Apply migration 040." />
        ) : (
          <ol className="flex flex-col gap-2">
            {values.map((v, i) => (
              <li
                key={v.id}
                className="bg-surface border-border rounded-xl border px-5 py-4"
              >
                <div className="text-text-3 mb-1 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="text-text text-[15px] font-semibold leading-snug tracking-[-0.005em]">
                  {v.name}
                </div>
                {v.description ? (
                  <div className="text-text-2 mt-1.5 text-[13px] leading-relaxed">
                    {v.description}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Standards */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">
            Standards · {standards.length} rules
          </h2>
          <span className="text-text-3 text-[11px]">
            Leading indicators drive drift alerts.
          </span>
        </div>
        {standards.length === 0 ? (
          <EmptyState text="No standards seeded yet. Apply migration 040." />
        ) : (
          <div className="flex flex-col gap-6">
            {AREA_ORDER.map((area) => {
              const list = standardsByArea.get(area) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={area}>
                  <div className="mb-2 flex items-center gap-2">
                    <AreaDot area={area} />
                    <div className="text-text-2 text-[12.5px] font-semibold uppercase tracking-[0.05em]">
                      {AREA_LABEL[area]}
                    </div>
                  </div>
                  <div className="bg-surface border-border overflow-hidden rounded-xl border">
                    <table className="w-full">
                      <thead>
                        <tr className="text-text-3 border-border border-b text-[10.5px] uppercase tracking-[0.06em]">
                          <th className="px-4 py-2.5 text-left font-semibold">Standard</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Rule</th>
                          <th className="px-4 py-2.5 text-left font-semibold">Leading indicator</th>
                        </tr>
                      </thead>
                      <tbody>
                        {list.map((s) => (
                          <tr key={s.id} className="border-border border-b last:border-b-0">
                            <td className="text-text px-4 py-3 text-[13.5px] font-medium align-top">
                              {s.name}
                            </td>
                            <td className="text-text-2 px-4 py-3 text-[13px] align-top">
                              {s.rule}
                            </td>
                            <td className="text-text-3 px-4 py-3 text-[12.5px] align-top">
                              {s.leading_indicator ?? '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Vision */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-text text-[15px] font-semibold tracking-[-0.005em]">
            Vision · the long arc
          </h2>
          <span className="text-text-3 text-[11px]">5-year and 10-year north.</span>
        </div>
        {!vision5y && !vision10y ? (
          <EmptyState text="No vision entries seeded yet." />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {vision5y ? <VisionCard label="5 years (Pedro at 29)" entry={vision5y} /> : null}
            {vision10y ? <VisionCard label="10 years (Pedro at 34)" entry={vision10y} /> : null}
          </div>
        )}
      </section>
    </div>
  );
}

function VisionCard({ label, entry }: { label: string; entry: VisionEntry }) {
  return (
    <div className="bg-surface border-border rounded-xl border px-5 py-4">
      <div className="text-text-3 mb-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]">
        {label}
      </div>
      <div className="text-text-2 text-[13.5px] leading-relaxed whitespace-pre-line">
        {entry.body}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="bg-surface border-border text-text-3 rounded-xl border px-5 py-8 text-center text-[13px]">
      {text}
    </div>
  );
}
