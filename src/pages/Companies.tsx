import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Building2 } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';

export default function Companies() {
  const { setShowFirebaseSetup } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [name, setName] = useState('');
  const [companyToDelete, setCompanyToDelete] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(fetched);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching companies:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      if (editingCompany) {
        await updateDoc(doc(db, 'companies', editingCompany.id), { name });
      } else {
        await addDoc(collection(db, 'companies'), { name, createdAt: serverTimestamp() });
      }
      setIsModalOpen(false);
      setName('');
      setEditingCompany(null);
    } catch (error: any) {
      console.error("Error saving company:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
    }
  };

  const openEditModal = (company: any) => {
    setEditingCompany(company);
    setName(company.name);
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (companyToDelete) {
      try {
        await deleteDoc(doc(db, 'companies', companyToDelete));
      } catch (error: any) {
        console.error("Error deleting company:", error);
        if (error.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      } finally {
        setCompanyToDelete(null);
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Building2 className="text-indigo-600" />
          شەریکەکان
        </h1>
        <button
          onClick={() => {
            setEditingCompany(null);
            setName('');
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          شەریکەی نوێ
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-right">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="px-6 py-4 text-sm font-medium text-gray-500">ناوی شەریکە</th>
              <th className="px-6 py-4 text-sm font-medium text-gray-500 w-32 text-center">کردارەکان</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={2} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
            ) : companies.length === 0 ? (
              <tr><td colSpan={2} className="text-center py-8 text-gray-500">هیچ شەریکەیەک نییە</td></tr>
            ) : (
              companies.map(company => (
                <tr key={company.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-gray-900">{company.name}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => openEditModal(company)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit size={18} />
                      </button>
                      <button
                        onClick={() => setCompanyToDelete(company.id)}
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

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold mb-4">
              {editingCompany ? 'دەستکاریکردنی شەریکە' : 'زیادکردنی شەریکە'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ناوی شەریکە</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="ناوی شەریکە بنووسە..."
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  پاشەکەوتکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!companyToDelete}
        onClose={() => setCompanyToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی شەریکە"
        message="دڵنیایت لە سڕینەوەی ئەم شەریکەیە؟ ئەم کردارە پاشگەزبوونەوەی تێدا نییە."
      />
    </div>
  );
}
