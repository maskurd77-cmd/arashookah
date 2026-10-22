import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, where, Timestamp, doc, getDoc, updateDoc, deleteDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, Calendar, FileText, TrendingUp, DollarSign, CreditCard, Send, Printer, Trash2, Edit2, Lock, ShieldCheck, AlertTriangle, X } from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { sendTelegramMessage } from '../services/telegram';
import { useReactToPrint } from 'react-to-print';
import { ThermalReceipt } from '../components/receipts/ThermalReceipt';
import { A4Receipt } from '../components/receipts/A4Receipt';

export default function Receipts() {
  const { setShowFirebaseSetup, userData } = useAuth();
  const isAdmin = userData?.role === 'admin';

  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [viewMode, setViewMode] = useState<'details' | 'thermal' | 'a4'>('details');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [settings, setSettings] = useState<any>({ shopName: '', phone: '', address: '', receiptFooter: '' });

  // Admin Actions: Delete & Edit Receipt
  const [saleToDelete, setSaleToDelete] = useState<any | null>(null);
  const [isDeletingSale, setIsDeletingSale] = useState(false);
  const [saleToEdit, setSaleToEdit] = useState<any | null>(null);
  const [editCustomerName, setEditCustomerName] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDiscount, setEditDiscount] = useState(0);
  const [isSavingSaleEdit, setIsSavingSaleEdit] = useState(false);

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

  // Admin Action: Delete Sale & Rollback Inventory / Debt
  const handleConfirmDeleteSale = async () => {
    if (!isAdmin || !saleToDelete) return;
    setIsDeletingSale(true);
    try {
      // 1. Revert product stocks (increment back the sold items)
      for (const item of (saleToDelete.items || [])) {
        const prodId = item.originalId || item.id;
        const qty = item.quantity - (item.returnedQuantity || 0);
        if (prodId && qty > 0) {
          const stockToAdd = (item.isWholesale && item.packSize > 1) ? qty * item.packSize : qty;
          await updateDoc(doc(db, 'products', prodId), {
            stock: increment(stockToAdd)
          }).catch(console.error);
        }
      }

      // 2. If it was a debt sale, revert debt from customer
      // Only the unpaid part of the sale (total - paid at the counter) was added to the debt
      if (saleToDelete.paymentMethod === 'debt' && saleToDelete.customerId && saleToDelete.customerId !== 'new') {
        const debtPortion = Math.max(0, (saleToDelete.total || 0) - (saleToDelete.amountPaid || 0));
        if (debtPortion > 0) {
          await updateDoc(doc(db, 'debts', saleToDelete.customerId), {
            totalAmount: increment(-debtPortion),
            remainingAmount: increment(-debtPortion)
          }).catch(console.error);
        }
      }

      // 3. Delete sale document
      await deleteDoc(doc(db, 'sales', saleToDelete.id));

      if (selectedSale?.id === saleToDelete.id) {
        setSelectedSale(null);
      }
      setSaleToDelete(null);
      alert('وەسڵەکە بە سەرکەوتوویی سڕایەوە و کاڵاکان گەڕێندرانەوە بۆ کۆگا.');
    } catch (err: any) {
      console.error(err);
      alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوەی وەسڵ: ' + err.message);
    } finally {
      setIsDeletingSale(false);
    }
  };

  const handleOpenEditSale = (sale: any) => {
    if (!isAdmin) {
      alert('تەنیا ئەدمین دەسەڵاتی دەستکاری هەیە!');
      return;
    }
    setSaleToEdit(sale);
    setEditCustomerName(sale.customerName || '');
    setEditNotes(sale.notes || '');
    setEditDiscount(sale.discount || 0);
  };

  const handleSaveSaleEdit = async () => {
    if (!isAdmin || !saleToEdit) return;
    setIsSavingSaleEdit(true);
    try {
      const subtotal = saleToEdit.subtotal || saleToEdit.total || 0;
      const newTotal = Math.max(0, subtotal - editDiscount + (saleToEdit.additionalCharge || 0));
      const totalDiff = newTotal - (saleToEdit.total || 0);

      await updateDoc(doc(db, 'sales', saleToEdit.id), {
        customerName: editCustomerName,
        notes: editNotes,
        discount: editDiscount,
        total: newTotal,
      });

      // If debt sale, adjust customer debt
      if (saleToEdit.paymentMethod === 'debt' && saleToEdit.customerId && saleToEdit.customerId !== 'new' && totalDiff !== 0) {
        await updateDoc(doc(db, 'debts', saleToEdit.customerId), {
          totalAmount: increment(totalDiff),
          remainingAmount: increment(totalDiff)
        }).catch(console.error);
      }

      setSelectedSale((prev: any) => prev ? {
        ...prev,
        customerName: editCustomerName,
        notes: editNotes,
        discount: editDiscount,
        total: newTotal
      } : null);

      setSaleToEdit(null);
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا لە کاتی دەستکاری وەسڵ: ' + err.message);
    } finally {
      setIsSavingSaleEdit(false);
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

                  {/* Admin Edit Receipt Button */}
                  {isAdmin ? (
                    <button
                      onClick={() => handleOpenEditSale(selectedSale)}
                      className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-amber-100 transition-colors border border-amber-200"
                      title="دەستکاریکردنی وەسڵ"
                    >
                      <Edit2 size={15} />
                      دەستکاری
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-not-allowed border border-gray-200"
                      title="تەنیا ئەدمین دەسەڵاتی دەستکاری هەیە"
                    >
                      <Lock size={13} />
                      دەستکاری
                    </button>
                  )}

                  {/* Admin Delete Receipt Button */}
                  {isAdmin ? (
                    <button
                      onClick={() => setSaleToDelete(selectedSale)}
                      className="px-3 py-1.5 bg-rose-50 text-rose-700 rounded-xl flex items-center gap-1.5 text-xs font-bold hover:bg-rose-100 transition-colors border border-rose-200"
                      title="سڕینەوەی وەسڵ و گەڕاندنەوەی کاڵاکان بۆ کۆگا"
                    >
                      <Trash2 size={15} />
                      سڕینەوە
                    </button>
                  ) : (
                    <button
                      disabled
                      className="px-2.5 py-1.5 bg-gray-100 text-gray-400 rounded-xl flex items-center gap-1.5 text-xs font-medium cursor-not-allowed border border-gray-200"
                      title="تەنیا ئەدمین دەسەڵاتی سڕینەوەی هەیە"
                    >
                      <Lock size={13} />
                      سڕینەوە
                    </button>
                  )}
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

      {/* Delete Receipt Confirmation Modal */}
      {saleToDelete && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-100 text-right animate-in fade-in zoom-in duration-200">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
              <AlertTriangle size={24} />
            </div>

            <h3 className="text-lg font-black text-gray-950 text-center mb-1">
              دڵنیایت لە سڕینەوەی ئەم وەسڵە؟
            </h3>
            <p className="text-xs text-gray-500 text-center mb-4">
              وەسڵی <strong className="text-rose-600">#{saleToDelete.receiptNumber}</strong> - کۆی پارە: <strong className="text-gray-900">{(saleToDelete.total || 0).toLocaleString()} IQD</strong>
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 mb-5 space-y-1 text-right leading-relaxed">
              <div className="font-bold flex items-center gap-1.5 text-amber-800">
                <ShieldCheck size={16} />
                <span>کاریگەریی ئەم سڕینەوەیە:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11.5px] pr-1">
                <li>کاڵاکانی ئەم وەسڵە دەگەڕێندرێنەوە سەر کۆگا و مەخزەن بە تەواوی.</li>
                <li>ئەگەر بە قەرز فرۆشرابێت، بڕی قەرزەکە لەسەر حسابی کڕیار لادەبرێت.</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setSaleToDelete(null)}
                disabled={isDeletingSale}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs transition-colors"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteSale}
                disabled={isDeletingSale}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs transition-colors flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                {isDeletingSale ? 'سڕینەوە...' : 'بەڵێ، سڕینەوەی وەسڵ'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Receipt Modal */}
      {saleToEdit && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-gray-100 text-right animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-base font-black text-gray-900 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-amber-600" />
                  دەستکاریکردنی وەسڵی #{saleToEdit.receiptNumber}
                </h3>
                <p className="text-xs text-gray-400">تایبەت بە بەڕێوەبەر (ئەدمین)</p>
              </div>
              <button onClick={() => setSaleToEdit(null)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">ناوی کڕیار</label>
                <input
                  type="text"
                  value={editCustomerName}
                  onChange={(e) => setEditCustomerName(e.target.value)}
                  placeholder="ناوی کڕیار بنووسە..."
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">داشکاندن (IQD)</label>
                <input
                  type="number"
                  min="0"
                  value={editDiscount}
                  onChange={(e) => setEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full py-2.5 px-3 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="تێبینی بنووسە..."
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex justify-between items-center text-xs">
                <span className="font-bold text-amber-900">کۆی گشتی نوێ:</span>
                <span className="font-black text-amber-800 font-mono text-sm">
                  {Math.max(0, (saleToEdit.subtotal || saleToEdit.total || 0) - editDiscount + (saleToEdit.additionalCharge || 0)).toLocaleString()} IQD
                </span>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100 mt-4">
              <button
                type="button"
                onClick={() => setSaleToEdit(null)}
                disabled={isSavingSaleEdit}
                className="flex-1 py-2.5 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-bold text-xs"
              >
                پاشگەزبوونەوە
              </button>
              <button
                type="button"
                onClick={handleSaveSaleEdit}
                disabled={isSavingSaleEdit}
                className="flex-1 py-2.5 px-4 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-black text-xs shadow-sm flex items-center justify-center gap-1.5"
              >
                {isSavingSaleEdit ? 'پاشەکەوتکردن...' : 'پاشەکەوتکردن'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
