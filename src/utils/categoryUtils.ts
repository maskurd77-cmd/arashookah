import { doc, getDoc, setDoc } from 'firebase/firestore';

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
  'خەڵتە', 'خەلتە',
  'ناریەکان', 'ناریەكان', 'ناریە', 'ئاریەکان',
  'سۆندەکان', 'سۆندەكان', 'سۆندە', 'سونده', 'سونده کان',
  'تیلەکان', 'تێلەكان', 'تێلەکان', 'تیلە', 'تیله',
  'شوشەکان', 'شوشەكان', 'شوشە', 'شوشه',
  'مەقاشەکان', 'مقاشەكان', 'مەقاشەكان', 'مقاشەکان', 'مەقاش', 'مقاش',
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
  if (p.section === 'shisha') return true;
  return false;
}

export async function syncAndCleanCategories(db: any) {
  try {
    // Clean settings/shisha_categories so general categories are never in Shisha
    const shishaRef = doc(db, 'settings', 'shisha_categories');
    const shishaSnap = await getDoc(shishaRef);
    if (shishaSnap.exists() && Array.isArray(shishaSnap.data().list)) {
      const currentList: string[] = shishaSnap.data().list;
      const cleanedList = currentList.filter(c => !isGeneralCategory(c));
      if (cleanedList.length !== currentList.length) {
        await setDoc(shishaRef, { list: cleanedList }, { merge: true });
      }
    }

    // Ensure settings/general_categories contains all standard general categories
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
      if (changed) {
        await setDoc(genRef, { list: genList }, { merge: true });
      }
    }
  } catch (err) {
    console.error("Error in syncAndCleanCategories:", err);
  }
}
