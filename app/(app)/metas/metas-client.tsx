'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { BookOpen, Dumbbell, Flame, Footprints, Pencil, Plus, Sparkles, Target, Trash2, Undo2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { parseDecimalInput } from '@/lib/number';
import {
  METRIC_META,
  daysUntil,
  formatDatePt,
  formatNumber,
  formatWeekRange,
  goalUnit,
  type Goal,
  type GoalKind,
  type GoalMetric,
} from '@/lib/goals';
import {
  createGoal,
  deleteGoal,
  logGoalEntry,
  undoLastGoalEntry,
  updateGoal,
  updateManualValue,
  type GoalInput,
} from './actions';

export interface WeeklyCard {
  goal: Goal;
  value: number;
  ratio: number;
  streak: number;
  history: { weekStart: string; value: number; met: boolean; beforeGoal: boolean }[];
}

export interface TargetCard {
  goal: Goal;
  current: number;
  ratio: number;
  exerciseName: string | null;
}

interface Props {
  today: string;
  weekStart: string;
  weekly: WeeklyCard[];
  targets: TargetCard[];
  exercises: { id: string; name: string }[];
  loadError: string | null;
}

const METRIC_ICON: Partial<Record<GoalMetric, typeof Dumbbell>> = {
  workouts: Dumbbell,
  runs: Footprints,
  run_km: Footprints,
  reading_minutes: BookOpen,
  books_finished: BookOpen,
  exercise_max: Dumbbell,
  manual: Sparkles,
};

const LOG_LINK: Partial<Record<GoalMetric, { href: string; label: string }>> = {
  workouts: { href: '/workout', label: 'Registrar treino' },
  runs: { href: '/workout?day=cardio', label: 'Registrar corrida' },
  run_km: { href: '/workout?day=cardio', label: 'Registrar corrida' },
  reading_minutes: { href: '/books#leitura', label: 'Registrar leitura' },
};

function unitFor(goal: Goal, value: number): string {
  const unit = goalUnit(goal);
  if (value === 1 && unit.endsWith('s') && unit !== 'min') return unit.slice(0, -1);
  return unit;
}

