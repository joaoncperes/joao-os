import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SetupProgress } from '../setup-progress';

export const metadata = { title: 'Welcome — João OS' };

export default function WelcomePage() {
  return (
    <>
      <SetupProgress step="welcome" />
      <Card>
        <CardHeader>
          <CardTitle>Welcome to João OS</CardTitle>
          <CardDescription>The operational layer for your Personal OS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground text-sm leading-relaxed">
            Three minutes to set up. We&apos;ll confirm your account, review the 13 daily habits
            from your Personal OS, and the 7-day training split. Everything is editable later.
          </p>
          <p className="text-muted-foreground text-sm leading-relaxed">
            After setup, the Today screen opens at every launch. The other surfaces ship in later
            sprints.
          </p>
          <div className="pt-4">
            <Link
              href="/setup/account"
              className={buttonVariants({ size: 'lg', className: 'w-full' })}
            >
              Get started
            </Link>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
