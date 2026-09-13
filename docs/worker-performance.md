# Worker resource budget

On 2026-09-12 at about 21:28 UTC, `pedro-os` returned Cloudflare error 1102.
Workers Analytics showed repeated `exceededResources` invocations, including
ones at 10 ms of CPU with zero subrequests. Some requests therefore failed
before reaching authentication/database I/O. Reducing SQL response time alone
cannot resolve that failure mode.

Rechecked directly against Workers Analytics at 21:50 UTC: the 21:20–21:35 UTC
window contains 18 `exceededResources` requests, nine with zero subrequests.
At the screenshot's exact second (21:28:40 UTC), an invocation failed with
13.286 ms CPU and zero subrequests. The analytics quantiles are reported in
microseconds. These aggregate records establish the CPU-budget problem but do
not identify a particular JavaScript function as its source.

Cloudflare's [Workers limits](https://developers.cloudflare.com/workers/platform/limits/#cpu-time)
give Workers Free only 10 ms of CPU per HTTP request. Workers Paid defaults to
30 seconds. Occasional successful requests above the limit are not evidence
that the app fits it: Cloudflare allows temporary CPU overruns, then terminates
requests when they consistently exceed the allowance.

`wrangler.jsonc` uses the account's default CPU allowance so updates can deploy
on the existing plan. On 2026-09-12 Wrangler confirmed Workers Free: attempts
with an explicit 30,000 ms budget were rejected with error 100328 (CPU limits
are not supported for the Free plan). The explicit limit was removed to deploy
the percentage display and code optimizations on Free, without a billing change.

**Workers Paid is still recommended for reliable Next/OpenNext execution.**
The code optimizations do not remove Free's 10 ms ceiling or guarantee that
error 1102 cannot recur. After enabling Paid, an explicit budget can be added
as `"limits": { "cpu_ms": 30000 }`. Setting `cpu_ms` alone does not upgrade the
account or override the free-plan ceiling.
The deployment retry at 21:49 UTC received the same 100328 rejection. Production
has not received this refactor; the paid-plan change needs the account owner's
authorization before deployment can be completed.

## Keep request work small

- `React.cache` shares the Supabase client, verified account/profile, and weekly
  plan **within one server render**. Never replace it with a global authenticated
  client, process-wide user cache, or public cache of the dashboard.
- Today still authenticates and fetches initial data on the server. Its
  interactive task/habit tree loads in the browser via `next/dynamic` with
  `ssr: false`; the first HTML shows a loading placeholder. Mutations still use
  authenticated Server Actions and RLS.
- Quote selection uses a count-only HEAD request and one deterministically
  ordered row at a random offset. It never downloads the whole library and
  continues to include quotes beyond PostgREST's default row cap. A concurrent
  deletion permits only one fallback row read.
- Task mutations refresh the existing TanStack task query. They do not need to
  re-render the shell, quote, priorities, and books. Habit mutations retain route
  invalidation because other server-rendered screens display habit history.
- Historical Today views continue to skip current tasks, quotes, and books.

## Validation and release

```sh
pnpm test
pnpm exec tsc --noEmit
pnpm exec eslint app components lib
pnpm exec opennextjs-cloudflare build
pnpm exec wrangler deploy --dry-run
```

A local production smoke check should verify both signed-out/setup redirects
and a signed-in Today request. Count upstream reads: layout + Today must perform
one auth verification, one profile read, and one weekly-plan read. Quote reads
must have `limit=1`. Verify task/habit edits, date navigation, consistency,
priorities, books, quote display, search, and desktop/mobile layouts. A task edit
must not fetch quotes, books, or weekly priorities again.

After deployment, verify Workers Logs for cold loads and repeated edits,
including the originally failing `/today` route. Inspect CPU time and invocation
outcomes; local Next/Workerd previews do not prove compliance with production
CPU limits. Retain observability in Wrangler. See
[OpenNext profiling](https://opennext.js.org/cloudflare/perf#troubleshooting-performance)
for local CPU profiles if a new hotspot appears. The isolate memory ceiling
remains 128 MB on either Workers plan.
