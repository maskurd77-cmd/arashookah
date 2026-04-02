import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Search, Printer, AlertTriangle, DollarSign, ScanLine, Package, Boxes, Coins, CheckCircle, X } from 'lucide-react';
import Barcode from 'react-barcode';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ProductModal } from '../components/ProductModal';

export default function Products() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'shisha'>('general');
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [labelProduct, setLabelProduct] = useState<any>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

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

    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      setCompanies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error: any) => {
      console.error("Error fetching companies:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
    });

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

    return () => {
      unsubscribe();
      unsubCompanies();
    };
  }, [setShowFirebaseSetup]);

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

  const [bulkEditData, setBulkEditData] = useState({
    price: '',
    wholesalePrice: '',
    costPrice: '',
    wholesaleCost: '',
    company: ''
  });

  return (
    <div className="space-y-6 print:h-auto print:block">
      <div className="flex justify-between items-center print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">بەڕێوەبردنی کالا</h1>
        <button
          onClick={() => {
            setEditingProduct(null);
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
        <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="flex gap-4 w-full sm:w-auto">
            <div className="relative max-w-md flex-1 sm:flex-none sm:w-80">
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
                <div className="col-span-2">
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
