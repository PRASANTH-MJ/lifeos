import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer, TextField } from '@/components';
import { useShoppingList } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

export default function ShoppingListScreen() {
  const theme = useAppTheme();
  const { items, loading, addItem, toggleChecked, removeItem, clearChecked } = useShoppingList();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onAdd = async () => {
    if (!name.trim()) return;
    await addItem(name.trim(), quantity.trim() || null);
    setName('');
    setQuantity('');
  };

  const checkedCount = items.filter((item) => item.checked).length;

  return (
    <ScreenContainer>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Shopping List
        </Text>

        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 2 }}>
              <TextField placeholder="Item name" value={name} onChangeText={setName} onSubmitEditing={onAdd} returnKeyType="done" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Qty" value={quantity} onChangeText={setQuantity} onSubmitEditing={onAdd} returnKeyType="done" />
            </View>
            <Pressable onPress={onAdd} hitSlop={8} style={{ justifyContent: 'center' }}>
              <Ionicons name="add-circle" size={32} color={theme.colors.primary} />
            </Pressable>
          </View>
        </Card>

        {items.length === 0 ? (
          <EmptyState icon="cart-outline" title="Your list is empty" subtitle="Add items above as you think of them." />
        ) : (
          <View style={{ gap: theme.spacing.sm }}>
            {items.map((item) => (
              <Pressable key={item.id} onPress={() => toggleChecked(item)}>
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                  <Ionicons
                    name={item.checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={item.checked ? theme.colors.success : theme.colors.textTertiary}
                  />
                  <Text
                    style={{
                      flex: 1,
                      color: item.checked ? theme.colors.textTertiary : theme.colors.textPrimary,
                      fontSize: theme.typography.size.base,
                      textDecorationLine: item.checked ? 'line-through' : 'none',
                    }}>
                    {item.name}
                  </Text>
                  {item.quantity ? (
                    <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>{item.quantity}</Text>
                  ) : null}
                  <Pressable onPress={() => removeItem(item.id)} hitSlop={8}>
                    <Ionicons name="close" size={18} color={theme.colors.textTertiary} />
                  </Pressable>
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
    </ScreenContainer>
  );
}
