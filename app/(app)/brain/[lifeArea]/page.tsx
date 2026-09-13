import { permanentRedirect } from 'next/navigation';

// The old /brain/[lifeArea] routes are now PARA Areas folders. We don't
// know the new folder_id without a DB lookup, so redirect to the Areas
// category page where the seeded folders are visible.
export default function BrainLifeAreaRedirect() {
  permanentRedirect('/second-brain/areas');
}
