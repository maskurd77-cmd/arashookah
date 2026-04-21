import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { db, auth, firebaseConfig } from '../firebase';
import { Plus, Trash2, Shield, User } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';

import { useAuth } from '../context/AuthContext';

export default function Users() {
  const { setShowFirebaseSetup } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
  });

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(collection(db, 'users'), (querySnapshot) => {
      setUsers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching users:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      // Create a secondary app to avoid logging out the admin
      const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
      const secondaryAuth = getAuth(secondaryApp);
      
      const userCredential = await createUserWithEmailAndPassword(secondaryAuth, formData.email, formData.password);
      
      // Sign out the secondary app immediately
      await signOut(secondaryAuth);
      
      // Use the main db (where admin is still logged in) to create the user doc
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        name: formData.name,
        email: formData.email,
        role: formData.role,
        createdAt: new Date().toISOString(),
      });

      setIsModalOpen(false);
      setFormData({ name: '', email: '', password: '', role: 'cashier' });
    } catch (error: any) {
      console.error("Error adding user:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else if (error.code === 'auth/email-already-in-use') {
        alert("ئەم ئیمەیڵە پێشتر بەکارهاتووە. تکایە ئیمەیڵێکی تر بەکاربهێنە.");
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی زیادکردنی بەکارهێنەر");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setUserToDelete(id);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await deleteDoc(doc(db, 'users', userToDelete));
    } catch (error: any) {
      console.error("Error deleting user:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
    }
  };

  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    manager: 'bg-blue-100 text-blue-700',
    cashier: 'bg-green-100 text-green-700',
  };

  const roleLabels: Record<string, string> = {
    admin: 'ئەدمین',
    manager: 'بەڕێوەبەر',
    cashier: 'کاشێر',
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">بەکارهێنەران</h1>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors"
        >
          <Plus size={20} />
          بەکارهێنەری نوێ
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ناو</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ئیمەیڵ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ڕۆڵ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-8 text-gray-500">هیچ بەکارهێنەرێک نییە</td></tr>
              ) : (
                users.map(user => (
                  <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                          {user.name.charAt(0)}
                        </div>
                        <span className="font-medium text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500" dir="ltr">{user.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 w-max ${roleColors[user.role]}`}>
                        {user.role === 'admin' ? <Shield size={14} /> : <User size={14} />}
                        {roleLabels[user.role]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleDelete(user.id)}
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
      </div>

      {/* Add User Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-xl font-bold text-gray-900">زیادکردنی بەکارهێنەری نوێ</h2>
            </div>
            <form onSubmit={handleAddUser} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ناو</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ئیمەیڵ</label>
                <input
                  type="email"
                  required
                  dir="ltr"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">وشەی نهێنی</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={formData.password}
                  onChange={(e) => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ڕۆڵ</label>
                <select
                  required
                  value={formData.role}
                  onChange={(e) => setFormData({...formData, role: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="admin">ئەدمین</option>
                  <option value="manager">بەڕێوەبەر</option>
                  <option value="cashier">کاشێر</option>
                </select>
              </div>
              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {loading ? 'چاوەڕێبە...' : 'زیادکردن'}
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
        title="سڕینەوەی بەکارهێنەر"
        message="دڵنیایت لە سڕینەوەی ئەم بەکارهێنەرە؟ ئەم کردارە ناگەڕێتەوە."
      />
    </div>
  );
}
