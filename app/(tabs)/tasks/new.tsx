import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';

import { LoadingState, ScreenContainer } from '@/components';
import { TaskForm, useRecurringTasks, useTaskDetail, useTasks } from '@/modules/tasks';

export default function TaskFormScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { taskId, recurring } = useLocalSearchParams<{ taskId?: string; recurring?: string }>();
  const isEdit = Boolean(taskId);
  const initialRecurring = recurring === '1';

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

            for (let i = 0; i < checklistItems.length; i += 1) {
              await db.runAsync(
                `INSERT INTO tasks (title, notes, priority, due_date, completed_at, parent_task_id, sort_order, created_at, archived, is_recurring, recurrence_days)
                 VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, 0, 0, '[]')`,
                [checklistItems[i], values.priority, newId, i, new Date().toISOString()]
              );
            }
          }
          router.back();
        }}
      />
    </ScreenContainer>
  );
}
