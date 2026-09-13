// GitHub publishing for the blog. Commits/updates/deletes a single markdown
// file per article in the pedro-blog repo via the GitHub Contents API; a
// GitHub Action in that repo rebuilds + deploys to Cloudflare Pages.
//
// SERVER ONLY — reads BLOG_GITHUB_TOKEN. Only ever imported from the blog
// server actions ('use server'). Never import this from a client component.
// (The `server-only` guard package isn't installed in this project, so this
// comment is the contract.)
//
// The published body must be clean CommonMark+GFM: the blog's Astro pipeline
// has no rehype-raw, so raw HTML (resized <img>, <mark>) would not render.
// normalizeBody() down-converts the only HTML our serializer can emit.

import { Buffer } from 'node:buffer';

const API = 'https://api.github.com';

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) throw new Error(`${name} is not configured.`);
  return v;
}

const repo = () => env('BLOG_REPO', 'YOUR_USERNAME/YOUR_BLOG');
const branch = () => env('BLOG_DEFAULT_BRANCH', 'main');
const contentDir = () => env('BLOG_CONTENT_PATH', 'src/content/articles');

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${env('BLOG_GITHUB_TOKEN')}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'pedro-os-blog-publisher',
    'Content-Type': 'application/json',
  };
}

/** Repo path of the live file for a slug, e.g. src/content/articles/foo.md */
export function articlePath(slug: string): string {
  return `${contentDir()}/${slug}.md`;
}

// --- Markdown serialization -------------------------------------------------

function yamlString(s: string): string {
  // Double-quoted YAML scalar — titles/descriptions can contain colons,
  // quotes, '#', etc. Escape backslash and double-quote only.
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/**
 * Down-convert the only HTML our TipTap→markdown serializer emits into plain
 * CommonMark, so the blog (no rehype-raw) renders everything:
 *  - resized images  <img src="X" alt="Y" width="N%" />  →  ![Y](X)
 *  - highlight        <mark>…</mark>                       →  … (unwrapped)
 *  - underline        <u>…</u>                             →  … (unwrapped)
 */
export function normalizeBody(md: string): string {
  return md
    .replace(/<img\b[^>]*?>/g, (tag) => {
      const src = tag.match(/\bsrc="([^"]*)"/)?.[1] ?? '';
      const alt = (tag.match(/\balt="([^"]*)"/)?.[1] ?? '').replace(/&quot;/g, '"');
      return src ? `![${alt}](${src})` : '';
    })
    .replace(/<\/?(?:mark|u)>/g, '');
}

/** Build the full file contents: YAML frontmatter + normalized body. */
export function buildFileContent(input: {
  title: string;
  summary: string | null;
  dateSp: string; // bare YYYY-MM-DD in Pedro's TZ
  body: string;
}): string {
  const fm = ['---', `title: ${yamlString(input.title.trim())}`, `date: ${input.dateSp}`];
  const summary = input.summary?.trim();
  if (summary) fm.push(`description: ${yamlString(summary)}`);
  fm.push('---');
  return `${fm.join('\n')}\n\n${normalizeBody(input.body).trim()}\n`;
}

// --- GitHub Contents API ----------------------------------------------------

/** Current blob sha of a file, or null if it doesn't exist (404). */
async function getSha(path: string): Promise<string | null> {
  const url = `${API}/repos/${repo()}/contents/${path}?ref=${branch()}`;
  const res = await fetch(url, { headers: headers(), cache: 'no-store' });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub GET ${path} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as { sha?: string };
  return json.sha ?? null;
}

/**
 * Create or update a file. Always re-fetches the current sha immediately
 * before the write (never trusts a stored sha). Returns the new commit + blob
 * shas.
 */
export async function putFile(
  path: string,
  content: string,
  message: string,
): Promise<{ commitSha: string; blobSha: string }> {
  const sha = await getSha(path);
  const res = await fetch(`${API}/repos/${repo()}/contents/${path}`, {
    method: 'PUT',
    headers: headers(),
    cache: 'no-store',
    body: JSON.stringify({
      message,
      branch: branch(),
      content: Buffer.from(content, 'utf-8').toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    throw new Error(`GitHub PUT ${path} failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as {
    content: { sha: string };
    commit: { sha: string };
  };
  return { commitSha: json.commit.sha, blobSha: json.content.sha };
}

/** Delete a file. Idempotent: a missing file (404) is treated as success. */
export async function deleteFile(path: string, message: string): Promise<void> {
  const sha = await getSha(path);
  if (sha == null) return; // already gone
  const res = await fetch(`${API}/repos/${repo()}/contents/${path}`, {
    method: 'DELETE',
    headers: headers(),
    cache: 'no-store',
    body: JSON.stringify({ message, branch: branch(), sha }),
  });
  if (!res.ok) {
    throw new Error(`GitHub DELETE ${path} failed: ${res.status} ${await res.text()}`);
  }
}

/** Public URL of a published article. */
export function liveUrl(slug: string): string {
  return `https://example.com/articles/${slug}`;
}
