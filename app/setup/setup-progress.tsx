import { Progress } from '@/components/ui/progress';

const STEPS = ['welcome', 'account', 'habits', 'workout'] as const;
type Step = (typeof STEPS)[number];

export function SetupProgress({ step }: { step: Step }) {
  const idx = STEPS.indexOf(step);
  const value = ((idx + 1) / STEPS.length) * 100;
  return (
    <div className="mb-6 space-y-2">
      <div className="text-muted-foreground flex items-center justify-between text-xs">
        <span>
          Step {idx + 1} of {STEPS.length}
        </span>
        <span className="capitalize">{step}</span>
      </div>
      <Progress value={value} />
    </div>
  );
}
