'use client';

import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { Plus, GripVertical } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';
import type { TaskBucket, TodayTask } from '@/lib/supabase/types';
import {
  createTask,
  deleteTask,
  rescheduleTask,
  setTaskTime,
  toggleTaskComplete,
} from './task-actions';
import { HabitTaskRow } from './habit-task-row';

const BUCKET_LABEL: Record<TaskBucket, string> = {
  today: 'Today',
  tomorrow: 'Tomorrow',
  backlog: 'Backlog',
};

const BUCKET_ORDER: TaskBucket[] = ['today', 'tomorrow', 'backlog'];

const QUERY_KEY = ['tasks', 'today'] as const;

// A habit row, pre-rendered upstream but tagged with its sort keys so this
// component can interleave it with tasks by time. Habits keep their own query
// and mutations in today-client.tsx — only the ordering happens here.
export interface TodaySlotItem {
  id: string;
  time: string | null; // 'HH:MM:SS'
  order: number; // habit sort_order — tie-breaker at equal times
  node: ReactNode;
}

type MergedRow =
  | { kind: 'habit'; time: string | null; tie: string; item: TodaySlotItem }
  | { kind: 'task'; time: string | null; tie: string; item: TodayTask };

// Timed rows ascend chronologically; untimed rows collect at the bottom.
// 'HH:MM:SS' is lexicographically ordered, so a string compare is correct.
function byTimeNullsLast(a: MergedRow, b: MergedRow): number {
  if (a.time && b.time) {
    if (a.time !== b.time) return a.time < b.time ? -1 : 1;
  } else if (a.time) {
    return -1;
  } else if (b.time) {
    return 1;
  }
  return a.tie < b.tie ? -1 : a.tie > b.tie ? 1 : 0;
}

interface Props {
  initialTasks: TodayTask[];
  todaySlotItems?: TodaySlotItem[];
}

