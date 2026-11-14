// Search for the site's catalog and programs and the admin's lists (owner requests 2026-10-26 and 2026-11-14). The
// lists are small, so the apps filter what they already have instead of asking the API.
//
// Clients rarely know a product's exact name, so a query finds more than its letters (owner request 2026-11-14):
// - other endings of Russian words: «сыворотки» finds «сыворотка»;
// - the same word in the other alphabet: «сика» finds «Cica», «селл» finds «CELL», «krem» finds «крем»;
// - everyday words for skin problems and products: «прыщи» finds «акне», «серум» finds «сыворотка»;
// - typos («сывортка», «пинка»), for a word that nothing in the list contains as typed;
// - a query typed in the other keyboard layout («cs djhjnrf»), when it finds nothing as typed;
// - filler words («для», «от») are skipped, and general ones («кожа», «средство») never hide a result.
// Results are ranked: exact words first, then other spellings, everyday words and typos. A query of several words
// that nothing matches completely offers the closest items as similar ones.

/** Lower case, «ё» as «е», punctuation as spaces: "Dr.SGN" and "dr sgn" read the same. */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Identity of a brand or category name: two names with the same key are the same thing ("Dr. SGN", "Dr.SGN" and
 * "dr sgn" all give "drsgn"), so the admin cannot create such duplicates (owner request 2026-10-27).
 */
export function nameKey(name: string): string {
  return normalizeSearch(name).replace(/ /g, '');
}

/** A searchable text of an item; plain strings weigh 1, less telling texts (volume, category) weigh less. */
export type SearchField =
  string | null | undefined | { readonly text: string | null | undefined; readonly weight: number };

export interface SearchResult<T> {
  /** Items that match every word of the query, best first. */
  found: T[];
  /** When nothing is found: the items closest to a query of several words, best first. */
  similar: T[];
}

/**
 * Items matching the query, best first, and similar items when none match. An empty query keeps every item in its
 * order.
 */
export function rankSearch<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => readonly SearchField[],
  similarLimit = 8,
): SearchResult<T> {
  const variants = queryVariants(query);
  if (!variants) return { found: [...items], similar: [] };
  const fields = items.map((item) => prepareFields(fieldsOf(item)));
  let similar: T[] = [];
  for (const [index, words] of variants.entries()) {
    // Typos are read only in the query as typed: the other layout of a real word is gibberish.
    const scores = scoreItems(words, fields, index === 0);
    const found = best(
      items,
      scores.map((score) => (score.matched === score.required ? score.score : 0)),
    );
    if (found.length) return { found, similar: [] };
    if (index === 0) similar = closest(items, scores, similarLimit);
  }
  return { found: [], similar };
}

/** Items matching the query, in their own order (the admin's sorted lists). */
export function filterSearch<T>(
  items: readonly T[],
  query: string,
  fieldsOf: (item: T) => readonly SearchField[],
): T[] {
  const found = new Set(rankSearch(items, query, fieldsOf, 0).found);
  return items.filter((item) => found.has(item));
}

// ---- Query words ----

interface Probe {
  /** What is looked for: a word, its stem, its sound key or an everyday word for the same thing. */
  text: string;
  /** Compared with the sound keys of the item's words instead of the words. */
  sound: boolean;
  weight: number;
  /** The shortest text that may also match inside a word ("акне" in «постакне»). */
  inside: number;
  /** Typos may be read in it. */
  typos: boolean;
}

interface Word {
  probes: Probe[];
  /** A general word («кожа», «средство»): it adds to the rank but never hides an item. */
  soft: boolean;
}

// Russian endings vary with the case and number ("сыворотка", "сыворотки", "кремы"), so a word drops up to two
// trailing vowels before it is looked up. Latin words stay whole.
const ENDING = /[аеиоуыэюяйь]{1,2}$/;

function stem(word: string): string {
  if (word.length < 4 || !/[а-я]/.test(word)) return word;
  const cut = word.replace(ENDING, '');
  return cut.length >= 3 ? cut : word;
}

/** Search form of a text: normalized, with the Kyrgyz «ө», «ү», «ң» read as «о», «у», «н». */
function searchText(value: string): string {
  return normalizeSearch(value.replace(/[өӨ]/g, 'о').replace(/[үҮ]/g, 'у').replace(/[ңҢ]/g, 'н'));
}

