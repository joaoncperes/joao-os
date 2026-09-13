import { permanentRedirect } from 'next/navigation';

export default function BrainInboxRedirect() {
  permanentRedirect('/second-brain/inbox');
}
