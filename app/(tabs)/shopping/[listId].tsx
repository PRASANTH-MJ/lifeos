import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Text, View } from 'react-native';

import {
  Button,
  Card,
  Chip,
  EmptyState,
  GlowSurface,
  ImportFormatModal,
  LoadingState,
  RowActionsMenu,
  ScreenContainer,
  StatCard,
  TextField,
  showAlert,
  type ImportFieldSpec,
} from '@/components';
import { readDocumentText } from '@/lib/readDocumentText';
import { loadSampleShoppingItems } from '@/lib/sampleData';
import { formatCurrency, useAccounts } from '@/modules/finance';
import { parseShoppingCsv, priceLabelForUnit, SHOPPING_UNITS, UNIT_LABELS, useShoppingList, useShoppingLists } from '@/modules/shopping';
import type { ShoppingItem, ShoppingUnit } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

const CSV_MIME_TYPES = ['text/csv', 'text/comma-separated-values', 'application/vnd.ms-excel', 'text/plain'];

/** Mirrors exactly what modules/shopping/importShoppingCsv.ts reads — keep in sync with that file
 * if its column matching ever changes. */
const SHOPPING_IMPORT_FIELDS: ImportFieldSpec[] = [
  {
    column: 'name',
    aliases: ['item', 'itemName'],
    required: true,
    format: 'Text — the item name.',
    notes: 'Rows with no name are skipped.',
    example: 'Milk',
  },
  {
    column: 'quantity',
    aliases: ['qty'],
    required: false,
    format: 'Free text (any format you like, e.g. a number or "2 kg").',
    example: '2',
  },
  {
    column: 'price',
    required: false,
    format: 'Plain number, no currency symbol.',
    example: '3.49',
  },
];

type ItemDraft = { name: string; quantity: string; unit: ShoppingUnit; price: string; notes: string };

const BLANK_DRAFT: ItemDraft = { name: '', quantity: '', unit: 'pcs', price: '', notes: '' };

function draftFromItem(item: ShoppingItem): ItemDraft {
  return {
    name: item.name,
    quantity: item.quantity && item.quantity !== '1' ? item.quantity : '',
    unit: item.unit ?? 'pcs',
    price: item.price != null ? String(item.price) : '',
    notes: item.notes ?? '',
  };
}

/** Add/Edit item bottom sheet — one sheet handles both (editingItem null = adding), mirroring the
 * app's other log-entry sheets (HabitLogSheet) instead of the old always-expanded inline Card,
 * which ate ~400px of permanently-visible space above the list on every visit. */
