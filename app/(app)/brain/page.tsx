import { permanentRedirect } from 'next/navigation';

export default function BrainRedirect() {
  permanentRedirect('/second-brain');
}
