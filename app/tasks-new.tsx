import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';

import { LoadingState, ScreenContainer, UpsellModal } from '@/components';
import { LIMIT_LABELS, useFreeTierGate } from '@/modules/premium';
import { TaskForm, useRecurringTasks, useTaskDetail, useTaskLabelLinks, useTasks } from '@/modules/tasks';

export default function TaskFormScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { taskId, recurring } = useLocalSearchParams<{ taskId?: string; recurring?: string }>();
  const isEdit = Boolean(taskId);
  const initialRecurring = recurring === '1';
  const recurringGate = useFreeTierGate('recurringTasks');
  const taskGate = useFreeTierGate('tasks');
  const [upsellKind, setUpsellKind] = useState<'recurringTasks' | 'tasks' | null>(null);

  const { createTask } = useTasks();
  const { createRecurringTask } = useRecurringTasks();
  const { task: existingTask, loading: loadingExisting, updateTask } = useTaskDetail(Number(taskId ?? 0));
  const { setLabelsFor } = useTaskLabelLinks(isEdit ? Number(taskId) : null);

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
        onSave={async (values, checklistItems, labelIds) => {
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
              blocked_by_task_id: values.blockedByTaskId,
            });
            await setLabelsFor(Number(taskId), labelIds);
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
                  blockedByTaskId: values.blockedByTaskId,
                });

            for (let i = 0; i < checklistItems.length; i += 1) {
              await db.runAsync(
                `INSERT INTO tasks (title, notes, priority, due_date, completed_at, parent_task_id, sort_order, created_at, archived, is_recurring, recurrence_days)
                 VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, 0, 0, '[]')`,
                [checklistItems[i], values.priority, newId, i, new Date().toISOString()]
              );
            }
            if (labelIds.length > 0) {
              await setLabelsFor(newId, labelIds);
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
