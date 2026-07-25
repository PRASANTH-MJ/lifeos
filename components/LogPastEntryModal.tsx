import type { ReactNode } from 'react';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { monthCursorOf, shiftMonth, todayKey } from '@/lib/date';
import { CalendarMonthGrid } from '@/modules/calendar';
import { useAppTheme } from '@/theme';
import { Button } from './Button';
import { Chip } from './Chip';

type Item = { key: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  items: Item[];
  selectedItemKey: string | null;
  onSelectItem: (key: string) => void;
  date: string;
  onSelectDate: (dateKey: string) => void;
  extra?: ReactNode;
  onClose: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  moduleColor: string;
  moduleMutedColor: string;
};

/** Shared "log a past session/entry" bottom sheet — pick what happened, pick which day, save. */
export function LogPastEntryModal({
  visible,
  title,
  items,
  selectedItemKey,
  onSelectItem,
  date,
  onSelectDate,
  extra,
  onClose,
  onSave,
  saveDisabled,
  moduleColor,
  moduleMutedColor,
}: Props) {
  const theme = useAppTheme();
  const [cursor, setCursor] = useState(() => monthCursorOf(date));

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            maxHeight: '85%',
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.lg,
          }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
            {title}
          </Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {items.map((item) => (
              <Chip
                key={item.key}
                label={item.label}
                selected={selectedItemKey === item.key}
                onPress={() => onSelectItem(item.key)}
                color={moduleColor}
                mutedColor={moduleMutedColor}
              />
            ))}
          </View>

          {extra}

          <CalendarMonthGrid
            year={cursor.year}
            month={cursor.month}
            selectedDate={date}
            markedDates={new Set([date])}
            onSelectDate={onSelectDate}
            onChangeMonth={(delta) => setCursor((c) => shiftMonth(c, delta))}
          />

          <Button label="Save" onPress={onSave} disabled={saveDisabled || !selectedItemKey || date > todayKey()} />
        </View>
      </View>
    </Modal>
  );
}
