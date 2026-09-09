export type ShoppingList = {
  id: number;
  name: string;
  created_at: string;
};

export type ShoppingUnit = 'pcs' | 'kg' | 'g' | 'L' | 'ml';

export type ShoppingItem = {
  id: number;
  list_id: number;
  name: string;
  quantity: string | null;
  unit: ShoppingUnit | null;
  price: number | null;
  notes: string | null;
  checked: number;
  sort_order: number;
  created_at: string;
};
