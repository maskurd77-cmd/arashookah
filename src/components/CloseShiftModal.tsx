import React, { useState, useEffect } from 'react';
import { useShift } from '../context/ShiftContext';
import { Send, AlertTriangle, Square, CheckCircle2, Clock, DollarSign, ShoppingBag, CreditCard, Smartphone, Wallet, Lock, X } from 'lucide-react';
import { collection, query, where, Timestamp, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';

interface CloseShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CloseShiftModal: React.FC<CloseShiftModalProps> = ({ isOpen, onClose }) => {
  const { activeShift, closeShift } = useShift();
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [endingNotes, setEndingNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [stats, setStats] = useState({
    salesCount: 0,
    totalSales: 0,
    cashSales: 0,
    debtSales: 0,
    fibSales: 0,
    totalExpenses: 0,
    expectedCash: 0,
  });

  useEffect(() => {
    if (!isOpen || !activeShift) return;

    const fetchShiftStats = async () => {
      setStatsLoading(true);
      setErrorMsg(null);

      const startTimeStamp = activeShift.startTime
        ? (activeShift.startTime.toDate ? activeShift.startTime.toDate() : new Date(activeShift.startTime))
        : new Date();

      try {
        // Query sales since shift startTime
        const salesQ = query(
          collection(db, 'sales'),
          where('createdAt', '>=', Timestamp.fromDate(startTimeStamp))
        );

        // Query expenses since shift startTime
        const expQ = query(
          collection(db, 'expenses'),
          where('createdAt', '>=', Timestamp.fromDate(startTimeStamp))
        );

        const [salesSnap, expSnap] = await Promise.all([
          getDocs(salesQ),
          getDocs(expQ)
        ]);

        let salesCount = salesSnap.docs.length;
        let totalSales = 0;
        let cashSales = 0;
        let debtSales = 0;
        let fibSales = 0;

        salesSnap.docs.forEach((doc) => {
          const d = doc.data();
          const tot = d.total || 0;
          totalSales += tot;
          if (d.paymentMethod === 'cash') cashSales += tot;
          else if (d.paymentMethod === 'debt') debtSales += tot;
          else if (d.paymentMethod === 'fib') fibSales += tot;
          else cashSales += tot;
        });

        let totalExpenses = expSnap.docs.reduce((acc, curr) => acc + (curr.data().amount || 0), 0);

        const expectedCash = (activeShift.startingCash || 0) + cashSales - totalExpenses;

        setStats({
          salesCount,
          totalSales,
          cashSales,
          debtSales,
          fibSales,
          totalExpenses,
          expectedCash
        });
      } catch (err) {
        console.error("Error calculating shift summary:", err);
      } finally {
        setStatsLoading(false);
      }
    };

    fetchShiftStats();
  }, [isOpen, activeShift]);

  if (!isOpen || !activeShift) return null;

  const handleCloseShift = async () => {
    setLoading(true);
    setErrorMsg(null);

    const res = await closeShift(endingNotes);

    setLoading(false);
    if (res.success) {
      alert("✅ شەفت بە سەرکەوتوویی داخرا و ڕاپۆرت ڕەوانەی تێلیگرام کراوە!");
      onClose();
    } else {
      setErrorMsg(res.error || "کێشەیەک لە داخستنی شەفت ڕوویدا");
    }
  };

  const startTimeFormatted = activeShift.startTime
    ? (activeShift.startTime.toDate ? activeShift.startTime.toDate().toLocaleString('ku-IQ', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString())
    : 'نادیار';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-pink-700 p-6 text-white relative">
          <button 
            onClick={onClose}
            className="absolute left-4 top-4 p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
          >
            <X size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Square className="text-white fill-white/20" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black">داخستنی شەفت و ناردنی ڕاپۆرت</h2>
              <p className="text-rose-100 text-sm mt-0.5 font-medium">
                شەفتی: {activeShift.userName} ({startTimeFormatted})
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-2xl text-rose-800 text-sm font-bold flex flex-col gap-1">
              <div className="flex items-center gap-2 text-rose-600 font-black">
                <AlertTriangle size={20} />
                <span>شەفتەکە نادۆزرێتەوە یان تێلیگرام کێشەی هەیە!</span>
              </div>
              <p className="text-xs text-rose-700 whitespace-pre-line mt-1">{errorMsg}</p>
            </div>
          )}

          {statsLoading ? (
            <div className="py-12 text-center text-gray-500 font-bold">خەمڵاندن و کۆکردنەوەی ئاماری شەفت...</div>
          ) : (
            <>
              {/* Mandatory Notice */}
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-xs font-bold">
                <Send className="text-amber-600 shrink-0" size={20} />
                <span>
                  سیستەم بەشێوەی ناچاری ڕاپۆرتی بەراوردی ئەم شەفتە دەنێرێت بۆ تێلیگرام پێش ئەوەی ڕێگە بدات شەفتەکە دابخەیت.
                </span>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-bold block mb-1">پارەی سەرەتایی قاسە</span>
                  <span className="text-lg font-black text-gray-800">
                    {(activeShift.startingCash || 0).toLocaleString()} <span className="text-xs text-gray-400">IQD</span>
                  </span>
                </div>

                <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                  <span className="text-xs text-gray-500 font-bold block mb-1">ژمارەی فرۆشتنەکان</span>
                  <span className="text-lg font-black text-indigo-600">
                    {stats.salesCount} <span className="text-xs text-gray-400">وەسڵ</span>
                  </span>
                </div>

                <div className="bg-emerald-50/60 p-3.5 rounded-2xl border border-emerald-100">
                  <span className="text-xs text-emerald-700 font-bold block mb-1">کۆی فرۆشی نەقد</span>
                  <span className="text-lg font-black text-emerald-600">
                    {stats.cashSales.toLocaleString()} <span className="text-xs text-emerald-500">IQD</span>
                  </span>
                </div>

                <div className="bg-orange-50/60 p-3.5 rounded-2xl border border-orange-100">
                  <span className="text-xs text-orange-700 font-bold block mb-1">کۆی فرۆشی قەرز</span>
                  <span className="text-lg font-black text-orange-600">
                    {stats.debtSales.toLocaleString()} <span className="text-xs text-orange-500">IQD</span>
                  </span>
                </div>

                <div className="bg-rose-50/60 p-3.5 rounded-2xl border border-rose-100">
                  <span className="text-xs text-rose-700 font-bold block mb-1">کۆی خەرجییەکان</span>
                  <span className="text-lg font-black text-rose-600">
                    {stats.totalExpenses.toLocaleString()} <span className="text-xs text-rose-500">IQD</span>
                  </span>
                </div>

                <div className="bg-indigo-50 p-3.5 rounded-2xl border border-indigo-100">
                  <span className="text-xs text-indigo-700 font-bold block mb-1">کۆی گشتی فرۆشراو</span>
                  <span className="text-lg font-black text-indigo-700">
                    {stats.totalSales.toLocaleString()} <span className="text-xs text-indigo-500">IQD</span>
                  </span>
                </div>
              </div>

              {/* Expected Net Cash Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl text-emerald-950 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-emerald-700 block">پێشبینیکراوی پێویستی نەقد لە قاسەدا</span>
                  <span className="text-xs text-emerald-600 font-medium">(پارەی سەرەتایی + نەقد - خەرجی)</span>
                </div>
                <div className="text-2xl font-black text-emerald-700 dir-ltr">
                  {stats.expectedCash.toLocaleString()} <span className="text-xs">IQD</span>
                </div>
              </div>

              {/* Ending Notes */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">
                  تێبینی کۆتایی شەفت (ئارەزوومەندانە)
                </label>
                <textarea
                  value={endingNotes}
                  onChange={(e) => setEndingNotes(e.target.value)}
                  placeholder="تێبینی، کێشە، یان جیاوازی پارە لە قاسە هەبێت بنووسە..."
                  rows={2}
                  className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-sm focus:bg-white focus:border-rose-500 focus:outline-none transition-all resize-none"
                />
              </div>
            </>
          )}

          {/* Modal Actions */}
          <div className="pt-2 flex items-center gap-3">
            <button
              onClick={handleCloseShift}
              disabled={loading || statsLoading}
              className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white font-black text-base rounded-2xl shadow-lg shadow-rose-600/20 hover:shadow-rose-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <span>دەنێردرێت بۆ تێلیگرام و دادەخرێت...</span>
              ) : (
                <>
                  <Send size={20} />
                  <span>ناردنی ڕاپۆرت بۆ تێلیگرام &amp; داخستنی شەفت</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-2xl transition-colors"
            >
              داخستن
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
