import { doc, getDoc, setDoc } from 'firebase/firestore';

export const defaultGeneralCategories: string[] = [
  'دەرمان',
  'دیاری',
  'یاریەکان',
  'هەمەجۆر',
  'نێرگلە',
  'فەحم',
  'هیتەر',
  'سیم',
  'خەڵتە',
  'ناریەکان',
  'سۆندەکان',
  'تیلەکان',
  'شوشەکان',
  'مەقاشەکان',
  'سەرەکەکان',
  'تەباغی غاز',
  'قایش وبنی دار و تنفیس',
  'ئەدوات بەفر',
  'توتون',
  'پاککەرەوە و فرچە',
  'کاڵای دەرەکی',
  'سەفەری'
];

export const defaultExternalCategories: string[] = ['کاڵای دەرەکی', 'سەفەری', 'هەمەجۆر'];

export function normalizeCategoryText(str: string): string {
  if (!str) return '';
  return str
    .replace(/[​-‍﻿]/g, '')
    .replace(/ك/g, 'ک')
    .replace(/ي/g, 'ی')
    .replace(/أ/g, 'ئ')
    .replace(/إ/g, 'ئ')
    .replace(/آ/g, 'ئ')
    .replace(/ة/g, 'ە')
    .replace(/ڵ/g, 'ل')
    .replace(/ێ/g, 'ی')
    .replace(/\.{2,}/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Canonical category names and every spelling variant that resolves to them.
 * Matching is done on the normalized FULL name only (never on substrings), so
 * «دیاری» can never be confused with «یاری», and product names such as «ستیل»
 * or «کۆکتیل» never pull a product into «تیلەکان».
 */
const CATEGORY_VARIANTS: Record<string, string[]> = {
  'خەڵتە': ['خەڵتە', 'خەڵتەکان', 'خەلتەکان', 'خەلتە', 'خلتەکان', 'خلتە'],
  'مەقاشەکان': ['مەقاشەکان', 'مقاشەكان', 'مقاشەکان', 'مەقاش', 'مقاش'],
  'سۆندەکان': ['سۆندەکان', 'سۆندەكان', 'سۆندە', 'سونده', 'سونده کان', 'سۆندە کان'],
  'تیلەکان': ['تیلەکان', 'تێلەكان', 'تێلەکان', 'تیلەكان', 'تیلە', 'تێلە', 'تیله'],
  'شوشەکان': ['شوشەکان', 'شوشەكان', 'شوشە', 'شوشه', 'شیشە', 'شیشەکان'],
  'ناریەکان': ['ناریەکان', 'ناریەكان', 'ناریە', 'ئاریەکان', 'ئاریەكان', 'ئاریە'],
  'سەرەکەکان': ['سەرەکەکان', 'سەركەكان', 'سەرکەکان', 'سەرەکان', 'سەركەکان', 'سەرەكان', 'سەرە', 'سەری'],
  'تەباغی غاز': ['تەباغی غاز', 'تەباغ', 'غاز', 'تەباخ', 'تەباغی'],
  'قایش وبنی دار و تنفیس': ['قایش وبنی دار و تنفیس', 'قایش وبنی...', 'قایش وبنی', 'قایش و بنی', 'قایش و بنی دار و تنفیس', 'قایش'],
  'ئەدوات بەفر': ['ئەدوات بەفر', 'أدوات بەفر', 'ادوات بەفر', 'ئەدواتی بەفر', 'بەفر', 'ئایسباک'],
  'یاریەکان': ['یاریەکان', 'یاریەكان', 'یاری'],
  'دیاری': ['دیاری', 'دیارییەکان'],
  'فەحم': ['فەحم', 'فەحمەکان'],
  'هیتەر': ['هیتەر', 'هیته ر', 'هیتەرەکان'],
  'سیم': ['سیم', 'سیمەکان'],
  'نێرگلە': ['نێرگلە', 'نێرگەلە', 'نێرگلەکان', 'نیرگله'],
  'دەرمان': ['دەرمان', 'دەرمانەکان'],
  'توتون': ['توتون', 'توتن', 'تتوون'],
  'پاککەرەوە و فرچە': ['پاککەرەوە و فرچە', 'پاککەرەوە', 'فرچە'],
  'ماجیکبارەکان': ['ماجیکبارەکان', 'ماجیک بارەکان', 'ماجیکبار', 'ماجیک بار', 'ماجیکبارەكان'],
};

const SHISHA_CANONICALS = new Set(['ماجیکبارەکان']);

const variantToCanonical: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(CATEGORY_VARIANTS)) {
    m.set(normalizeCategoryText(canonical), canonical);
    for (const v of variants) m.set(normalizeCategoryText(v), canonical);
  }
  return m;
})();

