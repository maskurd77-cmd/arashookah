import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Calendar, FileText, TrendingUp, DollarSign, CreditCard, Send, Printer } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { sendTelegramMessage } from '../services/telegram';
import { useReactToPrint } from 'react-to-print';
import { ThermalReceipt } from '../components/receipts/ThermalReceipt';
import { A4Receipt } from '../components/receipts/A4Receipt';

export default function Receipts() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'details' | 'thermal' | 'a4'>('details');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [settings, setSettings] = useState<any>({ shopName: '', phone: '', address: '', receiptFooter: '' });

  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const a4PrintRef = useRef<HTMLDivElement>(null);

  const handlePrintThermal = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `Receipt-${selectedSale?.receiptNumber || 'print'}`,
  });

  const handlePrintA4 = useReactToPrint({
    contentRef: a4PrintRef,
    documentTitle: `Invoice-${selectedSale?.receiptNumber || 'print'}`,
  });

  useEffect(() => {
    // Load shop settings for receipts
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists()) {
          setSettings(snap.data());
        }
      } catch (err) {
        console.warn("Could not load settings in Receipts:", err);
      }
    };
    fetchSettings();
  }, []);

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

  const handleSendReceiptToTelegram = async (sale: any) => {
    if (!sale) return;
    setIsSendingTelegram(true);
    try {
      let itemsText = '';
      if (sale.items && sale.items.length > 0) {
        itemsText = sale.items.map((item: any) => {
          const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
          const price = item.isGift ? 0 : (item.isWholesale ? item.wholesalePrice || item.price : item.price);
          return `- ${item.name} (${effectiveQuantity}x) = ${(price * effectiveQuantity).toLocaleString()} د.ع`;
        }).join('\n');
      }

      const message = `
🧾 <b>وەسڵی ژمارە:</b> ${sale.receiptNumber}
📅 <b>بەروار:</b> ${sale.createdAt ? format(sale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
👤 <b>کڕیار:</b> ${sale.customerName || 'گشتی'}
💳 <b>جۆری پارەدان:</b> ${sale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}

<b>کاڵاکان:</b>
${itemsText}

💰 <b>کۆی گشتی:</b> ${sale.total.toLocaleString()} دینار
`.trim();

      const res = await sendTelegramMessage(message);
      if (res.success) {
        alert("✅ وەسڵ بە سەرکەوتوویی نێردرا بۆ تێلیگرام.");
      } else {
        alert(`❌ هەڵەیەک ڕوویدا: ${res.error || 'دڵنیابە لە ڕێکخستنەکانی تێلیگرام'}`);
      }
    } catch (error) {
      console.error(error);
      alert("❌ هەڵەیەک ڕوویدا لە ناردنی وەسڵەکە.");
    } finally {
      setIsSendingTelegram(false);
    }
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
              <div className="p-4 sm:p-6 border-b border-gray-100 bg-gray-50 flex flex-wrap gap-3 justify-between items-center">
                <div>
                  <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 flex items-center gap-2">
                    <FileText className="text-indigo-600" />
                    وەسڵ #{selectedSale.receiptNumber}
                  </h2>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-500">
                    <span>{selectedSale.createdAt ? format(selectedSale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300"></span>
                    <span className="font-medium text-gray-700">{selectedSale.customerName || 'کڕیاری گشتی'}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Switcher */}
                  <div className="bg-gray-200/80 p-1 rounded-xl flex gap-1 text-xs font-bold">
                    <button
                      onClick={() => setViewMode('details')}
                      className={`px-2.5 py-1.5 rounded-lg transition-all ${
                        viewMode === 'details' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📊 وردەکاری
                    </button>
                    <button
                      onClick={() => setViewMode('thermal')}
                      className={`px-2.5 py-1.5 rounded-lg transition-all ${
                        viewMode === 'thermal' ? 'bg-white text-indigo-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      🧾 80mm
                    </button>
                    <button
                      onClick={() => setViewMode('a4')}
                      className={`px-2.5 py-1.5 rounded-lg transition-all ${
                        viewMode === 'a4' ? 'bg-white text-slate-950 shadow-xs' : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      📄 A4
                    </button>
                  </div>

                  <button
                    onClick={() => handlePrintThermal()}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-indigo-700 transition-colors shadow-xs active:scale-95"
                  >
                    <Printer size={15} />
                    چاپ (80mm)
                  </button>
                  <button
                    onClick={() => handlePrintA4()}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-slate-800 transition-colors shadow-xs active:scale-95"
                  >
                    <FileText size={15} />
                    چاپ (A4)
                  </button>
                  <button
                    onClick={() => handleSendReceiptToTelegram(selectedSale)}
                    disabled={isSendingTelegram}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl flex items-center gap-1.5 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 border border-blue-200"
                  >
                    <Send size={15} />
                    {isSendingTelegram ? '...' : 'تێلیگرام'}
                  </button>
                </div>
              </div>

              {viewMode === 'details' && (
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 font-bold">کۆی گشتی</p>
                      <p className="text-lg font-black text-gray-900">{selectedSale.subtotal?.toLocaleString() || selectedSale.total.toLocaleString()} IQD</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <p className="text-xs text-gray-500 mb-1 font-bold">داشکاندن</p>
                      <p className="text-lg font-black text-red-600">{selectedSale.discount?.toLocaleString() || 0} IQD</p>
                    </div>
                    <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                      <p className="text-xs text-indigo-600 mb-1 font-bold">کۆی کۆتایی</p>
                      <p className="text-lg font-black text-indigo-700">{selectedSale.total.toLocaleString()} IQD</p>
                    </div>
                    <div className={`${calculateSaleProfit(selectedSale) >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'} p-4 rounded-xl border`}>
                      <p className={`text-xs mb-1 font-bold ${calculateSaleProfit(selectedSale) >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>قازانج</p>
                      <p className={`text-lg font-black flex items-center gap-1.5 ${calculateSaleProfit(selectedSale) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        <TrendingUp size={18} />
                        {calculateSaleProfit(selectedSale).toLocaleString()} IQD
                      </p>
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-gray-800 mb-3">لیستی کاڵاکانی فرۆشراو</h3>
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-gray-100 border-b border-gray-200 font-black">
                        <tr>
                          <th className="px-4 py-3 text-gray-700">کاڵا</th>
                          <th className="px-4 py-3 text-gray-700 text-center">دانە / بڕ</th>
                          <th className="px-4 py-3 text-gray-700 text-center">نرخی دانە</th>
                          <th className="px-4 py-3 text-gray-700 text-left">کۆی نرخ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {selectedSale.items?.map((item: any, index: number) => {
                          const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
                          return (
                            <tr key={index} className={effectiveQuantity <= 0 ? 'bg-red-50/50 opacity-60' : 'hover:bg-gray-50'}>
                              <td className="px-4 py-3">
                                <div className="font-bold text-gray-900">{item.name}</div>
                                {item.isWholesale && <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full mt-1 inline-block font-bold">جملە</span>}
                                {item.returnedQuantity > 0 && (
                                  <div className="text-xs text-red-500 mt-1 font-bold">گەڕاوە: {item.returnedQuantity}</div>
                                )}
                              </td>
                              <td className="px-4 py-3 font-mono font-bold text-center">
                                {effectiveQuantity}
                              </td>
                              <td className="px-4 py-3 text-gray-600 font-mono text-center">
                                {item.isGift ? 'دیاری' : (item.isWholesale ? item.wholesalePrice || item.price : item.price).toLocaleString()}
                              </td>
                              <td className="px-4 py-3 font-bold text-gray-900 font-mono text-left">
                                {item.isGift ? '0' : ((item.isWholesale ? item.wholesalePrice || item.price : item.price) * effectiveQuantity).toLocaleString()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Live Thermal Receipt Preview */}
              {viewMode === 'thermal' && (
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center items-start">
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-300 w-full max-w-[340px] my-2">
                    <ThermalReceipt
                      settings={settings}
                      receiptNumber={selectedSale.receiptNumber}
                      date={selectedSale.createdAt ? selectedSale.createdAt.toDate() : new Date()}
                      paymentMethod={selectedSale.paymentMethod}
                      paymentCurrency={selectedSale.paymentCurrency || 'IQD'}
                      customerName={selectedSale.customerName}
                      customerPhone={selectedSale.customerPhone}
                      items={selectedSale.items || []}
                      subtotal={selectedSale.subtotal || selectedSale.total}
                      discount={selectedSale.discount || 0}
                      additionalCharge={selectedSale.additionalCharge || 0}
                      total={selectedSale.total}
                      amountPaid={selectedSale.amountPaid || 0}
                      amountPaidUsd={selectedSale.amountPaidUsd || 0}
                      usdExchangeRate={selectedSale.usdExchangeRate || settings.usdRate || 1500}
                      previousDebt={selectedSale.previousDebt || 0}
                      cashierName={selectedSale.cashierName}
                      isReprint={true}
                    />
                  </div>
                </div>
              )}

              {/* Live A4 Receipt Preview */}
              {viewMode === 'a4' && (
                <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-slate-200/60 flex justify-center items-start">
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-300 w-full max-w-[794px] my-2">
                    <A4Receipt
                      settings={settings}
                      receiptNumber={selectedSale.receiptNumber}
                      date={selectedSale.createdAt ? selectedSale.createdAt.toDate() : new Date()}
                      paymentMethod={selectedSale.paymentMethod}
                      paymentCurrency={selectedSale.paymentCurrency || 'IQD'}
                      customerName={selectedSale.customerName}
                      customerPhone={selectedSale.customerPhone}
                      items={selectedSale.items || []}
                      subtotal={selectedSale.subtotal || selectedSale.total}
                      discount={selectedSale.discount || 0}
                      additionalCharge={selectedSale.additionalCharge || 0}
                      total={selectedSale.total}
                      amountPaid={selectedSale.amountPaid || 0}
                      amountPaidUsd={selectedSale.amountPaidUsd || 0}
                      usdExchangeRate={selectedSale.usdExchangeRate || settings.usdRate || 1500}
                      previousDebt={selectedSale.previousDebt || 0}
                      cashierName={selectedSale.cashierName}
                      isReprint={true}
                      notes={selectedSale.notes}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-gray-400">
              <FileText size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-medium">وەسڵێک هەڵبژێرە بۆ بینینی وردەکاری</p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Print Components for Reprinting */}
      <div className="hidden">
        {selectedSale && (
          <>
            <ThermalReceipt
              ref={thermalPrintRef}
              settings={settings}
              receiptNumber={selectedSale.receiptNumber}
              date={selectedSale.createdAt ? selectedSale.createdAt.toDate() : new Date()}
              paymentMethod={selectedSale.paymentMethod}
              paymentCurrency={selectedSale.paymentCurrency || 'IQD'}
              customerName={selectedSale.customerName}
              customerPhone={selectedSale.customerPhone}
              items={selectedSale.items || []}
              subtotal={selectedSale.subtotal || selectedSale.total}
              discount={selectedSale.discount || 0}
              additionalCharge={selectedSale.additionalCharge || 0}
              total={selectedSale.total}
              amountPaid={selectedSale.amountPaid || 0}
              amountPaidUsd={selectedSale.amountPaidUsd || 0}
              usdExchangeRate={selectedSale.usdExchangeRate || settings.usdRate || 1500}
              previousDebt={selectedSale.previousDebt || 0}
              cashierName={selectedSale.cashierName}
              isReprint={true}
            />

            <A4Receipt
              ref={a4PrintRef}
              settings={settings}
              receiptNumber={selectedSale.receiptNumber}
              date={selectedSale.createdAt ? selectedSale.createdAt.toDate() : new Date()}
              paymentMethod={selectedSale.paymentMethod}
              paymentCurrency={selectedSale.paymentCurrency || 'IQD'}
              customerName={selectedSale.customerName}
              customerPhone={selectedSale.customerPhone}
              items={selectedSale.items || []}
              subtotal={selectedSale.subtotal || selectedSale.total}
              discount={selectedSale.discount || 0}
              additionalCharge={selectedSale.additionalCharge || 0}
              total={selectedSale.total}
              amountPaid={selectedSale.amountPaid || 0}
              amountPaidUsd={selectedSale.amountPaidUsd || 0}
              usdExchangeRate={selectedSale.usdExchangeRate || settings.usdRate || 1500}
              previousDebt={selectedSale.previousDebt || 0}
              cashierName={selectedSale.cashierName}
              isReprint={true}
              notes={selectedSale.notes}
            />
          </>
        )}
      </div>
    </div>
  );
}
