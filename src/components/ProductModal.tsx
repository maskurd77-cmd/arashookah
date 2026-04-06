import React, { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, doc, getDoc, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, ScanLine, Package, Boxes, Coins, CheckCircle, X, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingProduct: any;
  activeSection: 'general' | 'shisha';
}

export function ProductModal({ isOpen, onClose, editingProduct, activeSection }: ProductModalProps) {
  const { setShowFirebaseSetup } = useAuth();
  const [loading, setLoading] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [isUsdMode, setIsUsdMode] = useState(false);
  const [usdPrice, setUsdPrice] = useState(0);
  const [usdWholesalePrice, setUsdWholesalePrice] = useState(0);
  const [usdCost, setUsdCost] = useState(0);
  const [usdWholesaleCost, setUsdWholesaleCost] = useState(0);
  const [hasWholesale, setHasWholesale] = useState(false);
  const [categories, setCategories] = useState<string[]>(['دەرمان', 'نێرگلە', 'شیشە', 'یاریەکان', 'فەحم', 'هیتەر']);
  const [companies, setCompanies] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    wholesalePrice: 0,
    packSize: 1,
    costPrice: 0,
    wholesaleCost: 0,
    barcode: '',
    stock: 0,
    section: activeSection,
    company: '',
    category: '',
    isUsdMode: false,
    usdPrice: 0,
    usdWholesalePrice: 0,
    usdCost: 0,
    usdWholesaleCost: 0,
    isWeighed: false,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.usdExchangeRate) {
            setUsdExchangeRate(data.usdExchangeRate);
          }
        }
        
        const catRef = doc(db, 'settings', 'categories');
        const catSnap = await getDoc(catRef);
        if (catSnap.exists()) {
          const data = catSnap.data();
          if (data.list && data.list.length > 0) {
            setCategories(data.list);
          }
        }
        
        // Fetch companies
        const companiesSnap = await getDocs(collection(db, 'companies'));
        const fetchedCompanies = companiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setCompanies(fetchedCompanies);
      } catch (e: any) {
        console.error("Error fetching settings:", e);
        if (e.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      }
    };
    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      if (editingProduct) {
        setFormData({
          name: editingProduct.name,
          price: editingProduct.price,
          wholesalePrice: editingProduct.wholesalePrice || 0,
          packSize: editingProduct.packSize || 1,
          costPrice: editingProduct.costPrice || 0,
          wholesaleCost: editingProduct.wholesaleCost || 0,
          barcode: editingProduct.barcode,
          stock: editingProduct.stock,
          section: editingProduct.section || 'general',
          company: editingProduct.company || '',
          category: editingProduct.category || '',
          isUsdMode: editingProduct.isUsdMode || false,
          usdPrice: editingProduct.usdPrice || 0,
          usdWholesalePrice: editingProduct.usdWholesalePrice || 0,
          usdCost: editingProduct.usdCost || 0,
          usdWholesaleCost: editingProduct.usdWholesaleCost || 0,
          isWeighed: editingProduct.isWeighed || false,
        });
        setIsUsdMode(editingProduct.isUsdMode || false);
        setUsdPrice(editingProduct.usdPrice || 0);
        setUsdWholesalePrice(editingProduct.usdWholesalePrice || 0);
        setUsdCost(editingProduct.usdCost || 0);
        setUsdWholesaleCost(editingProduct.usdWholesaleCost || 0);
        setHasWholesale(!!editingProduct.wholesalePrice && editingProduct.packSize > 1);
      } else {
        setFormData({ name: '', price: 0, wholesalePrice: 0, packSize: 1, costPrice: 0, wholesaleCost: 0, barcode: '', stock: 0, section: activeSection, company: '', category: '', isUsdMode: false, usdPrice: 0, usdWholesalePrice: 0, usdCost: 0, usdWholesaleCost: 0, isWeighed: false });
        setIsUsdMode(false);
        setUsdPrice(0);
        setUsdWholesalePrice(0);
        setUsdCost(0);
        setUsdWholesaleCost(0);
        setHasWholesale(false);
      }
    }
  }, [isOpen, editingProduct, activeSection]);

  useEffect(() => {
    if (isUsdMode) {
      setFormData(prev => ({
        ...prev,
        price: Math.round(usdPrice * usdExchangeRate),
        wholesalePrice: Math.round(usdWholesalePrice * usdExchangeRate),
        costPrice: Math.round(usdCost * usdExchangeRate)
      }));
    }
  }, [usdPrice, usdWholesalePrice, usdCost, usdExchangeRate, isUsdMode]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: name === 'price' || name === 'wholesalePrice' || name === 'costPrice' || name === 'wholesaleCost' || name === 'stock' || name === 'packSize' ? Number(value) : value 
    }));
  };

  const generateBarcode = () => {
    const newBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    setFormData(prev => ({ ...prev, barcode: newBarcode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const productData = { 
        ...formData,
        isUsdMode,
        usdPrice,
        usdWholesalePrice: hasWholesale ? usdWholesalePrice : 0,
        usdCost,
        usdWholesaleCost: hasWholesale ? usdWholesaleCost : 0,
        wholesalePrice: hasWholesale ? formData.wholesalePrice : 0,
        wholesaleCost: hasWholesale ? formData.wholesaleCost : 0,
        packSize: hasWholesale ? formData.packSize : 1,
      };

      if (editingProduct) {
        await updateDoc(doc(db, 'products', editingProduct.id), productData);
      } else {
        await addDoc(collection(db, 'products'), productData);
      }

      if (formData.category && !categories.includes(formData.category)) {
        const newCategories = [...categories, formData.category];
        setCategories(newCategories);
        try {
          await setDoc(doc(db, 'settings', 'categories'), { list: newCategories });
        } catch (e: any) {
          console.error("Error saving category:", e);
        }
      }

      onClose();
    } catch (error: any) {
      console.error("Error saving product:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-50 z-[100] flex flex-col print:hidden">
      <div className="bg-white w-full h-full overflow-hidden flex flex-col shadow-2xl">
        <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            {editingProduct ? <Edit size={24} /> : <Plus size={24} />}
            {editingProduct ? 'دەستکاریکردنی کالا' : 'زیادکردنی کالای نوێ'}
          </h2>
          <button onClick={onClose} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 flex flex-col">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
            {/* General Info Section */}
            <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 h-fit">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Package size={20} className="text-indigo-600" />
              زانیاری گشتی
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">ناوی کالا</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={formData.name}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 transition-colors font-medium text-lg"
                  placeholder="ناوی کالا لێرە بنووسە..."
                />
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">کەتەگۆری (پۆل)</label>
                <input
                  type="text"
                  name="category"
                  list="category-options"
                  value={formData.category}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 transition-colors font-medium text-lg"
                  placeholder="کەتەگۆری هەڵبژێرە یان بنووسە..."
                />
                <datalist id="category-options">
                  {categories.map((cat, idx) => (
                    <option key={idx} value={cat} />
                  ))}
                </datalist>
              </div>
              
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  شەریکە / جۆر (ئارەزوومەندانە)
                </label>
                <input
                  type="text"
                  name="company"
                  list="company-options"
                  value={formData.company}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 transition-colors font-medium text-lg"
                  placeholder="شەریکە یان جۆر بنووسە یان هەڵبژێرە..."
                />
                <datalist id="company-options">
                  {companies.map((company) => (
                    <option key={company.id} value={company.name} />
                  ))}
                </datalist>
              </div>
              
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">بارکۆد</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      name="barcode"
                      value={formData.barcode}
                      onChange={handleInputChange}
                      className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-mono text-lg transition-colors"
                      placeholder="بارکۆد..."
                    />
                  </div>
                  <button
                    type="button"
                    onClick={generateBarcode}
                    className="px-4 py-3 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors text-sm font-bold whitespace-nowrap"
                  >
                    دروستکردن
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">ستۆک (بڕی بەردەست)</label>
                <div className="relative">
                  <Boxes className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                  <input
                    type="number"
                    name="stock"
                    required
                    min="0"
                    step="any"
                    value={formData.stock}
                    onChange={handleInputChange}
                    className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-medium text-lg transition-colors"
                    placeholder="0"
                  />
                </div>
              </div>
              
              {hasWholesale && (
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">قەبارەی تەک (Pack Size)</label>
                  <div className="relative">
                    <Package className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="number"
                      name="packSize"
                      required={hasWholesale}
                      min="1"
                      step="1"
                      value={formData.packSize}
                      onChange={handleInputChange}
                      className="w-full pl-4 pr-10 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-medium text-lg transition-colors"
                      placeholder="10"
                    />
                  </div>
                </div>
              )}
              
              <div className={hasWholesale ? "md:col-span-2" : "md:col-span-1"}>
                <label className="block text-sm font-bold text-gray-700 mb-1">بەش</label>
                <select
                  name="section"
                  value={formData.section}
                  onChange={handleInputChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 transition-colors font-medium text-lg"
                >
                  <option value="general">بەشی گشتی</option>
                  <option value="shisha">بەشی شیشە</option>
                </select>
              </div>
            </div>

            {formData.section === 'general' && (
              <div className="mt-5">
                <label className="flex items-center gap-3 cursor-pointer p-4 bg-blue-50 border-2 border-blue-100 rounded-xl hover:bg-blue-100 transition-colors">
                  <input 
                    type="checkbox" 
                    name="isWeighed"
                    checked={formData.isWeighed || false}
                    onChange={(e) => setFormData(prev => ({ ...prev, isWeighed: e.target.checked }))}
                    className="rounded text-blue-600 focus:ring-blue-500 w-6 h-6 border-gray-300"
                  />
                  <div className="flex flex-col">
                    <span className="text-base font-bold text-blue-900">
                      دەفرۆشرێت بە کێش (کیلۆ / گرام)
                    </span>
                    <span className="text-sm text-blue-700">بۆ ئەو کاڵایانەی کە بە کێشانە دەفرۆشرێن نەک بە دانە</span>
                  </div>
                </label>
              </div>
            )}
          </div>
          
          {/* Pricing Section */}
          <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100 h-fit">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <Coins size={20} className="text-emerald-600" />
                نرخەکان
              </h3>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border-2 border-gray-200 hover:border-indigo-300 transition-colors shadow-sm">
                  <input 
                    type="checkbox" 
                    checked={hasWholesale}
                    onChange={(e) => setHasWholesale(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                  />
                  <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                    <Package size={18} className="text-indigo-600" />
                    جملەی هەیە
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer bg-white px-4 py-2 rounded-xl border-2 border-gray-200 hover:border-indigo-300 transition-colors shadow-sm">
                  <input 
                    type="checkbox" 
                    checked={isUsdMode}
                    onChange={(e) => setIsUsdMode(e.target.checked)}
                    className="rounded text-indigo-600 focus:ring-indigo-500 w-5 h-5"
                  />
                  <span className="text-sm font-bold text-gray-700 flex items-center gap-1">
                    <DollarSign size={18} className="text-green-600" />
                    بە دۆلار
                  </span>
                </label>
              </div>
            </div>

            {isUsdMode && (
              <div className={`grid grid-cols-1 ${hasWholesale ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4 pb-5 mb-5 border-b-2 border-gray-200`}>
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                  <label className="block text-xs font-bold text-green-800 mb-1">تێچووی دانە (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={usdCost}
                      onChange={(e) => setUsdCost(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-2 border-2 border-green-200 rounded-lg focus:ring-0 focus:border-green-500 bg-white font-bold text-lg"
                    />
                  </div>
                </div>
                <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                  <label className="block text-xs font-bold text-green-800 mb-1">فرۆشتنی دانە (USD)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={usdPrice}
                      onChange={(e) => setUsdPrice(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-2 border-2 border-green-200 rounded-lg focus:ring-0 focus:border-green-500 bg-white font-bold text-lg"
                    />
                  </div>
                </div>
                {hasWholesale && (
                  <>
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                      <label className="block text-xs font-bold text-green-800 mb-1">تێچووی کۆ (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={usdWholesaleCost}
                          onChange={(e) => setUsdWholesaleCost(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-2 border-2 border-green-200 rounded-lg focus:ring-0 focus:border-green-500 bg-white font-bold text-lg"
                        />
                      </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl border border-green-100">
                      <label className="block text-xs font-bold text-green-800 mb-1">فرۆشتنی کۆ (USD)</label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold">$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={usdWholesalePrice}
                          onChange={(e) => setUsdWholesalePrice(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-2 border-2 border-green-200 rounded-lg focus:ring-0 focus:border-green-500 bg-white font-bold text-lg"
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <div className={`grid grid-cols-1 ${hasWholesale ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-4`}>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">تێچووی دانە (IQD)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="costPrice"
                    required
                    min="0"
                    value={formData.costPrice}
                    onChange={handleInputChange}
                    readOnly={isUsdMode}
                    className={`w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-bold text-lg transition-colors ${isUsdMode ? 'bg-gray-100 text-gray-500 border-gray-100' : 'bg-white'}`}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">IQD</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">نرخی دانە (IQD)</label>
                <div className="relative">
                  <input
                    type="number"
                    name="price"
                    required
                    min="0"
                    value={formData.price}
                    onChange={handleInputChange}
                    readOnly={isUsdMode}
                    className={`w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-bold text-lg transition-colors ${isUsdMode ? 'bg-gray-100 text-gray-500 border-gray-100' : 'bg-white'}`}
                  />
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">IQD</span>
                </div>
              </div>
              {hasWholesale && (
                <>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">تێچووی کۆ (IQD)</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="wholesaleCost"
                        required={hasWholesale}
                        min="0"
                        value={formData.wholesaleCost}
                        onChange={handleInputChange}
                        readOnly={isUsdMode}
                        className={`w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-bold text-lg transition-colors ${isUsdMode ? 'bg-gray-100 text-gray-500 border-gray-100' : 'bg-white'}`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">IQD</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">نرخی کۆ (IQD)</label>
                    <div className="relative">
                      <input
                        type="number"
                        name="wholesalePrice"
                        required={hasWholesale}
                        min="0"
                        value={formData.wholesalePrice}
                        onChange={handleInputChange}
                        readOnly={isUsdMode}
                        className={`w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 font-bold text-lg transition-colors ${isUsdMode ? 'bg-gray-100 text-gray-500 border-gray-100' : 'bg-white'}`}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">IQD</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          </div>

          <div className="pt-6 mt-auto flex gap-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all text-lg"
            >
              پاشگەزبوونەوە
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all disabled:opacity-50 text-lg shadow-md shadow-indigo-200 flex items-center justify-center gap-2"
            >
              {loading ? 'چاوەڕێبە...' : (
                <>
                  <CheckCircle size={20} />
                  پاشەکەوتکردن
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
