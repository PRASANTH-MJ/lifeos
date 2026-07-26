export type ShoppingList = {
  id: number;
  name: string;
  created_at: string;
};

export type ShoppingItem = {
  id: number;
  list_id: number;
  name: string;
  quantity: string | null;
  price: number | null;
  checked: number;
  sort_order: number;
  created_at: string;
};
