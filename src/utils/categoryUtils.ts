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

const knownGeneralVariations: string[] = [
  'دەرمان', 'خواردنەوە', 'دیاری', 'یاریەکان', 'یاریەكان', 'یاری', 'ڤەیپ و پۆد', 'ڤەیپ', 'پۆد', 'جگەرە', 'چەرخ', 'هەمەجۆر',
  'نێرگلە', 'فەحم', 'هیتەر', 'سیم',
  'خەڵتەکان', 'خەلتەکان', 'خەڵتە', 'خەلتە', 'خلتەکان', 'خلتە',
  'ناریەکان', 'ناریەكان', 'ناریە', 'ئاریەکان',
  'سۆندەکان', 'سۆندەكان', 'سۆندە', 'سونده', 'سونده کان',
  'تیلەکان', 'تێلەكان', 'تێلەکان', 'تیلە', 'تیله',
  'شوشەکان', 'شوشەكان', 'شوشە', 'شوشه',
  'مەقاشەکان', 'مقاشەكان', 'مەقاشەکان', 'مقاشەکان', 'مەقاش', 'مقاش',
  'سەرەکەکان', 'سەركەكان', 'سەرەکان', 'سەرە', 'سەری',
  'تەباغی غاز', 'تەباغ', 'غاز',
  'قایش وبنی دار و تنفیس', 'قایش وبنی...', 'قایش وبنی', 'قایش و بنی', 'قایش و بنی دار و تنفیس', 'قایش',
  'ئەدوات بەفر', 'أدوات بەفر', 'ادوات بەفر', 'ئەدواتی بەفر', 'بەفر',
  'توتون', 'پاککەرەوە و فرچە', 'پاککەرەوە', 'فرچە', 'کاڵای دەرەکی', 'سەفەری'
];

const normalizedGeneralSet = new Set(knownGeneralVariations.map(normalizeCategoryText));

export function isGeneralCategory(catName: string): boolean {
  if (!catName) return false;
  const raw = catName.trim();
  if (defaultGeneralCategories.includes(raw)) return true;
  const norm = normalizeCategoryText(raw);
  if (normalizedGeneralSet.has(norm)) return true;
  
  // Specific keyword fallbacks
  if (norm.includes('خەلت') || norm.includes('خلت')) return true;
  if (norm.includes('مقاش') || norm.includes('مەقاش')) return true;
  if (norm.includes('شوش') || norm.includes('شیشە نێرگلە')) return true;
  if (norm.includes('ناریە') || norm.includes('ناریە')) return true;
  if (norm.includes('قایش')) return true;
  if (norm.includes('بەفر')) return true;
  if (norm.includes('سۆند') || norm.includes('سوند')) return true;
  if (norm.includes('سەرەک') || norm.includes('سەرك')) return true;
  if (norm.includes('تیل') || norm.includes('تێل')) return true;

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
 * Intelligent category matching that accounts for singular/plural ("خەڵتە" vs "خەڵتەکان"),
 * Kurdish character normalization (ڵ/ل, ی/ێ, etc.), and prefix/suffix differences.
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

  // Khalte / Khaltekan special matching
  const isPKhalta = normP === 'خلتە' || normP === 'خلتەکان' || normP === 'خەلتە' || normP === 'خەلتەکان' || rawP === 'خەڵتە' || rawP === 'خەڵتەکان';
  const isTKhalta = normT === 'خلتە' || normT === 'خلتەکان' || normT === 'خەلتە' || normT === 'خەلتەکان' || rawT === 'خەڵتە' || rawT === 'خەڵتەکان';
  if (isPKhalta && isTKhalta) return true;

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

  if (norm === 'خلتە' || norm === 'خلتەکان' || norm === 'خەلتە' || norm === 'خەلتەکان') {
    return ['خەڵتەکان', 'خەڵتە', 'خەلتەکان', 'خەلتە', 'خلتەکان', 'خلتە'];
  }
  if (norm === 'مەقاشەکان' || norm === 'مقاش') {
    return ['مەقاشەکان', 'مەقاش', 'مقاشەکان', 'مقاش'];
  }
  if (norm === 'سۆندەکان' || norm === 'سۆندە' || norm === 'سونده') {
    return ['سۆندەکان', 'سۆندە', 'سونده', 'سونده کان'];
  }
  if (norm === 'تیلەکان' || norm === 'تیلە') {
    return ['تیلەکان', 'تێلەکان', 'تیلە', 'تیله'];
  }
  if (norm === 'شوشەکان' || norm === 'شوشە') {
    return ['شوشەکان', 'شوشە', 'شوشه'];
  }
  if (norm === 'سەرەکەکان' || norm === 'سەرەکان' || norm === 'سەرە') {
    return ['سەرەکەکان', 'سەركەکان', 'سەرەکان', 'سەرە'];
  }
  if (norm === 'ناریەکان' || norm === 'ناریە') {
    return ['ناریەکان', 'ناریە', 'ئاریەکان'];
  }
  if (norm === 'یاریەکان' || norm === 'یاری') {
    return ['یاریەکان', 'یاری'];
  }

  return [raw];
}

