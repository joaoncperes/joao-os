/**
 * Standalone test for extractHashtags. No test framework in this repo — run
 * directly with: `pnpm exec tsx lib/hashtags.test.ts`. Exits non-zero on
 * failure so it can gate CI / pre-push if wired in later.
 */
import assert from 'node:assert/strict';
import { extractHashtags } from './hashtags';

const cases: Array<[string, string[]]> = [
  ['Some #ideia here', ['ideia']],
  ['Capturei uma #produção nova', ['produção']], // PT accent
  ['# Heading\n## Sub\ntext', []], // ATX headings excluded
  ['before ```\n#nope\n``` after #yes', ['yes']], // fenced code stripped
  ['use `#inline` not a tag, but #real is', ['real']], // inline code stripped
  ['link https://x.com/y#anchor end', []], // URL stripped
  ['#tag and #tag again', ['tag']], // dedup, first-seen order
  ['ticket #123 and #4you', []], // digit-leading rejected
  ['nested #area/sub and #area', ['area/sub', 'area']], // nested kept distinct
  ['ends #word. next', ['word']], // stops at punctuation
  ['id#hash attached', []], // word-attached # rejected
  ['Multi #hook #ideia #investidores', ['hook', 'ideia', 'investidores']],
  ['UPPER #Hook becomes lower', ['hook']], // lowercased
  ['', []],
];

let failed = 0;
for (const [input, expected] of cases) {
  const got = extractHashtags(input);
  try {
    assert.deepEqual(got, expected);
    console.log(`ok  ${JSON.stringify(input)} -> ${JSON.stringify(got)}`);
  } catch {
    failed += 1;
    console.error(`FAIL ${JSON.stringify(input)}`);
    console.error(`     expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} of ${cases.length} test(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${cases.length} tests passed`);
