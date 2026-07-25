import { cancelReminder, requestNotificationPermissions, scheduleOneTimeNotification } from '@/notifications';

import type { PlannedPayment } from './types';

export function plannedPaymentReminderId(id: string): string {
  return `finance-planned-${id}`;
}

/** Reminds at 9am on the payment's due date — planned payments don't carry a time of day like
 * tasks do, so there's no due-moment to offset a reminder from. */
export async function syncPlannedPaymentNotification(payment: Pick<PlannedPayment, 'id' | 'payee' | 'amount' | 'next_date' | 'notify' | 'type'>): Promise<void> {
  if (!payment.notify) {
    await cancelReminder(plannedPaymentReminderId(payment.id));
    return;
  }
  const granted = await requestNotificationPermissions();
  if (!granted) return;

  const [year, month, day] = payment.next_date.split('-').map(Number);
  const date = new Date(year, month - 1, day, 9, 0, 0, 0);
  await scheduleOneTimeNotification({
    identifier: plannedPaymentReminderId(payment.id),
    title: payment.type === 'income' ? `${payment.payee} expected today` : `${payment.payee} due today`,
    body: `${payment.amount}`,
    date,
  });
}

export async function cancelPlannedPaymentNotification(id: string): Promise<void> {
  await cancelReminder(plannedPaymentReminderId(id));
}
