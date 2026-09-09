import * as XLSX from 'xlsx';

export type ParsedShoppingRow = {
  name: string;
  quantity: string | null;
  price: number | null;
};

export type ImportShoppingResult = {
  rows: ParsedShoppingRow[];
  total: number;
  skipped: number;
};

function normalizeKeys(record: Record<string, unknown>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    normalized[key.trim().toLowerCase()] = String(value ?? '').trim();
  }
  return normalized;
}

/** Reads CSV text (from a file picked via expo-document-picker and read with `File#text()`)
 * into shopping-item rows. A row with no name is dropped — quantity and price are optional
 * everywhere else in this module too. */
export function parseShoppingCsv(csvText: string): ImportShoppingResult {
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

  const rows: ParsedShoppingRow[] = [];
  let skipped = 0;

  for (const record of records) {
    const entry = normalizeKeys(record);
    const name = entry.name || entry.item || entry.itemname;
    if (!name) {
      skipped += 1;
      continue;
    }
    const quantity = entry.quantity || entry.qty || null;
    const priceRaw = entry.price;
    const price = priceRaw ? Number(priceRaw) : null;
    rows.push({ name, quantity, price: price && !Number.isNaN(price) ? price : null });
  }

  return { rows, total: records.length, skipped };
}
