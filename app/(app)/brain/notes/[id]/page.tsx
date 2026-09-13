import { permanentRedirect } from 'next/navigation';

export default async function BrainNoteRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  permanentRedirect(`/second-brain/notes/${id}`);
}