/**
 * Maps a category spelling variant to its single canonical form.
 * Unknown names are returned unchanged (trimmed).
 */
export function getCanonicalCategoryName(rawCategory: string | undefined | null): string {
  if (!rawCategory) return '';
  const trimmed = rawCategory.trim();
  const norm = normalizeCategoryText(trimmed);

  // Magic Bar variations in Shisha section
  if (norm.includes('ماجیک') || norm.includes('magic bar') || norm.includes('magicbar')) {
    return 'ماجیکبارەکان';
  }

  return variantToCanonical.get(norm) || trimmed;
}

/**
 * Deduplicates category lists, normalizing and resolving to canonical names.
 */
export function deduplicateCategories(cats: (string | undefined | null)[]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of cats) {
    if (!raw) continue;
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const canonical = getCanonicalCategoryName(trimmed);
    const norm = normalizeCategoryText(canonical);
    if (!seen.has(norm)) {
      seen.add(norm);
      result.push(canonical);
    }
  }

  return result;
}

/**
 * Resolves a stored category name to its canonical category & section.
 * The product name is intentionally ignored: a product stays in the category the
 * owner chose. (The second parameter is kept for call-site compatibility.)
 */
export function detectCategoryFromNameOrCat(rawCat: string | undefined | null, _rawName?: string | undefined | null): { category: string; section: string } | null {
  if (!rawCat || !rawCat.trim()) return null;
  const canonical = getCanonicalCategoryName(rawCat);
  if (!variantToCanonical.has(normalizeCategoryText(canonical))) return null;
  return { category: canonical, section: SHISHA_CANONICALS.has(canonical) ? 'shisha' : 'general' };
}

export function isGeneralCategory(catName: string): boolean {
  if (!catName) return false;
  const raw = catName.trim();
  if (defaultGeneralCategories.includes(raw)) return true;
  const detected = detectCategoryFromNameOrCat(raw);
  return !!detected && detected.section === 'general';
}

export function isShishaProduct(p: any): boolean {
  if (p.section === 'external') return false;
  const cat = (p.category || '').trim();
  if (isGeneralCategory(cat)) return false;
  return p.section === 'shisha';
}

/**
 * Category equality that tolerates spelling variants («مقاش» = «مەقاشەکان»,
 * Arabic/Kurdish letter differences) but never partial-word matches.
 */
export function isCategoryMatch(prodCat: string | undefined | null, targetCat: string | undefined | null): boolean {
  if (!prodCat && !targetCat) return true;
  if (!prodCat || !targetCat) return false;
  if (targetCat === 'all') return true;

  const rawP = prodCat.trim();
  const rawT = targetCat.trim();
  if (rawP === rawT) return true;

  return normalizeCategoryText(getCanonicalCategoryName(rawP)) === normalizeCategoryText(getCanonicalCategoryName(rawT));
}

/**
 * All stored spellings of a category, for Firestore `in` queries.
 */
export function getCategoryQueryVariants(category: string): string[] {
  if (!category || category === 'all') return [];
  const raw = category.trim();
  const canonical = getCanonicalCategoryName(raw);
  const variants = CATEGORY_VARIANTS[canonical];
  if (!variants) return [raw];
  // Firestore `in` accepts at most 30 values
  return Array.from(new Set([raw, canonical, ...variants])).slice(0, 30);
}

// Seeded into settings/deleted_categories only when that document does not exist yet.
const INITIAL_DELETED_CATEGORIES = [
  'ڤەیپ و پۆد', 'ڤەیپ', 'پۆد', 'فەیپ',
  'جگەرە', 'جگەره',
  'خواردنەوە', 'شەربەت',
  'چەرخ',
];

export function isCategoryDeleted(category: string, deleted: string[]): boolean {
  const target = normalizeCategoryText(getCanonicalCategoryName(category));
  return deleted.some(b => category === b || normalizeCategoryText(getCanonicalCategoryName(b)) === target);
}

/**
 * Removes a category from settings/deleted_categories, so re-creating a
 * previously deleted category works and is not purged again later.
 */
export async function undeleteCategory(db: any, categoryName: string): Promise<void> {
  const ref = doc(db, 'settings', 'deleted_categories');
  const snap = await getDoc(ref);
  if (!snap.exists() || !Array.isArray(snap.data().list)) return;
  const list: string[] = snap.data().list;
  const filtered = list.filter(c => !isCategoryDeleted(categoryName, [c]));
  if (filtered.length !== list.length) {
    await setDoc(ref, { list: filtered }, { merge: true });
  }
}

/**
 * Cleans the category LISTS only (spelling variants, duplicates, deleted names).
 * Products are never modified here: moving products between categories is done
 * only by the owner, or through the reviewed data-repair tool in Settings.
 */
