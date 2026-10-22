import React, { useState } from 'react';
import { collection, doc, getDocs, writeBatch, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Wrench, RefreshCw, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import { getCanonicalCategoryName, normalizeCategoryText } from '../utils/categoryUtils';

/**
 * Admin tool that finds data problems in products and fixes ONLY what the admin selects.
 * Nothing is written until "جێبەجێکردن" is pressed and confirmed.
 */

// Products that the old automatic name-based logic moved into the wrong category.
// Applied only when the product is still in the listed wrong category.
const KNOWN_MISPLACED: { name: string; from: string; to: string; reason: string }[] = [
  { name: 'ادالیا لیمۆ كۆكتیل', from: 'تیلەکان', to: 'دەرمان', reason: '«کۆکتیل» وشەی «تیل»ی تێدایە' },
  { name: 'طه قەزەم ستیل 2026', from: 'تیلەکان', to: 'نێرگلە', reason: '«ستیل» وشەی «تیل»ی تێدایە' },
  { name: 'طه قەزەم ستیل 2027', from: 'تیلەکان', to: 'نێرگلە', reason: '«ستیل» وشەی «تیل»ی تێدایە' },
  { name: 'بانگ بانگ بنێشت سادە بەفر', from: 'ئەدوات بەفر', to: 'دەرمان', reason: 'تامی دەرمانە، نەک ئامرازی بەفر' },
  { name: 'الاماسی بنێشت بەفر', from: 'ئەدوات بەفر', to: 'دەرمان', reason: 'تامی دەرمانە، نەک ئامرازی بەفر' },
];

type Fix =
  | { key: string; kind: 'category'; productId: string; productName: string; from: string; to: string; reason: string }
  | { key: string; kind: 'name'; productId: string; from: string; to: string }
  | { key: string; kind: 'merge'; keepId: string; keepName: string; removeId: string; removeName: string; addStock: number; note: string };

interface Notice { title: string; lines: string[] }

const cleanName = (n: string) => (n || '').replace(/\s+/g, ' ').trim();

export const DataRepairPanel: React.FC = () => {
  const [scanning, setScanning] = useState(false);
  const [applying, setApplying] = useState(false);
  const [fixes, setFixes] = useState<Fix[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [notices, setNotices] = useState<Notice[]>([]);
  const [resultMsg, setResultMsg] = useState<string | null>(null);

  const scan = async () => {
    setScanning(true);
    setResultMsg(null);
    try {
      const snap = await getDocs(collection(db, 'products'));
      const products = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
      const found: Fix[] = [];

      // 1. Products moved into a wrong category by the old automatic logic
      for (const m of KNOWN_MISPLACED) {
        products
          .filter(p => cleanName(p.name) === m.name && (p.category || '').trim() === m.from)
          .forEach(p => found.push({ key: `cat-${p.id}`, kind: 'category', productId: p.id, productName: p.name, from: m.from, to: m.to, reason: m.reason }));
      }

      // 2. Category spelling variants (e.g. «سەركەكان» → «سەرەکەکان») so one category is not split in two
      products.forEach(p => {
        const cat = (p.category || '').trim();
        if (!cat || found.some(f => f.kind === 'category' && f.productId === p.id)) return;
        const canonical = getCanonicalCategoryName(cat);
        if (canonical !== cat) {
          found.push({ key: `cat-${p.id}`, kind: 'category', productId: p.id, productName: p.name, from: cat, to: canonical, reason: 'یەکخستنی ڕێنووسی کەتەگۆری' });
        }
      });

      // 3. Extra spaces in names (they make the same product look like two)
      products.forEach(p => {
        const cleaned = cleanName(p.name);
        if (p.name && cleaned !== p.name) {
          found.push({ key: `name-${p.id}`, kind: 'name', productId: p.id, from: p.name, to: cleaned });
        }
      });

      // 4. Duplicate products (same name, same section). Merged only when their barcodes do not conflict.
      const groups = new Map<string, any[]>();
      products.forEach(p => {
        const k = `${p.section || 'general'}|${normalizeCategoryText(p.name || '').replace(/\s+/g, '')}`;
        if (!p.name) return;
        groups.set(k, [...(groups.get(k) || []), p]);
      });
      const manualDuplicates: string[] = [];
      groups.forEach(list => {
        if (list.length < 2) return;
        const barcodes = Array.from(new Set(list.map(p => (p.barcode || '').trim()).filter(Boolean)));
        if (barcodes.length > 1 || list.some(p => p.packBarcode)) {
          manualDuplicates.push(`${cleanName(list[0].name)} (${list.length} دانە، بارکۆدی جیاواز: ${barcodes.join(' / ')})`);
          return;
        }
        // Keep the record that has a barcode / the most information; fold the others into it
        const sorted = [...list].sort((a, b) =>
          (b.barcode ? 1 : 0) - (a.barcode ? 1 : 0) || Object.keys(b).length - Object.keys(a).length
        );
        const keep = sorted[0];
        sorted.slice(1).forEach(dup => {
          const priceNote = dup.price !== keep.price ? ` · نرخی جیاواز: ${(dup.price || 0).toLocaleString()} ← نرخی هەڵگیراو: ${(keep.price || 0).toLocaleString()}` : '';
          found.push({
            key: `merge-${dup.id}`,
            kind: 'merge',
            keepId: keep.id,
            keepName: keep.name,
            removeId: dup.id,
            removeName: dup.name,
            addStock: Number(dup.stock) || 0,
            note: `ستۆک: ${keep.stock ?? 0} + ${dup.stock ?? 0}${priceNote}`,
          });
        });
      });

      // Informational only: these need the owner (physical count / decisions), not an automatic change
      const info: Notice[] = [];
      const negative = products.filter(p => (Number(p.stock) || 0) < 0);
      if (negative.length) {
        info.push({
          title: `ستۆکی سالب (${negative.length}) — پێویستی بە ژماردنی ڕاستەقینە هەیە لە بەشی کۆگا`,
          lines: negative.map(p => `${cleanName(p.name)}: ${Math.round((Number(p.stock) || 0) * 100) / 100}`),
        });
      }
      const byBarcode = new Map<string, string[]>();
      products.forEach(p => {
        const b = (p.barcode || '').trim();
        if (b) byBarcode.set(b, [...(byBarcode.get(b) || []), cleanName(p.name)]);
      });
      const shared = Array.from(byBarcode.entries()).filter(([, names]) => names.length > 1);
      if (shared.length) {
        info.push({
          title: `بارکۆدی هاوبەش (${shared.length}) — لە POS پەنجەرەی هەڵبژاردن دەردەکەوێت`,
          lines: shared.map(([b, names]) => `${b}: ${names.join('، ')}`),
        });
      }
      if (manualDuplicates.length) {
        info.push({ title: 'کاڵای دووبارە بە بارکۆدی جیاواز — بە دەست بپشکنە', lines: manualDuplicates });
      }
      const uncategorized = products.filter(p => !(p.category || '').trim());
      if (uncategorized.length) {
        info.push({ title: `کاڵای بێ کەتەگۆری (${uncategorized.length})`, lines: uncategorized.map(p => cleanName(p.name)) });
      }

      setFixes(found);
      setSelected(new Set(found.map(f => f.key)));
      setNotices(info);
    } catch (err: any) {
      console.error('Data scan failed:', err);
      alert('❌ پشکنین سەرکەوتوو نەبوو: ' + (err.message || ''));
    } finally {
      setScanning(false);
    }
  };

  const apply = async () => {
    if (!fixes) return;
    const chosen = fixes.filter(f => selected.has(f.key));
    if (chosen.length === 0) return;
    if (!window.confirm(`${chosen.length} گۆڕانکاری جێبەجێ دەکرێت. پێشتر باکئاپت وەرگرتووە؟ بەردەوام دەبیت؟`)) return;

    setApplying(true);
    try {
      let batch = writeBatch(db);
      let ops = 0;
      const commitIfFull = async () => {
        if (ops >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          ops = 0;
        }
      };

      for (const f of chosen) {
        if (f.kind === 'category') {
          batch.update(doc(db, 'products', f.productId), { category: f.to });
          ops++;
        } else if (f.kind === 'name') {
          batch.update(doc(db, 'products', f.productId), { name: f.to });
          ops++;
        } else {
          batch.update(doc(db, 'products', f.keepId), { stock: increment(f.addStock) });
          batch.delete(doc(db, 'products', f.removeId));
          ops += 2;
        }
        await commitIfFull();
      }
      if (ops > 0) await batch.commit();

      setResultMsg(`✅ ${chosen.length} گۆڕانکاری بە سەرکەوتوویی جێبەجێ کرا.`);
      setFixes(null);
      setNotices([]);
    } catch (err: any) {
      console.error('Data repair failed:', err);
      alert('❌ هەڵەیەک ڕوویدا: ' + (err.message || ''));
    } finally {
      setApplying(false);
    }
  };

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const describe = (f: Fix) => {
    if (f.kind === 'category') return { title: f.productName, detail: `کەتەگۆری: ${f.from} ← ${f.to}`, sub: f.reason };
    if (f.kind === 'name') return { title: f.to, detail: 'لابردنی بۆشایی زیادە لە ناو', sub: `«${f.from}»` };
    return { title: f.keepName, detail: 'یەکخستنی کاڵای دووبارە (دووەمیان دەسڕدرێتەوە)', sub: f.note };
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-4">
      <div className="border-b border-gray-100 pb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
            <Wrench size={20} className="text-amber-600" />
            پشکنین و چاککردنی داتای کاڵاکان
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            هیچ شتێک ناگۆڕدرێت تا خۆت هەڵی نەبژێریت و «جێبەجێکردن» دانەگریت. پێش جێبەجێکردن باکئاپ وەربگرە.
          </p>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={scanning || applying}
          className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-black disabled:opacity-50"
        >
          <RefreshCw size={16} className={scanning ? 'animate-spin' : ''} />
          {scanning ? 'پشکنین...' : 'پشکنین'}
        </button>
      </div>

      {resultMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold">
          <CheckCircle2 size={18} /> {resultMsg}
        </div>
      )}

      {fixes && fixes.length === 0 && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm font-bold">
          <CheckCircle2 size={18} /> هیچ کێشەیەک نەدۆزرایەوە کە بە ئۆتۆماتیکی چاک بکرێت.
        </div>
      )}

      {fixes && fixes.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black text-gray-800">گۆڕانکارییە پێشنیارکراوەکان ({selected.size} / {fixes.length})</span>
            <div className="flex gap-2 text-xs font-bold">
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setSelected(new Set(fixes.map(f => f.key)))}>هەمووی</button>
              <button type="button" className="text-gray-500 hover:underline" onClick={() => setSelected(new Set())}>هیچ</button>
            </div>
          </div>
          <div className="max-h-[420px] overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-100">
            {fixes.map(f => {
              const d = describe(f);
              return (
                <label key={f.key} className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4" checked={selected.has(f.key)} onChange={() => toggle(f.key)} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-bold text-gray-900">{d.title}</span>
                    <span className="block text-xs font-bold text-indigo-700 mt-0.5">{d.detail}</span>
                    <span className="block text-xs text-gray-500 font-medium mt-0.5">{d.sub}</span>
                  </span>
                </label>
              );
            })}
          </div>
          <button
            type="button"
            onClick={apply}
            disabled={applying || selected.size === 0}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black disabled:opacity-50"
          >
            {applying ? 'جێبەجێکردن...' : `جێبەجێکردنی ${selected.size} گۆڕانکاری`}
          </button>
        </div>
      )}

      {notices.map(n => (
        <div key={n.title} className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <div className="flex items-center gap-2 text-sm font-black text-amber-900">
            {n.title.startsWith('بارکۆدی هاوبەش') ? <Info size={16} /> : <AlertTriangle size={16} />}
            {n.title}
          </div>
          <ul className="mt-2 space-y-0.5 text-xs text-amber-900 font-medium max-h-40 overflow-y-auto">
            {n.lines.map((l, i) => <li key={i}>• {l}</li>)}
          </ul>
        </div>
      ))}
    </div>
  );
};
