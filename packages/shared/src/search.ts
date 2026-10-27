// Product search for the site catalog and the admin list (owner request 2026-10-26). The catalog is small, so the
// apps filter the list they already have instead of asking the API.

/** Lower case, «ё» as «е», punctuation as spaces: "Dr.SGN" and "dr sgn" read the same. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

// Russian endings vary with the case and number ("сыворотка", "сыворотки", "кремы"), so a query word drops up to
// two trailing vowels before it is looked up. Latin words stay whole.
const ENDING = /[аеиоуыэюяйь]{1,2}$/;

function stem(word: string): string {
  if (word.length < 4) return word;
  const cut = word.replace(ENDING, '');
  return cut.length >= 3 ? cut : word;
}

/**
 * Whether every word of the query occurs in the fields (in any order, also inside longer words). An empty query
 * matches everything.
 */
export function matchesSearch(query: string, fields: readonly (string | null | undefined)[]): boolean {
  const words = normalizeSearch(query).split(' ').filter(Boolean);
  if (!words.length) return true;
  const text = normalizeSearch(fields.filter(Boolean).join(' '));
  const joined = text.replace(/ /g, '');
  return words.every((word) => {
    const part = stem(word);
    return text.includes(part) || joined.includes(part);
  });
}

/**
 * Identity of a brand or category name: two names with the same key are the same thing ("Dr. SGN", "Dr.SGN" and
 * "dr sgn" all give "drsgn"), so the admin cannot create such duplicates (owner request 2026-10-27).
 */
export function nameKey(name: string): string {
  return normalizeSearch(name).replace(/ /g, '');
}
