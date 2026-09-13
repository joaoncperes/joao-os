import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import { readRandomQuote } from './random-quote';

function fixture(count: number, options: { countError?: boolean; readError?: boolean; deleted?: boolean } = {}) {
  const requests: { method: string; url: URL }[] = [];
  const quote = {
    id: 'quote-id', author_id: 'author-id', text: 'A quote', source: null,
    created_at: '2026-01-01T00:00:00Z', author: { name: 'Author', photo_url: null },
  };
  const client = createClient('https://quotes.example.test', 'test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const method = init?.method ?? 'GET';
        requests.push({ method, url });
        if (method === 'HEAD') {
          return new Response(null, {
            status: options.countError ? 403 : 200,
            headers: { 'content-range': `*/${count}` },
          });
        }
        assert.equal(url.searchParams.get('limit'), '1', 'Every quote read must be bounded');
        if (options.readError) {
          return new Response(JSON.stringify({ message: 'denied' }), { status: 403 });
        }
        const missing = options.deleted && url.searchParams.get('offset') !== '0';
        return Response.json(missing ? [] : [quote]);
      },
    },
  });
  return { client, requests, quote };
}

test('a large quote library transfers only one quote, including beyond the API row cap', async (t) => {
  t.mock.method(Math, 'random', () => 0.99999);
  const { client, requests, quote } = fixture(50_000);
  assert.deepEqual(await readRandomQuote(client), quote);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].method, 'HEAD');
  assert.equal(requests[1].url.searchParams.get('offset'), '49999');
  assert.equal(requests[1].url.searchParams.get('order'), 'created_at.asc,id.asc');
  assert.match(requests[1].url.searchParams.get('select')!, /author:authors\(name,photo_url\)/);
});

test('a singleton and the first random offset still show the quote', async (t) => {
  t.mock.method(Math, 'random', () => 0);
  const { client, requests, quote } = fixture(1);
  assert.deepEqual(await readRandomQuote(client), quote);
  assert.equal(requests[1].url.searchParams.get('offset'), '0');
});

test('an empty library or failed count skips the row request', async () => {
  for (const mock of [fixture(0), fixture(20, { countError: true })]) {
    assert.equal(await readRandomQuote(mock.client), null);
    assert.equal(mock.requests.length, 1);
  }
});

test('a concurrent deletion uses a single bounded fallback', async (t) => {
  t.mock.method(Math, 'random', () => 0.9);
  const { client, requests, quote } = fixture(10, { deleted: true });
  assert.deepEqual(await readRandomQuote(client), quote);
  assert.equal(requests.length, 3);
  assert.equal(requests[2].url.searchParams.get('offset'), '0');
});

test('quote read errors do not fail Today or trigger repeated retries', async () => {
  const { client, requests } = fixture(10, { readError: true });
  assert.equal(await readRandomQuote(client), null);
  assert.equal(requests.length, 2);
});
