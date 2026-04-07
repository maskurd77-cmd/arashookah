import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Calendar, FileText, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function Receipts() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSale, setSelectedSale] = useState<any>(null);

  useEffect(() => {
    const start = Timestamp.fromDate(startOfDay(selectedDate));
    const end = Timestamp.fromDate(endOfDay(selectedDate));

    const q = query(
      collection(db, 'sales'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setSales(salesData);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching receipts:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedDate, setShowFirebaseSetup]);

  const filteredSales = sales.filter(sale => 
    sale.receiptNumber?.toString().includes(searchTerm) ||
    sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const calculateSaleCost = (sale: any) => {
    return sale.items?.reduce((itemAcc: number, item: any) => {
      let itemCost = 0;
      const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQuantity <= 0) return itemAcc;
      
      if (item.isWholesale) {
        itemCost = (item.wholesaleCost || (item.costPrice * (item.packSize || 1))) * effectiveQuantity;
      } else {
        itemCost = (item.costPrice || 0) * effectiveQuantity;
      }
      return itemAcc + itemCost;
    }, 0) || 0;
  };

  const calculateSaleProfit = (sale: any) => {
    const cost = calculateSaleCost(sale);
    return sale.total - cost;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">وەسڵەکان</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: List */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
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
            <div className="relative">
              <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="date"
                className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                value={format(selectedDate, 'yyyy-MM-dd')}
                onChange={(e) => setSelectedDate(new Date(e.target.value))}
              />
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-280px)]">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
              <h2 className="font-bold text-gray-700">لیستی وەسڵەکان</h2>
              <span className="text-sm bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg font-bold">{filteredSales.length} وەسڵ</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {loading ? (
                <p className="text-center text-gray-500 py-4">بارکردن...</p>
              ) : filteredSales.length === 0 ? (
                <p className="text-center text-gray-500 py-4">هیچ وەسڵێک نەدۆزرایەوە بۆ ئەم بەروارە</p>
              ) : (
                filteredSales.map(sale => {
                  const profit = calculateSaleProfit(sale);
                  return (
                    <button
                      key={sale.id}
                      onClick={() => setSelectedSale(sale)}
                      className={`w-full text-right p-4 rounded-xl border transition-all ${
                        selectedSale?.id === sale.id 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-900">#{sale.receiptNumber}</span>
                        <span className="text-xs text-gray-500">
                          {sale.createdAt ? format(sale.createdAt.toDate(), 'HH:mm') : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm mb-2">
                        <span className="text-gray-600 truncate max-w-[120px]">{sale.customerName || 'کڕیاری گشتی'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          sale.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-700' : 'bg-orange-100 text-orange-700'
                        }`}>
                          {sale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-gray-100/50">
                        <span className="font-bold text-indigo-600">{sale.total.toLocaleString()} IQD</span>
                        <span className={`text-xs font-bold flex items-center gap-1 ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {profit >= 0 ? '+' : ''}{profit.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Details */}
        <div className="lg:col-span-2">
          {selectedSale ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-140px)]">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <FileText className="text-indigo-600" />
                    وەسڵ #{selectedSale.receiptNumber}
                  </h2>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{selectedSale.createdAt ? format(selectedSale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="font-medium text-gray-700">{selectedSale.customerName || 'کڕیاری گشتی'}</span>
                  </div>
                </div>
                <div className={`px-4 py-2 rounded-xl flex items-center gap-2 font-bold ${
                  selectedSale.paymentMethod === 'cash' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                }`}>
                  {selectedSale.paymentMethod === 'cash' ? <DollarSign size={18} /> : <CreditCard size={18} />}
                  {selectedSale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">کۆی گشتی</p>
                    <p className="text-xl font-bold text-gray-900">{selectedSale.subtotal?.toLocaleString() || selectedSale.total.toLocaleString()} IQD</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                    <p className="text-sm text-gray-500 mb-1">داشکاندن</p>
                    <p className="text-xl font-bold text-red-600">{selectedSale.discount?.toLocaleString() || 0} IQD</p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                    <p className="text-sm text-indigo-600 mb-1">کۆی کۆتایی</p>
                    <p className="text-xl font-bold text-indigo-700">{selectedSale.total.toLocaleString()} IQD</p>
                  </div>
                  <div className={`${calculateSaleProfit(selectedSale) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} p-4 rounded-xl border`}>
                    <p className={`text-sm mb-1 ${calculateSaleProfit(selectedSale) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>قازانج</p>
                    <p className={`text-xl font-bold flex items-center gap-2 ${calculateSaleProfit(selectedSale) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      <TrendingUp size={20} />
                      {calculateSaleProfit(selectedSale).toLocaleString()} IQD
                    </p>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-gray-800 mb-4">کاڵاکان</h3>
                <div className="border border-gray-100 rounded-xl overflow-hidden">
                  <table className="w-full text-right">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">کاڵا</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">نرخ</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">دانە</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-500">کۆ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {selectedSale.items?.map((item: any, index: number) => {
                        const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
                        return (
                          <tr key={index} className={effectiveQuantity <= 0 ? 'bg-red-50/50 opacity-60' : ''}>
                            <td className="px-4 py-3">
                              <div className="font-medium text-gray-900">{item.name}</div>
                              {item.isWholesale && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 inline-block">جملە</span>}
                              {item.returnedQuantity > 0 && (
                                <div className="text-xs text-red-500 mt-1">گەڕاوە: {item.returnedQuantity}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 text-gray-600">
                              {item.isGift ? 'دیاری' : (item.isWholesale ? item.wholesalePrice || item.price : item.price).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 font-medium">
                              {effectiveQuantity}
                            </td>
                            <td className="px-4 py-3 font-bold text-gray-900">
                              {item.isGift ? '0' : ((item.isWholesale ? item.wholesalePrice || item.price : item.price) * effectiveQuantity).toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-gray-400">
              <FileText size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-medium">وەسڵێک هەڵبژێرە بۆ بینینی وردەکاری</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
