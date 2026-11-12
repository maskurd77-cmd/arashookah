import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, setDoc, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Building2, Camera, Upload, Link as LinkIcon, X, Search, Package, Image as ImageIcon, CheckCircle2, Sparkles, RefreshCw, Palette } from 'lucide-react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useAuth } from '../context/AuthContext';

interface ProcessLogoResult {
  dataUrl: string;
  hasTransparency: boolean;
  isWhiteDetected: boolean;
  hasColors: boolean;
}

// Smart image processor:
// - Keeps transparency intact (PNG)
// - If transparent PNG has white logo/text, converts white pixels to dark charcoal (#18181b)
// - Retains all colored pixels (red, gold, green, etc.) in their 100% original vibrant colors!
export const processCompanyLogo = (
  source: File | string,
  mode: 'auto' | 'invert_white' | 'original' = 'auto'
): Promise<ProcessLogoResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const MAX = 280;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const totalPixels = canvas.width * canvas.height;

      let transparentPixels = 0;
      let whitePixels = 0;
      let coloredPixels = 0;
      let visiblePixels = 0;

      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a < 40) {
          transparentPixels++;
        } else {
          visiblePixels++;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = (r * 299 + g * 587 + b * 114) / 1000;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);

          if (lum > 175 && sat < 35) {
            whitePixels++;
          } else if (sat >= 35) {
            coloredPixels++;
          }
        }
      }

      const hasTransparency = transparentPixels > totalPixels * 0.04;
      const isWhiteDetected = hasTransparency && visiblePixels > 20 && (whitePixels / visiblePixels) > 0.35;
      const hasColors = coloredPixels > 20;

      const shouldTurnWhiteToBlack = (mode === 'auto' && isWhiteDetected) || mode === 'invert_white';

      if (shouldTurnWhiteToBlack) {
        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a >= 25) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const lum = (r * 299 + g * 587 + b * 114) / 1000;
            const sat = Math.max(r, g, b) - Math.min(r, g, b);

            // ONLY transform white / light-gray pixels!
            // Colored pixels (sat >= 35) KEEP THEIR ORIGINAL VIBRANT COLOR!
            if (lum > 170 && sat < 35) {
              data[i] = 24;
              data[i + 1] = 24;
              data[i + 2] = 27;
              // Keep original alpha for smooth edges
            }
          }
        }
        ctx.putImageData(imgData, 0, 0);
      }

      const dataUrl = canvas.toDataURL('image/png');
      resolve({
        dataUrl,
        hasTransparency,
        isWhiteDetected,
        hasColors,
      });
    };

    img.onerror = () => reject(new Error('نەتوانرا وێنەکە بخوێندرێتەوە'));

    if (typeof source === 'string') {
      img.src = source;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('نەتوانرا فایلەکە بخوێندرێتەوە'));
      reader.readAsDataURL(source);
    }
  });
};

