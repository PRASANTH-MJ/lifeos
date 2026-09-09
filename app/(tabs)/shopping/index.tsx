import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, IconBadge, LoadingState, ScreenContainer, showAlert } from '@/components';
import { SAMPLE_SHOPPING_LIST_NAME } from '@/lib/sampleData';
import { formatCurrency, useAccounts } from '@/modules/finance';
import { useShoppingLists } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

export default function ShoppingListsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { lists, loading, addList, refresh } = useShoppingLists();
  // Follows the user's actual account currency (same source Finance uses), not a hardcoded 'INR'
  // — a non-INR user's shopping totals were showing the wrong currency symbol entirely.
  const { displayCurrency } = useAccounts();

  if (loading) {
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <LoadingState />
      </ScreenContainer>
    );
  }

  const onLoadSampleList = () => {
    showAlert('Load a sample list?', `Creates a "${SAMPLE_SHOPPING_LIST_NAME}" list with a few common items so you can see how it looks.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Load sample list',
        onPress: async () => {
          const listId = await addList(SAMPLE_SHOPPING_LIST_NAME);
          router.push({ pathname: '/shopping/[listId]', params: { listId, seed: '1' } });
        },
      },
    ]);
  };

  return (
    <ScreenContainer onRefresh={refresh} edges={['top', 'bottom']}>
      <View style={{ gap: theme.spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
            Shopping Lists
          </Text>
          {lists.length > 0 ? (
            // The shopping tab's Stack.Screen has headerShown: false (see _layout.tsx), so a
            // Stack.Screen headerRight button here would never render — this body-level button
            // is the actual "add another list" entry point once at least one list already exists
            // (the EmptyState CTA below only covers the zero-lists case).
            <Link href="/shopping/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={30} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ) : null}
        </View>

        {lists.length === 0 ? (
          <View style={{ gap: theme.spacing.sm }}>
            <EmptyState
              icon="cart-outline"
              title="No shopping lists yet"
              subtitle="Create a list for groceries, a trip, or anything you're shopping for."
              ctaLabel="Create your first list"
              onPressCta={() => router.push('/shopping/new')}
            />
            <Pressable onPress={onLoadSampleList} style={{ alignItems: 'center' }}>
              <Text style={{ color: theme.colors.primary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.medium }}>
                Or load a sample list
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {lists.map((list) => {
              const progress = list.totalItems > 0 ? list.checkedItems / list.totalItems : 0;
              return (
                <Link key={list.id} href={{ pathname: '/shopping/[listId]', params: { listId: list.id } }} asChild>
                  <Pressable>
                    <Card style={{ gap: theme.spacing.sm }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md }}>
                        <IconBadge name="cart-outline" size="md" />
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                            {list.name}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>
                            {list.checkedItems}/{list.totalItems} items
                          </Text>
                        </View>
                        {list.estimate > 0 ? (
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                              {formatCurrency(list.estimate, displayCurrency)}
                            </Text>
                            <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Estimate</Text>
                          </View>
                        ) : null}
                        <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                      </View>
                      {list.totalItems > 0 ? (
                        <View style={{ height: 4, borderRadius: theme.radius.full, backgroundColor: theme.colors.surface, overflow: 'hidden' }}>
                          <View
                            style={{
                              width: `${Math.round(progress * 100)}%`,
                              height: '100%',
                              borderRadius: theme.radius.full,
                              backgroundColor: progress >= 1 ? theme.colors.success : theme.colors.primary,
                            }}
                          />
                        </View>
                      ) : null}
                    </Card>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
