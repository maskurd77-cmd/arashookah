import { doc, getDoc, setDoc, collection, getDocs, updateDoc } from 'firebase/firestore';

export const defaultGeneralCategories: string[] = [
  'دەرمان',
  'خواردنەوە',
  'دیاری',
  'یاریەکان',
  'ڤەیپ و پۆد',
  'جگەرە',
  'چەرخ',
  'هەمەجۆر',
  'نێرگلە',
  'فەحم',
  'هیتەر',
  'سیم',
  'خەڵتەکان',
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

export function normalizeCategoryText(str: string): string {
  if (!str) return '';
  return str
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
 * Intelligent category & section detection based on raw category or product name keywords.
 * Maps any dialect, spelling variation, or unassigned product to its canonical category & section.
 */
export function detectCategoryFromNameOrCat(rawCat: string | undefined | null, rawName: string | undefined | null): { category: string; section: string } | null {
  const normCat = normalizeCategoryText(rawCat || '');
  const normName = normalizeCategoryText(rawName || '');

  // 1. خەڵتەکان (Tobacco mixtures / blends / weighed items)
  if (normCat.includes('خلت') || normCat.includes('خەلت') || normName.includes('خلت') || normName.includes('خەلت')) {
    return { category: 'خەڵتەکان', section: 'general' };
  }

  // 2. مەقاشەکان (Tongs)
  if (normCat.includes('مقاش') || normCat.includes('مەقاش') || normName.includes('مقاش') || normName.includes('مەقاش')) {
    return { category: 'مەقاشەکان', section: 'general' };
  }

  // 3. سۆندەکان (Hoses)
  if (normCat.includes('سۆند') || normCat.includes('سوند') || normName.includes('سۆند') || normName.includes('سوند')) {
    return { category: 'سۆندەکان', section: 'general' };
  }

  // 4. شوشەکان (Glass bases / vases)
  if (normCat.includes('شوش') || (normCat.includes('شیشە') && !normCat.includes('نێرگلە')) || normName.includes('شوشە') || normName.includes('شوشه') || (normName.includes('شیشەی') && !normName.includes('نێرگلە'))) {
    return { category: 'شوشەکان', section: 'general' };
  }

  // 5. ناریەکان (Wind covers / charcoal holders)
  if (normCat.includes('ناریە') || normCat.includes('ئاریە') || normName.includes('ناریە') || normName.includes('ئاریە')) {
    return { category: 'ناریەکان', section: 'general' };
  }

  // 6. سەرەکەکان (Bowls / heads)
  if (normCat.includes('سەرەک') || normCat.includes('سەرك') || normCat.includes('سەرە') || normCat.includes('سەری') || normName.includes('سەرەک') || normName.includes('سەرك') || normName.includes('سەری نێرگلە') || normName.includes('سەری فەخار')) {
    return { category: 'سەرەکەکان', section: 'general' };
  }

  // 7. تیلەکان (Stems / pipes)
  if (normCat.includes('تیل') || normCat.includes('تێل') || normName.includes('تیل') || normName.includes('تێل')) {
    return { category: 'تیلەکان', section: 'general' };
  }

  // 8. قایش وبنی دار و تنفیس (Gaskets, wooden base rings, purge valves)
  if (normCat.includes('قایش') || normCat.includes('بنی دار') || normCat.includes('تنفیس') || normName.includes('قایش') || normName.includes('بنی دار') || normName.includes('تنفیس')) {
    return { category: 'قایش وبنی دار و تنفیس', section: 'general' };
  }

  // 9. ئەدوات بەفر (Ice attachments / cooling components)
  if (normCat.includes('بەفر') || normCat.includes('ئایسباک') || normCat.includes('ئیس باک') || normName.includes('بەفر') || normName.includes('ئایسباک') || normName.includes('ئیس باک')) {
    return { category: 'ئەدوات بەفر', section: 'general' };
  }

  // 10. تەباغی غاز (Gas burners / stoves)
  if (normCat.includes('تەباغ') || normCat.includes('تەباخ') || normCat.includes('غاز') || normName.includes('تەباغ') || normName.includes('تەباخ')) {
    return { category: 'تەباغی غاز', section: 'general' };
  }

  // 11. پاککەرەوە و فرچە (Cleaning brushes / brushes)
  if (normCat.includes('پاککەرەوە') || normCat.includes('فرچە') || normCat.includes('پاکەرەوە') || normName.includes('پاککەرەوە') || normName.includes('فرچە') || normName.includes('پاکەرەوە')) {
    return { category: 'پاککەرەوە و فرچە', section: 'general' };
  }

  // 12. ڤەیپ و پۆد (Vapes & pods)
  if (normCat.includes('ڤەیپ') || normCat.includes('پۆد') || normCat.includes('فەیپ') || normName.includes('ڤەیپ') || normName.includes('پۆد') || normName.includes('فەیپ')) {
    return { category: 'ڤەیپ و پۆد', section: 'general' };
  }

  // 13. فەحم (Charcoal)
  if (normCat.includes('فەحم') || normCat.includes('خەڵووز') || normCat.includes('خەلووز') || normName.includes('فەحم') || normName.includes('خەڵووز') || normName.includes('خەلووز')) {
    return { category: 'فەحم', section: 'general' };
  }

  // 14. هیتەر (Heater)
  if (normCat.includes('هیتەر') || normCat.includes('هیته ر') || normName.includes('هیتەر') || normName.includes('هیته ر')) {
    return { category: 'هیتەر', section: 'general' };
  }

  // 15. سیم (Mesh wire / foil puncher)
  if (normCat === 'سیم' || normCat === 'سیمەکان' || normName.includes('سیمی فەحم') || normName.includes('سیمی نێرگلە')) {
    return { category: 'سیم', section: 'general' };
  }

  // 16. چەرخ (Lighters)
  if (normCat.includes('چەرخ') || normName.includes('چەرخ')) {
    return { category: 'چەرخ', section: 'general' };
  }

  // 17. جگەرە (Cigarettes)
  if (normCat.includes('جگەرە') || normCat.includes('جگەره') || normName.includes('جگەرە')) {
    return { category: 'جگەرە', section: 'general' };
  }

  // 18. یاریەکان (Games / cards)
  if (normCat.includes('یاری') || normCat.includes('دۆمینە') || normCat.includes('تاوڵە') || normCat.includes('کۆنکان') || normName.includes('دۆمینە') || normName.includes('تاوڵە') || normName.includes('کۆنکان')) {
    return { category: 'یاریەکان', section: 'general' };
  }

  // 19. خواردنەوە (Drinks / water)
  if (normCat.includes('خواردنەوە') || normCat.includes('شەربەت') || normCat.includes('کۆلا') || normCat.includes('پێپسی') || normName.includes('کۆلا') || normName.includes('پێپسی') || normName.includes('شەربەت')) {
    return { category: 'خواردنەوە', section: 'general' };
  }

  // 20. دیاری (Gifts)
  if (normCat.includes('دیاری') || normName.includes('دیاری')) {
    return { category: 'دیاری', section: 'general' };
  }

  // 21. نێرگلە (Hookahs)
  if (normCat.includes('نێرگلە') || normCat.includes('نێرگەلە') || normCat.includes('نیرگله') || normName.includes('نێرگلە') || normName.includes('نێرگەلە') || normName.includes('نیرگله')) {
    return { category: 'نێرگلە', section: 'general' };
  }

  // 22. توتون (Tobacco)
  if (normCat.includes('توتون') || normCat.includes('توتن') || normCat.includes('تتوون') || normName.includes('توتون') || normName.includes('توتن')) {
    return { category: 'توتون', section: 'general' };
  }

  // 23. دەرمان (Flavors / molasses)
  if (normCat.includes('دەرمان') || normName.includes('دەرمان')) {
    return { category: 'دەرمان', section: 'general' };
  }

  // 24. ماجیکبارەکان (Magic Bars - Shisha section!)
  if (normCat.includes('ماجیک') || normName.includes('ماجیک') || normName.includes('magic bar') || normName.includes('magicbar')) {
    return { category: 'ماجیکبارەکان', section: 'shisha' };
  }

  return null;
}

const knownGeneralVariations: string[] = [
  'دەرمان', 'خواردنەوە', 'دیاری', 'یاریەکان', 'یاریەكان', 'یاری', 'ڤەیپ و پۆد', 'ڤەیپ', 'پۆد', 'جگەرە', 'چەرخ', 'هەمەجۆر',
  'نێرگلە', 'فەحم', 'هیتەر', 'سیم',
  'خەڵتەکان', 'خەلتەکان', 'خەڵتە', 'خەلتە', 'خلتەکان', 'خلتە',
  'ناریەکان', 'ناریەكان', 'ناریە', 'ئاریەکان', 'ئاریەكان', 'ئاریە',
  'سۆندەکان', 'سۆندەكان', 'سۆندە', 'سونده', 'سونده کان', 'سۆندە کان',
  'تیلەکان', 'تێلەكان', 'تێلەکان', 'تیلەكان', 'تیلە', 'تێلە', 'تیله',
  'شوشەکان', 'شوشەكان', 'شوشە', 'شوشه', 'شیشە', 'شیشەکان',
  'مەقاشەکان', 'مقاشەكان', 'مەقاشەکان', 'مقاشەکان', 'مەقاش', 'مقاش',
  'سەرەکەکان', 'سەركەكان', 'سەرەکان', 'سەركەکان', 'سەرەكان', 'سەرە', 'سەری',
  'تەباغی غاز', 'تەباغ', 'غاز', 'تەباخ', 'تەباغی',
  'قایش وبنی دار و تنفیس', 'قایش وبنی...', 'قایش وبنی', 'قایش و بنی', 'قایش و بنی دار و تنفیس', 'قایش',
  'ئەدوات بەفر', 'أدوات بەفر', 'ادوات بەفر', 'ئەدواتی بەفر', 'بەفر', 'ئایسباک',
  'توتون', 'پاککەرەوە و فرچە', 'پاککەرەوە', 'فرچە', 'کاڵای دەرەکی', 'سەفەری'
];

const normalizedGeneralSet = new Set(knownGeneralVariations.map(normalizeCategoryText));

export function isGeneralCategory(catName: string): boolean {
  if (!catName) return false;
  const raw = catName.trim();
  if (defaultGeneralCategories.includes(raw)) return true;
  const norm = normalizeCategoryText(raw);
  if (normalizedGeneralSet.has(norm)) return true;
  
  const detected = detectCategoryFromNameOrCat(raw, '');
  if (detected && detected.section === 'general') return true;

  return false;
}

export function isShishaProduct(p: any): boolean {
  if (p.section === 'external') return false;
  const cat = (p.category || '').trim();
  if (isGeneralCategory(cat)) return false;
  const normName = normalizeCategoryText(p.name || '');
  if (normName.includes('خلت') || normName.includes('خەلت')) return false;
  if (p.section === 'shisha') return true;
  return false;
}

/**
 * Intelligent category matching that accounts for singular/plural ("مەقاش" vs "مەقاشەکان"),
 * Kurdish/Arabic character normalization (ك/ک, ي/ی, ڵ/ل, ێ/ی, etc.), and prefix/suffix differences.
 */
export function isCategoryMatch(prodCat: string | undefined | null, targetCat: string | undefined | null): boolean {
  if (!prodCat && !targetCat) return true;
  if (!prodCat || !targetCat) return false;
  if (targetCat === 'all') return true;

  const rawP = prodCat.trim();
  const rawT = targetCat.trim();
  if (rawP === rawT) return true;

  const normP = normalizeCategoryText(rawP);
  const normT = normalizeCategoryText(rawT);
  if (normP === normT) return true;

  // Use detectCategoryFromNameOrCat to map both sides to their canonical category
  const detP = detectCategoryFromNameOrCat(rawP, '');
  const detT = detectCategoryFromNameOrCat(rawT, '');
  if (detP && detT && detP.category === detT.category) {
    return true;
  }

  // Plural/singular base matching
  const stripSuffix = (s: string) => s.replace(/(ەکان|کان|ەكان|كان|ە|ه)$/, '');
  const pBase = stripSuffix(normP);
  const tBase = stripSuffix(normT);
  if (pBase.length >= 3 && pBase === tBase) {
    return true;
  }

  return false;
}

/**
 * Generates all query variations for Firestore `in` queries so exact-string indexing
 * in Firestore matches all database documents across plural/spelling variants.
 */
export function getCategoryQueryVariants(category: string): string[] {
  if (!category || category === 'all') return [];
  const raw = category.trim();
  const norm = normalizeCategoryText(raw);

  // 1. خەڵتەکان
  if (norm === 'خلتە' || norm === 'خلتەکان' || norm === 'خەلتە' || norm === 'خەلتەکان') {
    return ['خەڵتەکان', 'خەڵتە', 'خەلتەکان', 'خەلتە', 'خلتەکان', 'خلتە'];
  }
  // 2. مەقاشەکان
  if (norm === 'مەقاشەکان' || norm === 'مەقاش' || norm === 'مقاشەکان' || norm === 'مقاش') {
    return ['مەقاشەکان', 'مەقاشەكان', 'مقاشەکان', 'مقاشەكان', 'مەقاش', 'مقاش'];
  }
  // 3. سۆندەکان
  if (norm === 'سۆندەکان' || norm === 'سۆندە' || norm === 'سونده' || norm === 'سوند') {
    return ['سۆندەکان', 'سۆندەكان', 'سۆندە', 'سونده', 'سونده کان', 'سۆندە کان'];
  }
  // 4. تیلەکان
  if (norm === 'تیلەکان' || norm === 'تیلە' || norm === 'تێلەکان' || norm === 'تێلە') {
    return ['تیلەکان', 'تێلەكان', 'تێلەکان', 'تیلەكان', 'تیلە', 'تێلە', 'تیله'];
  }
  // 5. شوشەکان
  if (norm === 'شوشەکان' || norm === 'شوشە' || norm === 'شیشە' || norm === 'شیشەکان') {
    return ['شوشەکان', 'شوشەكان', 'شوشە', 'شوشه', 'شیشە', 'شیشەکان'];
  }
  // 6. سەرەکەکان
  if (norm === 'سەرەکەکان' || norm === 'سەرکەکان' || norm === 'سەرەکان' || norm === 'سەرە' || norm === 'سەری') {
    return ['سەرەکەکان', 'سەركەكان', 'سەرەکان', 'سەركەکان', 'سەرەكان', 'سەرە', 'سەری'];
  }
  // 7. ناریەکان
  if (norm === 'ناریەکان' || norm === 'ناریە' || norm === 'ئاریەکان' || norm === 'ئاریە') {
    return ['ناریەکان', 'ناریەكان', 'ناریە', 'ئاریەکان', 'ئاریەكان', 'ئاریە'];
  }
  // 8. قایش وبنی دار و تنفیس
  if (norm.includes('قایش') || norm.includes('بنی دار') || norm.includes('تنفیس')) {
    return ['قایش وبنی دار و تنفیس', 'قایش وبنی...', 'قایش وبنی', 'قایش و بنی', 'قایش و بنی دار و تنفیس', 'قایش'];
  }
  // 9. ئەدوات بەفر
  if (norm.includes('بەفر') || norm.includes('ئایسباک')) {
    return ['ئەدوات بەفر', 'أدوات بەفر', 'ادوات بەفر', 'ئەدواتی بەفر', 'بەفر'];
  }
  // 10. تەباغی غاز
  if (norm.includes('تەباغ') || norm.includes('غاز') || norm.includes('تەباخ')) {
    return ['تەباغی غاز', 'تەباغ', 'غاز', 'تەباخ', 'تەباغی'];
  }
  // 11. پاککەرەوە و فرچە
  if (norm.includes('پاککەرەوە') || norm.includes('فرچە') || norm.includes('پاکەرەوە')) {
    return ['پاککەرەوە و فرچە', 'پاککەرەوە', 'فرچە', 'پاکەرەوە'];
  }
  // 12. ڤەیپ و پۆد
  if (norm.includes('ڤەیپ') || norm.includes('پۆد') || norm.includes('فەیپ')) {
    return ['ڤەیپ و پۆد', 'ڤەیپ', 'پۆد', 'فەیپ', 'ڤەیپەکان'];
  }
  // 13. یاریەکان
  if (norm.includes('یاری') || norm.includes('دۆمینە') || norm.includes('تاوڵە')) {
    return ['یاریەکان', 'یاریەكان', 'یاری', 'دۆمینە', 'تاوڵە'];
  }
  // 14. فەحم
  if (norm.includes('فەحم') || norm.includes('خەڵووز')) {
    return ['فەحم', 'فەحمەکان', 'فەحم كان', 'خەڵووز'];
  }
  // 15. هیتەر
  if (norm.includes('هیتەر')) {
    return ['هیتەر', 'هیته ر', 'هیتەرەکان'];
  }
  // 16. نێرگلە
  if (norm.includes('نێرگلە') || norm.includes('نیرگله')) {
    return ['نێرگلە', 'نێرگەلە', 'نێرگلەکان', 'نیرگله'];
  }
  // 17. دەرمان
  if (norm.includes('دەرمان')) {
    return ['دەرمان', 'دەرمانەکان'];
  }
  // 18. توتون
  if (norm.includes('توتون')) {
    return ['توتون', 'توتن', 'تتوون'];
  }
  // 19. خواردنەوە
  if (norm.includes('خواردنەوە')) {
    return ['خواردنەوە', 'خواردنەوەکان', 'شەربەت', 'کۆلا', 'ئاو'];
  }
  // 20. دیاری
  if (norm.includes('دیاری')) {
    return ['دیاری', 'دیارییەکان'];
  }
  // 21. ماجیکبارەکان
  if (norm.includes('ماجیک')) {
    return ['ماجیکبارەکان', 'ماجیک بارەکان', 'ماجیکبار', 'ماجیک بار', 'ماجیکبارەكان'];
  }

  return [raw];
}

/**
 * Complete, robust system synchronization:
 * 1. Cleans Shisha categories by purging general accessories.
 * 2. Standardizes General categories list in Firestore settings.
 * 3. Scans all products: restores missing categories, fixes misassigned sections,
 *    and standardizes any dialect/spelling variants into canonical categories.
 */
export async function syncAndCleanCategories(db: any): Promise<{ updatedCount: number; details: string[] }> {
  let updatedCount = 0;
  const details: string[] = [];

  try {
    // 1. Clean settings/shisha_categories so general categories are never in Shisha
    const shishaRef = doc(db, 'settings', 'shisha_categories');
    const shishaSnap = await getDoc(shishaRef);
    if (shishaSnap.exists() && Array.isArray(shishaSnap.data().list)) {
      const currentList: string[] = shishaSnap.data().list;
      const cleanedList = currentList.filter(c => !isGeneralCategory(c));
      if (cleanedList.length !== currentList.length) {
        await setDoc(shishaRef, { list: cleanedList }, { merge: true });
      }
    }

    // 2. Ensure settings/general_categories contains all standard general categories
    const genRef = doc(db, 'settings', 'general_categories');
    const genSnap = await getDoc(genRef);
    if (genSnap.exists() && Array.isArray(genSnap.data().list)) {
      let genList: string[] = genSnap.data().list;
      let changed = false;

      // Migrate any legacy names
      const replacements: Record<string, string> = {
        'قایش وبنی...': 'قایش وبنی دار و تنفیس',
        'قایش وبنی': 'قایش وبنی دار و تنفیس',
        'خەڵتە': 'خەڵتەکان',
        'خەلتە': 'خەڵتەکان',
        'خەلتەکان': 'خەڵتەکان',
        'مقاشەكان': 'مەقاشەکان',
        'مەقاش': 'مەقاشەکان',
        'مقاش': 'مەقاشەکان',
        'سۆندەكان': 'سۆندەکان',
        'سۆندە': 'سۆندەکان',
        'شوشەكان': 'شوشەکان',
        'شوشە': 'شوشەکان',
        'ناریەكان': 'ناریەکان',
        'ناریە': 'ناریەکان',
        'سەركەكان': 'سەرەکەکان',
        'سەرەکان': 'سەرەکەکان',
        'سەرە': 'سەرەکەکان',
        'تێلەكان': 'تیلەکان',
        'تێلەکان': 'تیلەکان',
        'تیلە': 'تیلەکان',
        'أدوات بەفر': 'ئەدوات بەفر',
        'ادوات بەفر': 'ئەدوات بەفر',
        'تەباغ': 'تەباغی غاز',
        'غاز': 'تەباغی غاز'
      };

      genList = genList.map(c => {
        if (replacements[c]) {
          changed = true;
          return replacements[c];
        }
        return c;
      });

      // Ensure all standard categories are present
      defaultGeneralCategories.forEach(stdCat => {
        if (!genList.includes(stdCat)) {
          genList.push(stdCat);
          changed = true;
        }
      });

      if (changed) {
        await setDoc(genRef, { list: Array.from(new Set(genList)) }, { merge: true });
      }
    } else {
      await setDoc(genRef, { list: defaultGeneralCategories }, { merge: true });
    }

    // 3. Batch restore and standardize all products in Firestore
    const prodsSnap = await getDocs(collection(db, 'products'));
    const updates: Promise<any>[] = [];

    prodsSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const detected = detectCategoryFromNameOrCat(data.category, data.name);

      if (detected) {
        const needsCatUpdate = data.category !== detected.category;
        const needsSectionUpdate = data.section !== detected.section;

        if (needsCatUpdate || needsSectionUpdate) {
          updatedCount++;
          details.push(`«${data.name || docSnap.id}» -> ${detected.category} (${detected.section})`);
          updates.push(updateDoc(doc(db, 'products', docSnap.id), {
            category: detected.category,
            section: detected.section
          }));
        }
      }
    });

    if (updates.length > 0) {
      console.log(`Auto-consolidated ${updates.length} products into their standardized categories.`);
      await Promise.all(updates);
    }
  } catch (err) {
    console.error("Error in syncAndCleanCategories:", err);
  }

  return { updatedCount, details };
}
