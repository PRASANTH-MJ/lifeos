import type { ShoppingUnit } from './types';

export const SHOPPING_UNITS: ShoppingUnit[] = ['pcs', 'kg', 'g', 'L', 'ml'];

export const UNIT_LABELS: Record<ShoppingUnit, string> = { pcs: 'pcs', kg: 'kg', g: 'g', L: 'L', ml: 'ml' };

/** Price is always entered as a rate against the *larger* unit of its family (per piece, per kg,
 * per L) even when the quantity itself is logged in the smaller one (g, ml) — matching how prices
 * are actually quoted at a shop. This is the label shown above the price field for a given unit. */
export function priceLabelForUnit(unit: ShoppingUnit): string {
  if (unit === 'g' || unit === 'kg') return 'Price per kg';
  if (unit === 'ml' || unit === 'L') return 'Price per L';
  return 'Price per piece';
}

/** Shopping quantity is free-text ("25 kg", "4 L", "2 kg") so a price×quantity line total needs
 * the LEADING numeric portion, not a strict full-string parse — `Number("25 kg")` returns NaN
 * (JS's Number() requires the entire string to be numeric, unlike parseFloat/this regex), which
 * silently fell back to a multiplier of 1 for every quantity that wasn't a bare number. Blank/
 * missing quantity means "one of it", matching how items are normally listed. */
export function quantityAsNumber(quantity: string | null | undefined): number {
  if (quantity == null || quantity.trim() === '') return 1;
  const match = quantity.match(/^\s*[-+]?\d+(\.\d+)?/);
  return match ? Number(match[0]) : 1;
}

/** Converts a quantity number into the unit its price is quoted against — grams into the
 * kilograms the price-per-kg rate expects, millilitres into the litres the price-per-L rate
 * expects. Piece counts and quantities already in the priced unit (kg, L) pass through as-is. */
function quantityInPricedUnit(amount: number, unit: ShoppingUnit): number {
  if (unit === 'g' || unit === 'ml') return amount / 1000;
  return amount;
}

/** The single source of truth for a shopping item's line total (price × quantity, unit-aware) —
 * used by both the list detail screen's "Overall"/"remaining" totals and the list overview's
 * "Estimate", so the two can never disagree the way they did before this was unified (see git
 * history: entering a weight/volume quantity like "500 g" against a per-kg price used to just
 * multiply price × 500 as if 500 whole units were bought, wildly overstating the total). Missing
 * `unit` (legacy rows from before this column existed) defaults to 'pcs', which reproduces
 * exactly the old raw-multiply behavior those rows always had. */
export function itemLineTotal(price: number | null | undefined, quantity: string | null | undefined, unit: ShoppingUnit | null | undefined): number {
  const amount = quantityAsNumber(quantity);
  const priced = quantityInPricedUnit(amount, unit ?? 'pcs');
  return (price ?? 0) * priced;
}
