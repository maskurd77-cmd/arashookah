import React, { useState, useEffect, useRef } from 'react';
import { doc, setDoc, collection, getDocs, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Save, Store, Phone, MapPin, AlertTriangle, Trash2, Lock, 
  Download, Upload, Send, Printer, Eye, DollarSign, 
  Sliders, MessageSquare, ShieldAlert, Sparkles, CheckCircle2,
  FileText, Receipt, Image as ImageIcon, Link as LinkIcon, XCircle, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ThermalReceipt } from '../components/receipts/ThermalReceipt';
import { A4Receipt } from '../components/receipts/A4Receipt';
import { KashfHisabA4 } from '../components/receipts/KashfHisabA4';
import { useReactToPrint } from 'react-to-print';

export default function Settings() {
  const { setShowFirebaseSetup } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [activeTab, setActiveTab] = useState<'store' | 'telegram' | 'backup' | 'danger'>('store');
  const [previewMode, setPreviewMode] = useState<'thermal' | 'a4' | 'kashf'>('thermal');

  const [settings, setSettings] = useState({
    shopName: 'aras hookah shop',
    phone: '',
    address: '',
    receiptHeaderNote: 'بەخێربێن بۆ فرۆشگاکەمان',
    receiptFooter: 'سوپاس بۆ سەردانەکەتان، هەمیشە بەخێربێن',
    pinCode: '1234',
    telegramBotToken: '',
    telegramChatId: '',
    usdRate: 1500,
    receiptSize: '80mm' as '80mm' | 'a4',
    logoUrl: '',
  });

  const [clearModalOpen, setClearModalOpen] = useState(false);
  const [collectionToClear, setCollectionToClear] = useState<string | null>(null);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [testingTelegram, setTestingTelegram] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ success?: boolean; message?: string } | null>(null);
  const [logoInputType, setLogoInputType] = useState<'upload' | 'url'>('upload');

  // Print refs for test print
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const a4PrintRef = useRef<HTMLDivElement>(null);
  const kashfPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintThermal = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `وەسڵی_تاقیکردنەوە_${settings.shopName}`,
  });

  const handlePrintA4 = useReactToPrint({
    contentRef: a4PrintRef,
    documentTitle: `وەسڵی_A4_${settings.shopName}`,
  });

  const handlePrintKashf = useReactToPrint({
    contentRef: kashfPrintRef,
    documentTitle: `کەشفی_حساب_${settings.shopName}`,
  });

  const handleTestPrint = () => {
    if (previewMode === 'thermal') {
      handlePrintThermal();
    } else if (previewMode === 'a4') {
      handlePrintA4();
    } else {
      handlePrintKashf();
    }
  };

  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('تکایە تەنها فایلی وێنە هەڵبژێرە (PNG, JPG, SVG, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const MAX_HEIGHT = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png', 0.9);
          setSettings(prev => ({ ...prev, logoUrl: dataUrl }));
        } else {
          setSettings(prev => ({ ...prev, logoUrl: event.target?.result as string }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setSettings(prev => ({ ...prev, logoUrl: '' }));
  };

  useEffect(() => {
    setLoading(true);
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSettings(prev => ({
          ...prev,
          ...data,
          receiptHeaderNote: data.receiptHeaderNote || prev.receiptHeaderNote,
          receiptFooter: data.receiptFooter || prev.receiptFooter,
          usdRate: data.usdRate || prev.usdRate,
          receiptSize: data.receiptSize || prev.receiptSize,
          logoUrl: data.logoUrl || '',
        }));
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

  const handleTestTelegram = async () => {
    if (!settings.telegramBotToken || !settings.telegramChatId) {
      alert("تکایە سەرەتا تۆکن و ئایدی چات پڕبکەرەوە.");
      return;
    }
    setTestingTelegram(true);
    setTelegramStatus(null);
    try {
      const url = `https://api.telegram.org/bot${settings.telegramBotToken}/sendMessage`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chat_id: settings.telegramChatId,
          text: `🤖 <b>تێستی سیستەمی ${settings.shopName}</b>\n\n✅ پەیوەندی بە سەرکەوتوویی بەسترایەوە!\n📅 کات: ${new Date().toLocaleString('ku-IQ')}`,
          parse_mode: 'HTML',
        }),
      });

      if (response.ok) {
        setTelegramStatus({ success: true, message: 'نامەی تاقیکردنەوە بە سەرکەوتوویی نێردرا بۆ تێلیگرام!' });
      } else {
        const errorText = await response.text();
        setTelegramStatus({ success: false, message: `هەڵە: ${errorText}` });
      }
    } catch (error: any) {
      setTelegramStatus({ success: false, message: `هەڵەی پەیوەندی: ${error.message}` });
    } finally {
      setTestingTelegram(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const collectionsToBackup = ['products', 'sales', 'debts', 'inventoryHistory', 'expenses', 'settings', 'users', 'companies'];
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
      downloadAnchorNode.setAttribute("download", `backup-${settings.shopName.replace(/\s+/g, '_')}-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchorNode);
      downloadAnchorNode.click();
      downloadAnchorNode.remove();
      
      alert('✅ باکئاپ بە سەرکەوتوویی دابەزێندرا.');
    } catch (error) {
      console.error("Backup error:", error);
      alert('❌ هەڵەیەک ڕوویدا لە کاتی باکئاپکردن');
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
              // Clear existing data
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

              // Restore data
              let restoreBatch = writeBatch(db);
              let restoreCount = 0;
              
              for (const docData of docs) {
                const { id, ...data } = docData;
                
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
          alert('✅ داتاکان بە سەرکەوتوویی گەڕێندرانەوە');
        } catch (err) {
          console.error("Error parsing or restoring data:", err);
          alert('❌ هەڵەیەک ڕوویدا لە کاتی گەڕاندنەوەی داتاکان.');
        } finally {
          setIsRestoring(false);
          event.target.value = '';
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error("Restore error:", error);
      alert('❌ هەڵەیەک ڕوویدا لە کاتی خوێندنەوەی فایلەکە');
      setIsRestoring(false);
      event.target.value = '';
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'general'), settings);
      alert('✅ ڕێکخستنەکان و دیزاینی وەسڵ بە سەرکەوتوویی پاشەکەوت کران');
    } catch (error: any) {
      console.error("Error saving settings:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('❌ هەڵەیەک ڕوویدا لە کاتی پاشەکەوتکردن');
      }
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
      alert('✅ داتاکان بە سەرکەوتوویی سڕانەوە');
    } catch (error: any) {
      console.error("Error clearing data:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('❌ هەڵەیەک ڕوویدا لە کاتی سڕینەوە');
      }
    } finally {
      setClearing(false);
    }
  };

  // Sample data for live receipt preview
  const sampleItems = [
    { name: 'نێرگەلە مەحمودی کلاسیک', quantity: 2, price: 15000, isWholesale: false },
    { name: 'فەحم فەست فایەر (کارتۆن)', quantity: 1, price: 28000, isWholesale: true },
    { name: 'شیلە ئەلفاخر بلوبێری', quantity: 3, price: 4000, isWholesale: false },
    { name: 'سەری فەخار ئەسڵی', quantity: 1, price: 3000, isGift: true },
  ];

  const sampleSubtotal = 70000;
  const sampleDiscount = 5000;
  const sampleTotal = 65000;

  const sampleDebtHistory = [
    { type: 'purchase' as const, date: new Date(Date.now() - 86400000 * 3).toISOString(), amount: 120000, receiptNumber: '100412', note: 'کڕینی کاڵای جۆراوجۆر' },
    { type: 'payment' as const, date: new Date(Date.now() - 86400000 * 2).toISOString(), amount: 50000, note: 'واسلکردنی پارەی نەقد' },
    { type: 'purchase' as const, date: new Date(Date.now() - 86400000 * 1).toISOString(), amount: 65000, receiptNumber: '100489', note: 'کڕینی نوێ' },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Sliders className="text-indigo-600" size={28} />
            ڕێکخستنە گشتییەکان و پێشبینی وەسڵ
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            دیزاین و زانیاری دوکانەکەت بگۆڕە و ڕاستەوخۆ لە پەنجەرەی پێشبینیدا سەیری شێوازی وەسڵەکان بکە.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={handleTestPrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-800 rounded-xl font-bold hover:bg-gray-200 transition-colors text-sm"
          >
            <Printer size={18} className="text-indigo-600" />
            تاقیکردنەوەی چاپ
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 text-sm shadow-sm"
          >
            <Save size={18} />
            {saving ? 'پاشەکەوت دەکرێت...' : 'پاشەکەوتکردنی گۆڕانکارییەکان'}
          </button>
        </div>
      </div>

      {/* Main Grid: Form Controls (Left/Col 7) + Live Preview (Right/Col 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Settings Tabs & Inputs */}
        <div className="lg:col-span-7 space-y-6">
          {/* Tabs Navigation */}
          <div className="flex gap-2 bg-gray-100/80 p-1.5 rounded-2xl border border-gray-200">
            <button
              onClick={() => setActiveTab('store')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'store'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Store size={18} />
              ناسنامە و وەسڵ
            </button>

            <button
              onClick={() => setActiveTab('telegram')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'telegram'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Send size={18} />
              تێلیگرام
            </button>

            <button
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'backup'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <Download size={18} />
              باکئاپ
            </button>

            <button
              onClick={() => setActiveTab('danger')}
              className={`flex-1 py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                activeTab === 'danger'
                  ? 'bg-white text-rose-700 shadow-xs'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'
              }`}
            >
              <ShieldAlert size={18} />
              مەترسیدار
            </button>
          </div>

          {/* TAB 1: Store & Receipt Identity */}
          {activeTab === 'store' && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-5">
              <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Store size={20} className="text-indigo-600" />
                  زانیاری دوکان و وەسڵی کڕیار
                </h2>
                <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-lg">
                  پێداچوونەوەی ڕاستەوخۆ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Shop Logo Setting Card */}
                <div className="sm:col-span-2 bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4.5 space-y-3.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-150/70 pb-2.5">
                    <div>
                      <label className="block text-xs font-black text-indigo-950 flex items-center gap-2">
                        <ImageIcon size={17} className="text-indigo-600" />
                        لۆگۆی فەرمی دوکان (بۆ سەرەوەی وەسڵ و راپۆرتەکان)
                      </label>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        ئەم لۆگۆیە بە شێوەی ئۆتۆماتیکی لە سەرەوەی هەموو وەسڵەکان (80mm و A4)، کەشفی حسابات و راپۆرتەکان دەردەکەوێت.
                      </p>
                    </div>

                    {/* Switcher: Upload vs URL */}
                    <div className="flex items-center bg-white/90 p-1 rounded-xl border border-indigo-200 text-xs self-start sm:self-auto">
                      <button
                        type="button"
                        onClick={() => setLogoInputType('upload')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          logoInputType === 'upload'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <Upload size={13} />
                        بارکردنی وێنە
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogoInputType('url')}
                        className={`px-3 py-1 rounded-lg font-bold transition-all flex items-center gap-1.5 ${
                          logoInputType === 'url'
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'text-gray-600 hover:text-gray-900'
                        }`}
                      >
                        <LinkIcon size={13} />
                        بەستەری لینک
                      </button>
                    </div>
                  </div>

                  {/* Logo Preview & Input Actions */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                    {/* Visual Preview Thumbnail Box */}
                    <div className="relative group shrink-0">
                      {settings.logoUrl ? (
                        <div className="w-20 h-20 rounded-2xl bg-white border-2 border-indigo-200 p-1.5 flex items-center justify-center overflow-hidden shadow-xs relative">
                          <img
                            src={settings.logoUrl}
                            alt="Shop Logo"
                            className="w-full h-full object-contain rounded-xl"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = 'https://placehold.co/100x100?text=Logo';
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            title="سڕینەوەی لۆگۆ"
                            className="absolute -top-1.5 -left-1.5 bg-rose-600 text-white p-1 rounded-full shadow-md hover:bg-rose-700 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="w-20 h-20 rounded-2xl bg-white/80 border-2 border-dashed border-indigo-200 flex flex-col items-center justify-center text-indigo-400 gap-1">
                          <ImageIcon size={24} />
                          <span className="text-[10px] font-bold text-gray-400">بێ لۆگۆ</span>
                        </div>
                      )}
                    </div>

                    {/* Inputs based on selected mode */}
                    <div className="flex-1 w-full">
                      {logoInputType === 'upload' ? (
                        <div>
                          <label className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 bg-white border-2 border-dashed border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50/20 cursor-pointer transition-all">
                            <div className="flex items-center gap-3 text-right">
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                <Upload size={18} />
                              </div>
                              <div>
                                <p className="text-xs font-black text-gray-900">هەڵبژاردنی وێنەی لۆگۆ لە کۆمپیوتەر یان مۆبایل</p>
                                <p className="text-[11px] text-gray-500">فۆرماتەکانی PNG, JPG, SVG, WebP (پێشنیارکراو: وێنەی چوارگۆشە)</p>
                              </div>
                            </div>
                            <span className="px-3.5 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shrink-0 shadow-xs hover:bg-indigo-700">
                              دیاریکردنی فایل
                            </span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoFileUpload}
                            />
                          </label>
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="relative">
                            <LinkIcon className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
                            <input
                              type="url"
                              dir="ltr"
                              value={settings.logoUrl || ''}
                              onChange={(e) => setSettings({ ...settings, logoUrl: e.target.value })}
                              placeholder="https://example.com/shop-logo.png"
                              className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-xs font-mono text-left"
                            />
                          </div>
                          <p className="text-[10px] text-gray-500">لینکی ڕاستەوخۆی وێنەی لۆگۆکەت لێرە دابنێ کە بە .png یان .jpg کۆتایی دێت.</p>
                        </div>
                      )}

                      {settings.logoUrl && (
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-indigo-100 text-xs">
                          <span className="text-emerald-700 font-bold flex items-center gap-1.5 text-[11px]">
                            <CheckCircle2 size={14} className="text-emerald-600" />
                            لۆگۆ بە سەرکەوتوویی بارکراوە و لەسەر وەسڵەکان چالاکە
                          </span>
                          <button
                            type="button"
                            onClick={handleRemoveLogo}
                            className="text-rose-600 hover:text-rose-800 font-bold text-[11px] hover:underline"
                          >
                            سڕینەوەی لۆگۆ
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Shop Name */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ناوی دوکان (لەسەر سەرەوەی وەسڵ)</label>
                  <div className="relative">
                    <Store className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      required
                      value={settings.shopName}
                      onChange={(e) => setSettings({ ...settings, shopName: e.target.value })}
                      placeholder="ناوی دوکان بنووسە..."
                      className="w-full pl-4 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 font-bold"
                    />
                  </div>
                </div>

                {/* Receipt Header Note */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێکستی پێشوازی / درووشم (ژێر ناوی دوکان)</label>
                  <input
                    type="text"
                    value={settings.receiptHeaderNote || ''}
                    onChange={(e) => setSettings({ ...settings, receiptHeaderNote: e.target.value })}
                    placeholder="بۆ نموونە: بەخێربێن بۆ باشترین فرۆشگای نێرگەلە..."
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ژمارەی پەیوەندی</label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      dir="ltr"
                      value={settings.phone}
                      onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                      placeholder="0750 000 0000"
                      className="w-full pl-4 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-left font-mono font-bold"
                    />
                  </div>
                </div>

                {/* USD Exchange Rate */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">نرخی دۆلار بەرامبەر دینار (1$ = ? IQD)</label>
                  <div className="relative">
                    <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="number"
                      dir="ltr"
                      value={settings.usdRate || 1500}
                      onChange={(e) => setSettings({ ...settings, usdRate: Number(e.target.value) || 1500 })}
                      placeholder="1500"
                      className="w-full pl-4 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-left font-mono font-bold"
                    />
                  </div>
                </div>

                {/* Address */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ناونیشانی دوکان</label>
                  <div className="relative">
                    <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      value={settings.address}
                      onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                      placeholder="هەولێر - شەقامی ٦٠ مەتری بەرامبەر..."
                      className="w-full pl-4 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                    />
                  </div>
                </div>

                {/* Footer Message */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێکستی خوارەوەی وەسڵ (سوپاسگوزاری و مەرجەکان)</label>
                  <input
                    type="text"
                    value={settings.receiptFooter || ''}
                    onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                    placeholder="سوپاس بۆ سەردانەکەتان، کاڵای فرۆشراو دەگۆڕدرێتەوە..."
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                </div>

                {/* Default Receipt Size */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">شێوازی چاپی پێشوەختە لە کاشێر</label>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, receiptSize: '80mm' })}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        settings.receiptSize === '80mm'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <Receipt size={16} />
                      گەرمی (80mm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, receiptSize: 'a4' })}
                      className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        settings.receiptSize === 'a4'
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                          : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                      }`}
                    >
                      <FileText size={16} />
                      لاپەڕەی گەورە (A4)
                    </button>
                  </div>
                </div>

                {/* Lock Screen PIN Code */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">پین کۆدی قفڵکردنی شاشە</label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="password"
                      dir="ltr"
                      pattern="[0-9]*"
                      inputMode="numeric"
                      value={settings.pinCode || ''}
                      onChange={(e) => setSettings({ ...settings, pinCode: e.target.value.replace(/\D/g, '') })}
                      placeholder="بۆ نموونە: 1234"
                      className="w-full pl-4 pr-10 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 text-left font-mono font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Telegram Notifications */}
          {activeTab === 'telegram' && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Send size={20} className="text-blue-600" />
                  ڕێکخستنەکانی بۆتی تێلیگرام
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  سیستەم بە شێوەی ئۆتۆماتیکی ئاگاداری ڕۆژانە و خەرجیەکان دەنێرێت بۆ گرووپ یان چاتی تێلیگرامەکەت.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تۆکنی بۆت (Bot Token)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.telegramBotToken || ''}
                    onChange={(e) => setSettings({ ...settings, telegramBotToken: e.target.value })}
                    placeholder="e.g. 123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-left font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ئایدی چات (Chat ID)</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={settings.telegramChatId || ''}
                    onChange={(e) => setSettings({ ...settings, telegramChatId: e.target.value })}
                    placeholder="e.g. -1001234567890 یان 987654321"
                    className="w-full px-4 py-3 bg-gray-50/50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 text-left font-mono text-xs"
                  />
                </div>

                {telegramStatus && (
                  <div className={`p-4 rounded-xl border flex items-start gap-3 ${
                    telegramStatus.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                  }`}>
                    {telegramStatus.success ? <CheckCircle2 size={20} className="shrink-0 text-emerald-600 mt-0.5" /> : <AlertTriangle size={20} className="shrink-0 text-red-600 mt-0.5" />}
                    <div className="text-xs font-bold">{telegramStatus.message}</div>
                  </div>
                )}

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={testingTelegram}
                    className="flex items-center gap-2 py-3 px-5 bg-blue-50 text-blue-700 rounded-xl font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 text-xs border border-blue-200"
                  >
                    <Send size={16} />
                    {testingTelegram ? 'نامە دەنێردرێت...' : 'ناردنی نامەی تاقیکردنەوە (Test)'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Backup & Restore */}
          {activeTab === 'backup' && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-gray-100 space-y-5">
              <div className="border-b border-gray-100 pb-3">
                <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                  <Download size={20} className="text-emerald-600" />
                  باکئاپ و گەڕاندنەوەی داتاکان
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  دەتوانیت لە هەر کاتێکدا داتاکانی فرۆش، کاڵاکان، و قەرزەکان لە فایلی JSON بە پارێزراوی هەڵبگریت.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <button
                  type="button"
                  onClick={handleBackup}
                  disabled={isBackingUp}
                  className="flex flex-col items-center justify-center p-6 bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl hover:bg-indigo-100/70 transition-colors text-indigo-800 font-bold group"
                >
                  <Download size={32} className="mb-2 text-indigo-600 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">داگرتنی فایلی باکئاپ</span>
                  <span className="text-[11px] text-indigo-600 font-normal mt-1">
                    {isBackingUp ? 'تکایە چاوەڕێبە...' : 'داگرتنی هەموو داتاکان (.JSON)'}
                  </span>
                </button>

                <label className="flex flex-col items-center justify-center p-6 bg-emerald-50 border-2 border-dashed border-emerald-200 rounded-2xl hover:bg-emerald-100/70 transition-colors text-emerald-800 font-bold cursor-pointer group">
                  <Upload size={32} className="mb-2 text-emerald-600 group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-black">گەڕاندنەوەی باکئاپ</span>
                  <span className="text-[11px] text-emerald-600 font-normal mt-1">
                    {isRestoring ? 'داتاکان دەگەڕێنرێنەوە...' : 'هەڵبژاردنی فایلی .JSON'}
                  </span>
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
          )}

          {/* TAB 4: Danger Zone */}
          {activeTab === 'danger' && (
            <div className="bg-white rounded-2xl p-6 shadow-xs border border-rose-100 space-y-5">
              <div className="border-b border-rose-100 pb-3">
                <h2 className="text-lg font-black text-rose-800 flex items-center gap-2">
                  <ShieldAlert size={20} className="text-rose-600" />
                  ناوچەی مەترسیدار (سڕینەوەی بەشەکان)
                </h2>
                <p className="text-xs text-rose-600 mt-1">
                  ئاگاداربە! سڕینەوەی ئەم داتایانە گەڕانەوەی نییە. دڵنیابە سەرەتا باکئاپ وەربگریت.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setCollectionToClear('sales'); setClearModalOpen(true); }}
                  className="flex items-center justify-between p-3.5 border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors text-rose-700 font-bold text-xs"
                >
                  <span>سڕینەوەی وەسڵ و فرۆشەکان</span>
                  <Trash2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => { setCollectionToClear('products'); setClearModalOpen(true); }}
                  className="flex items-center justify-between p-3.5 border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors text-rose-700 font-bold text-xs"
                >
                  <span>سڕینەوەی هەموو کاڵاکان</span>
                  <Trash2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => { setCollectionToClear('debts'); setClearModalOpen(true); }}
                  className="flex items-center justify-between p-3.5 border border-rose-200 rounded-xl hover:bg-rose-50 transition-colors text-rose-700 font-bold text-xs"
                >
                  <span>سڕینەوەی هەموو قەرزەکان</span>
                  <Trash2 size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => { setCollectionToClear('all'); setClearModalOpen(true); }}
                  className="flex items-center justify-between p-3.5 bg-rose-600 text-white rounded-xl hover:bg-rose-700 transition-colors font-black text-xs shadow-xs"
                >
                  <span>سڕینەوەی سەرجەم داتاکان</span>
                  <AlertTriangle size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Interactive Live Preview (پریڤیوی زیندووی وەسڵ) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden sticky top-6">
            {/* Preview Header Controls */}
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Eye className="text-indigo-600" size={20} />
                <h3 className="font-black text-gray-900 text-sm">پێشبینی ڕاستەوخۆی وەسڵ</h3>
              </div>

              {/* Mode Switcher */}
              <div className="flex items-center bg-gray-200/80 p-1 rounded-xl text-xs">
                <button
                  onClick={() => setPreviewMode('thermal')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    previewMode === 'thermal'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  80mm
                </button>
                <button
                  onClick={() => setPreviewMode('a4')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    previewMode === 'a4'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  A4
                </button>
                <button
                  onClick={() => setPreviewMode('kashf')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    previewMode === 'kashf'
                      ? 'bg-white text-indigo-700 shadow-xs'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  کەشفی حساب
                </button>
              </div>
            </div>

            {/* Receipt Preview Canvas Area */}
            <div className="p-4 bg-gray-100/60 max-h-[calc(100vh-220px)] overflow-y-auto flex justify-center">
              {previewMode === 'thermal' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
                  <ThermalReceipt
                    settings={settings}
                    receiptNumber="10482"
                    date={new Date()}
                    paymentMethod="cash"
                    customerName="ڕێبوار کەمال"
                    customerPhone="0750 123 4567"
                    items={sampleItems}
                    subtotal={sampleSubtotal}
                    discount={sampleDiscount}
                    total={sampleTotal}
                    amountPaid={70000}
                    usdExchangeRate={settings.usdRate || 1500}
                    cashierName="کاشێری سەرەکی"
                  />
                </div>
              )}

              {previewMode === 'a4' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden scale-75 origin-top w-full max-w-[550px]">
                  <A4Receipt
                    settings={settings}
                    receiptNumber="INV-2026-089"
                    date={new Date()}
                    paymentMethod="debt"
                    customerName="ئەحمەد هۆشیار (کۆمپانیای ئاراس)"
                    customerPhone="0750 999 8877"
                    items={sampleItems}
                    subtotal={sampleSubtotal}
                    discount={sampleDiscount}
                    total={sampleTotal}
                    amountPaid={30000}
                    previousDebt={150000}
                    usdExchangeRate={settings.usdRate || 1500}
                    cashierName="بەڕێوەبەری فرۆش"
                  />
                </div>
              )}

              {previewMode === 'kashf' && (
                <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden scale-75 origin-top w-full max-w-[550px]">
                  <KashfHisabA4
                    settings={settings}
                    customerName="کاک ئاراس حەمە ئەمین"
                    customerPhone="0750 444 3322"
                    totalAmount={185000}
                    paidAmount={50000}
                    remainingAmount={135000}
                    history={sampleDebtHistory}
                    statementDate={new Date()}
                  />
                </div>
              )}
            </div>

            {/* Quick Test Print Bar */}
            <div className="p-3 border-t border-gray-100 bg-white flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                <Sparkles size={14} className="text-indigo-600" />
                ئەم دیزاینە لە کاتی فرۆشتن چاپ دەکرێت
              </span>
              <button
                onClick={handleTestPrint}
                className="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1.5 border border-indigo-200"
              >
                <Printer size={14} />
                چاپی تێست
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden Render Containers strictly for react-to-print execution */}
      <div className="hidden">
        <div ref={thermalPrintRef}>
          <ThermalReceipt
            settings={settings}
            receiptNumber="TEST-80MM"
            date={new Date()}
            paymentMethod="cash"
            customerName="کڕیاری تاقیکردنەوە"
            customerPhone={settings.phone || '0750 000 0000'}
            items={sampleItems}
            subtotal={sampleSubtotal}
            discount={sampleDiscount}
            total={sampleTotal}
            amountPaid={70000}
            usdExchangeRate={settings.usdRate || 1500}
            cashierName="سیستەم"
          />
        </div>

        <div ref={a4PrintRef}>
          <A4Receipt
            settings={settings}
            receiptNumber="TEST-A4"
            date={new Date()}
            paymentMethod="cash"
            customerName="کڕیاری نموونەیی"
            customerPhone={settings.phone || '0750 000 0000'}
            items={sampleItems}
            subtotal={sampleSubtotal}
            discount={sampleDiscount}
            total={sampleTotal}
            amountPaid={sampleTotal}
            usdExchangeRate={settings.usdRate || 1500}
            cashierName="سیستەم"
          />
        </div>

        <div ref={kashfPrintRef}>
          <KashfHisabA4
            settings={settings}
            customerName="کڕیاری تاقیکردنەوەی قەرز"
            customerPhone={settings.phone || '0750 000 0000'}
            totalAmount={185000}
            paidAmount={50000}
            remainingAmount={135000}
            history={sampleDebtHistory}
            statementDate={new Date()}
          />
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
