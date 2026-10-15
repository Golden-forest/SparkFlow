export const DIMS = ['d3', 'd4', 'd7', 'd8', 'd9', 'd10'] as const;
export type Dim = typeof DIMS[number];

export interface RatingRecord {
  dims: Partial<Record<Dim, number>>;
  d4Text?: string;
  d7Text?: string;
  note?: string;
  seconds: number;
  savedAt?: string;
  sessionDate?: string;
}

export type RatingStore = Record<string, Record<string, RatingRecord>>;

export interface RatingManifest {
  version: number;
  rateable: Array<{ id: string; bg: string }>;
  orders: Record<string, string[]>;
  browse: Array<{ id: string; bg: string }>;
  cal: Array<{ n: number; file: string; label: string; symptom: string; goal: string }>;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Reject corrupt payloads before they can replace the user's saved ratings. */
export function decodeRatingStore(value: unknown): RatingStore {
  if (!isObject(value)) throw new Error('Invalid saved ratings.');
  for (const records of Object.values(value)) {
    if (!isObject(records)) throw new Error('Invalid saved ratings.');
    for (const record of Object.values(records)) {
      if (!isObject(record) || !isObject(record.dims)
        || typeof record.seconds !== 'number' || !Number.isFinite(record.seconds) || record.seconds < 0) {
        throw new Error('Invalid saved ratings.');
      }
      for (const [dim, score] of Object.entries(record.dims)) {
        if (!DIMS.some(known => known === dim) || typeof score !== 'number'
          || !Number.isInteger(score) || score < 1 || score > 5) {
          throw new Error('Invalid saved ratings.');
        }
      }
      for (const key of ['d4Text', 'd7Text', 'note', 'savedAt', 'sessionDate']) {
        if (record[key] !== undefined && typeof record[key] !== 'string') throw new Error('Invalid saved ratings.');
      }
    }
  }
  return value as RatingStore;
}

export function decodeRatingManifest(value: unknown): RatingManifest {
  if (!isObject(value) || value.version !== 1 || !isObject(value.orders)
    || !Array.isArray(value.rateable) || !Array.isArray(value.browse) || !Array.isArray(value.cal)) {
    throw new Error('Invalid rating manifest.');
  }
  for (const item of [...value.rateable, ...value.browse]) {
    if (!isObject(item) || typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(item.id)
      || typeof item.bg !== 'string') throw new Error('Invalid rating manifest.');
  }
  for (const order of Object.values(value.orders)) {
    if (!Array.isArray(order) || !order.every(id => typeof id === 'string')) throw new Error('Invalid rating manifest.');
  }
  for (const item of value.cal) {
    if (!isObject(item) || typeof item.n !== 'number' || !Number.isInteger(item.n)
      || typeof item.file !== 'string' || !/^cal\/[a-zA-Z0-9_-]+\.html$/.test(item.file)
      || !['label', 'symptom', 'goal'].every(key => typeof item[key] === 'string')) {
      throw new Error('Invalid rating manifest.');
    }
  }
  return value as unknown as RatingManifest;
}
