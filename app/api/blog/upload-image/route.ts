import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get('file');
  const articleId = form.get('articleId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file.' }, { status: 400 });
  }
  if (typeof articleId !== 'string' || !articleId) {
    return NextResponse.json({ error: 'Missing articleId.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File exceeds 10MB.' }, { status: 413 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type.' }, { status: 415 });
  }

  // Verify the user owns this article before storing under its prefix.
  const { data: article, error: artErr } = await supabase
    .from('articles')
    .select('id')
    .eq('id', articleId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (artErr) {
    return NextResponse.json({ error: artErr.message }, { status: 500 });
  }
  if (!article) {
    return NextResponse.json({ error: 'Article not found.' }, { status: 404 });
  }

  const ext = extFromType(file.type) ?? extFromName(file.name) ?? 'bin';
  const objectName = `${user.id}/${articleId}/${crypto.randomUUID()}.${ext}`;

  const bytes = new Uint8Array(await file.arrayBuffer());
  const { error: upErr } = await supabase.storage
    .from('article-images')
    .upload(objectName, bytes, {
      contentType: file.type,
      cacheControl: '31536000',
      upsert: false,
    });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: pub } = supabase.storage
    .from('article-images')
    .getPublicUrl(objectName);
  return NextResponse.json({ url: pub.publicUrl, path: objectName });
}

function extFromType(type: string): string | null {
  switch (type) {
    case 'image/png': return 'png';
    case 'image/jpeg': return 'jpg';
    case 'image/gif': return 'gif';
    case 'image/webp': return 'webp';
    case 'image/avif': return 'avif';
    case 'image/svg+xml': return 'svg';
    default: return null;
  }
}

function extFromName(name: string): string | null {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return null;
  const ext = name.slice(idx + 1).toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? ext : null;
}