export function TaskBuckets({ initialTasks, todaySlotItems }: Props) {
  const supabase = createClient();
  const qc = useQueryClient();
  const [draggingTask, setDraggingTask] = useState<TodayTask | null>(null);

  const { data: tasks = initialTasks } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase.from('v_today_tasks').select('*');
      if (error) throw error;
      return (data ?? []) as TodayTask[];
    },
    initialData: initialTasks,
    staleTime: 30_000,
  });

  // Press-and-hold to drag — keeps taps available for the checkbox.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const toggleMutation = useMutation({
    mutationFn: async (input: { taskId: string; nowComplete: boolean }) => {
      const result = await toggleTaskComplete({
        taskId: input.taskId,
        complete: input.nowComplete,
      });
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ taskId, nowComplete }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<TodayTask[]>(QUERY_KEY);
      if (prev) {
        qc.setQueryData<TodayTask[]>(
          QUERY_KEY,
          prev.map((t) =>
            t.task_id === taskId
              ? { ...t, completed_at: nowComplete ? new Date().toISOString() : null }
              : t,
          ),
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to update task');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const result = await deleteTask({ taskId });
      if (result.error) throw new Error(result.error);
    },
    onMutate: async (taskId) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<TodayTask[]>(QUERY_KEY);
      if (prev) {
        qc.setQueryData<TodayTask[]>(QUERY_KEY, prev.filter((t) => t.task_id !== taskId));
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to delete task');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const createMutation = useMutation({
    mutationFn: async (input: { title: string; bucket: TaskBucket }) => {
      const result = await createTask(input);
      if (result.error) throw new Error(result.error);
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : 'Failed to create task');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const setTimeMutation = useMutation({
    mutationFn: async (input: { taskId: string; time: string | null }) => {
      const result = await setTaskTime(input);
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ taskId, time }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<TodayTask[]>(QUERY_KEY);
      if (prev) {
        // Normalise to the view's 'HH:MM:SS' so the optimistic sort matches
        // what comes back from the server.
        const stored = time == null ? null : time.length === 5 ? `${time}:00` : time;
        qc.setQueryData<TodayTask[]>(
          QUERY_KEY,
          prev.map((t) => (t.task_id === taskId ? { ...t, scheduled_time: stored } : t)),
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to set time');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  const rescheduleMutation = useMutation({
    mutationFn: async (input: { taskId: string; bucket: TaskBucket }) => {
      const result = await rescheduleTask(input);
      if (result.error) throw new Error(result.error);
    },
    onMutate: async ({ taskId, bucket }) => {
      await qc.cancelQueries({ queryKey: QUERY_KEY });
      const prev = qc.getQueryData<TodayTask[]>(QUERY_KEY);
      if (prev) {
        const today = prev[0]?.today_in_tz ?? new Date().toISOString().slice(0, 10);
        const offsetDays = bucket === 'today' ? 0 : bucket === 'tomorrow' ? 1 : 7;
        const newDate = addDaysISO(today, offsetDays);
        qc.setQueryData<TodayTask[]>(
          QUERY_KEY,
          prev.map((t) =>
            t.task_id === taskId ? { ...t, bucket, scheduled_date: newDate } : t,
          ),
        );
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(QUERY_KEY, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to move task');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    setDraggingTask(tasks.find((t) => t.task_id === id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDraggingTask(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (!BUCKET_ORDER.includes(overId as TaskBucket)) return;
    const targetBucket = overId as TaskBucket;
    const taskId = String(active.id);
    const task = tasks.find((t) => t.task_id === taskId);
    if (!task || task.bucket === targetBucket) return;
    rescheduleMutation.mutate({ taskId, bucket: targetBucket });
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDraggingTask(null)}
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <BucketCard
          bucket="today"
          tasks={tasks.filter((t) => t.bucket === 'today')}
          onToggle={(taskId, nowComplete) => toggleMutation.mutate({ taskId, nowComplete })}
          onDelete={(taskId) => deleteMutation.mutate(taskId)}
          onCreate={(title) => createMutation.mutate({ title, bucket: 'today' })}
          mutating={toggleMutation.isPending || deleteMutation.isPending}
          isDragging={draggingTask !== null}
          draggingFromBucket={draggingTask?.bucket ?? null}
          topSlotItems={todaySlotItems}
          onSetTime={(taskId, time) => setTimeMutation.mutate({ taskId, time })}
          draggingId={draggingTask?.task_id ?? null}
        />
        <div className="flex min-w-0 flex-col gap-6">
          {(['tomorrow', 'backlog'] as const).map((bucket) => (
            <BucketCard
              key={bucket}
              bucket={bucket}
              tasks={tasks.filter((t) => t.bucket === bucket)}
              onToggle={(taskId, nowComplete) =>
                toggleMutation.mutate({ taskId, nowComplete })
              }
              onDelete={(taskId) => deleteMutation.mutate(taskId)}
              onCreate={(title) => createMutation.mutate({ title, bucket })}
              mutating={toggleMutation.isPending || deleteMutation.isPending}
              isDragging={draggingTask !== null}
              draggingFromBucket={draggingTask?.bucket ?? null}
              draggingId={draggingTask?.task_id ?? null}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {draggingTask ? (
          <div
            className="bg-surface border-border flex items-center gap-2.5 rounded-md border px-3.5 py-2 text-[14px] font-medium shadow-lg"
            style={{ boxShadow: 'var(--shadow-lg)' }}
          >
            <GripVertical className="text-text-4 h-3 w-3" />
            <span>{draggingTask.title}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

interface BucketProps {
  bucket: TaskBucket;
  tasks: TodayTask[];
  onToggle: (taskId: string, nowComplete: boolean) => void;
  onDelete: (taskId: string) => void;
  onCreate: (title: string) => void;
  mutating: boolean;
  isDragging: boolean;
  draggingFromBucket: TaskBucket | null;
  draggingId: string | null;
  topSlotItems?: TodaySlotItem[];
  onSetTime?: (taskId: string, time: string | null) => void;
}

function BucketCard({
  bucket,
  tasks,
  onToggle,
  onDelete,
  onCreate,
  mutating,
  isDragging,
  draggingFromBucket,
  draggingId,
  topSlotItems,
  onSetTime,
}: BucketProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setNodeRef, isOver } = useDroppable({ id: bucket });

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  function commit() {
    const title = draft.trim();
    if (title) onCreate(title);
    setDraft('');
    setAdding(false);
  }

  const isValidTarget = isDragging && draggingFromBucket !== bucket;
  const visibleCount = tasks.filter((t) => t.completed_at == null).length;

  // Habits and tasks share one chronological list. Habits come in pre-rendered
  // (they keep their own query + mutations upstream); only ordering is decided here.
  const merged: MergedRow[] = [
    ...(topSlotItems ?? []).map(
      (i): MergedRow => ({ kind: 'habit', time: i.time, tie: String(i.order).padStart(6, '0'), item: i }),
    ),
    ...tasks.map((t): MergedRow => ({ kind: 'task', time: t.scheduled_time, tie: t.created_at, item: t })),
  ].sort(byTimeNullsLast);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'bg-surface border-border overflow-hidden rounded-xl border transition-colors',
        isValidTarget && 'border-accent',
        isOver && isValidTarget && 'bg-accent-tint',
      )}
    >
      <div className="flex items-center justify-between px-4 pb-2.5 pt-3.5">
        <div className="text-text-3 text-[11.5px] font-semibold uppercase tracking-[0.08em]">
          {BUCKET_LABEL[bucket]}
        </div>
        <div className="text-text-4 bg-surface-2 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums">
          {visibleCount}
        </div>
      </div>

      <div className="flex flex-col">
        {merged.map((row) =>
          row.kind === 'habit' ? (
            <Fragment key={`h:${row.item.id}`}>{row.item.node}</Fragment>
          ) : (
            <DraggableTaskRow
              key={row.item.task_id}
              task={row.item}
              onToggle={(nowComplete) => onToggle(row.item.task_id, nowComplete)}
              onDelete={() => onDelete(row.item.task_id)}
              onSetTime={
                onSetTime ? (time) => onSetTime(row.item.task_id, time) : undefined
              }
              disabled={mutating}
              isDragging={draggingId === row.item.task_id}
            />
          ),
        )}
        {tasks.length === 0 && !adding && !topSlotItems?.length ? (
          <div className="border-border text-text-4 border-t px-3.5 py-3 text-[14px] italic">
            {isValidTarget ? 'Drop here' : 'Nothing here.'}
          </div>
        ) : null}
        {adding ? (
          <div className="border-border bg-accent-tint flex h-[42px] items-center gap-2.5 border-t px-3.5">
            <span className="w-3" />
            <span className="border-border-strong bg-surface grid h-4 w-4 place-items-center rounded border-[1.5px]" />
            <span className="text-text-4 w-[42px] shrink-0 text-xs font-medium tabular-nums">—</span>
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commit();
                if (e.key === 'Escape') {
                  setDraft('');
                  setAdding(false);
                }
              }}
              placeholder="Task title…"
              className="text-text placeholder:text-text-4 flex-1 border-none bg-transparent p-0 text-[14px] font-medium outline-none"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="border-border text-text-3 hover:bg-surface-2 hover:text-text-2 flex h-[42px] w-full items-center gap-2 border-t px-3.5 text-left text-[14px] font-medium transition-colors"
          >
            <Plus className="h-3 w-3" />
            New task
          </button>
        )}
      </div>
    </section>
  );
}

function DraggableTaskRow({
  task,
  onToggle,
  onDelete,
  onSetTime,
  disabled,
  isDragging,
}: {
  task: TodayTask;
  onToggle: (nowComplete: boolean) => void;
  onDelete: () => void;
  onSetTime?: (time: string | null) => void;
  disabled?: boolean;
  isDragging: boolean;
}) {
  const { attributes, listeners, setNodeRef } = useDraggable({ id: task.task_id });
  return (
    <div ref={setNodeRef}>
      <HabitTaskRow
        kind="task"
        done={task.completed_at != null}
        time={task.scheduled_time}
        title={task.title}
        disabled={disabled}
        onToggle={onToggle}
        onDelete={onDelete}
        onTimeChange={onSetTime}
        dragHandleProps={{ ...attributes, ...listeners }}
        isDragging={isDragging}
      />
    </div>
  );
}

function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(`${dateISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
