import indianFoodsData from './data/indianFoods.json';

export type FoodSearchResult = {
  code: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  caloriesPer100g: number | null;
  proteinPer100g: number | null;
  carbsPer100g: number | null;
  fatPer100g: number | null;
  /** Present for local Indian-dish results (source === 'indian') — these are per-serving values
   * (see `serving`), not per 100g, since a whole dosa/idli isn't naturally described in 100g terms. */
  serving?: string;
  source: 'indian' | 'openfoodfacts';
};

type IndianFoodRow = { name: string; aliases?: string[]; serving: string; calories: number; protein: number; carbs: number; fat: number };

const INDIAN_FOODS = indianFoodsData as IndianFoodRow[];

function searchIndianFoods(query: string): FoodSearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return INDIAN_FOODS.filter(
    (food) => food.name.toLowerCase().includes(q) || (food.aliases ?? []).some((alias) => alias.toLowerCase().includes(q))
  ).map((food, i) => ({
    code: `indian-${i}-${food.name}`,
    name: food.name,
    brand: null,
    imageUrl: null,
    caloriesPer100g: food.calories,
    proteinPer100g: food.protein,
    carbsPer100g: food.carbs,
    fatPer100g: food.fat,
    serving: food.serving,
    source: 'indian' as const,
  }));
}

type OffNutriments = {
  'energy-kcal_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
};

type OffProduct = {
  code?: string;
  product_name?: string;
  brands?: string;
  image_small_url?: string;
  nutriments?: OffNutriments;
};

function toOffResult(product: OffProduct): FoodSearchResult | null {
  const name = product.product_name?.trim();
  if (!name || !product.code) return null;
  const n = product.nutriments ?? {};
  return {
    code: product.code,
    name,
    brand: product.brands?.trim() || null,
    imageUrl: product.image_small_url || null,
    caloriesPer100g: typeof n['energy-kcal_100g'] === 'number' ? n['energy-kcal_100g'] : null,
    proteinPer100g: typeof n.proteins_100g === 'number' ? n.proteins_100g : null,
    carbsPer100g: typeof n.carbohydrates_100g === 'number' ? n.carbohydrates_100g : null,
    fatPer100g: typeof n.fat_100g === 'number' ? n.fat_100g : null,
    source: 'openfoodfacts' as const,
  };
}

const FIELDS = 'code,product_name,brands,nutriments,image_small_url';

/** Searches a curated set of common Indian dishes (standard reference nutrition values) first,
 * then Open Food Facts (free, open, ODbL-licensed — see FOOD_DATA_LICENSE_NOTICE) for packaged
 * products — Open Food Facts alone under-represents home-cooked Indian dishes since it's primarily
 * a barcode/packaged-product database, so the curated list fills that gap. */
export async function searchFoodProducts(query: string): Promise<FoodSearchResult[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const indianResults = searchIndianFoods(trimmed);

  let offResults: FoodSearchResult[] = [];
  try {
    const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(
      trimmed
    )}&search_simple=1&action=process&json=1&page_size=20&fields=${FIELDS}`;
    const response = await fetch(url);
    if (response.ok) {
      const data = await response.json();
      const products: OffProduct[] = data.products ?? [];
      offResults = products.map(toOffResult).filter((r): r is FoodSearchResult => r != null);
    }
  } catch {
    // Open Food Facts unreachable — still return whatever curated Indian-dish matches we found.
  }

  return [...indianResults, ...offResults];
}

/** Looks up a single product by barcode (e.g. from a camera scan) — barcodes only apply to
 * packaged products, so this only ever queries Open Food Facts. */
export async function lookupFoodBarcode(barcode: string): Promise<FoodSearchResult | null> {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json?fields=${FIELDS}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  if (data.status === 0 || !data.product) return null;
  return toOffResult(data.product);
}

export const FOOD_DATA_LICENSE_NOTICE = 'Indian dish values are standard reference estimates · Packaged food data from Open Food Facts (ODbL)';
