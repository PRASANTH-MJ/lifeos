import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer, StatCard, TextField } from '@/components';
import { formatCurrency } from '@/modules/finance';
import { useShoppingList } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

export default function ShoppingListScreen() {
  const theme = useAppTheme();
  const { items, loading, addItem, toggleChecked, removeItem, clearChecked, overallTotal, remainingTotal, itemTotal, refresh } =
    useShoppingList();
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('');
  const [price, setPrice] = useState('');

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onAdd = async () => {
    if (!name.trim()) return;
    await addItem(name.trim(), quantity.trim() || null, price.trim() ? Number(price) : null);
    setName('');
    setQuantity('');
    setPrice('');
  };

  const checkedCount = items.filter((item) => item.checked).length;

  return (
    <ScreenContainer onRefresh={refresh}>
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Shopping List
        </Text>

        {overallTotal > 0 ? (
          <View style={{ flexDirection: 'row', gap: theme.spacing.md }}>
            <StatCard label="Overall" value={formatCurrency(overallTotal, 'INR')} />
            <StatCard
              label="Remaining"
              value={formatCurrency(remainingTotal, 'INR')}
              color={remainingTotal > 0 ? theme.colors.danger : theme.colors.success}
            />
          </View>
        ) : null}

        <Card style={{ gap: theme.spacing.sm }}>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm }}>
            <View style={{ flex: 2 }}>
              <TextField placeholder="Item name" value={name} onChangeText={setName} onSubmitEditing={onAdd} returnKeyType="done" />
            </View>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Qty" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" onSubmitEditing={onAdd} returnKeyType="done" />
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <TextField placeholder="Price (₹)" value={price} onChangeText={setPrice} keyboardType="decimal-pad" onSubmitEditing={onAdd} returnKeyType="done" />
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
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        color: item.checked ? theme.colors.textTertiary : theme.colors.textPrimary,
                        fontSize: theme.typography.size.base,
                        textDecorationLine: item.checked ? 'line-through' : 'none',
                      }}>
                      {item.name}
                    </Text>
                    {item.quantity || item.price != null ? (
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                        {item.quantity ? `Qty ${item.quantity}` : null}
                        {item.quantity && item.price != null ? ' · ' : null}
                        {item.price != null ? `${formatCurrency(item.price, 'INR')} each` : null}
                      </Text>
                    ) : null}
                  </View>
                  {item.price != null ? (
                    <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                      {formatCurrency(itemTotal(item), 'INR')}
                    </Text>
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
