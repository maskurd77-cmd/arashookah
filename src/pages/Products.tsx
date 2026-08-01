import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Search, Printer, AlertTriangle, DollarSign, ScanLine, Package, Boxes, Coins, CheckCircle, X, LayoutGrid, Building2, ArrowRight, Tag, Sparkles, Layers, Beaker, Flame, Coffee, Cigarette, Dices, ChevronLeft, RefreshCw } from 'lucide-react';
import Barcode from 'react-barcode';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ProductModal } from '../components/ProductModal';
import { cacheManager } from '../lib/cache';

export default function Products() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'shisha' | 'external'>('general');
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [labelProduct, setLabelProduct] = useState<any>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const defaultSectionCategories: Record<string, string[]> = {
    general: ['دەرمان', 'خواردنەوە', 'دیاری', 'یاریەکان', 'هەمەجۆر'],
    shisha: ['نێرگلە', 'شیشە', 'فەحم', 'توتون', 'سەری نێرگلە', 'هیتەر', 'یاریەکان', 'یارمەتیدەرەکان'],
    external: ['کاڵای دەرەکی', 'سەفەری', 'هەمەجۆر']
  };

  const [customCategories, setCustomCategories] = useState<string[]>(cacheManager.getCategories() || []);
  const [companies, setCompanies] = useState<any[]>(cacheManager.getCompanies() || []);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showAllProducts, setShowAllProducts] = useState<boolean>(false);

  // Active categories dynamically calculated based on selected section
  const categories = React.useMemo(() => {
    const base = defaultSectionCategories[activeSection] || defaultSectionCategories.general;
    const merged = new Set([...base, ...customCategories]);
    return Array.from(merged);
  }, [activeSection, customCategories]);
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    price: '',
    wholesalePrice: '',
    costPrice: '',
    wholesaleCost: '',
    company: '',
    category: ''
  });

  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handlePrintLabel = () => {
    window.print();
  };

  // OPTIMIZATION: High-performance caching for companies and settings
  useEffect(() => {
    const fetchSettingsAndCompanies = async () => {
      try {
        const cachedComp = cacheManager.getCompanies();
        const cachedCats = cacheManager.getCategories();

        if (cachedComp) {
          setCompanies(cachedComp);
        } else {
          const companySnap = await getDocs(collection(db, 'companies'));
          const companyList = companySnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          cacheManager.setCompanies(companyList);
          setCompanies(companyList);
        }

        if (cachedCats) {
          setCustomCategories(cachedCats);
        } else {
          const catRef = doc(db, 'settings', 'categories');
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
            const data = catSnap.data();
            const list = data.list || data.categories || [];
            if (Array.isArray(list) && list.length > 0) {
              cacheManager.setCategories(list);
              setCustomCategories(list);
            }
          }
        }

        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.usdExchangeRate) {
            setUsdExchangeRate(data.usdExchangeRate);
          }
        }
      } catch (e: any) {
        console.error("Error fetching settings/companies:", e);
        if (e.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      }
    };
    fetchSettingsAndCompanies();
  }, [setShowFirebaseSetup]);

  // OPTIMIZATION: Incremental snapshot updates via snapshot.docChanges()
  useEffect(() => {
    const isGridMode = selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && !searchTerm.trim() && !showAllProducts;

    if (isGridMode) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Restore from cache if available to prevent flash of empty state
    const cachedSecProds = cacheManager.getSectionProducts(activeSection);
    if (cachedSecProds && cachedSecProds.length > 0) {
      setProducts(cachedSecProds);
    } else {
      setLoading(true);
    }

    const queryConstraints: any[] = [];
    if (selectedCategoryFilter !== 'all') {
      queryConstraints.push(where('category', '==', selectedCategoryFilter));
      queryConstraints.push(where('section', '==', activeSection));
    } else if (selectedCompanyFilter !== 'all') {
      queryConstraints.push(where('company', '==', selectedCompanyFilter));
      queryConstraints.push(where('section', '==', activeSection));
    } else {
      queryConstraints.push(where('section', '==', activeSection));
    }

    queryConstraints.push(limit(200));

    const q = query(collection(db, 'products'), ...queryConstraints);

    // Process snapshot delta via snapshot.docChanges() - only touch modified/added items
    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const updatedProducts = cacheManager.applyProductSnapshotChanges(activeSection, snapshot);
      setProducts(updatedProducts);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching products:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategoryFilter, selectedCompanyFilter, searchTerm, showAllProducts, activeSection, setShowFirebaseSetup]);

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteDoc(doc(db, 'products', productToDelete));
      } catch (error: any) {
        console.error("Error deleting product:", error);
        if (error.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => 
    (p.section === activeSection || (!p.section && activeSection === 'general')) &&
    (selectedCompanyFilter === 'all' || p.company === selectedCompanyFilter) &&
    (selectedCategoryFilter === 'all' || p.category === selectedCategoryFilter) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.company && p.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchTerm)))
  );

  const toggleProductSelection = (id: string) => {
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedProductIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0) return;

    setLoading(true);
    try {
      const updates: any = {};
      if (bulkEditData.price !== '') updates.price = Number(bulkEditData.price);
      if (bulkEditData.wholesalePrice !== '') updates.wholesalePrice = Number(bulkEditData.wholesalePrice);
      if (bulkEditData.costPrice !== '') updates.costPrice = Number(bulkEditData.costPrice);
      if (bulkEditData.wholesaleCost !== '') updates.wholesaleCost = Number(bulkEditData.wholesaleCost);
      if (bulkEditData.company !== '') updates.company = bulkEditData.company;
      if (bulkEditData.category !== '') updates.category = bulkEditData.category;

      if (Object.keys(updates).length > 0) {
        const promises = Array.from(selectedProductIds).map((id: string) => 
          updateDoc(doc(db, 'products', id), updates)
        );
        await Promise.all(promises);
      }
      
      setIsBulkEditModalOpen(false);
      setSelectedProductIds(new Set());
      setBulkEditData({
        price: '',
        wholesalePrice: '',
        costPrice: '',
        wholesaleCost: '',
        company: ''
      });
    } catch (error: any) {
      console.error("Error updating products:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی گۆڕینی کاڵاکان");
      }
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes('دەرمان')) return Beaker;
    if (name.includes('نێرگلە') || name.includes('توتون')) return Cigarette;
    if (name.includes('شیشە')) return Sparkles;
    if (name.includes('یاری')) return Dices;
    if (name.includes('فەحم') || name.includes('ئاگر') || name.includes('هیتەر')) return Flame;
    if (name.includes('خواردنەوە') || name.includes('چای') || name.includes('کۆلا')) return Coffee;
    return Package;
  };

  const isGridMode = selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && !searchTerm.trim() && !showAllProducts;

  const resetToCategoryGrid = () => {
    setSelectedCategoryFilter('all');
    setSelectedCompanyFilter('all');
    setSearchTerm('');
    setShowAllProducts(false);
  };

  return (
    <div className="space-y-6 print:h-auto print:block">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package className="text-indigo-600" size={28} />
            <span>بەڕێوەبردنی کاڵاکان</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            کاشی کەتەگۆرییەکان کلیک بکە بۆ بینینی کاڵاکان بەبێ ماندوکردنی داتابەیس
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isGridMode && (
            <button
              onClick={resetToCategoryGrid}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl transition-all text-xs font-black shadow-sm"
            >
              <LayoutGrid size={18} />
              <span>کاشی کەتەگۆرییەکان</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md text-xs font-black active:scale-95"
          >
            <Plus size={18} />
            <span>کالای نوێ</span>
          </button>
        </div>
      </div>

      <div className="flex gap-3 print:hidden overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveSection('general'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'general' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی گشتی
        </button>
        <button
          onClick={() => { setActiveSection('shisha'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'shisha' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی شیشە
        </button>
        <button
          onClick={() => { setActiveSection('external'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'external' 
              ? 'bg-emerald-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          کاڵای دەرەکی
        </button>
      </div>

      {/* VIEW MODE 1: Interactive Category Grid Cards (Saves Firebase Reads) */}
      {isGridMode ? (
        <div className="space-y-6 print:hidden">
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="space-y-1 text-center md:text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-bold text-indigo-200">
                <Sparkles size={14} />
                سیستەمی کاشی زیرەک (کەمکردنەوەی لیمیت)
              </span>
              <h2 className="text-xl font-black">کەتەگۆرییەکانی کاڵا هەڵبژێرە</h2>
              <p className="text-xs text-indigo-200 font-medium max-w-xl">
                بۆ پاراستنی لیمیتی داتابەیس و خێرایی، کلیک لەسەر هەر کەتەگۆرییەک بکە بۆ داواکردن و بینینی کاڵاکانی ئەو بەشە.
              </p>
            </div>

            <button
              onClick={() => setShowAllProducts(true)}
              className="px-5 py-3 bg-white hover:bg-indigo-50 text-indigo-900 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95"
            >
              <Boxes size={18} />
              <span>بینینی هەموو کاڵاکان پێکەوە</span>
            </button>
          </div>

          {/* Categories Grid Cards */}
          <div>
            <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
              <LayoutGrid size={18} className="text-indigo-600" />
              <span>کەتەگۆرییەکانی کاڵا</span>
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {categories.map((cat, idx) => {
                const CatIcon = getCategoryIcon(cat);
                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className="group relative bg-white border-2 border-gray-100 hover:border-indigo-500 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-between text-center min-h-[140px] hover:-translate-y-1 cursor-pointer overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-indigo-500 to-purple-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                    
                    <div className="p-3 bg-indigo-50 group-hover:bg-indigo-600 text-indigo-600 group-hover:text-white rounded-2xl transition-all duration-200 shadow-sm">
                      <CatIcon size={28} />
                    </div>

                    <div className="my-2">
                      <span className="block font-black text-sm text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {cat}
                      </span>
                      <span className="text-[10px] text-gray-400 font-medium">کلیک بکە بۆ کالاكان</span>
                    </div>

                    <div className="w-full py-1 bg-gray-50 group-hover:bg-indigo-50 rounded-xl text-[11px] font-bold text-gray-500 group-hover:text-indigo-700 transition-colors flex items-center justify-center gap-1">
                      <span>کردنەوە</span>
                      <ChevronLeft size={14} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Companies Grid Cards */}
          {companies.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                <Building2 size={18} className="text-purple-600" />
                <span>شەریکەکان و براندەکان</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {companies.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedCompanyFilter(comp.name)}
                    className="bg-white border border-gray-100 hover:border-purple-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3 text-right group hover:-translate-y-0.5"
                  >
                    <div className="p-2.5 bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white rounded-xl transition-colors">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-bold text-xs text-gray-800 truncate group-hover:text-purple-600">
                        {comp.name}
                      </span>
                      <span className="text-[10px] text-gray-400 block truncate">شەریکە</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* VIEW MODE 2: Filtered Products Table View */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
          {/* Active Filter Bar & Back Navigation */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={resetToCategoryGrid}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-500 text-indigo-700 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowRight size={16} />
                <span>گەڕانەوە بۆ کاشیی کەتەگۆرییەکان</span>
              </button>

              <div className="flex items-center gap-2 bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <Tag size={14} className="text-indigo-600" />
                <span>
                  {selectedCategoryFilter !== 'all' && `کەتەگۆری: ${selectedCategoryFilter}`}
                  {selectedCompanyFilter !== 'all' && `شەریکە: ${selectedCompanyFilter}`}
                  {searchTerm && `گەڕان بۆ: "${searchTerm}"`}
                  {showAllProducts && selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && 'هەموو کاڵاکان'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span>ژمارەی کاڵای دۆزراوە:</span>
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md">{filteredProducts.length}</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 w-full sm:w-auto flex-wrap">
              <div className="relative max-w-md flex-1 sm:flex-none sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                  className="w-full pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">هەموو کەتەگۆرییەکان</option>
                {categories.map((c, idx) => (
                  <option key={idx} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">هەموو شەریکەکان</option>
                {companies.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            {selectedProductIds.size > 0 && (
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors font-medium"
              >
                <Edit size={18} />
                گۆڕینی بەکۆمەڵ ({selectedProductIds.size})
              </button>
            )}
          </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-sm font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                    onChange={toggleAllSelection}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ناو</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">کەتەگۆری</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">شەریکە/جۆر</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">تێچووی دانە</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">نرخی دانە</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">تێچووی کۆ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">نرخی کۆ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">قەبارەی تەک</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">قازانج (دانە)</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ستۆک</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">بارکۆد</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-500">هیچ کالایەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        {product.isWeighed && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">بە کێش</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.category || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.company || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {(product.costPrice || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-gray-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-indigo-600 font-bold">
                      {product.price.toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-indigo-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {(product.wholesaleCost || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-gray-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-purple-600 font-bold">
                      {(product.wholesalePrice || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-purple-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.packSize || 1} دانە
                    </td>
                    <td className="px-6 py-4 text-green-600 font-bold">
                      {(product.price - (product.costPrice || 0)).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-green-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {Number(product.stock.toFixed(3))} {product.isWeighed ? 'کگم' : 'دانە'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">{product.barcode}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setLabelProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="چاپکردنی لابل"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        activeSection={activeSection}
      />

      {/* Label Print Modal */}
      {labelProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">چاپکردنی لابل</h2>
            </div>
            <div className="p-6 flex justify-center">
              {/* The Label to Print */}
              <div className="border border-gray-300 p-4 w-64 text-center bg-white" dir="rtl">
                <h3 className="font-bold text-sm mb-1 truncate">{labelProduct.name}</h3>
                <p className="text-lg font-bold mb-2">{labelProduct.price.toLocaleString()} IQD</p>
                <div className="flex justify-center">
                  <Barcode value={labelProduct.barcode || '0000000000'} width={1.5} height={40} fontSize={12} />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setLabelProduct(null)}
                className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                داخستن
              </button>
              <button
                onClick={handlePrintLabel}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                چاپکردن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Label for Printing */}
      {labelProduct && (
        <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999] print:p-0">
          <style type="text/css" media="print">
            {`
              @page {
                size: 50mm 30mm landscape;
                margin: 0;
              }
              html, body {
                width: 50mm;
                height: 30mm;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden;
              }
              .print-label-wrapper {
                page-break-inside: avoid;
                page-break-after: avoid;
                page-break-before: avoid;
              }
            `}
          </style>
          <div ref={labelRef} className="print-label-wrapper w-[50mm] h-[30mm] flex flex-col items-center justify-center bg-white box-border p-1" dir="rtl">
            <h3 className="font-bold text-[11px] leading-tight mb-0.5 truncate w-full text-center px-1">{labelProduct.name}</h3>
            <p className="text-[13px] font-bold mb-0.5">{labelProduct.price.toLocaleString()} IQD</p>
            <div className="flex justify-center w-full overflow-hidden">
              <Barcode value={labelProduct.barcode || '0000000000'} width={1.2} height={25} fontSize={10} margin={0} displayValue={true} />
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی کالا"
        message="دڵنیایت لە سڕینەوەی ئەم کالایە؟ ئەم کردارە پاشگەزبوونەوەی نییە."
      />

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit className="text-indigo-600" />
              گۆڕینی بەکۆمەڵ ({selectedProductIds.size} کاڵا)
            </h2>
            <p className="text-sm text-gray-500 mb-6">تەنها ئەو خانانە پڕبکەرەوە کە دەتەوێت بیانگۆڕیت. ئەوانەی بەتاڵن وەک خۆیان دەمێننەوە.</p>
            
            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نرخی فرۆشتن (مفرد)</label>
                  <input
                    type="number"
                    value={bulkEditData.price}
                    onChange={(e) => setBulkEditData({...bulkEditData, price: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تێچووی مفرد</label>
                  <input
                    type="number"
                    value={bulkEditData.costPrice}
                    onChange={(e) => setBulkEditData({...bulkEditData, costPrice: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نرخی فرۆشتن (جملە)</label>
                  <input
                    type="number"
                    value={bulkEditData.wholesalePrice}
                    onChange={(e) => setBulkEditData({...bulkEditData, wholesalePrice: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تێچووی جملە</label>
                  <input
                    type="number"
                    value={bulkEditData.wholesaleCost}
                    onChange={(e) => setBulkEditData({...bulkEditData, wholesaleCost: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">شەریکە</label>
                  <select
                    value={bulkEditData.company}
                    onChange={(e) => setBulkEditData({...bulkEditData, company: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">بێ گۆڕانکاری...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">کەتەگۆری</label>
                  <select
                    value={bulkEditData.category}
                    onChange={(e) => setBulkEditData({...bulkEditData, category: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">بێ گۆڕانکاری...</option>
                    {categories.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'چاوەڕێبە...' : 'گۆڕینی کاڵاکان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