export function MetasClient({ today, weekStart, weekly, targets, exercises, loadError }: Props) {
  const [dialog, setDialog] = useState<{ open: boolean; goal: Goal | null; kind: GoalKind }>({
    open: false,
    goal: null,
    kind: 'weekly',
  });

  const onTrack = weekly.filter((w) => w.value >= w.goal.target_value).length;

  function openNew(kind: GoalKind) {
    setDialog({ open: true, goal: null, kind });
  }
  function openEdit(goal: Goal) {
    setDialog({ open: true, goal, kind: goal.kind });
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-accent mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]">
            Semana {formatWeekRange(weekStart)}
          </div>
          <h1 className="text-text text-[30px] font-semibold leading-[1.05] tracking-[-0.02em]">
            Metas
          </h1>
          <p className="text-text-3 mt-1.5 text-[13.5px]">
            {weekly.length === 0
              ? 'Crie sua primeira meta semanal.'
              : onTrack === weekly.length
                ? `Todas as ${weekly.length} metas da semana batidas. 🎉`
                : `${onTrack} de ${weekly.length} metas batidas nesta semana.`}
          </p>
        </div>
        <Button onClick={() => openNew('weekly')}>
          <Plus className="mr-1 h-4 w-4" />
          Nova meta
        </Button>
      </header>

      {loadError ? (
        <div className="bg-surface border-border text-danger rounded-xl border p-4 text-sm">
          Não consegui carregar as metas: {loadError}
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
          Metas da semana
        </h2>
        {weekly.length === 0 ? (
          <EmptyCard text="Nenhuma meta semanal ainda." onAdd={() => openNew('weekly')} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {weekly.map((w) => (
              <WeeklyGoalCard
                key={w.goal.id}
                card={w}
                today={today}
                weekStart={weekStart}
                onEdit={() => openEdit(w.goal)}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
            Objetivos de longo prazo
          </h2>
          <button
            type="button"
            onClick={() => openNew('target')}
            className="text-accent text-[12.5px] font-semibold hover:underline"
          >
            + Novo objetivo
          </button>
        </div>
        {targets.length === 0 ? (
          <EmptyCard
            text="Ex.: supino 100 kg até junho, ler 25 livros em 2027, correr 200 km no semestre, tocar 50 músicas no piano."
            onAdd={() => openNew('target')}
            cta="Criar objetivo"
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {targets.map((t) => (
              <TargetGoalCard key={t.goal.id} card={t} today={today} onEdit={() => openEdit(t.goal)} />
            ))}
          </div>
        )}
      </section>

      <GoalDialog
        key={`${dialog.goal?.id ?? 'new'}-${dialog.kind}-${dialog.open}`}
        open={dialog.open}
        onOpenChange={(open) => setDialog((d) => ({ ...d, open }))}
        goal={dialog.goal}
        initialKind={dialog.kind}
        exercises={exercises}
      />
    </div>
  );
}

function EmptyCard({ text, onAdd, cta = 'Criar meta' }: { text: string; onAdd: () => void; cta?: string }) {
  return (
    <div className="bg-surface border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-5 py-8 text-center">
      <Target className="text-text-4 h-5 w-5" />
      <p className="text-text-3 max-w-md text-[13px]">{text}</p>
      <Button variant="outline" size="sm" onClick={onAdd}>
        {cta}
      </Button>
    </div>
  );
}

function ProgressBar({ ratio, done }: { ratio: number; done: boolean }) {
  return (
    <div className="bg-surface-2 h-2 w-full overflow-hidden rounded-full">
      <div
        className={cn('h-full rounded-full transition-[width]', done ? 'bg-success' : 'bg-accent')}
        style={{ width: `${Math.round(ratio * 100)}%` }}
      />
    </div>
  );
}

function WeeklyGoalCard({
  card,
  today,
  weekStart,
  onEdit,
}: {
  card: WeeklyCard;
  today: string;
  weekStart: string;
  onEdit: () => void;
}) {
  const { goal, value, ratio, streak, history } = card;
  const done = value >= goal.target_value;
  const Icon = METRIC_ICON[goal.metric] ?? Target;
  const remaining = Math.max(0, goal.target_value - value);
  const log = LOG_LINK[goal.metric];

  return (
    <div className="bg-surface border-border flex flex-col gap-3 rounded-xl border px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'grid h-8 w-8 place-items-center rounded-lg',
              done ? 'bg-success-soft text-success' : 'bg-accent-soft text-accent',
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <div className="text-text text-[14.5px] font-semibold">{goal.title}</div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${goal.title}`}
          className="text-text-4 hover:text-text hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-md"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-text text-[26px] font-semibold tabular-nums leading-none">
          {formatNumber(value)}
        </span>
        <span className="text-text-3 text-[13px] font-medium">
          / {formatNumber(goal.target_value)} {unitFor(goal, goal.target_value)}
        </span>
      </div>

      <ProgressBar ratio={ratio} done={done} />

      <div className="text-text-3 flex items-center justify-between text-[12px]">
        <span>
          {done
            ? 'Meta batida ✓'
            : `Faltam ${formatNumber(remaining)} ${unitFor(goal, remaining)}`}
        </span>
        {streak > 0 ? (
          <span className="text-freeze inline-flex items-center gap-1 font-semibold">
            <Flame className="h-3.5 w-3.5" />
            {streak} {streak === 1 ? 'semana' : 'semanas'}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1" aria-label="Últimas 8 semanas">
          {history.map((h) => (
            <span
              key={h.weekStart}
              title={`Semana ${formatWeekRange(h.weekStart)}: ${formatNumber(h.value)}`}
              className={cn(
                'h-2.5 w-2.5 rounded-sm',
                h.beforeGoal
                  ? 'bg-surface-2'
                  : h.met
                    ? 'bg-success'
                    : 'border-border-strong border bg-transparent',
              )}
            />
          ))}
        </div>
        {log ? (
          <Link href={log.href} className="text-accent text-[12px] font-semibold hover:underline">
            {log.label} →
          </Link>
        ) : null}
      </div>
      {goal.metric === 'manual' ? (
        <ManualEntryLogger goal={goal} today={today} weekStart={weekStart} />
      ) : null}
    </div>
  );
}

function ManualEntryLogger({ goal, today, weekStart }: { goal: Goal; today: string; weekStart: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState('');
  const unit = goalUnit(goal);
  const isCount = unit === 'vezes' || unit === 'vez';

  function log(v: number) {
    start(async () => {
      const r = await logGoalEntry(goal.id, v, today);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(`${goal.title}: +${formatNumber(v)} ${unit}`);
      setValue('');
      router.refresh();
    });
  }

  return (
    <form
      className="border-border flex flex-wrap items-center gap-1.5 border-t pt-3"
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseDecimalInput(value);
        if (v == null || v <= 0) {
          toast.error('Digite quanto você fez.');
          return;
        }
        log(v);
      }}
    >
      {isCount ? (
        <Button type="button" size="sm" onClick={() => log(1)} disabled={pending}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Fiz hoje
        </Button>
      ) : (
        <>
          <Input
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={unit}
            aria-label={`Quanto (${unit})`}
            className="h-8 w-20"
          />
          <Button type="submit" size="sm" disabled={pending}>
            <Plus className="mr-1 h-3.5 w-3.5" />
            Registrar
          </Button>
        </>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await undoLastGoalEntry(goal.id, weekStart);
            if (!r.ok) toast.error(r.error);
            else router.refresh();
          })
        }
        className="text-text-3 hover:text-text ml-auto inline-flex items-center gap-1 text-[12px] font-medium disabled:opacity-50"
      >
        <Undo2 className="h-3.5 w-3.5" />
        Desfazer
      </button>
    </form>
  );
}

function TargetGoalCard({
  card,
  today,
  onEdit,
}: {
  card: TargetCard;
  today: string;
  onEdit: () => void;
}) {
  const { goal, current, ratio, exerciseName } = card;
  const done = current >= goal.target_value;
  const unit = goalUnit(goal);
  const days = goal.due_date ? daysUntil(today, goal.due_date) : null;

  return (
    <div className="bg-surface border-border flex flex-col gap-3 rounded-xl border px-4 py-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-text text-[14.5px] font-semibold">{goal.title}</div>
          <div className="text-text-3 mt-0.5 text-[12px]">
            {exerciseName ? `${exerciseName} · ` : ''}
            {goal.due_date
              ? `até ${formatDatePt(goal.due_date)}${
                  days != null
                    ? days > 0
                      ? ` · faltam ${days} dias`
                      : days === 0
                        ? ' · é hoje'
                        : ` · prazo passou há ${-days} dias`
                    : ''
                }`
              : 'sem prazo'}
          </div>
        </div>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Editar ${goal.title}`}
          className="text-text-4 hover:text-text hover:bg-surface-2 grid h-7 w-7 place-items-center rounded-md"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-baseline gap-1.5">
        <span className="text-text text-[26px] font-semibold tabular-nums leading-none">
          {formatNumber(current)}
        </span>
        <span className="text-text-3 text-[13px] font-medium">
          / {formatNumber(goal.target_value)} {unit}
        </span>
        <span className="text-text-3 ml-auto text-[12px] font-semibold tabular-nums">
          {Math.round(ratio * 100)}%
        </span>
      </div>
      <ProgressBar ratio={ratio} done={done} />
      {goal.start_value != null && goal.metric !== 'manual' ? (
        <div className="text-text-3 text-[12px]">
          Começou em {formatNumber(goal.start_value)} {unit}
        </div>
      ) : null}
      {goal.metric === 'manual' ? <ManualValueEditor goal={goal} current={current} /> : null}
    </div>
  );
}

function ManualValueEditor({ goal, current }: { goal: Goal; current: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useState(String(current));
  return (
    <form
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const v = parseDecimalInput(value);
        if (v == null) {
          toast.error('Digite um número.');
          return;
        }
        start(async () => {
          const r = await updateManualValue(goal.id, v);
          if (!r.ok) toast.error(r.error);
          else {
            toast.success('Progresso atualizado');
            router.refresh();
          }
        });
      }}
    >
      <Input
        inputMode="decimal"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Valor atual"
        className="h-8 w-28"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        Atualizar
      </Button>
    </form>
  );
}

function GoalDialog({
  open,
  onOpenChange,
  goal,
  initialKind,
  exercises,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: Goal | null;
  initialKind: GoalKind;
  exercises: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [kind, setKind] = useState<GoalKind>(goal?.kind ?? initialKind);
  const [metric, setMetric] = useState<GoalMetric>(
    goal?.metric ?? (initialKind === 'weekly' ? 'workouts' : 'exercise_max'),
  );
  const [title, setTitle] = useState(goal?.title ?? '');
  const [target, setTarget] = useState(goal ? String(goal.target_value) : '');
  const [dueDate, setDueDate] = useState(goal?.due_date ?? '');
  const [exerciseId, setExerciseId] = useState(goal?.exercise_id ?? exercises[0]?.id ?? '');
  const [startValue, setStartValue] = useState(
    goal?.start_value != null ? String(goal.start_value) : '',
  );
  const [customUnit, setCustomUnit] = useState(goal?.unit ?? '');

  const metricOptions = (Object.keys(METRIC_META) as GoalMetric[]).filter((m) =>
    kind === 'weekly' ? METRIC_META[m].weekly : METRIC_META[m].target,
  );

  function changeKind(next: GoalKind) {
    setKind(next);
    if (next === 'weekly' && !METRIC_META[metric].weekly) setMetric('workouts');
  }

  function submit() {
    const targetValue = parseDecimalInput(target);
    if (targetValue == null || targetValue <= 0) {
      toast.error('Defina um alvo maior que zero.');
      return;
    }
    const input: GoalInput = {
      title: title.trim() || METRIC_META[metric].label,
      kind,
      metric,
      targetValue,
      dueDate: kind === 'target' && dueDate ? dueDate : null,
      exerciseId: metric === 'exercise_max' ? exerciseId || null : null,
      startValue: metric === 'manual' && kind === 'target' ? parseDecimalInput(startValue) ?? 0 : null,
      unit: metric === 'manual' ? customUnit.trim() || 'vezes' : null,
    };
    start(async () => {
      const r = goal ? await updateGoal(goal.id, input) : await createGoal(input);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success(goal ? 'Meta atualizada' : 'Meta criada');
      onOpenChange(false);
      router.refresh();
    });
  }

  function remove() {
    if (!goal) return;
    if (!confirm(`Apagar a meta "${goal.title}"? Seus registros continuam salvos.`)) return;
    start(async () => {
      const r = await deleteGoal(goal.id);
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Meta apagada');
      onOpenChange(false);
      router.refresh();
    });
  }

  const unit = metric === 'manual' ? customUnit.trim() || 'vezes' : METRIC_META[metric].unit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{goal ? 'Editar meta' : 'Nova meta'}</DialogTitle>
          <DialogDescription>
            O progresso é calculado sozinho a partir dos seus treinos, corridas e leituras.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['weekly', 'Toda semana', 'Reinicia na segunda'],
                ['target', 'Objetivo', 'Chegar em X até uma data'],
              ] as const
            ).map(([k, label, sub]) => (
              <button
                key={k}
                type="button"
                onClick={() => changeKind(k)}
                className={cn(
                  'rounded-lg border px-3 py-2 text-left transition-colors',
                  kind === k
                    ? 'border-accent bg-accent-soft'
                    : 'border-border hover:bg-surface-2',
                )}
              >
                <div className="text-text text-[13px] font-semibold">{label}</div>
                <div className="text-text-3 text-[11.5px]">{sub}</div>
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-metric">O que medir</Label>
            <select
              id="goal-metric"
              value={metric}
              onChange={(e) => setMetric(e.target.value as GoalMetric)}
              className="border-input h-9 rounded-lg border bg-transparent px-2.5 text-sm"
            >
              {metricOptions.map((m) => (
                <option key={m} value={m}>
                  {METRIC_META[m].label}
                </option>
              ))}
            </select>
          </div>

          {metric === 'exercise_max' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-exercise">Exercício</Label>
              {exercises.length === 0 ? (
                <p className="text-text-3 text-[12.5px]">
                  Cadastre exercícios no seu plano de treino primeiro.
                </p>
              ) : (
                <select
                  id="goal-exercise"
                  value={exerciseId}
                  onChange={(e) => setExerciseId(e.target.value)}
                  className="border-input h-9 rounded-lg border bg-transparent px-2.5 text-sm"
                >
                  {exercises.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      {ex.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="goal-title">Nome</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                metric === 'manual'
                  ? kind === 'weekly'
                    ? 'Ex.: Tocar piano'
                    : 'Ex.: Aprender 10 músicas no piano'
                  : kind === 'weekly'
                    ? 'Ex.: Treinar'
                    : metric === 'exercise_max'
                      ? 'Ex.: Supino 100 kg'
                      : 'Ex.: Ler 25 livros'
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-target">
                {kind === 'weekly' ? 'Alvo por semana' : 'Onde quero chegar'}
              </Label>
              <div className="flex items-center gap-1.5">
                <Input
                  id="goal-target"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                  placeholder="0"
                />
                {unit ? <span className="text-text-3 text-[12px]">{unit}</span> : null}
              </div>
            </div>
            {kind === 'target' ? (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="goal-due">Prazo (opcional)</Label>
                <Input
                  id="goal-due"
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            ) : null}
          </div>

          {metric === 'manual' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-unit">Unidade</Label>
              <Input
                id="goal-unit"
                value={customUnit}
                onChange={(e) => setCustomUnit(e.target.value)}
                placeholder="vezes, min, páginas, músicas…"
              />
              <p className="text-text-3 text-[11.5px]">
                {kind === 'weekly'
                  ? 'Com "vezes", o card ganha um botão "Fiz hoje". Com outra unidade, você digita quanto fez.'
                  : 'Você atualiza o valor à mão direto no card.'}
              </p>
            </div>
          ) : null}

          {metric === 'manual' && kind === 'target' ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="goal-start">Valor de hoje</Label>
              <Input
                id="goal-start"
                inputMode="decimal"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                placeholder="0"
              />
            </div>
          ) : null}

          {kind === 'target' && metric !== 'manual' && metric !== 'exercise_max' ? (
            <p className="text-text-3 text-[12px]">
              Conta tudo o que você registrar a partir de hoje até o prazo.
            </p>
          ) : null}

          <DialogFooter className="items-center">
            {goal ? (
              <Button
                type="button"
                variant="destructive"
                onClick={remove}
                disabled={pending}
                className="sm:mr-auto"
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Apagar
              </Button>
            ) : null}
            <Button type="submit" disabled={pending}>
              {pending ? 'Salvando…' : goal ? 'Salvar' : 'Criar meta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