const CYRILLIC_SOUNDS: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

// Sound keys already worked out: the same words come back with every item and every search.
const soundKeys = new Map<string, string>();

/**
 * How a word sounds, in rough Latin letters, so the two alphabets meet: «сика» and "cica" both give "sika", «селл»
 * and "cell" both "sel", «крем» and "krem" both "krem".
 */
function soundKey(word: string): string {
  const known = soundKeys.get(word);
  if (known !== undefined) return known;
  if (soundKeys.size > 20_000) soundKeys.clear();
  const key = [...word]
    .map((char) => CYRILLIC_SOUNDS[char] ?? char)
    .join('')
    .replace(/j/g, 'dzh')
    .replace(/sch/g, 'sh')
    .replace(/ch/g, 'ч')
    .replace(/sh/g, 'ш')
    .replace(/zh/g, 'ж')
    .replace(/kh/g, 'h')
    .replace(/ph/g, 'f')
    .replace(/ts/g, 's')
    .replace(/ck/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/w/g, 'v')
    .replace(/x/g, 'ks')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1');
  soundKeys.set(word, key);
  return key;
}

// Everyday, Latin and ingredient words for the same skin problem, product or ingredient: a query word starting with
// one of them also looks for the others. Stems, so every ending fits; a stem of three letters or less must be the whole
// word («поры», not «порошок»).
const SYNONYMS: readonly (readonly string[])[] = [
  // Problems and effects.
  ['акне', 'прыщ', 'высып', 'воспал', 'угр', 'комедон', 'acne', 'trouble'],
  [
    'морщин',
    'антивозраст',
    'омолаж',
    'омолож',
    'лифтинг',
    'возрастн',
    'эйдж',
    'упруг',
    'wrinkle',
    'lifting',
    'ageless',
  ],
  ['пигмент', 'пятн', 'пятен', 'осветл', 'веснушк', 'отбел', 'мелазм', 'white', 'bright'],
  ['сух', 'сухост', 'обезвож', 'увлажн', 'шелуш', 'стянут', 'moist', 'hydra', 'aqua'],
  ['жирн', 'себум', 'себорег', 'сальн', 'матир'],
  ['чувствит', 'покрасн', 'купероз', 'раздраж', 'успока', 'реактивн', 'розаце', 'sooth', 'calm'],
  ['тускл', 'сиян', 'сияющ', 'glow'],
  ['барьер', 'восстанов', 'регенер', 'barrier', 'repair'],
  ['пор', 'pore'],
  // Products and body parts.
  ['spf', 'солнц', 'санскрин', 'sunscreen', 'sun'],
  ['умыв', 'очищ', 'демакияж', 'clean', 'wash'],
  ['сыворотк', 'серум', 'serum'],
  ['ампул', 'ampoule', 'ampule'],
  ['тонер', 'тоник', 'toner', 'tonic'],
  ['крем', 'cream'],
  ['маск', 'mask'],
  ['пилинг', 'пиллинг', 'скатк', 'эксфол', 'отшелуш', 'peel'],
  ['патч', 'patch'],
  ['пэд', 'пад', 'диск', 'pad'],
  ['масл', 'oil'],
  ['молочк', 'milk'],
  ['массаж', 'massage'],
  ['бб', 'bb'],
  ['глаз', 'век', 'eye'],
  ['губ', 'lip'],
  ['шея', 'шеи', 'шею', 'шеей', 'neck'],
  // Ingredients.
  ['ниацин', 'niacin'],
  ['гиалурон', 'hyaluron'],
  ['ретинол', 'retinol'],
  ['витамин', 'vitamin', 'vita'],
  ['пептид', 'peptide', 'biopepta'],
  ['коллаген', 'collagen'],
  ['центелл', 'centella', 'cica', 'сика', 'цика'],
  ['азулен', 'azulen'],
  ['керамид', 'ceramide'],
  ['экзосом', 'exosome', 'exo'],
  ['кислот', 'acid'],
  ['лосос', 'salmon'],
  ['прополис', 'propolis'],
  ['алоэ', 'aloe'],
  ['ромашк', 'chamomile'],
  // Brand words.
  ['доктор', 'dr'],
  ['бай', 'by'],
];

