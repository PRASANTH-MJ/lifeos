import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import * as Crypto from 'expo-crypto';

import { LoadingState, ScreenContainer, UpsellModal } from '@/components';
import { webDb } from '@/db/webDb';
import { pushLocalRow } from '@/modules/sync/syncEngine.web';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { TaskForm, useRecurringTasks, useTaskDetail, useTasks } from '@/modules/tasks';

export default function TaskFormScreen() {
  const router = useRouter();
  const { taskId, recurring } = useLocalSearchParams<{ taskId?: string; recurring?: string }>();
  const isEdit = Boolean(taskId);
  const initialRecurring = recurring === '1';
  const recurringGate = useFreeTierGate('recurringTasks');
  const taskGate = useFreeTierGate('tasks');
  const [upsellKind, setUpsellKind] = useState<'recurringTasks' | 'tasks' | null>(null);

  const { createTask } = useTasks();
  const { createRecurringTask } = useRecurringTasks();
  const { task: existingTask, loading: loadingExisting, updateTask } = useTaskDetail(Number(taskId ?? 0));

  if (isEdit && (loadingExisting || !existingTask)) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Stack.Screen options={{ title: isEdit ? 'Edit Task' : initialRecurring ? 'New Recurring Task' : 'New Task' }} />
      <TaskForm
        task={isEdit ? existingTask : null}
        autoFocusTitle={!isEdit}
        showChecklist={!isEdit}
        initialRecurring={!isEdit && initialRecurring}
        lockRecurring={!isEdit}
        submitLabel={isEdit ? 'Save changes' : 'Save task'}
        onSave={async (values, checklistItems) => {
          const addsANewRecurringTask = values.isRecurring && (!isEdit || !existingTask?.is_recurring);
          const addsANewPlainTask = !isEdit && !values.isRecurring;
          if (addsANewRecurringTask && !recurringGate.allowed) {
            setUpsellKind('recurringTasks');
            return;
          }
          if (addsANewPlainTask && !taskGate.allowed) {
            setUpsellKind('tasks');
            return;
          }

          if (isEdit) {
            await updateTask({
              title: values.title,
              notes: values.notes,
              priority: values.priority,
              category_id: values.categoryId,
              important: values.important ? 1 : 0,
              due_date: values.dueDate,
              due_time: values.dueTime,
              reminder_offset_minutes: values.reminderOffsetMinutes,
              alarm_enabled: values.alarmEnabled ? 1 : 0,
              recurrence_frequency: values.isRecurring ? values.recurrenceFrequency : null,
              recurrence_days: JSON.stringify(values.recurrenceDays),
              period_target_count: values.periodTargetCount,
              period_length_days: values.periodLengthDays,
            });
          } else {
            const newId = values.isRecurring
              ? await createRecurringTask({
                  title: values.title,
                  notes: values.notes ?? undefined,
                  priority: values.priority,
                  categoryId: values.categoryId,
                  important: values.important,
                  recurrenceFrequency: values.recurrenceFrequency,
                  recurrenceDays: values.recurrenceDays,
                  periodTargetCount: values.periodTargetCount,
                  periodLengthDays: values.periodLengthDays,
                  dueTime: values.dueTime,
                  reminderOffsetMinutes: values.reminderOffsetMinutes,
                  alarmEnabled: values.alarmEnabled,
                })
              : await createTask({
                  title: values.title,
                  notes: values.notes ?? undefined,
                  priority: values.priority,
                  categoryId: values.categoryId,
                  important: values.important,
                  dueDate: values.dueDate,
                  dueTime: values.dueTime,
                  reminderOffsetMinutes: values.reminderOffsetMinutes,
                  alarmEnabled: values.alarmEnabled,
                });

            // Native inserts checklist items as plain (non-recurring, incomplete) child tasks via
            // `INSERT INTO tasks (...) VALUES (...)` — translated here to webDb.tasks.add() calls
            // inside one transaction, each followed by pushLocalRow('tasks', id) so the new rows
            // sync out (sync_id/updated_at are required by pushLocalRow to actually enqueue).
            await webDb.transaction('rw', webDb.tasks, async () => {
              for (let i = 0; i < checklistItems.length; i += 1) {
                const now = new Date().toISOString();
                await webDb.tasks.add({
                  title: checklistItems[i],
                  notes: null,
                  priority: values.priority,
                  due_date: null,
                  completed_at: null,
                  parent_task_id: newId,
                  sort_order: i,
                  created_at: now,
                  archived: 0,
                  is_recurring: 0,
                  recurrence_days: '[]',
                  sync_id: Crypto.randomUUID(),
                  updated_at: now,
                } as never);
              }
            });
            for (let i = 0; i < checklistItems.length; i += 1) {
              const child = await webDb.tasks
                .where('parent_task_id')
                .equals(newId as number)
                .and((row) => row.sort_order === i)
                .first();
              if (child) await pushLocalRow('tasks', child.id as number);
            }
          }
          // Not router.back(): see the identical comment in app/(tabs)/habits/new.tsx — this
          // screen is also opened cross-tab (from Today's "+"), so dismissTo is what reliably
          // lands on the Tasks tab's list rather than wherever back() resolves to.
          router.dismissTo('/tasks');
        }}
      />

      <UpsellModal
        visible={upsellKind !== null}
        resourceLabel={upsellKind ? LIMIT_LABELS[upsellKind] : ''}
        limit={upsellKind === 'tasks' ? taskGate.limit : recurringGate.limit}
        onClose={() => setUpsellKind(null)}
      />
    </ScreenContainer>
  );
}
