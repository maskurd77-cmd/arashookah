import React, { useState, useEffect } from 'react';
import { collection, doc, updateDoc, addDoc, serverTimestamp, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { AlertTriangle, Plus, History, DollarSign, TrendingUp, Package } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Inventory() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addAmount, setAddAmount] = useState(0);
  const [note, setNote] = useState('');

  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');

  useEffect(() => {
    setLoading(true);
    let unsubProducts: () => void;
    let unsubHistory: () => void;

    try {
      unsubProducts = onSnapshot(collection(db, 'products'), (productsSnap) => {
        const fetchedProducts = productsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setProducts(fetchedProducts);
      }, (e: any) => {
        console.warn("Could not load products:", e);
        if (e.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      });

      const historyQuery = query(collection(db, 'inventoryHistory'), orderBy('createdAt', 'desc'), limit(50));
      unsubHistory = onSnapshot(historyQuery, (historySnap) => {
        setHistory(historySnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (e: any) => {
        console.warn("Could not load inventory history:", e);
        setLoading(false);
      });
    } catch (error: any) {
      console.error("Error setting up inventory listeners:", error);
      setLoading(false);
    }

    return () => {
      if (unsubProducts) unsubProducts();
      if (unsubHistory) unsubHistory();
    };
  }, [setShowFirebaseSetup]);

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct || addAmount <= 0) return;

    setLoading(true);
    try {
      const newStock = selectedProduct.stock + addAmount;
      await updateDoc(doc(db, 'products', selectedProduct.id), { stock: newStock });

      await addDoc(collection(db, 'inventoryHistory'), {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        type: 'add',
        amount: addAmount,
        previousStock: selectedProduct.stock,
        newStock: newStock,
        note: note,
        createdAt: serverTimestamp(),
      });

      setIsAddModalOpen(false);
      setSelectedProduct(null);
      setAddAmount(0);
      setNote('');
    } catch (error) {
      console.error("Error adding stock:", error);
      alert("هەڵەیەک ڕوویدا لە کاتی زیادکردنی ستۆک");
    } finally {
      setLoading(false);
    }
  };

  const lowStockProducts = products.filter(p => p.stock <= 10);

  const totalCostValue = products.reduce((sum, p) => sum + ((p.costPrice || 0) * p.stock), 0);
  const totalRetailValue = products.reduce((sum, p) => sum + (p.price * p.stock), 0);
  const expectedProfit = totalRetailValue - totalCostValue;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">گۆگا (Inventory)</h1>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          زیادکردنی ستۆک
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-blue-100 rounded-xl text-blue-600">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کۆی گشتی تێچووی گۆگا</p>
            <p className="text-2xl font-bold text-gray-900">{totalCostValue.toLocaleString()} IQD</p>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-indigo-100 rounded-xl text-indigo-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کۆی گشتی نرخی فرۆشتن</p>
            <p className="text-2xl font-bold text-gray-900">{totalRetailValue.toLocaleString()} IQD</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="p-3 bg-green-100 rounded-xl text-green-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">قازانجی پێشبینیکراو</p>
            <p className="text-2xl font-bold text-gray-900">{expectedProfit.toLocaleString()} IQD</p>
          </div>
        </div>
      </div>

      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-4">
          <div className="p-2 bg-red-100 rounded-xl text-red-600">
            <AlertTriangle size={24} />
          </div>
          <div>
            <h3 className="font-bold text-red-800 mb-1">ئاگاداری کەمبوونی کالا</h3>
            <p className="text-sm text-red-600 mb-3">ئەم کالایانەی خوارەوە ستۆکیان کەمە (١٠ یان کەمتر):</p>
            <div className="flex flex-wrap gap-2">
              {lowStockProducts.map(p => (
                <span key={p.id} className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white text-red-700 border border-red-200">
                  {p.name} <span className="mr-2 font-bold bg-red-100 px-2 py-0.5 rounded-full">{p.stock} {p.isWeighed ? 'کگم' : 'دانە'}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-100 flex">
          <button
            onClick={() => setActiveTab('stock')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${
              activeTab === 'stock'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            ستۆکی ئێستا
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 py-4 text-sm font-bold text-center border-b-2 transition-colors ${
              activeTab === 'history'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            مێژووی گۆگا
          </button>
        </div>

        {activeTab === 'stock' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">کالا</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">جۆر</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">ستۆک</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">تێچوو</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">نرخی فرۆشتن</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">کۆی تێچوو</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
                ) : products.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">هیچ کالایەک نییە</td></tr>
                ) : (
                  products.map(product => (
                    <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {product.isWeighed ? 'بە کێش' : 'بە دانە'}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`font-bold ${product.stock <= 10 ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock} {product.isWeighed ? 'کگم' : 'دانە'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{(product.costPrice || 0).toLocaleString()} IQD</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{product.price.toLocaleString()} IQD</td>
                      <td className="px-6 py-4 font-medium text-indigo-600">
                        {((product.costPrice || 0) * product.stock).toLocaleString()} IQD
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">بەروار</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">کالا</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">جۆر</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">بڕ</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">ستۆکی نوێ</th>
                  <th className="px-6 py-3 text-sm font-medium text-gray-500">تێبینی</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
                ) : history.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-500">هیچ مێژوویەک نییە</td></tr>
                ) : (
                  history.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {item.createdAt?.toDate().toLocaleString('ku-IQ')}
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900">{item.productName}</td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${item.type === 'add' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {item.type === 'add' ? 'زیادکردن' : 'کەمکردن'}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-900" dir="ltr">
                        {item.type === 'add' ? '+' : '-'}{item.amount} {products.find(p => p.id === item.productId)?.isWeighed ? 'کگم' : 'دانە'}
                      </td>
                      <td className="px-6 py-4 text-gray-500">{item.newStock} {products.find(p => p.id === item.productId)?.isWeighed ? 'کگم' : 'دانە'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500">{item.note || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Stock Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">زیادکردنی ستۆک</h2>
            </div>
            <form onSubmit={handleAddStock} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">هەڵبژاردنی کالا</label>
                <select
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  onChange={(e) => setSelectedProduct(products.find(p => p.id === e.target.value))}
                  value={selectedProduct?.id || ''}
                >
                  <option value="" disabled>کالایەک هەڵبژێرە...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (ستۆکی ئێستا: {p.stock} {p.isWeighed ? 'کگم' : 'دانە'})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">بڕی زیادکراو {selectedProduct?.isWeighed ? '(کگم)' : '(دانە)'}</label>
                <input
                  type="number"
                  required
                  min="0.001"
                  step={selectedProduct?.isWeighed ? "0.001" : "1"}
                  value={addAmount}
                  onChange={(e) => setAddAmount(Number(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تێبینی (ئارەزوومەندانە)</label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="بۆ نموونە: کڕینی نوێ لە کۆمپانیا..."
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={loading || !selectedProduct || addAmount <= 0}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'چاوەڕێبە...' : 'زیادکردن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
