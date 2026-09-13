import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DEFAULT_HABITS } from '@/lib/seed';
import { SetupProgress } from '../setup-progress';
import { HabitsForm } from './habits-form';

export const metadata = { title: 'Habits — Pedro OS' };

export default function HabitsPage() {
  return (
    <>
      <SetupProgress step="habits" />
      <Card>
        <CardHeader>
          <CardTitle>Daily habits</CardTitle>
          <CardDescription>
            Pre-filled with your 13 defaults from the Personal OS. Edit times, names, or remove —
            all editable later in Settings.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <HabitsForm initialHabits={DEFAULT_HABITS} />
        </CardContent>
      </Card>
    </>
  );
}