// Words that carry no meaning in a query; skipped unless the query has nothing else.
const FILLER = new Set(
  (
    'а без бы в во для до же за и из или к ко ли мне мой моя мои на над не нужен нужна нужно о об от очень по под ' +
    'при с со у хочу что чтобы это какой какая какое какие есть лучший лучшая самый самая and for of the with'
  ).split(' '),
);

// General words (stems): they never hide an item, an item that has them ranks higher.
const GENERAL = new Set([
  'лиц',
  'лицом',
  'кож',
  'кожей',
  'средств',
  'средством',
  'уход',
  'уходом',
  'косметик',
  'продукт',
]);

const MAX_WORDS = 8;

function toWord(word: string): Word {
  const direct = stem(word);
  const probes: Probe[] = [{ text: direct, sound: false, weight: 1, inside: 1, typos: true }];
  const sound = soundKey(direct);
  if (sound.length >= 2) probes.push({ text: sound, sound: true, weight: 0.9, inside: 4, typos: true });
  for (const group of SYNONYMS) {
    if (!group.some((entry) => (entry.length > 3 ? direct.startsWith(entry) : direct === entry))) continue;
    for (const entry of group) {
      if (entry !== direct) probes.push({ text: entry, sound: false, weight: 0.7, inside: 4, typos: false });
    }
  }
  // A lone letter ("vitamin c") is too common to require.
  return { probes, soft: GENERAL.has(direct) || word.length < 2 };
}

function toWords(text: string): Word[] | null {
  const all = [...new Set(searchText(text).split(' ').filter(Boolean))].slice(0, MAX_WORDS);
  if (!all.length) return null;
  const meaningful = all.filter((word) => !FILLER.has(word));
  return (meaningful.length ? meaningful : all).map(toWord);
}

// The same keys in the Latin and the Russian layout, for a query typed with the wrong one.
const LATIN_KEYS = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RUSSIAN_KEYS = 'йцукенгшщзхъфывапролджэячсмитьбюё';
const SHIFTED_LATIN_KEYS = '{}:"<>~';
const SHIFTED_RUSSIAN_KEYS = 'хъжэбюё';
const OTHER_LAYOUT = new Map<string, string>([
  ...[...SHIFTED_LATIN_KEYS].map((key, i) => [key, SHIFTED_RUSSIAN_KEYS.charAt(i)] as const),
  ...[...LATIN_KEYS].flatMap((key, i) => {
    const russian = RUSSIAN_KEYS.charAt(i);
    return [[key, russian] as const, [russian, key] as const];
  }),
]);

/** The query as typed, then the same keys in the other layout when that reads differently. */
function queryVariants(query: string): Word[][] | null {
  const typed = toWords(query);
  if (!typed) return null;
  const switched = [...query.toLowerCase()].map((char) => OTHER_LAYOUT.get(char) ?? char).join('');
  const other = searchText(switched) === searchText(query) ? null : toWords(switched);
  return other ? [typed, other] : [typed];
}

// ---- Item texts ----

interface Field {
  weight: number;
  words: string[];
  sounds: string[];
  text: string;
  joined: string;
  soundText: string;
  soundJoined: string;
}

function prepareFields(fields: readonly SearchField[]): Field[] {
  return fields.flatMap((field) => {
    const { text, weight } = typeof field === 'object' && field !== null ? field : { text: field, weight: 1 };
    const normalized = text ? searchText(text) : '';
    if (!normalized) return [];
    const words = normalized.split(' ');
    const sounds = words.map(soundKey);
    return [
      {
        weight,
        words,
        sounds,
        text: normalized,
        joined: words.join(''),
        soundText: sounds.join(' '),
        soundJoined: sounds.join(''),
      },
    ];
  });
}

// ---- Matching ----

/** How well a probe is found as typed: 1 at the start of a word, less inside one ("drsgn" in «Dr. SGN»), 0 not. */
function exactQuality(probe: Probe, field: Field): number {
  const words = probe.sound ? field.sounds : field.words;
  if (words.some((word) => word.startsWith(probe.text))) return 1;
  if (probe.text.length < probe.inside) return 0;
  const [text, joined] = probe.sound ? [field.soundText, field.soundJoined] : [field.text, field.joined];
  return text.includes(probe.text) || joined.includes(probe.text) ? 0.85 : 0;
}

/** Typos a probe may hold: none in short words, one up to seven letters, two in longer ones. */
function typoBudget(length: number): number {
  return length < 4 ? 0 : length < 8 ? 1 : 2;
}