export async function syncAndCleanCategories(db: any) {
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

    // 2. Ensure settings/general_categories contains all standard general categories with 'خەڵتەکان'
    const genRef = doc(db, 'settings', 'general_categories');
    const genSnap = await getDoc(genRef);
    if (genSnap.exists() && Array.isArray(genSnap.data().list)) {
      let genList: string[] = genSnap.data().list;
      let changed = false;
      if (genList.includes('قایش وبنی...')) {
        genList = genList.map(c => c === 'قایش وبنی...' ? 'قایش وبنی دار و تنفیس' : c);
        changed = true;
      }
      if (!genList.includes('قایش وبنی دار و تنفیس')) {
        genList.push('قایش وبنی دار و تنفیس');
        changed = true;
      }
      if (genList.includes('خەڵتە') || genList.includes('خەلتە')) {
        genList = genList.map(c => (c === 'خەڵتە' || c === 'خەلتە') ? 'خەڵتەکان' : c);
        changed = true;
      }
      if (!genList.includes('خەڵتەکان')) {
        genList.push('خەڵتەکان');
        changed = true;
      }
      if (!genList.includes('ناریەکان')) {
        genList.push('ناریەکان');
        changed = true;
      }
      if (changed) {
        await setDoc(genRef, { list: Array.from(new Set(genList)) }, { merge: true });
      }
    } else {
      await setDoc(genRef, { list: defaultGeneralCategories }, { merge: true });
    }

    // 3. Batch consolidate all products belonging to Khaltekan into standard 'خەڵتەکان' and 'general' section
    const prodsSnap = await getDocs(collection(db, 'products'));
    const updates: Promise<any>[] = [];

    prodsSnap.docs.forEach(docSnap => {
      const data = docSnap.data();
      const rawCat = (data.category || '').trim();
      const normCat = normalizeCategoryText(rawCat);
      const name = data.name || '';
      const normName = normalizeCategoryText(name);

      const isKhalteProduct =
        normCat === 'خلتە' ||
        normCat === 'خلتەکان' ||
        normCat === 'خەلتە' ||
        normCat === 'خەلتەکان' ||
        rawCat === 'خەڵتە' ||
        rawCat === 'خەڵتەکان' ||
        rawCat === 'خەلتە' ||
        rawCat === 'خەلتەکان' ||
        normCat.includes('خلت') ||
        normCat.includes('خەلت') ||
        (!rawCat && (normName.includes('خلت') || normName.includes('خەلت'))) ||
        (data.isWeighed && (normName.includes('خلت') || normName.includes('خەلت')));

      if (isKhalteProduct) {
        if (data.category !== 'خەڵتەکان' || data.section !== 'general') {
          updates.push(updateDoc(doc(db, 'products', docSnap.id), {
            category: 'خەڵتەکان',
            section: 'general'
          }));
        }
      }
    });

    if (updates.length > 0) {
      console.log(`Auto-consolidated ${updates.length} products into 'خەڵتەکان' category.`);
      await Promise.all(updates);
    }
  } catch (err) {
    console.error("Error in syncAndCleanCategories:", err);
  }
}
