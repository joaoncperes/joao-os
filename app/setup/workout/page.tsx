import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DAY_OF_WEEK_LABELS, DEFAULT_SPLIT } from '@/lib/seed';
import { SetupProgress } from '../setup-progress';
import { WorkoutForm } from './workout-form';

export const metadata = { title: 'Workout split — João OS' };

export default function WorkoutPage() {
  return (
    <>
      <SetupProgress step="workout" />
      <Card>
        <CardHeader>
          <CardTitle>Weekly training split</CardTitle>
          <CardDescription>
            7-day split. Editable later in Settings; renaming exercises preserves history.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WorkoutForm initialSplit={DEFAULT_SPLIT} dayLabels={DAY_OF_WEEK_LABELS} />
        </CardContent>
      </Card>
    </>
  );
}
