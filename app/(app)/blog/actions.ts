'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { articleSlug } from '@/lib/blog-slug';
import {
  articlePath,
  buildFileContent,
  putFile,
  deleteFile,
  liveUrl,
} from '@/lib/blog-publish';
import { dateInTz } from '@/lib/date';
import type { Article, TipTapDoc } from '@/lib/supabase/types';

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : { data: T }))
  | { ok: false; error: string };

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in.');
  return { supabase, userId: user.id };
}

// Postgres unique_violation — the (user_id, slug) constraint backstop.
function isUniqueViolation(error: { code?: string } | null): boolean {
  return error?.code === '23505';
}

export interface ArticleMetaInput {
  title: string;
  slug?: string;
  summary?: string | null;
}

export async function createArticle(
  input: ArticleMetaInput,
): Promise<Result<{ id: string }>> {
  try {
    const { supabase, userId } = await ctx();
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };
    const slug = articleSlug(input.slug || title);
    if (!slug) return { ok: false, error: 'Could not derive a slug from the title.' };

    const { data: clash } = await supabase
      .from('articles')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .maybeSingle();
    if (clash) return { ok: false, error: 'A post with that slug already exists.' };

    const { data, error } = await supabase
      .from('articles')
      .insert({
        user_id: userId,
        title,
        slug,
        summary: input.summary?.trim() || null,
      })
      .select('id')
      .single();
    if (error || !data) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: 'A post with that slug already exists.' };
      }
      return { ok: false, error: error?.message ?? 'create failed' };
    }

    revalidatePath('/blog');
    return { ok: true, data: { id: data.id } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function updateArticleMeta(
  articleId: string,
  input: ArticleMetaInput,
): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const title = input.title.trim();
    if (!title) return { ok: false, error: 'Title is required.' };
    const slug = articleSlug(input.slug || title);
    if (!slug) return { ok: false, error: 'Could not derive a slug from the title.' };

    const { data: clash } = await supabase
      .from('articles')
      .select('id')
      .eq('user_id', userId)
      .eq('slug', slug)
      .neq('id', articleId)
      .maybeSingle();
    if (clash) return { ok: false, error: 'Another post already uses that slug.' };

    const { error } = await supabase
      .from('articles')
      .update({ title, slug, summary: input.summary?.trim() || null })
      .eq('id', articleId)
      .eq('user_id', userId);
    if (error) {
      if (isUniqueViolation(error)) {
        return { ok: false, error: 'Another post already uses that slug.' };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath('/blog');
    revalidatePath(`/blog/${articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function saveArticleContent(input: {
  articleId: string;
  // JSON-stringified TipTapDoc — sending text avoids React Flight dropping
  // ProseMirror's null-proto attrs (same wire-format gotcha as book notes).
  contentJsonString: string;
  contentMd: string;
}): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();

    let contentJson: TipTapDoc;
    try {
      contentJson = JSON.parse(input.contentJsonString) as TipTapDoc;
    } catch (e) {
      return { ok: false, error: `Invalid contentJson: ${(e as Error).message}` };
    }

    const { error } = await supabase
      .from('articles')
      .update({ content_json: contentJson, content_md: input.contentMd })
      .eq('id', input.articleId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath(`/blog/${input.articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

async function loadArticle(
  supabase: Awaited<ReturnType<typeof ctx>>['supabase'],
  userId: string,
  articleId: string,
): Promise<Article | null> {
  const { data } = await supabase
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as Article | null) ?? null;
}

export async function publishArticle(
  articleId: string,
): Promise<Result<{ url: string; commitSha: string }>> {
  try {
    const { supabase, userId } = await ctx();
    const art = await loadArticle(supabase, userId, articleId);
    if (!art) return { ok: false, error: 'Article not found.' };
    if (!art.title.trim()) return { ok: false, error: 'Title is required to publish.' };
    if (!art.content_md.trim()) {
      return { ok: false, error: 'Cannot publish an empty post.' };
    }

    const newPath = articlePath(art.slug);
    const publishedAtIso = art.published_at ?? new Date().toISOString();
    const dateSp = dateInTz(publishedAtIso);

    const file = buildFileContent({
      title: art.title,
      summary: art.summary,
      dateSp,
      body: art.content_md,
    });

    // Commit the file FIRST. If this throws, the row is left untouched — we
    // never report "published" for a commit that didn't land.
    const { commitSha } = await putFile(newPath, file, `Publish: ${art.title}`);

    // Slug changed while published → remove the old file (new one is already
    // live, so there's no zero-file window). A cleanup failure is non-fatal.
    if (art.published_path && art.published_path !== newPath) {
      try {
        await deleteFile(art.published_path, `Remove old slug for: ${art.title}`);
      } catch (e) {
        console.warn('[blog] old-file cleanup failed:', (e as Error).message);
      }
    }

    const { error } = await supabase
      .from('articles')
      .update({
        status: 'published',
        published_at: publishedAtIso,
        published_slug: art.slug,
        published_path: newPath,
        published_commit_sha: commitSha,
      })
      .eq('id', articleId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/blog');
    revalidatePath(`/blog/${articleId}`);
    return { ok: true, data: { url: liveUrl(art.slug), commitSha } };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function unpublishArticle(articleId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const art = await loadArticle(supabase, userId, articleId);
    if (!art) return { ok: false, error: 'Article not found.' };

    if (art.published_path) {
      // Idempotent: a missing file resolves cleanly.
      await deleteFile(art.published_path, `Unpublish: ${art.title}`);
    }

    // Keep published_at so the original publish date is preserved if Pedro
    // re-publishes later; only clear the live-artifact tracking.
    const { error } = await supabase
      .from('articles')
      .update({
        status: 'draft',
        published_slug: null,
        published_path: null,
        published_commit_sha: null,
      })
      .eq('id', articleId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/blog');
    revalidatePath(`/blog/${articleId}`);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function deleteArticle(articleId: string): Promise<Result> {
  try {
    const { supabase, userId } = await ctx();
    const art = await loadArticle(supabase, userId, articleId);
    if (!art) return { ok: false, error: 'Article not found.' };

    // If it's live, take down the file first. If that fails, abort the row
    // delete so we never orphan a published file with no record of it.
    if (art.published_path) {
      try {
        await deleteFile(art.published_path, `Delete: ${art.title}`);
      } catch (e) {
        return {
          ok: false,
          error: `Could not remove the live post first: ${(e as Error).message}`,
        };
      }
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', articleId)
      .eq('user_id', userId);
    if (error) return { ok: false, error: error.message };

    revalidatePath('/blog');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
