import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, limit, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useShift, Shift } from '../context/ShiftContext';
import { StartShiftModal } from '../components/StartShiftModal';
import { CloseShiftModal } from '../components/CloseShiftModal';
import { 
  Clock, Play, Square, Send, DollarSign, User, Calendar, CheckCircle2, AlertCircle, RefreshCw, Search, FileText, ShoppingBag, ArrowUpRight 
} from 'lucide-react';

export default function Shifts() {
  const { activeShift, openStartModal, setOpenStartModal, openCloseModal, setOpenCloseModal, sendShiftReportToTelegram } = useShift();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const q = query(
      collection(db, 'shifts'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as Shift[];
      setShifts(docs);
      setLoading(false);
    }, (err) => {
      console.warn("Error fetching shifts history:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleReSendTelegram = async (shift: Shift) => {
    setSendingId(shift.id);
    const res = await sendShiftReportToTelegram(shift);
    setSendingId(null);

    if (res.success) {
      alert("✅ ڕاپۆرتی ئەم شەفتە سەرکەوتووانە نێردرا بۆ تێلیگرام.");
    } else {
      alert(`❌ هەڵە لە ناردنی تێلیگرام: ${res.error}`);
    }
  };

  const filteredShifts = shifts.filter(s => 
    s.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.userRole?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-7xl mx-auto space-y-8 p-2 sm:p-4 text-right" dir="rtl">
      {/* Modals */}
      <StartShiftModal isOpen={openStartModal} onClose={() => setOpenStartModal(false)} />
      <CloseShiftModal isOpen={openCloseModal} onClose={() => setOpenCloseModal(false)} />

      {/* Top Header Banner */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Clock size={36} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900">بەڕێوەبردنی شەفتەکان</h1>
            <p className="text-gray-500 text-sm mt-1">
              کۆنتڕۆڵی دەستپێکردن، داخستن و ناردنی ڕاپۆرتی ڕاستەوخۆی شەفتەکان بۆ تێلیگرام
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {activeShift ? (
            <button
              onClick={() => setOpenCloseModal(true)}
              className="flex-1 md:flex-none px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Square size={20} className="fill-white/30" />
              <span>داخستنی شەفتی بەکار</span>
            </button>
          ) : (
            <button
              onClick={() => setOpenStartModal(true)}
              className="flex-1 md:flex-none px-6 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold transition-all shadow-md flex items-center justify-center gap-2"
            >
              <Play size={20} className="fill-white" />
              <span>دەستپێکردنی شەفتی نوێ</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Widget */}
      {activeShift ? (
        <div className="bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-full text-xs font-black flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  شەفتی چالاک
                </span>
                <span className="text-gray-300 text-xs font-medium">
                  کاتی دەستپێکردن: {activeShift.startTime ? (activeShift.startTime.toDate ? activeShift.startTime.toDate().toLocaleString('ku-IQ') : 'نادیار') : 'نوێ'}
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-3">
                <User className="text-indigo-400" size={28} />
                <span>{activeShift.userName}</span>
                <span className="text-sm font-normal text-indigo-200 bg-white/10 px-3 py-1 rounded-xl">
                  {activeShift.userRole}
                </span>
              </h2>
              {activeShift.notes && (
                <p className="text-xs text-indigo-200 bg-white/5 p-2.5 rounded-xl border border-white/10 w-fit">
                  تێبینی: {activeShift.notes}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 bg-white/10 p-4 rounded-2xl border border-white/10 backdrop-blur-md">
              <div className="px-4 border-l border-white/10 text-center">
                <span className="text-xs text-indigo-200 block font-bold mb-0.5">پارەی سەرەتایی</span>
                <span className="text-xl font-black text-emerald-400">
                  {(activeShift.startingCash || 0).toLocaleString()} <span className="text-xs">IQD</span>
                </span>
              </div>

              <div className="px-4 text-center">
                <button
                  onClick={() => setOpenCloseModal(true)}
                  className="px-5 py-2.5 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-black text-sm transition-all shadow-md flex items-center gap-2"
                >
                  <Send size={16} />
                  <span>ڕاپۆرت &amp; داخستن</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-6 text-amber-900 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="text-amber-600 shrink-0" size={32} />
            <div>
              <h3 className="font-bold text-lg">هیچ شەفتێک چالاک نییە!</h3>
              <p className="text-sm text-amber-700">تکایە بۆ دەستپێکردنی تۆمارکردنی فرۆشتنەکان، شەفتێکی نوێ بکەرەوە.</p>
            </div>
          </div>
          <button
            onClick={() => setOpenStartModal(true)}
            className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-bold text-sm shadow-sm transition-all whitespace-nowrap"
          >
            دەستپێکردنی شەفت
          </button>
        </div>
      )}

      {/* Search & History Section */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
            <FileText size={22} className="text-indigo-600" />
            تۆماری شەفتە کۆنەکان
          </h2>

          <div className="relative w-full sm:w-72">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="گەڕان بەپێی کارمەند یان ڕۆڵ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="bg-gray-50 text-gray-600 font-bold border-b border-gray-100">
                <th className="p-4 rounded-r-2xl">کارمەند</th>
                <th className="p-4">کاتی دەستپێکردن</th>
                <th className="p-4">کاتی کۆتایی</th>
                <th className="p-4">پارەی سەرەتایی</th>
                <th className="p-4">کۆی فرۆش</th>
                <th className="p-4">بارودۆخ</th>
                <th className="p-4 rounded-l-2xl text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 font-bold">بارکردن...</td>
                </tr>
              ) : filteredShifts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-400 font-bold">هیچ شەفتێک نەدۆزرایەوە</td>
                </tr>
              ) : (
                filteredShifts.map((shift) => {
                  const isShiftOpen = shift.status === 'open';
                  const startTimeStr = shift.startTime ? (shift.startTime.toDate ? shift.startTime.toDate().toLocaleString('ku-IQ') : 'نادیار') : 'نادیار';
                  const endTimeStr = shift.endTime ? (shift.endTime.toDate ? shift.endTime.toDate().toLocaleString('ku-IQ') : 'نادیار') : '---';

                  return (
                    <tr key={shift.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="p-4 font-bold text-gray-900 flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-black flex items-center justify-center text-xs">
                          {shift.userName ? shift.userName.charAt(0) : 'U'}
                        </div>
                        <div>
                          <span>{shift.userName}</span>
                          <span className="block text-xs font-normal text-gray-400">{shift.userRole}</span>
                        </div>
                      </td>
                      <td className="p-4 font-medium text-gray-700">{startTimeStr}</td>
                      <td className="p-4 font-medium text-gray-700">{endTimeStr}</td>
                      <td className="p-4 font-black text-emerald-600">
                        {(shift.startingCash || 0).toLocaleString()} <span className="text-xs text-gray-400">IQD</span>
                      </td>
                      <td className="p-4 font-black text-indigo-600">
                        {shift.totalSalesAmount !== undefined ? shift.totalSalesAmount.toLocaleString() + ' IQD' : '---'}
                      </td>
                      <td className="p-4">
                        {isShiftOpen ? (
                          <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                            کاتی / چالاک
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-gray-100 text-gray-600 border border-gray-200 rounded-full text-xs font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={12} className="text-gray-400" />
                            داخراو
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleReSendTelegram(shift)}
                          disabled={sendingId === shift.id}
                          className="px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
                          title="دووبارە ناردنی ڕاپۆرت بۆ تێلیگرام"
                        >
                          <Send size={14} />
                          <span>{sendingId === shift.id ? 'دەنێردرێت...' : 'تێلیگرام'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
