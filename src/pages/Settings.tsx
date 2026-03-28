import React, { useState, useEffect } from 'react';
import { doc, setDoc, collection, getDocs, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { Save, Store, Phone, MapPin, AlertTriangle, Trash2, Lock, Download, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';

export default function Settings() {
  const { setShowFirebaseSetup } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [settings, setSettings] = useState({
    shopName: 'aras hookah shop',
    phone: '',
    address: '',
    receiptFooter: 'Powered By Mas Menu',
    pinCode: '',
    telegramBotToken: '',
    telegramChatId: '',
  });
  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [collectionToClear, setCollectionToClear] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);

  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setSettings(docSnap.data() as any);
      }
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching settings:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const collectionsToBackup = ['products', 'sales', 'debts', 'inventoryHistory', 'expenses', 'settings', 'users'];
      const backupData: Record<string, any> = {};

      for (const collName of collectionsToBackup) {
        const querySnapshot = await getDocs(collection(db, collName));
        backupData[collName] = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backupData));
      const downloadAnchorNode = document.createElement('a');
      downloadAnchorNode.setAttribute("href", dataStr);
      downloadAnchorNode.setAttribute("download", `backup-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      alert('باکئاپ بە سەرکەوتوویی وەرگیرا');
    } catch (error) {
      console.error("Backup error:", error);
      alert('هەڵەیەک ڕوویدا لە کاتی باکئاپکردن');
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleRestore = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!window.confirm('ئایا دڵنیایت دەتەوێت ئەم باکئاپە بگەڕێنیتەوە؟ داتاکانی ئێستا دەسڕێنەوە و دەگۆڕدرێن بەم داتایانە.')) {
      event.target.value = '';
      return;
    }

    setIsRestoring(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const backupData = JSON.parse(content);
          
          for (const collName of Object.keys(backupData)) {
            const docs = backupData[collName];
            if (Array.isArray(docs)) {
              // 1. Clear existing data in the collection
              const querySnapshot = await getDocs(collection(db, collName));
              let deleteBatch = writeBatch(db);
              let deleteCount = 0;
              for (const document of querySnapshot.docs) {
                deleteBatch.delete(doc(db, collName, document.id));
                deleteCount++;
                if (deleteCount === 450) {
                  await deleteBatch.commit();
                  deleteBatch = writeBatch(db);
                  deleteCount = 0;
                }
              }
              if (deleteCount > 0) {
                await deleteBatch.commit();
              }

              // 2. Restore data
              let restoreBatch = writeBatch(db);
              let restoreCount = 0;
              
              for (const docData of docs) {
                const { id, ...data } = docData;
                
                // Convert {seconds, nanoseconds} back to Date objects
                const restoreTimestamps = (obj: any): any => {
                  if (obj === null || typeof obj !== 'object') return obj;
                  if (obj.seconds !== undefined && obj.nanoseconds !== undefined) {
                    return new Date(obj.seconds * 1000);
                  }
                  if (Array.isArray(obj)) {
                    return obj.map(restoreTimestamps);
                  }
                  const newObj: any = {};
                  for (const key in obj) {
                    newObj[key] = restoreTimestamps(obj[key]);
                  }
                  return newObj;
                };
                
                const restoredData = restoreTimestamps(data);
                restoreBatch.set(doc(db, collName, id), restoredData);
                restoreCount++;

                if (restoreCount === 450) {
                  await restoreBatch.commit();
                  restoreBatch = writeBatch(db);
                  restoreCount = 0;
                }
              }
              if (restoreCount > 0) {
                await restoreBatch.commit();
              }
            }
          }
          alert('داتاکان بە سەرکەوتوویی گەڕێندرانەوە');
        } catch (err) {
          console.error("Error parsing or restoring data:", err);
          alert('هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوەی داتاکان. دڵنیابە لە دروستی فایلەکە.');
        } finally {
          setIsRestoring(false);
          event.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Restore error:", error);
      alert('هەڵەیەک ڕوویدا لە کاتی خوێندنەوەی فایلەکە');
      setIsRestoring(false);
      event.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      alert('ڕێکخستنەکان بە سەرکەوتوویی پاشەکەوت کران');
    } catch (error) {
      console.error("Error saving settings:", error);
      alert('هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
    } finally {
      setSaving(false);
    }
  };

  const handleClearData = async () => {
    if (!collectionToClear) return;
    setClearing(true);
    try {
      const collectionsToClear = collectionToClear === 'all' 
        ? ['products', 'sales', 'debts', 'inventoryHistory'] 
        : [collectionToClear];

      for (const collName of collectionsToClear) {
        const querySnapshot = await getDocs(collection(db, collName));
        const deletePromises = querySnapshot.docs.map(document => deleteDoc(doc(db, collName, document.id)));
        await Promise.all(deletePromises);
      }
      
      setClearModalOpen(false);
      setCollectionToClear(null);
      alert('داتاکان بە سەرکەوتوویی سڕانەوە');
    } catch (error: any) {
      console.error("Error clearing data:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
      }
    } finally {
      setClearing(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-full">بارکردن...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">ڕێکخستنەکان</h1>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Store size={20} className="text-indigo-600" />
            زانیاری دۆکان
          </h2>
          <p className="text-sm text-gray-500 mt-1">ئەم زانیاریانە لەسەر پسوڵە (ریسیپت) دەردەکەون.</p>
        </div>
        
        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ناوی دۆکان</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Store className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  required
                  value={settings.shopName}
                  onChange={(e) => setSettings({...settings, shopName: e.target.value})}
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ژمارەی مۆبایل</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Phone className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  dir="ltr"
                  value={settings.phone}
                  onChange={(e) => setSettings({...settings, phone: e.target.value})}
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ناونیشان</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <MapPin className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={settings.address}
                  onChange={(e) => setSettings({...settings, address: e.target.value})}
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">تێکستی خوارەوەی پسوڵە</label>
              <input
                type="text"
                disabled
                value="Powered By Mas Menu"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-gray-100 text-gray-500 cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">پین کۆدی قفڵکردنی شاشە</label>
              <div className="relative">
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="password"
                  pattern="[0-9]*"
                  inputMode="numeric"
                  placeholder="بۆ نموونە: 1234"
                  value={settings.pinCode || ''}
                  onChange={(e) => setSettings({...settings, pinCode: e.target.value.replace(/\D/g, '')})}
                  className="w-full pl-4 pr-10 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">ئەگەر بەتاڵ بێت، شاشە قفڵ ناکرێت.</p>
            </div>

            <div className="pt-4 border-t border-gray-100">
              <h3 className="text-md font-bold text-gray-900 mb-4">ڕێکخستنەکانی تێلیگرام (Telegram)</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تۆکنی بۆت (Bot Token)</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    value={settings.telegramBotToken || ''}
                    onChange={(e) => setSettings({...settings, telegramBotToken: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ئایدی چات (Chat ID)</label>
                  <input
                    type="text"
                    dir="ltr"
                    placeholder="e.g. -1001234567890"
                    value={settings.telegramChatId || ''}
                    onChange={(e) => setSettings({...settings, telegramChatId: e.target.value})}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-left"
                  />
                  <p className="text-xs text-gray-500 mt-1">ئەگەر ئەم دوو خانەیە پڕبکرێنەوە، سیستەمەکە بە ئۆتۆماتیکی نامە دەنێرێت بۆ تێلیگرام لە کاتی خەرجی و داخستنی ڕۆژ.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 py-3 px-6 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <Save size={20} />
              {saving ? 'چاوەڕێبە...' : 'پاشەکەوتکردن'}
            </button>
          </div>
        </form>
      </div>

      {/* Backup and Restore */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-gray-100 bg-gray-50">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <Save size={20} className="text-indigo-600" />
            باکئاپ و گەڕاندنەوەی داتاکان
          </h2>
          <p className="text-sm text-gray-500 mt-1">پارێزگاری لە داتاکانت بکە بە وەرگرتنی باکئاپ و گەڕاندنەوەی لە کاتی پێویستدا.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={handleBackup}
              disabled={isBackingUp}
              className="flex items-center justify-center gap-3 p-4 bg-indigo-50 border border-indigo-200 rounded-xl hover:bg-indigo-100 transition-colors text-indigo-700 font-bold disabled:opacity-50"
            >
              <Download size={24} />
              {isBackingUp ? 'چاوەڕێبە...' : 'وەرگرتنی باکئاپ (دابەزاندن)'}
            </button>
            
            <label className="flex items-center justify-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors text-emerald-700 font-bold cursor-pointer disabled:opacity-50">
              <Upload size={24} />
              {isRestoring ? 'چاوەڕێبە...' : 'گەڕاندنەوەی داتاکان (هێنانە ناوەوە)'}
              <input 
                type="file" 
                accept=".json" 
                className="hidden" 
                onChange={handleRestore}
                disabled={isRestoring}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden mt-8">
        <div className="p-6 border-b border-red-100 bg-red-50">
          <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
            <AlertTriangle size={20} />
            ناوچەی مەترسیدار (سڕینەوەی داتا)
          </h2>
          <p className="text-sm text-red-600 mt-1">ئاگاداربە، سڕینەوەی داتاکان پاشگەزبوونەوەی نییە.</p>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              onClick={() => { setCollectionToClear('sales'); setClearModalOpen(true); }}
              className="flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-red-700 font-medium"
            >
              سڕینەوەی هەموو پسوڵەکان (ڕاپۆرتەکان)
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => { setCollectionToClear('products'); setClearModalOpen(true); }}
              className="flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-red-700 font-medium"
            >
              سڕینەوەی هەموو کالایەکان
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => { setCollectionToClear('debts'); setClearModalOpen(true); }}
              className="flex items-center justify-between p-4 border border-red-200 rounded-xl hover:bg-red-50 transition-colors text-red-700 font-medium"
            >
              سڕینەوەی هەموو قەرزەکان
              <Trash2 size={18} />
            </button>
            <button
              onClick={() => { setCollectionToClear('all'); setClearModalOpen(true); }}
              className="flex items-center justify-between p-4 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold"
            >
              سڕینەوەی هەموو داتاکان (بە یەکجاری)
              <AlertTriangle size={18} />
            </button>
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={clearModalOpen}
        onClose={() => { setClearModalOpen(false); setCollectionToClear(null); }}
        onConfirm={handleClearData}
        title="دڵنیایت لە سڕینەوە؟"
        message="ئایا بەڕاستی دەتەوێت ئەم داتایانە بسڕیتەوە؟ ئەم کردارە پاشگەزبوونەوەی نییە و داتاکان بۆ هەمیشە لەدەست دەچن."
        confirmLabel={clearing ? 'دەسڕێتەوە...' : 'بەڵێ، سڕینەوە'}
      />
    </div>
  );
}