export async function syncAndCleanCategories(db: any): Promise<{ updatedCount: number; details: string[] }> {
  let updatedCount = 0;
  const details: string[] = [];

  try {
    const delRef = doc(db, 'settings', 'deleted_categories');
    const delSnap = await getDoc(delRef);
    let deleted: string[];
    if (delSnap.exists() && Array.isArray(delSnap.data().list)) {
      deleted = delSnap.data().list;
    } else {
      deleted = INITIAL_DELETED_CATEGORIES;
      await setDoc(delRef, { list: deleted }, { merge: true });
    }

    // 1. Shisha list: drop general categories, deleted names and duplicates
    const shishaRef = doc(db, 'settings', 'shisha_categories');
    const shishaSnap = await getDoc(shishaRef);
    if (shishaSnap.exists() && Array.isArray(shishaSnap.data().list)) {
      const currentList: string[] = shishaSnap.data().list;
      const cleanedList = deduplicateCategories(currentList.filter(c => !isGeneralCategory(c) && !isCategoryDeleted(c, deleted)));
      if (cleanedList.length !== currentList.length || cleanedList.some((c, idx) => c !== currentList[idx])) {
        await setDoc(shishaRef, { list: cleanedList }, { merge: true });
        updatedCount++;
        details.push('لیستی کەتەگۆرییەکانی شیشە ڕێکخرایەوە');
      }
    }

    // 2. General list: canonical spellings, no duplicates, no deleted names
    const genRef = doc(db, 'settings', 'general_categories');
    const genSnap = await getDoc(genRef);
    if (genSnap.exists() && Array.isArray(genSnap.data().list)) {
      const currentList: string[] = genSnap.data().list;
      const cleanedList = deduplicateCategories(currentList.filter(c => !isCategoryDeleted(c, deleted)));
      if (cleanedList.length !== currentList.length || cleanedList.some((c, idx) => c !== currentList[idx])) {
        await setDoc(genRef, { list: cleanedList }, { merge: true });
        await setDoc(doc(db, 'settings', 'categories'), { list: cleanedList }, { merge: true });
        updatedCount++;
        details.push('لیستی کەتەگۆرییە گشتییەکان ڕێکخرایەوە');
      }
    } else {
      const initial = deduplicateCategories(defaultGeneralCategories.filter(c => !isCategoryDeleted(c, deleted)));
      await setDoc(genRef, { list: initial }, { merge: true });
      await setDoc(doc(db, 'settings', 'categories'), { list: initial }, { merge: true });
    }

    // 3. Consolidate custom icons onto canonical names
    try {
      const iconRef = doc(db, 'settings', 'category_icons');
      const iconSnap = await getDoc(iconRef);
      if (iconSnap.exists()) {
        const rawIcons = iconSnap.data().icons || iconSnap.data() || {};
        let iconsChanged = false;
        const newIcons: Record<string, string> = {};

        for (const [catKey, url] of Object.entries(rawIcons)) {
          if (typeof url !== 'string' || !url.trim()) continue;
          const canonicalKey = getCanonicalCategoryName(catKey);
          if (canonicalKey !== catKey) iconsChanged = true;
          if (!newIcons[canonicalKey]) newIcons[canonicalKey] = url;
        }

        if (iconsChanged) {
          await setDoc(iconRef, { icons: newIcons });
        }
      }
    } catch (e) {
      console.warn("Could not consolidate category icons:", e);
    }
  } catch (err) {
    console.error("Error in syncAndCleanCategories:", err);
  }

  return { updatedCount, details };
}

/**
 * Fetches all custom category icon image URLs from Firestore settings/category_icons
 */
export async function getCategoryCustomIcons(db: any): Promise<Record<string, string>> {
  try {
    const snap = await getDoc(doc(db, 'settings', 'category_icons'));
    if (snap.exists()) {
      const data = snap.data();
      return data.icons || data || {};
    }
  } catch (e) {
    console.warn("Error getting category icons:", e);
  }
  return {};
}

/**
 * Saves or deletes a custom category icon image URL in Firestore settings/category_icons
 */
export async function saveCategoryCustomIcon(db: any, categoryName: string, iconUrl: string): Promise<void> {
  try {
    const ref = doc(db, 'settings', 'category_icons');
    const snap = await getDoc(ref);
    const current = snap.exists() ? (snap.data().icons || snap.data() || {}) : {};
    const trimmedCat = categoryName.trim();
    const trimmedUrl = iconUrl.trim();

    if (trimmedUrl) {
      current[trimmedCat] = trimmedUrl;
    } else {
      delete current[trimmedCat];
    }

    // Full overwrite (not merge) so that a removed icon is really deleted
    await setDoc(ref, { icons: current });
  } catch (e) {
    console.error("Error saving category custom icon:", e);
    throw e;
  }
}
