import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';

import { showAlert } from './showAlert';
import { useAppTheme } from '@/theme';

type Props = {
  itemLabel: string;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onEdit?: () => void;
  onArchive?: () => void;
  /** Overrides the label/icon shown for `onArchive` — e.g. "Unarchive"/"refresh-outline" for a row
   * already in an Archived view. Defaults to "Archive"/"archive-outline". */
  archiveLabel?: string;
  archiveIcon?: keyof typeof Ionicons.glyphMap;
  onDelete: () => void;
};

/** Small per-row overflow menu — optional reorder chevrons plus an Archive/Delete action sheet —
 * shared by any list that lets a user manually order or quick-manage items (Habits, Recurring
 * tasks) without opening the item's detail screen first. */
export function RowActionsMenu({
  itemLabel,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onEdit,
  onArchive,
  archiveLabel = 'Archive',
  archiveIcon = 'archive-outline',
  onDelete,
}: Props) {
  const theme = useAppTheme();
  const [menuVisible, setMenuVisible] = useState(false);

  const confirmDelete = () => {
    setMenuVisible(false);
    showAlert(`Delete ${itemLabel}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: onDelete },
    ]);
  };

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      {onMoveUp || onMoveDown ? (
        <View style={{ alignItems: 'center' }}>
          <Pressable accessibilityLabel={`Move ${itemLabel} up`} onPress={onMoveUp} disabled={!canMoveUp} hitSlop={6}>
            <Ionicons name="chevron-up" size={16} color={canMoveUp ? theme.colors.textSecondary : theme.colors.border} />
          </Pressable>
          <Pressable accessibilityLabel={`Move ${itemLabel} down`} onPress={onMoveDown} disabled={!canMoveDown} hitSlop={6}>
            <Ionicons name="chevron-down" size={16} color={canMoveDown ? theme.colors.textSecondary : theme.colors.border} />
          </Pressable>
        </View>
      ) : null}
      <Pressable accessibilityLabel={`More actions for ${itemLabel}`} onPress={() => setMenuVisible(true)} hitSlop={8} style={{ paddingLeft: 6 }}>
        <Ionicons name="ellipsis-vertical" size={18} color={theme.colors.textTertiary} />
      </Pressable>

      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={() => setMenuVisible(false)}>
        <Pressable style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: theme.colors.overlay }} onPress={() => setMenuVisible(false)}>
          <View
            style={{
              backgroundColor: theme.colors.surface,
              borderTopLeftRadius: theme.radius.xl,
              borderTopRightRadius: theme.radius.xl,
              padding: theme.spacing.xl,
              gap: theme.spacing.sm,
            }}>
            {onEdit ? (
              <MenuRow
                icon="pencil-outline"
                label="Edit"
                onPress={() => {
                  setMenuVisible(false);
                  onEdit();
                }}
              />
            ) : null}
            {onArchive ? (
              <MenuRow
                icon={archiveIcon}
                label={archiveLabel}
                onPress={() => {
                  setMenuVisible(false);
                  onArchive();
                }}
              />
            ) : null}
            <MenuRow icon="trash-outline" label="Delete" danger onPress={confirmDelete} />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function MenuRow({ icon, label, danger, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; danger?: boolean; onPress: () => void }) {
  const theme = useAppTheme();
  const color = danger ? theme.colors.danger : theme.colors.textPrimary;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md, paddingVertical: theme.spacing.md }}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color, fontSize: theme.typography.size.base, fontWeight: theme.typography.weight.medium }}>{label}</Text>
    </Pressable>
  );
}