function ItemFormSheet({
  visible,
  editingItem,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  editingItem: ShoppingItem | null;
  onClose: () => void;
  onSubmit: (draft: ItemDraft) => Promise<void>;
}) {
  const theme = useAppTheme();
  const [draft, setDraft] = useState<ItemDraft>(BLANK_DRAFT);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setDraft(editingItem ? draftFromItem(editingItem) : BLANK_DRAFT);
  }, [visible, editingItem]);

  const onSave = async () => {
    if (!draft.name.trim()) return;
    setSaving(true);
    await onSubmit(draft);
    setSaving(false);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, justifyContent: 'flex-end' }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={{ flex: 1, backgroundColor: theme.colors.overlay }} onPress={onClose} />
        <View
          style={{
            backgroundColor: theme.colors.surface,
            borderTopLeftRadius: theme.radius.xl,
            borderTopRightRadius: theme.radius.xl,
            padding: theme.spacing.xl,
            gap: theme.spacing.md,
            maxHeight: '85%',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
              {editingItem ? 'Edit item' : 'Add item'}
            </Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={theme.colors.textTertiary} />
            </Pressable>
          </View>

          <TextField label="Item name" placeholder="e.g. Milk" value={draft.name} onChangeText={(name) => setDraft((d) => ({ ...d, name }))} autoFocus={!editingItem} />

          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Quantity (optional)"
                placeholder="e.g. 2"
                value={draft.quantity}
                onChangeText={(quantity) => setDraft((d) => ({ ...d, quantity }))}
                keyboardType="decimal-pad"
              />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.xs, paddingBottom: 10 }}>
              {SHOPPING_UNITS.map((option) => (
                <Chip key={option} label={UNIT_LABELS[option]} selected={draft.unit === option} onPress={() => setDraft((d) => ({ ...d, unit: option }))} />
              ))}
            </View>
          </View>

          <TextField
            label={`${priceLabelForUnit(draft.unit)} (optional)`}
            placeholder="₹0.00"
            value={draft.price}
            onChangeText={(price) => setDraft((d) => ({ ...d, price }))}
            keyboardType="decimal-pad"
          />
          <TextField
            label="Notes (optional)"
            placeholder="e.g. ripe ones, brand preference"
            value={draft.notes}
            onChangeText={(notes) => setDraft((d) => ({ ...d, notes }))}
          />
          <Button label={editingItem ? 'Save changes' : 'Add item'} onPress={onSave} disabled={!draft.name.trim()} loading={saving} />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function ShoppingListScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { listId, seed } = useLocalSearchParams<{ listId: string; seed?: string }>();
  const id = Number(listId);
  const { lists, removeList } = useShoppingLists();
  const { items, loading, addItem, updateItem, toggleChecked, removeItem, clearChecked, overallTotal, remainingTotal, itemTotal, refresh } =
    useShoppingList(id);
  // Follows the user's actual account currency, not a hardcoded 'INR' — see shopping/index.tsx.
  const { displayCurrency } = useAccounts();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null);
  const [formatModalVisible, setFormatModalVisible] = useState(false);
  const seededRef = useRef(false);

  const list = lists.find((l) => l.id === id);

  // Arrives once, right after creating a fresh list from the "load a sample list" action on the
  // lists screen — seeded through the same addItem() a real user would use, not a raw DB write.
  useEffect(() => {
    if (seed !== '1' || seededRef.current || loading || items.length > 0) return;
    seededRef.current = true;
    loadSampleShoppingItems(addItem);
  }, [seed, loading, items.length, addItem]);

  const onImportCsv = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: CSV_MIME_TYPES, copyToCacheDirectory: true });
    if (result.canceled || !result.assets[0]) return;
    const text = await readDocumentText(result.assets[0]);
    const { rows, total, skipped } = parseShoppingCsv(text);

    if (rows.length === 0) {
      showAlert('Nothing to import', 'No rows had a usable item name. Make sure your CSV has a "name" column.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'View CSV format', onPress: () => setFormatModalVisible(true) },
      ]);
      return;
    }

    showAlert(
      `Import ${rows.length} item${rows.length === 1 ? '' : 's'}?`,
      skipped > 0 ? `${skipped} of ${total} rows were skipped (no name).` : `All ${total} rows matched.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          onPress: async () => {
            for (const row of rows) {
              await addItem(row.name, row.quantity, row.price);
            }
          },
        },
      ]
    );
  };

  const onDeleteList = () => {
    showAlert(`Delete "${list?.name ?? 'this list'}"?`, 'This deletes every item in it. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await removeList(id);
          router.back();
        },
      },
    ]);
  };

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onSubmitItem = async (draft: ItemDraft) => {
    if (editingItem) {
      await updateItem(editingItem.id, {
        name: draft.name.trim(),
        quantity: draft.quantity.trim() || null,
        price: draft.price.trim() ? Number(draft.price) : null,
        unit: draft.unit,
        notes: draft.notes.trim() || null,
      });
    } else {
      await addItem(draft.name.trim(), draft.quantity.trim() || null, draft.price.trim() ? Number(draft.price) : null, draft.unit, draft.notes.trim() || null);
    }
    setSheetVisible(false);
    setEditingItem(null);
  };

  const openAddSheet = () => {
    setEditingItem(null);
    setSheetVisible(true);
  };

  const openEditSheet = (item: ShoppingItem) => {
    setEditingItem(item);
    setSheetVisible(true);
  };

  const checkedCount = items.filter((item) => item.checked).length;

  return (
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          title: list?.name ?? 'Shopping List',
          headerRight: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
              <Pressable hitSlop={8} onPress={() => setFormatModalVisible(true)}>
                <Ionicons name="information-circle-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={onImportCsv}>
                <Ionicons name="document-attach-outline" size={22} color={theme.colors.textSecondary} />
              </Pressable>
              <Pressable hitSlop={8} onPress={onDeleteList}>
                <Ionicons name="trash-outline" size={22} color={theme.colors.danger} />
              </Pressable>
            </View>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
          <Text style={{ flex: 1, color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            {list?.name ?? 'Shopping List'}
          </Text>
          <Pressable
            onPress={openAddSheet}
            hitSlop={8}
            style={{
              width: 40,
              height: 40,
              borderRadius: theme.radius.full,
              backgroundColor: theme.colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="add" size={24} color="#fff" />
          </Pressable>
        </View>

        {overallTotal > 0 ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatCard label="Overall" value={formatCurrency(overallTotal, displayCurrency)} />
            <StatCard
              label="Remaining"
              value={formatCurrency(remainingTotal, displayCurrency)}
              color={remainingTotal > 0 ? theme.colors.danger : theme.colors.success}
            />
          </View>
        ) : null}

        {items.length === 0 ? (
          <EmptyState icon="cart-outline" title="Your list is empty" subtitle="Tap + to add your first item." />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => toggleChecked(item)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  {item.checked ? (
                    <GlowSurface intensity="sm" color={theme.colors.success} borderRadius={theme.radius.sm}>
                      <View
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: theme.radius.sm,
                          backgroundColor: theme.colors.success,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                        <Ionicons name="checkmark" size={16} color="#fff" />
                      </View>
                    </GlowSurface>
                  ) : (
                    <View
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: theme.radius.sm,
                        borderWidth: 2,
                        borderColor: theme.colors.border,
                      }}
                    />
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      numberOfLines={1}
                      style={{
                        color: item.checked ? theme.colors.textTertiary : theme.colors.textPrimary,
                        fontSize: theme.typography.size.base,
                        textDecorationLine: item.checked ? 'line-through' : 'none',
                      }}>
                      {item.name}
                    </Text>
                    {item.quantity || item.price != null ? (
                      <Text numberOfLines={1} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {item.quantity ? `Qty ${item.quantity}${item.unit && item.unit !== 'pcs' ? ` ${item.unit}` : ''}` : null}
                        {item.quantity && item.price != null ? ' · ' : null}
                        {item.price != null ? `${formatCurrency(item.price, displayCurrency)} ${priceLabelForUnit(item.unit ?? 'pcs').replace('Price ', '')}` : null}
                      </Text>
                    ) : null}
                    {item.notes ? (
                      <Text numberOfLines={1} style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs, fontStyle: 'italic' }}>
                        {item.notes}
                      </Text>
                    ) : null}
                  </View>
                  {item.price != null ? (
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                      {formatCurrency(itemTotal(item), displayCurrency)}
                    </Text>
                  ) : null}
                  <RowActionsMenu itemLabel={item.name} onEdit={() => openEditSheet(item)} onDelete={() => removeItem(item.id)} />
                </Card>
              </Pressable>
            ))}
          </View>
        )}

        {checkedCount > 0 ? (
          <Pressable onPress={clearChecked} style={{ alignItems: 'center' }}>
            <Text style={{ color: theme.colors.danger, fontSize: theme.typography.size.sm }}>Clear {checkedCount} checked item{checkedCount === 1 ? '' : 's'}</Text>
          </Pressable>
        ) : null}
      </View>

      <ItemFormSheet
        visible={sheetVisible}
        editingItem={editingItem}
        onClose={() => {
          setSheetVisible(false);
          setEditingItem(null);
        }}
        onSubmit={onSubmitItem}
      />

      <ImportFormatModal
        visible={formatModalVisible}
        onClose={() => setFormatModalVisible(false)}
        title="CSV/Excel import format"
        intro="Build your own file with a header row using these column names (any order, case-insensitive), then import it as CSV or Excel."
        fields={SHOPPING_IMPORT_FIELDS}
      />
    </ScreenContainer>
  );
}
