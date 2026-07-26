import { Ionicons } from '@expo/vector-icons';
import { Link, Stack, useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Card, EmptyState, LoadingState, ScreenContainer } from '@/components';
import { formatCurrency } from '@/modules/finance';
import { useShoppingLists } from '@/modules/shopping';
import { useAppTheme } from '@/theme';

export default function ShoppingListsScreen() {
  const theme = useAppTheme();
  const router = useRouter();
  const { lists, loading, refresh } = useShoppingLists();

  if (loading) {
    return (
      <ScreenContainer>
        <LoadingState />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer onRefresh={refresh}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Link href="/shopping/new" asChild>
              <Pressable hitSlop={8}>
                <Ionicons name="add-circle" size={28} color={theme.colors.primary} />
              </Pressable>
            </Link>
          ),
        }}
      />
      <View style={{ gap: theme.spacing.xl }}>
        <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size['3xl'], fontWeight: theme.typography.weight.bold }}>
          Shopping Lists
        </Text>

        {lists.length === 0 ? (
          <EmptyState
            icon="cart-outline"
            title="No shopping lists yet"
            subtitle="Create a list for groceries, a trip, or anything you're shopping for."
            ctaLabel="Create your first list"
            onPressCta={() => router.push('/shopping/new')}
          />
        ) : (
          <View style={{ gap: theme.spacing.md }}>
            {lists.map((list) => (
              <Link key={list.id} href={{ pathname: '/shopping/[listId]', params: { listId: list.id } }} asChild>
                <Pressable>
                  <Card style={{ gap: theme.spacing.xs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.lg, fontWeight: theme.typography.weight.bold }}>
                        {list.name}
                      </Text>
                      <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.sm }}>
                        {list.checkedItems}/{list.totalItems} items
                      </Text>
                      {list.estimate > 0 ? (
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ color: theme.colors.textPrimary, fontSize: theme.typography.size.sm, fontWeight: theme.typography.weight.semibold }}>
                            {formatCurrency(list.estimate, 'INR')}
                          </Text>
                          <Text style={{ color: theme.colors.textTertiary, fontSize: theme.typography.size.xs }}>Estimate</Text>
                        </View>
                      ) : null}
                    </View>
                  </Card>
                </Pressable>
              </Link>
            ))}
          </View>
        )}
      </View>
    </ScreenContainer>
  );
}
