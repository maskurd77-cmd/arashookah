import React, { useState } from 'react';
import { useShift } from '../context/ShiftContext';
import { Play, DollarSign, FileText, Send, AlertCircle, Clock, ShieldCheck } from 'lucide-react';

interface StartShiftModalProps {
  isOpen: boolean;
  onClose?: () => void;
  isMandatory?: boolean;
}

export const StartShiftModal: React.FC<StartShiftModalProps> = ({
  isOpen,
  onClose,
  isMandatory = false,
}) => {
  const { startShift } = useShift();
  const [startingCash, setStartingCash] = useState<string>('0');
  const [notes, setNotes] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);

    const amount = parseFloat(startingCash) || 0;
    const res = await startShift(amount, notes);

    setLoading(false);
    if (res.success) {
      if (onClose) onClose();
    } else {
      setErrorMsg(res.error || 'کێشەیەک لە دەستپێکردنی شەفت ڕوویدا');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-right" dir="rtl">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-blue-700 p-6 text-white relative">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-white/10 rounded-2xl backdrop-blur-md">
              <Play className="text-emerald-400 fill-emerald-400" size={28} />
            </div>
            <div>
              <h2 className="text-2xl font-black">دەستپێکردنی شەفتی نوێ</h2>
              <p className="text-indigo-100 text-sm mt-0.5 font-medium">
                تکایە بڕی پارەی سەرەتایی قاسە بنووسە بۆ دەستپێکردنی کاری ڕۆژەکە
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 bg-white/10 px-3 py-1.5 rounded-xl text-xs text-indigo-100 w-fit backdrop-blur-sm">
            <Send size={14} className="text-blue-300" />
            <span>نامەی ئاگادارکردنەوە ڕاستەوخۆ دەچێتە تێلیگرام</span>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-rose-700 text-sm font-bold">
              <AlertCircle size={20} className="shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <DollarSign size={18} className="text-emerald-600" />
              بڕی پارەی سەرەتایی لە قاسەدا (دینار / IQD)
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="250"
                required
                value={startingCash}
                onChange={(e) => setStartingCash(e.target.value)}
                placeholder="0"
                className="w-full text-2xl font-black text-emerald-600 bg-gray-50 border-2 border-gray-200 rounded-2xl px-4 py-3 text-left dir-ltr focus:bg-white focus:border-indigo-600 focus:outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">
                IQD
              </span>
            </div>
            {/* Quick cash buttons */}
            <div className="flex gap-2 mt-2">
              {[0, 25000, 50000, 100000, 250000].map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setStartingCash(val.toString())}
                  className="flex-1 py-1.5 bg-gray-100 hover:bg-indigo-50 hover:text-indigo-600 text-gray-600 font-bold text-xs rounded-xl transition-colors border border-gray-200/60"
                >
                  {val === 0 ? 'سفر' : `${(val / 1000).toLocaleString()} هەزار`}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-1.5">
              <FileText size={18} className="text-gray-500" />
              تێبینی سەرەتایی (ئارەزوومەندانە)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تێبینی بۆ ئەم شەفتە هەبێت بنووسە..."
              rows={2}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-2xl p-3 text-sm text-gray-800 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-lg rounded-2xl shadow-lg shadow-emerald-600/20 hover:shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 active:scale-[0.99]"
            >
              {loading ? (
                <span>دەنێردرێت...</span>
              ) : (
                <>
                  <Play size={22} className="fill-white" />
                  <span>دەستپێکردنی شەفت</span>
                </>
              )}
            </button>

            {!isMandatory && onClose && (
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-6 py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-base rounded-2xl transition-colors"
              >
                پاشگەزبوونەوە
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
