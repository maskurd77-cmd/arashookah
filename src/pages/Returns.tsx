import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, getDoc, query, orderBy, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, RotateCcw, AlertTriangle, FileText, Package, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Returns() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('general');

  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(fetchedSales);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching sales:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const filteredSales = sales.filter(sale => 
    (sale.section === activeSection || (!sale.section && activeSection === 'general')) &&
    (sale.receiptNumber?.toString().includes(searchTerm) ||
    sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    // Initialize return items with 0 return quantity
    setReturnItems(sale.items.map((item: any) => ({
      ...item,
      returnQuantity: 0,
      maxReturn: item.quantity - (item.returnedQuantity || 0)
    })));
  };

  const handleReturnQuantityChange = (index: number, quantity: number) => {
    const newReturnItems = [...returnItems];
    const item = newReturnItems[index];
    
    // Ensure quantity is within valid bounds
    const validQuantity = Math.max(0, Math.min(quantity, item.maxReturn));
    newReturnItems[index].returnQuantity = validQuantity;
    
    setReturnItems(newReturnItems);
  };

  const calculateReturnTotal = () => {
    return returnItems.reduce((total, item) => {
      if (item.isGift) return total; // Gifts have no return value
      // Calculate price per unit, considering wholesale
      let pricePerUnit = item.price;
      if (item.isWholesale && item.packSize > 1) {
        pricePerUnit = item.wholesalePrice / item.packSize;
      }
      return total + (pricePerUnit * item.returnQuantity);
    }, 0);
  };

  const handleProcessReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    if (itemsToReturn.length === 0) {
      alert('هیچ کاڵایەک دیاری نەکراوە بۆ گەڕانەوە');
      return;
    }

    setIsProcessing(true);
    try {
      const returnTotal = calculateReturnTotal();

      // 1. Create a return record
      await addDoc(collection(db, 'returns'), {
        saleId: selectedSale.id,
        receiptNumber: selectedSale.receiptNumber,
        items: itemsToReturn.map(item => ({
          id: item.id,
          originalId: item.originalId || item.id,
          name: item.name,
          returnQuantity: item.returnQuantity,
          price: item.price,
          isWholesale: item.isWholesale || false,
          isGift: item.isGift || false,
          packSize: item.packSize || 1,
          wholesalePrice: item.wholesalePrice || 0
        })),
        totalAmount: returnTotal,
        createdAt: serverTimestamp(),
      });

      // 2. Update original sale with returned quantities and new totals
      const updatedItems = selectedSale.items.map((saleItem: any) => {
        const returnedItem = itemsToReturn.find(i => i.id === saleItem.id);
        if (returnedItem) {
          return {
            ...saleItem,
            returnedQuantity: (saleItem.returnedQuantity || 0) + returnedItem.returnQuantity
          };
        }
        return saleItem;
      });

      const newTotal = Math.max(0, selectedSale.total - returnTotal);
      const newSubtotal = Math.max(0, selectedSale.subtotal - returnTotal);
      
      // If it's a cash sale, amountPaid is the total. If debt, we reduce amountPaid if returnTotal is greater than the remaining debt.
      let newAmountPaid = selectedSale.amountPaid;
      if (selectedSale.paymentMethod === 'cash') {
        newAmountPaid = newTotal;
      } else if (selectedSale.paymentMethod === 'debt') {
        const remainingDebt = selectedSale.total - (selectedSale.amountPaid || 0);
        if (returnTotal > remainingDebt) {
          newAmountPaid = Math.max(0, (selectedSale.amountPaid || 0) - (returnTotal - remainingDebt));
        }
      }

      await updateDoc(doc(db, 'sales', selectedSale.id), {
        items: updatedItems,
        total: newTotal,
        subtotal: newSubtotal,
        amountPaid: newAmountPaid,
        hasReturns: true
      });

      // 3. Update inventory (increment stock)
      for (const item of itemsToReturn) {
        const productId = item.originalId || item.id;
        const productRef = doc(db, 'products', productId);
        
        // Calculate actual quantity to return to stock
        let stockToReturn = item.returnQuantity;
        if (item.isWholesale && item.packSize > 1) {
          stockToReturn = item.returnQuantity * item.packSize;
        }

        await updateDoc(productRef, {
          stock: increment(stockToReturn)
        }).catch(err => console.error("Failed to update inventory for return:", err));
      }

      // 4. Update debt if it was a debt sale
      if (selectedSale.paymentMethod === 'debt' && selectedSale.debtId) {
        const debtRef = doc(db, 'debts', selectedSale.debtId);
        await updateDoc(debtRef, {
          amount: increment(-returnTotal),
          remainingAmount: increment(-returnTotal)
        }).catch(err => console.error("Failed to update debt for return:", err));
      }

      alert('گەڕانەوە بە سەرکەوتوویی ئەنجامدرا');
      setSelectedSale(null);
      setReturnItems([]);
    } catch (error: any) {
      console.error("Error processing return:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('هەڵەیەک ڕوویدا لە کاتی گەڕانەوە');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900">گەڕانەوەی کاڵا</h1>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto max-w-full">
          <button
            onClick={() => {
              setActiveSection('general');
              setSelectedSale(null);
              setReturnItems([]);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeSection === 'general' 
                ? 'bg-indigo-50 text-indigo-700' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            بەشی گشتی
          </button>
          <button
            onClick={() => {
              setActiveSection('shisha');
              setSelectedSale(null);
              setReturnItems([]);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
              activeSection === 'shisha' 
                ? 'bg-purple-50 text-purple-700' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            بەشی شیشە
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search and Sales List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="گەڕان بەپێی ژمارەی وەسڵ یان ناو..."
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
            <div className="p-4 border-b border-gray-100 bg-gray-50">
              <h2 className="font-bold text-gray-700">وەسڵەکان</h2>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {loading ? (
                <p className="text-center text-gray-500 py-4">بارکردن...</p>
              ) : filteredSales.length === 0 ? (
                <p className="text-center text-gray-500 py-4">هیچ وەسڵێک نەدۆزرایەوە</p>
              ) : (
                filteredSales.map(sale => (
                  <button
                    key={sale.id}
                    onClick={() => handleSelectSale(sale)}
                    className={`w-full text-right p-4 rounded-xl border transition-all ${
                      selectedSale?.id === sale.id 
                        ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                        : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-bold text-gray-900">#{sale.receiptNumber}</span>
                      <span className="text-sm text-gray-500">
                        {sale.createdAt ? format(sale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">{sale.customerName || 'کڕیاری گشتی'}</span>
                      <span className="font-bold text-indigo-600">{sale.total.toLocaleString()} IQD</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Return Details */}
        <div className="lg:col-span-2">
          {selectedSale ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-140px)]">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">وردەکاری وەسڵ #{selectedSale.receiptNumber}</h2>
                  <p className="text-sm text-gray-500">
                    {selectedSale.customerName || 'کڕیاری گشتی'} • {selectedSale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}
                  </p>
                </div>
                <div className="text-left">
                  <p className="text-sm text-gray-500 mb-1">کۆی گشتی وەسڵ</p>
                  <p className="text-xl font-bold text-indigo-600">{selectedSale.total.toLocaleString()} IQD</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <table className="w-full text-right">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">کاڵا</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">نرخ</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">کڕدراو</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">گەڕاوە پێشتر</th>
                      <th className="px-4 py-3 text-sm font-medium text-gray-500">بڕی گەڕانەوە</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {returnItems.map((item, index) => (
                      <tr key={index} className={item.maxReturn === 0 ? 'bg-gray-50 opacity-60' : ''}>
                        <td className="px-4 py-4 font-medium text-gray-900">
                          {item.name}
                          {item.isWholesale && <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full mr-2">کارتۆن</span>}
                          {item.isGift && <span className="text-xs text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full mr-2">هەدیە</span>}
                        </td>
                        <td className="px-4 py-4 text-gray-600">
                          {item.isGift ? '0' : (item.isWholesale ? item.wholesalePrice : item.price).toLocaleString()} IQD
                        </td>
                        <td className="px-4 py-4 text-gray-600">{item.quantity}</td>
                        <td className="px-4 py-4 text-orange-600">{item.returnedQuantity || 0}</td>
                        <td className="px-4 py-4">
                          <input
                            type="number"
                            min="0"
                            max={item.maxReturn}
                            value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                            onChange={(e) => handleReturnQuantityChange(index, Number(e.target.value))}
                            disabled={item.maxReturn === 0}
                            className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                            placeholder="0"
                          />
                          <span className="text-sm text-gray-500 mr-2">لە {item.maxReturn}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-center mb-6">
                  <span className="text-lg font-bold text-gray-700">کۆی پارەی گەڕاوە:</span>
                  <span className="text-2xl font-bold text-red-600">{calculateReturnTotal().toLocaleString()} IQD</span>
                </div>
                
                <button
                  onClick={handleProcessReturn}
                  disabled={isProcessing || calculateReturnTotal() === 0}
                  className="w-full py-4 bg-red-600 text-white rounded-xl font-bold text-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    'پرۆسێس دەکرێت...'
                  ) : (
                    <>
                      <RotateCcw size={24} />
                      گەڕاندنەوەی کاڵا
                    </>
                  )}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-gray-400">
              <RotateCcw size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-medium">وەسڵێک هەڵبژێرە بۆ گەڕانەوە</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
