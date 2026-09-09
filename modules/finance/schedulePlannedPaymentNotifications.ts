import { cancelReminder, requestNotificationPermissions, scheduleOneTimeNotification } from '@/notifications';
import { addDays } from '@/lib/date';

import type { PlannedPayment } from './types';

export function plannedPaymentReminderId(id: string): string {
  return `finance-planned-${id}`;
}

/** Reminds at 9am, `remind_days_before` days ahead of the payment's due date (0 = the due date
 * itself, matching the original behavior before subscriptions/bills gained a lead time) — planned
 * payments don't carry a time of day like tasks do, so there's no due-moment to offset a reminder
 * from. */
export async function syncPlannedPaymentNotification(
  payment: Pick<PlannedPayment, 'id' | 'payee' | 'amount' | 'next_date' | 'notify' | 'type' | 'remind_days_before'>
): Promise<void> {
  if (!payment.notify) {
    await cancelReminder(plannedPaymentReminderId(payment.id));
    return;
  }
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const reminderDateKey = addDays(payment.next_date, -payment.remind_days_before);
  const [year, month, day] = reminderDateKey.split('-').map(Number);
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  const dueLabel =
    payment.remind_days_before > 0 ? `in ${payment.remind_days_before} day${payment.remind_days_before === 1 ? '' : 's'}` : 'today';
  await scheduleOneTimeNotification({
    identifier: plannedPaymentReminderId(payment.id),
    title: payment.type === 'income' ? `${payment.payee} expected ${dueLabel}` : `${payment.payee} due ${dueLabel}`,
    body: `${payment.amount}`,
    date,
  });
}

export async function cancelPlannedPaymentNotification(id: string): Promise<void> {
  await cancelReminder(plannedPaymentReminderId(id));
}
