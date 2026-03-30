import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Trash2, Wallet, Calendar, Tag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { sendTelegramMessage } from '../services/telegram';

export default function Expenses() {
  const { setShowFirebaseSetup, userData } = useAuth();
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'shisha'>('general');
  const [formData, setFormData] = useState({
    amount: 0,
    category: 'کرێ',
    note: '',
    date: new Date().toISOString().split('T')[0],
    section: 'general'
  });

  const categories = ['کرێ', 'کارەبا', 'ئاو', 'مووچە', 'خواردن', 'هەمەجۆر', 'قەرزی دۆکان'];

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setExpenses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching expenses:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        ...formData,
        section: activeSection,
        createdAt: serverTimestamp()
      });
      
      // Send Telegram Notification
      const sectionName = activeSection === 'general' ? 'گشتی' : 'نێرگەلە';
      const message = `🔴 <b>خەرجییەکی نوێ زیادکرا</b>\n\n` +
                      `💰 <b>بڕ:</b> ${Number(formData.amount).toLocaleString()} IQD\n` +
                      `🏷 <b>جۆر:</b> ${formData.category}\n` +
                      `📝 <b>تێبینی:</b> ${formData.note || 'نییە'}\n` +
                      `🏢 <b>بەش:</b> ${sectionName}\n` +
                      `📅 <b>بەروار:</b> ${formData.date}`;
      
      sendTelegramMessage(message);

      setIsModalOpen(false);
      setFormData({ amount: 0, category: 'کرێ', note: '', date: new Date().toISOString().split('T')[0], section: activeSection });
    } catch (error: any) {
      console.error("Error adding expense:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی زیادکردنی خەرجی");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setExpenseToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!expenseToDelete) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseToDelete));
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  const filteredExpenses = expenses.filter(exp => exp.section === activeSection || (!exp.section && activeSection === 'general'));
  const totalExpenses = filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount), 0);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">خەرجییەکان</h1>
        <button
          onClick={() => {
            setFormData(prev => ({ ...prev, section: activeSection }));
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          <span>خەرجی نوێ</span>
        </button>
      </div>

      <div className="flex gap-4">
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

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کۆی گشتی خەرجییەکان</p>
            <p className="text-3xl font-bold text-red-600">{totalExpenses.toLocaleString()} <span className="text-sm font-normal text-red-600/70">IQD</span></p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">بەروار</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">جۆر</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">بڕی پارە</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">تێبینی</th>
                <th className="px-6 py-4 text-sm font-medium text-gray-500">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : filteredExpenses.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-500">هیچ خەرجییەک نییە</td></tr>
              ) : (
                filteredExpenses.map(expense => (
                  <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-900">{expense.date}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700">
                        <Tag size={12} />
                        {expense.category}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">{Number(expense.amount).toLocaleString()} IQD</td>
                    <td className="px-6 py-4 text-sm text-gray-500">{expense.note || '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleDelete(expense.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="سڕینەوە"
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-gray-900 mb-6">زیادکردنی خەرجی نوێ</h2>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">بڕی پارە (IQD)</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={formData.amount}
                  onChange={e => setFormData({...formData, amount: Number(e.target.value)})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">جۆری خەرجی</label>
                <select
                  value={formData.category}
                  onChange={e => setFormData({...formData, category: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                >
                  {categories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">بەروار</label>
                <input
                  type="date"
                  required
                  value={formData.date}
                  onChange={e => setFormData({...formData, date: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">تێبینی (ئارەزوومەندانە)</label>
                <textarea
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'چاوەڕێ بە...' : 'پاشەکەوتکردن'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={deleteModalOpen}
        onClose={() => setDeleteModalOpen(false)}
        onConfirm={confirmDelete}
        title="سڕینەوەی خەرجی"
        message="دڵنیایت لە سڕینەوەی ئەم خەرجییە؟ ئەم کردارە ناگەڕێتەوە."
      />
    </div>
  );
}