/** How well a probe is found with typos: one typo counts less than none, two less again. */
function typoQuality(probe: Probe, field: Field): number {
  const budget = typoBudget(probe.text.length);
  if (!probe.typos || !budget) return 0;
  let fewest = budget + 1;
  for (const word of probe.sound ? field.sounds : field.words) {
    if (word.length < probe.text.length - budget) continue;
    fewest = Math.min(fewest, prefixDistance(probe.text, word, fewest - 1));
    if (fewest === 1) break;
  }
  if (fewest > budget) return 0;
  return fewest === 1 ? 0.7 : 0.55;
}

/**
 * The fewest edits (a letter added, dropped or changed, or two neighbours swapped) that turn `probe` into the whole
 * `word` or into a start of it at least as long as the probe ("sika" is not read in "sianie"); `limit + 1` once it is
 * sure to be more than `limit`.
 */
function prefixDistance(probe: string, word: string, limit: number): number {
  const width = Math.min(word.length, probe.length + limit);
  let before: number[] = [];
  let previous = Array.from({ length: width + 1 }, (_, j) => j);
  for (let i = 1; i <= probe.length; i++) {
    const row = [i];
    let rowMin = i;
    for (let j = 1; j <= width; j++) {
      const change = probe.charAt(i - 1) === word.charAt(j - 1) ? 0 : 1;
      let value = Math.min(
        (previous[j] ?? Infinity) + 1,
        (row[j - 1] ?? Infinity) + 1,
        (previous[j - 1] ?? Infinity) + change,
      );
      if (
        i > 1 &&
        j > 1 &&
        probe.charAt(i - 1) === word.charAt(j - 2) &&
        probe.charAt(i - 2) === word.charAt(j - 1)
      ) {
        value = Math.min(value, (before[j - 2] ?? Infinity) + 1);
      }
      row.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    before = previous;
    previous = row;
  }
  let fewest = limit + 1;
  for (let j = Math.min(probe.length, word.length); j <= width; j++) {
    fewest = Math.min(fewest, previous[j] ?? Infinity);
  }
  return fewest;
}

function wordQuality(
  word: Word,
  fields: readonly Field[],
  quality: (probe: Probe, field: Field) => number,
): number {
  let top = 0;
  for (const field of fields) {
    for (const probe of word.probes) {
      top = Math.max(top, quality(probe, field) * probe.weight * field.weight);
    }
  }
  return top;
}

interface ItemScore {
  /** Required words the item has. */
  matched: number;
  required: number;
  score: number;
}

function scoreItems(words: readonly Word[], items: readonly Field[][], typos: boolean): ItemScore[] {
  const qualities = words.map((word) => {
    const exact = items.map((fields) => wordQuality(word, fields, exactQuality));
    // Typos are read only for a word that nothing has as typed, so a correct word never brings in look-alikes
    // («маска» does not find «массаж»).
    return typos && exact.every((quality) => quality === 0)
      ? items.map((fields) => wordQuality(word, fields, typoQuality))
      : exact;
  });
  const anyRequired = words.some((word) => !word.soft);
  const required = words.filter((word) => !anyRequired || !word.soft).length;
  return items.map((_, i) => {
    let matched = 0;
    let score = 0;
    words.forEach((word, w) => {
      const quality = qualities[w]?.[i] ?? 0;
      if (anyRequired && word.soft) {
        score += quality / 2;
      } else {
        if (quality > 0) matched++;
        score += quality;
      }
    });
    return { matched, required, score };
  });
}

/** Items with a score above zero, best first; equal scores keep the list's order. */
function best<T>(items: readonly T[], scores: readonly number[]): T[] {
  return items
    .map((item, i) => ({ item, i, score: scores[i] ?? 0 }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i)
    .map((entry) => entry.item);
}

/** For a query of several words: the items with the most of its words, when they have at least half of them. */
function closest<T>(items: readonly T[], scores: readonly ItemScore[], limit: number): T[] {
  const required = scores[0]?.required ?? 0;
  if (required < 2 || limit < 1) return [];
  const most = Math.max(...scores.map((score) => score.matched));
  if (most < Math.ceil(required / 2)) return [];
  return best(
    items,
    scores.map((score) => (score.matched === most ? score.score : 0)),
  ).slice(0, limit);
}
