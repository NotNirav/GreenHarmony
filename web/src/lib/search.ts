/**
 * Plant search in English, Hindi and Marathi, in either script.
 * Mirrors `deva_fold`, `transliterate` and `skeleton` in data-pipeline/scripts/build.py,
 * which precomputes each plant's `search_terms` and `search_keys`.
 */

export interface Searchable {
  id: string;
  search_terms: string[];
  search_keys: string[];
}

const NUKTA = "़";
const VIRAMA = "्";
const DEVANAGARI = /[ऀ-ॿ]/;

const CONSONANTS: Record<string, string> = {
  क: "k", ख: "kh", ग: "g", घ: "gh", ङ: "n", च: "ch", छ: "chh", ज: "j", झ: "jh", ञ: "n",
  ट: "t", ठ: "th", ड: "d", ढ: "dh", ण: "n", त: "t", थ: "th", द: "d", ध: "dh", न: "n",
  प: "p", फ: "ph", ब: "b", भ: "bh", म: "m", य: "y", र: "r", ल: "l", ळ: "l", व: "v",
  श: "sh", ष: "sh", स: "s", ह: "h",
  ["क" + NUKTA]: "k", ["ख" + NUKTA]: "kh", ["ग" + NUKTA]: "g", ["ज" + NUKTA]: "z",
  ["फ" + NUKTA]: "f", ["ड" + NUKTA]: "d", ["ढ" + NUKTA]: "dh",
};
const VOWELS: Record<string, string> = {
  अ: "a", आ: "aa", इ: "i", ई: "ee", उ: "u", ऊ: "oo", ऋ: "ri", ए: "e", ऐ: "ai", ओ: "o", औ: "au", ऑ: "o", ॲ: "a",
};
const MATRAS: Record<string, string> = {
  "ा": "aa", "ि": "i", "ी": "ee", "ु": "u", "ू": "oo", "ृ": "ri", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ॉ": "o", "ॅ": "e",
};
const SIGNS: Record<string, string> = { "ं": "n", "ँ": "n", "ः": "h" };

/** Spelling-tolerant Devanagari: no nukta or joiners, chandrabindu → anusvara. */
export function devaFold(text: string): string {
  return text.normalize("NFD").replace(/[़‌‍]/g, "").replace(/ँ/g, "ं").normalize("NFC");
}

/** Rough Devanagari → Latin, for phonetic matching only. */
export function transliterate(text: string): string {
  const s = text.normalize("NFD");
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) {
    let ch = s[i];
    if (s[i + 1] === NUKTA && CONSONANTS[ch + NUKTA]) ch += s[++i];
    const next = s[i + 1] ?? "";
    if (CONSONANTS[ch]) {
      out.push(CONSONANTS[ch]);
      if (!MATRAS[next] && next !== VIRAMA) out.push("a");
    } else if (VOWELS[ch]) out.push(VOWELS[ch]);
    else if (MATRAS[ch]) out.push(MATRAS[ch]);
    else if (SIGNS[ch]) out.push(ch === "ं" && "पफबभम".includes(next) ? "m" : SIGNS[ch]);
    else if (ch !== VIRAMA && ch !== NUKTA && ch !== "‌" && ch !== "‍") out.push(ch);
  }
  return out.join("");
}

/** Consonant skeleton, so "pudina", "pudeena" and पुदीना all become "pdn". */
export function skeleton(text: string): string {
  let s = text.toLowerCase();
  for (const [a, b] of [["chh", "c"], ["ch", "c"], ["sh", "s"], ["ph", "f"], ["w", "v"], ["z", "j"], ["q", "k"], ["x", "ks"]]) {
    s = s.replaceAll(a, b);
  }
  // Merge doubled letters before dropping vowels: "patta" = "pata", but "dudhi" keeps both d's.
  return s.replace(/[^a-z]/g, "").replace(/(.)\1+/g, "$1").replace(/[aeiouh]/g, "");
}

/** Long vowels written short, as most people type them ("aamba" → "amba", "pudeena" → "pudina"). */
export function foldVowels(text: string): string {
  return text.toLowerCase().replace(/aa/g, "a").replace(/ee|ii/g, "i").replace(/oo|uu/g, "u");
}

/**
 * Search relevance (0 = no match). Direct name matches rank first, then phonetic matches,
 * so "jaswand" finds जास्वंद, "pudina" finds पुदीना and गुडहल finds गुड़हल.
 */
export function queryScore(plant: Searchable, query: string): number {
  const raw = devaFold(query.trim().toLowerCase().replace(/\s+/g, " "));
  if (!raw) return 1;
  // Typed in English letters, also try the short-vowel spelling ("mooli" → "muli") the data stores.
  const qs = DEVANAGARI.test(raw) ? [raw] : [...new Set([raw, foldVowels(raw)])];
  if (plant.search_terms.some((t) => qs.includes(t))) return 5;
  if (plant.search_terms.some((t) => qs.some((q) => t.startsWith(q)))) return 4;
  if (plant.search_terms.some((t) => qs.some((q) => t.includes(q)))) return 3;
  const latin = DEVANAGARI.test(raw) ? transliterate(raw) : raw;
  if (!/^[a-z\s]+$/.test(latin)) return 0;
  const words = latin.split(" ").map(skeleton).filter((k) => k.length >= 2);
  const joined = skeleton(latin);
  if (words.length && words.every((w) => plant.search_keys.includes(w))) return 2;
  if (joined.length >= 2 && plant.search_keys.includes(joined)) return 2;
  if (words.length && words.every((w) => plant.search_keys.some((k) => k.startsWith(w)))) return 1;
  if (joined.length >= 3 && plant.search_keys.some((k) => k.startsWith(joined))) return 1;
  return 0;
}

/** Best matches first (ties keep dataset order, which is popularity-led). */
export function searchPlants<T extends Searchable>(items: T[], query: string, limit = 6, exclude: string[] = []): T[] {
  if (query.trim().length < 2) return [];
  return items
    .filter((p) => !exclude.includes(p.id))
    .map((p, i) => ({ p, i, s: queryScore(p, query) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.p);
}
