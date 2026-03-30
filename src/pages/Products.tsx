import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Search, Printer, AlertTriangle, DollarSign, ScanLine, Package, Boxes, Coins, CheckCircle, X } from 'lucide-react';
import Barcode from 'react-barcode';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function Products() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'shisha'>('general');
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [isUsdMode, setIsUsdMode] = useState(false);
  const [usdPrice, setUsdPrice] = useState(0);
  const [usdWholesalePrice, setUsdWholesalePrice] = useState(0);
  const [usdCost, setUsdCost] = useState(0);
  const [usdWholesaleCost, setUsdWholesaleCost] = useState(0);
  const [hasWholesale, setHasWholesale] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    price: 0,
    wholesalePrice: 0,
    packSize: 1,
    costPrice: 0,
    wholesaleCost: 0,
    barcode: '',
    stock: 0,
    section: 'general',
    company: '',
    isUsdMode: false,
    usdPrice: 0,
    usdWholesalePrice: 0,
    usdCost: 0,
    usdWholesaleCost: 0,
    isWeighed: false,
  });
  const [labelProduct, setLabelProduct] = useState<any>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handlePrintLabel = () => {
    window.print();
  };

  useEffect(() => {
    // Fetch settings for USD exchange rate
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
      } catch (e) {
        console.error("Error fetching settings:", e);
      }
    };
    fetchSettings();

    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'products'), (snapshot) => {
      const fetchedProducts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(fetchedProducts);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching products:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  // Update IQD prices when USD prices change
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

      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', price: 0, wholesalePrice: 0, packSize: 1, costPrice: 0, wholesaleCost: 0, barcode: '', stock: 0, section: activeSection, company: '', isUsdMode: false, usdPrice: 0, usdWholesalePrice: 0, usdCost: 0, usdWholesaleCost: 0, isWeighed: false });
      setIsUsdMode(false);
      setUsdPrice(0);
      setUsdWholesalePrice(0);
      setUsdCost(0);
      setUsdWholesaleCost(0);
      setHasWholesale(false);
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

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteDoc(doc(db, 'products', productToDelete));
      } catch (error) {
        console.error("Error deleting product:", error);
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      price: product.price,
      wholesalePrice: product.wholesalePrice || 0,
      packSize: product.packSize || 1,
      costPrice: product.costPrice || 0,
      wholesaleCost: product.wholesaleCost || 0,
      barcode: product.barcode,
      stock: product.stock,
      section: product.section || 'general',
      company: product.company || '',
      isUsdMode: product.isUsdMode || false,
      usdPrice: product.usdPrice || 0,
      usdWholesalePrice: product.usdWholesalePrice || 0,
      usdCost: product.usdCost || 0,
      usdWholesaleCost: product.usdWholesaleCost || 0,
      isWeighed: product.isWeighed || false,
    });
    setIsUsdMode(product.isUsdMode || false);
    setUsdPrice(product.usdPrice || 0);
    setUsdWholesalePrice(product.usdWholesalePrice || 0);
    setUsdCost(product.usdCost || 0);
    setUsdWholesaleCost(product.usdWholesaleCost || 0);
    setHasWholesale(!!product.wholesalePrice && product.packSize > 1);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => 
    (p.section === activeSection || (!p.section && activeSection === 'general')) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.company && p.company.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (p.barcode && p.barcode.includes(searchTerm)))
  );

  return (
    <div className="space-y-6 print:h-auto print:block">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">بەڕێوەبردنی کالا</h1>
        <button
          onClick={() => {
            setEditingProduct(null);
            setFormData({ name: '', price: 0, wholesalePrice: 0, packSize: 1, costPrice: 0, barcode: '', stock: 0, section: activeSection, isUsdMode: false, usdPrice: 0, usdWholesalePrice: 0, usdCost: 0, isWeighed: false });
            setIsUsdMode(false);
            setUsdPrice(0);
            setUsdWholesalePrice(0);
            setUsdCost(0);
            setHasWholesale(false);
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          کالای نوێ
        </button>
      </div>

      <div className="flex gap-4 print:hidden">
        <button
          onClick={() => setActiveSection('general')}
          className={`px-6 py-3 rounded-xl font-bold transition-all ${
            activeSection === 'general' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی گشتی
        </button>
        <button
          onClick={() => setActiveSection('shisha')}
          className={`px-6 py-3 rounded-xl font-bold transition-all ${
            activeSection === 'shisha' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی شیشە
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-md">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناو یان بارکۆد..."
              className="w-full pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ناو</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">شەریکە</th>
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
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">هیچ کالایەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        {product.isWeighed && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">بە کێش</span>}
                      </div>
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

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col print:hidden">
          <div className="bg-white w-full h-full overflow-hidden flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {editingProduct ? <Edit size={24} /> : <Plus size={24} />}
                {editingProduct ? 'دەستکاریکردنی کالا' : 'زیادکردنی کالای نوێ'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition-colors">
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
                    <label className="block text-sm font-bold text-gray-700 mb-1">شەریکە (ئارەزوومەندانە)</label>
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 transition-colors font-medium text-lg"
                      placeholder="ناوی شەریکە..."
                    />
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
                  onClick={() => setIsModalOpen(false)}
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
      )}

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
      <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999] print:p-0">
        <div ref={labelRef} className="border border-gray-300 p-4 w-64 text-center bg-white mx-auto mt-8" dir="rtl">
          <h3 className="font-bold text-sm mb-1 truncate">{labelProduct?.name}</h3>
          <p className="text-lg font-bold mb-2">{labelProduct?.price?.toLocaleString()} IQD</p>
          <div className="flex justify-center">
            <Barcode value={labelProduct?.barcode || '0000000000'} width={1.5} height={40} fontSize={12} />
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی کالا"
        message="دڵنیایت لە سڕینەوەی ئەم کالایە؟ ئەم کردارە پاشگەزبوونەوەی نییە."
      />
    </div>
  );
}
