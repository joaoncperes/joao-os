'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowLeft, ArrowUp, Moon, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { savePlan } from './actions';

export interface PlanDay {
  dayOfWeek: number;
  label: string;
  name: string;
  isRest: boolean;
  exercises: { name: string; sets: number }[];
}

interface Props {
  initialDays: PlanDay[];
  knownExercises: string[];
}

export function PlanEditor({ initialDays, knownExercises }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [days, setDays] = useState<PlanDay[]>(initialDays);
  const [dirty, setDirty] = useState(false);

  function patchDay(dow: number, fn: (d: PlanDay) => PlanDay) {
    setDirty(true);
    setDays((all) => all.map((d) => (d.dayOfWeek === dow ? fn(d) : d)));
  }

  function save() {
    start(async () => {
      const r = await savePlan(
        days.map((d) => ({
          dayOfWeek: d.dayOfWeek,
          name: d.name,
          isRest: d.isRest,
          exercises: d.exercises,
        })),
      );
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success('Plano de treino salvo');
      setDirty(false);
      router.push('/workout');
      router.refresh();
    });
  }

  const trainingDays = days.filter((d) => !d.isRest && d.exercises.some((e) => e.name.trim())).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/workout"
          className="text-text-3 hover:text-text mb-3 inline-flex items-center gap-1 text-[12.5px] font-medium"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para Treino
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-accent mb-2 text-[12px] font-semibold uppercase tracking-[0.08em]">
              Treino
            </div>
            <h1 className="text-text text-[30px] font-semibold leading-[1.05] tracking-[-0.02em]">
              Plano de treino
            </h1>
            <p className="text-text-3 mt-1.5 text-[13.5px]">
              Monte o treino de cada dia. {trainingDays} {trainingDays === 1 ? 'dia de treino' : 'dias de treino'} na semana.
            </p>
          </div>
          <Button onClick={save} disabled={pending || !dirty}>
            {pending ? 'Salvando…' : 'Salvar plano'}
          </Button>
        </div>
      </div>

      <datalist id="known-exercises">
        {knownExercises.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>

      <div className="grid gap-3 lg:grid-cols-2">
        {days.map((d) => (
          <div
            key={d.dayOfWeek}
            className={cn(
              'bg-surface border-border flex flex-col gap-3 rounded-xl border px-4 py-4',
              d.isRest && 'opacity-80',
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-text-3 text-[11px] font-semibold uppercase tracking-[0.08em]">
                {d.label}
              </div>
              <label className="text-text-2 inline-flex cursor-pointer items-center gap-1.5 text-[12.5px] font-medium">
                <input
                  type="checkbox"
                  checked={d.isRest}
                  onChange={(e) => patchDay(d.dayOfWeek, (x) => ({ ...x, isRest: e.target.checked }))}
                  className="accent-[var(--accent)]"
                />
                <Moon className="h-3.5 w-3.5" />
                Descanso
              </label>
            </div>

            {d.isRest ? (
              <p className="text-text-3 text-[13px]">Dia livre. Corridas podem ser registradas em qualquer dia.</p>
            ) : (
              <>
                <input
                  value={d.name}
                  onChange={(e) => patchDay(d.dayOfWeek, (x) => ({ ...x, name: e.target.value }))}
                  placeholder="Nome do treino (ex.: Peito e tríceps)"
                  aria-label={`Nome do treino de ${d.label}`}
                  className="border-border bg-surface text-text placeholder:text-text-4 focus:border-accent h-9 rounded-lg border px-3 text-[14px] font-semibold outline-none"
                />

                <ul className="flex flex-col gap-1.5">
                  {d.exercises.map((ex, i) => (
                    <li key={i} className="flex items-center gap-1.5">
                      <input
                        value={ex.name}
                        list="known-exercises"
                        onChange={(e) =>
                          patchDay(d.dayOfWeek, (x) => ({
                            ...x,
                            exercises: x.exercises.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)),
                          }))
                        }
                        placeholder="Exercício"
                        aria-label="Exercício"
                        className="border-border bg-surface text-text placeholder:text-text-4 focus:border-accent h-8 min-w-0 flex-1 rounded-md border px-2.5 text-[13px] outline-none"
                      />
                      <div className="border-border bg-surface inline-flex h-8 items-center rounded-md border pr-1.5">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={ex.sets}
                          onChange={(e) =>
                            patchDay(d.dayOfWeek, (x) => ({
                              ...x,
                              exercises: x.exercises.map((y, j) =>
                                j === i ? { ...y, sets: Number(e.target.value) || 1 } : y,
                              ),
                            }))
                          }
                          aria-label="Séries"
                          className="text-text w-10 border-none bg-transparent px-1 text-center text-[13px] font-semibold tabular-nums outline-none"
                        />
                        <span className="text-text-4 text-[10.5px] font-medium">séries</span>
                      </div>
                      <IconBtn
                        label="Subir"
                        disabled={i === 0}
                        onClick={() =>
                          patchDay(d.dayOfWeek, (x) => ({ ...x, exercises: move(x.exercises, i, i - 1) }))
                        }
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        label="Descer"
                        disabled={i === d.exercises.length - 1}
                        onClick={() =>
                          patchDay(d.dayOfWeek, (x) => ({ ...x, exercises: move(x.exercises, i, i + 1) }))
                        }
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </IconBtn>
                      <IconBtn
                        label="Remover"
                        onClick={() =>
                          patchDay(d.dayOfWeek, (x) => ({
                            ...x,
                            exercises: x.exercises.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </IconBtn>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() =>
                    patchDay(d.dayOfWeek, (x) => ({ ...x, exercises: [...x.exercises, { name: '', sets: 3 }] }))
                  }
                  className="text-accent inline-flex items-center gap-1 self-start text-[12.5px] font-semibold hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Adicionar exercício
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <p className="text-text-3 text-[12px]">
        Dica: use sempre o mesmo nome para o mesmo exercício. É assim que o app acompanha a sua progressão de carga.
      </p>

      <div className="flex justify-end">
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? 'Salvando…' : 'Salvar plano'}
        </Button>
      </div>
    </div>
  );
}

function IconBtn({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="text-text-4 hover:text-text hover:bg-surface-2 grid h-8 w-7 shrink-0 place-items-center rounded-md disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function move<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