export default function Companies() {
  const { setShowFirebaseSetup } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [companyIcons, setCompanyIcons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCompany, setEditingCompany] = useState<any>(null);
  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [rawSource, setRawSource] = useState<File | string | null>(null);
  const [colorMode, setColorMode] = useState<'auto' | 'invert_white' | 'original'>('auto');
  const [detectionInfo, setDetectionInfo] = useState<{ isWhiteDetected: boolean; hasColors: boolean } | null>(null);
  const [imageInputMode, setImageInputMode] = useState<'upload' | 'url'>('upload');
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Quick inline photo upload
  const quickFileInputRef = useRef<HTMLInputElement>(null);
  const [quickTargetCompany, setQuickTargetCompany] = useState<any>(null);

  // Auto-fix all existing white logos
  const [isFixingAll, setIsFixingAll] = useState(false);

  const [companyToDelete, setCompanyToDelete] = useState<any | null>(null);

  useEffect(() => {
    // 1. Fetch companies
    const unsubCompanies = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const fetched = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
      setCompanies(fetched);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching companies:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    // 2. Fetch products to display product counts per company
    const unsubProducts = onSnapshot(collection(db, 'products'), (snapshot) => {
      const prods = snapshot.docs.map(docSnap => docSnap.data());
      setProducts(prods);
    }, (err) => console.warn("Error fetching products:", err));

    // 3. Fetch company icons from settings/company_icons (synced with POS)
    const unsubIcons = onSnapshot(doc(db, 'settings', 'company_icons'), (snap) => {
      if (snap.exists() && snap.data().icons) {
        setCompanyIcons(snap.data().icons);
      }
    }, (err) => console.warn("Error fetching company icons:", err));

    return () => {
      unsubCompanies();
      unsubProducts();
      unsubIcons();
    };
  }, [setShowFirebaseSetup]);

  const handleModalImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsProcessingImage(true);
    try {
      setRawSource(file);
      const res = await processCompanyLogo(file, colorMode);
      setLogoUrl(res.dataUrl);
      setDetectionInfo({
        isWhiteDetected: res.isWhiteDetected,
        hasColors: res.hasColors,
      });
    } catch (err: any) {
      alert(err.message || 'هەڵەیەک ڕوویدا لە بارکردنی وێنە');
    } finally {
      setIsProcessingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUrlChange = async (url: string) => {
    setLogoUrl(url);
    if (!url.trim()) {
      setRawSource(null);
      setDetectionInfo(null);
      return;
    }
    // If it's a direct web image URL, try to process it
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:image')) {
      try {
        setRawSource(url);
        const res = await processCompanyLogo(url, colorMode);
        setLogoUrl(res.dataUrl);
        setDetectionInfo({
          isWhiteDetected: res.isWhiteDetected,
          hasColors: res.hasColors,
        });
      } catch {
        // External URL might fail CORS, keep original URL
        setDetectionInfo(null);
      }
    }
  };

  const handleColorModeChange = async (mode: 'auto' | 'invert_white' | 'original') => {
    setColorMode(mode);
    if (rawSource) {
      setIsProcessingImage(true);
      try {
        const res = await processCompanyLogo(rawSource, mode);
        setLogoUrl(res.dataUrl);
        setDetectionInfo({
          isWhiteDetected: res.isWhiteDetected,
          hasColors: res.hasColors,
        });
      } catch (err) {
        console.warn('Could not reprocess image:', err);
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  // Quick single-click photo upload from the card
  const handleQuickImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const comp = quickTargetCompany;
    if (!file || !comp) return;
    try {
      const res = await processCompanyLogo(file, 'auto');
      // 1. Update company doc
      await updateDoc(doc(db, 'companies', comp.id), { logoUrl: res.dataUrl });
      // 2. Update POS settings/company_icons
      await setDoc(doc(db, 'settings', 'company_icons'), {
        icons: { [comp.name]: res.dataUrl }
      }, { merge: true });
    } catch (err: any) {
      alert(err.message || 'هەڵەیەک ڕوویدا لە بارکردنی وێنە');
    } finally {
      setQuickTargetCompany(null);
      if (quickFileInputRef.current) quickFileInputRef.current.value = '';
    }
  };

  // Auto-fix all existing white logos across all companies
  const handleAutoFixAllLogos = async () => {
    if (!window.confirm('ئایا دڵنیایت لە چاکسازی لۆگۆکان؟ لۆگۆ سپییەکان دەکرێن بە ڕەش بە شێوازێکی جوان و ڕەنگەکانی تر بە پارێزراوی دەمێننەوە.')) return;
    setIsFixingAll(true);
    let count = 0;
    try {
      for (const comp of companies) {
        const currentImg = comp.logoUrl || companyIcons[comp.name];
        if (currentImg && currentImg.startsWith('data:image')) {
          try {
            const res = await processCompanyLogo(currentImg, 'invert_white');
            if (res.dataUrl !== currentImg) {
              await updateDoc(doc(db, 'companies', comp.id), { logoUrl: res.dataUrl });
              await setDoc(doc(db, 'settings', 'company_icons'), {
                icons: { [comp.name]: res.dataUrl }
              }, { merge: true });
              count++;
            }
          } catch (e) {
            console.warn('Error fixing company logo:', comp.name, e);
          }
        }
      }
      alert(`✅ چاکسازی تەواو بوو! (${count}) لۆگۆی سپی کران بە ڕەش و لە POS و کاڵاکانیش نوێکرانەوە.`);
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا: ' + (err.message || ''));
    } finally {
      setIsFixingAll(false);
    }
  };

  const openNewModal = () => {
    setEditingCompany(null);
    setName('');
    setLogoUrl('');
    setRawSource(null);
    setColorMode('auto');
    setDetectionInfo(null);
    setImageInputMode('upload');
    setIsModalOpen(true);
  };

  const openEditModal = (company: any) => {
    setEditingCompany(company);
    setName(company.name);
    const existingLogo = company.logoUrl || companyIcons[company.name] || '';
    setLogoUrl(existingLogo);
    setRawSource(existingLogo);
    setColorMode('auto');
    setDetectionInfo(null);
    setImageInputMode('upload');
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    try {
      const finalLogo = logoUrl.trim();

      if (editingCompany) {
        const oldName = editingCompany.name;
        await updateDoc(doc(db, 'companies', editingCompany.id), {
          name: trimmedName,
          logoUrl: finalLogo
        });

        // Sync with settings/company_icons for POS screen
        const nextIcons = { ...companyIcons };
        if (oldName && oldName !== trimmedName) {
          delete nextIcons[oldName];
        }
        if (finalLogo) {
          nextIcons[trimmedName] = finalLogo;
        } else {
          delete nextIcons[trimmedName];
        }
        await setDoc(doc(db, 'settings', 'company_icons'), { icons: nextIcons });

      } else {
        await addDoc(collection(db, 'companies'), {
          name: trimmedName,
          logoUrl: finalLogo,
          createdAt: serverTimestamp()
        });

        // Sync with settings/company_icons for POS
        if (finalLogo) {
          await setDoc(doc(db, 'settings', 'company_icons'), {
            icons: { [trimmedName]: finalLogo }
          }, { merge: true });
        }
      }

      setIsModalOpen(false);
      setName('');
      setLogoUrl('');
      setRawSource(null);
      setEditingCompany(null);
    } catch (error: any) {
      console.error("Error saving company:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە پاشەکەوتکردن");
      }
    }
  };

  const confirmDelete = async () => {
    if (companyToDelete) {
      try {
        await deleteDoc(doc(db, 'companies', companyToDelete.id));

        // Clean from settings/company_icons
        if (companyToDelete.name) {
          const nextIcons = { ...companyIcons };
          delete nextIcons[companyToDelete.name];
          await setDoc(doc(db, 'settings', 'company_icons'), { icons: nextIcons });
        }
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

  const filteredCompanies = companies.filter(c =>
    !searchTerm.trim() || c.name?.toLowerCase().includes(searchTerm.toLowerCase().trim())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-xs border border-gray-100">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
              <Building2 size={24} />
            </div>
            <span>شەریکەکان و براندەکان</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            لێرەوە دەتوانیت شەریکە و براندەکان زیاد بکەیت، لۆگۆی سپی خۆکارانە دەکرێتە ڕەش و ڕەنگەکانی تر بە پارێزراوی دەمێننەوە
          </p>
        </div>

        <div className="flex items-center gap-3">
          {companies.length > 0 && (
            <button
              onClick={handleAutoFixAllLogos}
              disabled={isFixingAll}
              className="flex items-center gap-2 px-3.5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
              title="چاکسازی خۆکاری هەموو لۆگۆ سپییەکان و کردنیان بە ڕەش"
            >
              {isFixingAll ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} className="text-amber-600" />}
              <span>{isFixingAll ? 'چاکسازی دەکرێت...' : 'چاکسازی لۆگۆ سپییەکان'}</span>
            </button>
          )}

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="گەڕان بەدوای شەریکە..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-10 pl-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700">
                <X size={15} />
              </button>
            )}
          </div>

          <button
            onClick={openNewModal}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold shadow-md shadow-indigo-200 active:scale-95 shrink-0"
          >
            <Plus size={18} />
            <span>شەریکەی نوێ</span>
          </button>
        </div>
      </div>

      {/* Hidden file input for quick inline logo update */}
      <input
        ref={quickFileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleQuickImageUpload}
      />

      {/* Grid of Companies */}
      {loading ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 font-bold border border-gray-100">
          بارکردن...
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center text-gray-400 font-bold border border-gray-100 flex flex-col items-center justify-center gap-2">
          <Building2 size={36} className="text-gray-300" />
          <span>{searchTerm ? 'هیچ شەریکەیەک نەدۆزرایەوە بەم ناوە' : 'هیچ شەریکەیەک تۆمار نەکراوە'}</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {filteredCompanies.map((comp) => {
            const logo = comp.logoUrl || companyIcons[comp.name];
            const prodCount = products.filter(p => p.company === comp.name).length;

            return (
              <div
                key={comp.id}
                className="bg-white rounded-2xl p-4.5 border border-gray-200/70 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group hover:-translate-y-0.5"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    {/* Logo Avatar with subtle checkerboard to show transparency clearly */}
                    <div className="relative group/avatar">
                      <div className="w-16 h-16 rounded-2xl bg-gray-50/80 border border-gray-200 flex items-center justify-center overflow-hidden p-1.5 shadow-2xs">
                        {logo ? (
                          <img
                            src={logo}
                            alt={comp.name}
                            className="w-full h-full object-contain rounded-xl drop-shadow-xs"
                            onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <span className="text-2xl font-black text-indigo-600">
                            {comp.name.trim().charAt(0)}
                          </span>
                        )}
                      </div>

                      {/* Quick Camera overlay */}
                      <button
                        type="button"
                        onClick={() => {
                          setQuickTargetCompany(comp);
                          quickFileInputRef.current?.click();
                        }}
                        className="absolute inset-0 bg-black/40 text-white rounded-2xl opacity-0 group-hover/avatar:opacity-100 flex flex-col items-center justify-center gap-0.5 transition-opacity"
                        title="گۆڕینی وێنە"
                      >
                        <Camera size={18} />
                        <span className="text-[9px] font-bold">گۆڕین</span>
                      </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(comp)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                        title="دەستکاریکردن"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => setCompanyToDelete(comp)}
                        className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        title="سڕینەوە"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Company Name */}
                  <h3 className="text-base font-black text-gray-900 truncate" title={comp.name}>
                    {comp.name}
                  </h3>

                  {/* Products count */}
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 font-bold mt-1">
                    <Package size={14} className="text-gray-400" />
                    <span>{prodCount} کاڵا</span>
                  </div>
                </div>

                {/* Footer status */}
                <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] font-bold">
                  {logo ? (
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 size={12} />
                      لۆگۆ دانراوە
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setQuickTargetCompany(comp);
                        quickFileInputRef.current?.click();
                      }}
                      className="text-indigo-600 hover:text-indigo-800 flex items-center gap-1 underline underline-offset-2"
                    >
                      <Camera size={12} />
                      دانانی وێنە
                    </button>
                  )}
                  <span className="text-gray-400 font-mono text-[10px]">POS ✅</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4" onClick={() => setIsModalOpen(false)}>
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                <Building2 className="text-indigo-600" size={22} />
                <span>{editingCompany ? 'دەستکاریکردنی شەریکە' : 'زیادکردنی شەریکەی نوێ'}</span>
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 pt-4">
              <div>
                <label className="block text-xs font-black text-gray-700 mb-1.5">ناوی شەریکە / براند</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-sm"
                  placeholder="ناوی شەریکە بنووسە (بۆ نموونە: Mazaya, Al Fakher, Adalya)..."
                  autoFocus
                />
              </div>

              {/* Company Logo Section */}
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-gray-800 flex items-center gap-1.5">
                    <ImageIcon size={16} className="text-indigo-600" />
                    <span>لۆگۆ / وێنەی شەریکە</span>
                  </label>

                  <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-gray-200 text-xs">
                    <button
                      type="button"
                      onClick={() => setImageInputMode('upload')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${imageInputMode === 'upload' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      فایل
                    </button>
                    <button
                      type="button"
                      onClick={() => setImageInputMode('url')}
                      className={`px-2.5 py-1 rounded-lg font-bold transition-colors ${imageInputMode === 'url' ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:text-gray-900'}`}
                    >
                      لینک
                    </button>
                  </div>
                </div>

                {/* Color Mode Options (Auto White-to-Black, Original) */}
                {logoUrl && (
                  <div className="bg-white p-2.5 rounded-xl border border-gray-200 space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                      <span className="flex items-center gap-1 text-gray-800">
                        <Palette size={14} className="text-indigo-600" />
                        مامەڵە لەگەڵ ڕەنگ:
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleColorModeChange('auto')}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${colorMode === 'auto' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          خۆکار (Auto)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleColorModeChange('invert_white')}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${colorMode === 'invert_white' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          سپی بکە بە ڕەش
                        </button>
                        <button
                          type="button"
                          onClick={() => handleColorModeChange('original')}
                          className={`px-2 py-0.5 rounded-md text-[11px] font-bold transition-colors ${colorMode === 'original' ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-700'}`}
                        >
                          ڕەسەن
                        </button>
                      </div>
                    </div>

                    {detectionInfo?.isWhiteDetected && (
                      <div className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg flex items-center gap-1">
                        <CheckCircle2 size={12} />
                        لۆگۆیەکی سپی دۆزرایەوە: خۆکارانە کرا بە ڕەش بۆ ئەوەی بە جوانی دەربکەوێت.
                      </div>
                    )}
                    {detectionInfo?.hasColors && (
                      <div className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-lg flex items-center gap-1">
                        <Palette size={12} />
                        ڕەنگە ڕەسەنەکانی لۆگۆکە بە تەواوی پارێزراون.
                      </div>
                    )}
                  </div>
                )}

                {/* Preview if available */}
                {logoUrl ? (
                  <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-200">
                    <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center overflow-hidden p-1 shrink-0">
                      <img src={logoUrl} alt="Preview" className="w-full h-full object-contain rounded-lg" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-xs font-bold text-gray-800 truncate">وێنەکە ئامادەیە</span>
                      <span className="text-[10px] text-gray-400">بە شەفافی و بە ڕوونی لە POS دەردەکەوێت</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => { setLogoUrl(''); setRawSource(null); setDetectionInfo(null); }}
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                      title="لابردنی وێنە"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ) : null}

                {/* Input depending on mode */}
                {imageInputMode === 'upload' ? (
                  <div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleModalImageUpload}
                    />
                    <button
                      type="button"
                      disabled={isProcessingImage}
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-3 bg-white border-2 border-dashed border-indigo-200 hover:border-indigo-400 text-indigo-700 rounded-xl flex items-center justify-center gap-2 font-bold text-xs transition-colors group"
                    >
                      <Upload size={16} className="text-indigo-600 group-hover:-translate-y-0.5 transition-transform" />
                      <span>{isProcessingImage ? 'وێنەکە دەپشکنرێت و ڕەنگ دەکرێت...' : 'هەڵبژاردنی وێنە لە کۆمپیوتەر...'}</span>
                    </button>
                  </div>
                ) : (
                  <div>
                    <div className="relative">
                      <LinkIcon size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="url"
                        value={logoUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="w-full pr-9 pl-3 py-2 text-xs bg-white border border-gray-200 rounded-xl font-mono text-left focus:ring-2 focus:ring-indigo-500 outline-none"
                        dir="ltr"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-bold text-sm"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-bold text-sm shadow-md shadow-indigo-200"
                >
                  پاشەکەوتکردن
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!companyToDelete}
        onClose={() => setCompanyToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی شەریکە"
        message={`دڵنیایت لە سڕینەوەی شەریکەی «${companyToDelete?.name}»؟ ئەم کردارە پاشگەزبوونەوەی تێدا نییە.`}
      />
    </div>
  );
}
