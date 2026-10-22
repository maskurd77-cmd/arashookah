import React, { useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../firebase';
import { X, ScanLine, Search, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { getPackPrice, getPackSize, hasPack } from '../utils/packUtils';

/**
 * Fast entry of pack (تەک) barcodes: scan a carton barcode, it is saved on that
 * product and the cursor jumps to the next product, so many products can be done in a row.
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

type RowState = { status: 'idle' | 'saving' | 'saved' | 'error'; message?: string };

export const PackBarcodeManager: React.FC<Props> = ({ isOpen, onClose }) => {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  // Latest saved codes, read synchronously so Enter + blur never save twice and
  // a code scanned on one row is immediately known as taken for the next rows
  const savedRef = useRef<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getDocs(collection(db, 'products'))
      .then(snap => {
        const all = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setProducts(all);
        savedRef.current = Object.fromEntries(all.map(p => [p.id, String(p.packBarcode || '').trim()]));
        setDrafts(Object.fromEntries(all.map(p => [p.id, p.packBarcode || ''])));
        setRowState({});
      })
      .catch(err => {
        console.error('Error loading products:', err);
        alert('❌ کاڵاکان بار نەبوون: ' + (err.message || ''));
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const packProducts = useMemo(() => products.filter(hasPack), [products]);
  const withBarcode = packProducts.filter(p => (p.packBarcode || '').trim()).length;

  // The list keeps its order while the user scans, so saved rows do not jump away
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return packProducts
      .filter(p => !onlyMissing || !(p.packBarcode || '').trim() || rowState[p.id]?.status === 'saved')
      .filter(p => !term ||
        (p.name || '').toLowerCase().includes(term) ||
        (p.company || '').toLowerCase().includes(term) ||
        String(p.barcode || '').includes(term) ||
        String(p.packBarcode || '').includes(term))
      .sort((a, b) => (a.category || '').localeCompare(b.category || '') || (a.name || '').localeCompare(b.name || ''));
    // rowState intentionally not a dependency: re-filtering after each save would move rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packProducts, search, onlyMissing]);

  const validate = (product: any, code: string): string | null => {
    if (!code) return null;
    if (code === String(product.barcode || '').trim()) return 'هەمان بارکۆدی دانەیە';
    const clash = products.find(p => p.id !== product.id &&
      (String(p.barcode || '').trim() === code || savedRef.current[p.id] === code));
    return clash ? `پێشتر بۆ «${clash.name}» بەکارهاتووە` : null;
  };

  const focusNext = (fromId: string) => {
    const idx = visible.findIndex(p => p.id === fromId);
    const next = visible[idx + 1];
    if (next) {
      const el = inputRefs.current[next.id];
      el?.focus();
      el?.select();
    }
  };

  const save = async (product: any, goNext: boolean) => {
    const code = (drafts[product.id] || '').trim();
    const current = savedRef.current[product.id] || '';
    if (code === current) {
      if (goNext) focusNext(product.id);
      return;
    }
    const error = validate(product, code);
    if (error) {
      setRowState(s => ({ ...s, [product.id]: { status: 'error', message: error } }));
      inputRefs.current[product.id]?.select();
      return;
    }
    setRowState(s => ({ ...s, [product.id]: { status: 'saving' } }));
    const previous = current;
    savedRef.current[product.id] = code;
    try {
      await updateDoc(doc(db, 'products', product.id), { packBarcode: code ? code : deleteField() });
      setProducts(list => list.map(p => (p.id === product.id ? { ...p, packBarcode: code } : p)));
      setRowState(s => ({ ...s, [product.id]: { status: 'saved' } }));
      if (goNext) focusNext(product.id);
    } catch (err: any) {
      console.error('Error saving pack barcode:', err);
      savedRef.current[product.id] = previous;
      setRowState(s => ({ ...s, [product.id]: { status: 'error', message: 'پاشەکەوت نەکرا' } }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 print:hidden">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
              <ScanLine size={22} className="text-purple-600" />
              بارکۆدی تەک
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              کلیک لە خانەی یەکەم بکە و بارکۆدی کارتۆنەکە سکان بکە. پاشەکەوت دەبێت و ئۆتۆماتیک دەچێتە کاڵای دواتر.
            </p>
            <p className="text-sm font-bold text-purple-700 mt-1">
              {withBarcode} لە {packProducts.length} کاڵای تەکدار بارکۆدی تەکیان هەیە
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
            <X size={22} />
          </button>
        </div>

        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="relative flex-1">
            <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="گەڕان بە ناو، شەریکە یان بارکۆد..."
              className="w-full pr-10 pl-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none"
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-bold text-gray-700 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4" checked={onlyMissing} onChange={e => setOnlyMissing(e.target.checked)} />
            تەنها ئەوانەی بارکۆدی تەکیان نییە
          </label>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-500 font-bold">
              <Loader2 size={20} className="animate-spin" /> بارکردن...
            </div>
          ) : visible.length === 0 ? (
            <div className="py-16 text-center text-gray-500 font-bold">هیچ کاڵایەک نییە</div>
          ) : (
            <table className="w-full text-right">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="text-sm text-gray-600">
                  <th className="px-4 py-3 font-bold">کاڵا</th>
                  <th className="px-4 py-3 font-bold">بارکۆدی دانە</th>
                  <th className="px-4 py-3 font-bold">تەک</th>
                  <th className="px-4 py-3 font-bold w-72">بارکۆدی تەک</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {visible.map(p => {
                  const state = rowState[p.id];
                  return (
                    <tr key={p.id} className={state?.status === 'saved' ? 'bg-emerald-50/50' : ''}>
                      <td className="px-4 py-3">
                        <div className="font-bold text-gray-900">{p.name}</div>
                        <div className="text-xs text-gray-500">{p.category}{p.company ? ` · ${p.company}` : ''}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-sm text-gray-600" dir="ltr">{p.barcode || '—'}</td>
                      <td className="px-4 py-3 text-sm">
                        <div className="font-bold text-gray-800">{getPackSize(p)} دانە</div>
                        <div className="text-xs text-purple-700 font-bold">{getPackPrice(p).toLocaleString()} IQD</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="relative">
                          <input
                            ref={el => { inputRefs.current[p.id] = el; }}
                            type="text"
                            dir="ltr"
                            value={drafts[p.id] ?? ''}
                            onChange={e => {
                              const value = e.target.value;
                              setDrafts(d => ({ ...d, [p.id]: value }));
                              if (rowState[p.id]?.status === 'error') setRowState(s => ({ ...s, [p.id]: { status: 'idle' } }));
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                save(p, true);
                              }
                            }}
                            onBlur={() => save(p, false)}
                            placeholder="سکان بکە..."
                            className={`w-full pl-9 pr-3 py-2 border-2 rounded-xl font-mono focus:outline-none ${
                              state?.status === 'error' ? 'border-rose-400 focus:border-rose-500' :
                              state?.status === 'saved' ? 'border-emerald-300 focus:border-emerald-500' :
                              'border-gray-200 focus:border-purple-500'}`}
                          />
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2">
                            {state?.status === 'saving' && <Loader2 size={16} className="animate-spin text-gray-400" />}
                            {state?.status === 'saved' && <CheckCircle2 size={16} className="text-emerald-600" />}
                            {state?.status === 'error' && <AlertTriangle size={16} className="text-rose-600" />}
                          </span>
                        </div>
                        {state?.status === 'error' && <div className="text-xs text-rose-600 font-bold mt-1">{state.message}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
