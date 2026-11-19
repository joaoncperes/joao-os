import { redirect } from 'next/navigation';

// A tela "Hoje" do Pedro OS foi substituída por Metas no João OS.
export default function TodayPage() {
  redirect('/metas');
}
