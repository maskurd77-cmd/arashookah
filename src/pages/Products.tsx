import React, { useState, useEffect, useRef } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Edit, Trash2, Search, Printer, AlertTriangle, DollarSign, ScanLine, Package, Boxes, Coins, CheckCircle, X, LayoutGrid, Building2, ArrowRight, Tag, Sparkles, Layers, Beaker, Flame, Coffee, Cigarette, Dices, ChevronLeft, RefreshCw, Snowflake, FlaskConical, Scissors, Gift, CupSoda, Zap, Wrench, Compass, PackageSearch, CloudFog } from 'lucide-react';
import Barcode from 'react-barcode';
import { useAuth } from '../context/AuthContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ProductModal } from '../components/ProductModal';
import { cacheManager } from '../lib/cache';
import { defaultGeneralCategories, isGeneralCategory, isShishaProduct, syncAndCleanCategories, isCategoryMatch, getCategoryQueryVariants, normalizeCategoryText } from '../utils/categoryUtils';

export default function Products() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [activeSection, setActiveSection] = useState<'general' | 'shisha' | 'external'>('general');
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [labelProduct, setLabelProduct] = useState<any>(null);
  const labelRef = useRef<HTMLDivElement>(null);

  const [generalCategories, setGeneralCategories] = useState<string[]>(defaultGeneralCategories);
  const [shishaCategories, setShishaCategories] = useState<string[]>([]);
  const [companies, setCompanies] = useState<any[]>(cacheManager.getCompanies() || []);
  const [selectedCompanyFilter, setSelectedCompanyFilter] = useState<string>('all');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [showAllProducts, setShowAllProducts] = useState<boolean>(false);

  // Category Management State
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);

  // Category Edit State
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [categoryToEdit, setCategoryToEdit] = useState<string | null>(null);
  const [editedCategoryName, setEditedCategoryName] = useState('');
  const [isSavingEditedCategory, setIsSavingEditedCategory] = useState(false);

  // Uncategorized Products State
  const [uncategorizedProducts, setUncategorizedProducts] = useState<any[]>([]);

  // Real-time Firestore sync for categories
  useEffect(() => {
    // 1. General categories
    const unsubGen = onSnapshot(doc(db, 'settings', 'general_categories'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().list) && snap.data().list.length > 0) {
        let currentList = snap.data().list;
        let needsUpdate = false;
        if (currentList.includes('خەڵتە') || currentList.includes('خەلتە')) {
          currentList = currentList.map((c: string) => (c === 'خەڵتە' || c === 'خەلتە') ? 'خەڵتەکان' : c);
          needsUpdate = true;
        }
        if (!currentList.includes('خەڵتەکان')) {
          currentList = [...currentList, 'خەڵتەکان'];
          needsUpdate = true;
        }
        if (!currentList.includes('ناریەکان')) {
          currentList = [...currentList, 'ناریەکان'];
          needsUpdate = true;
        }
        if (needsUpdate) {
          setDoc(doc(db, 'settings', 'general_categories'), { list: Array.from(new Set(currentList)) }, { merge: true }).catch(() => {});
        }
        setGeneralCategories(Array.from(new Set(currentList)));
      } else {
        getDoc(doc(db, 'settings', 'categories')).then(oldSnap => {
          if (oldSnap.exists() && Array.isArray(oldSnap.data().list) && oldSnap.data().list.length > 0) {
            const merged = Array.from(new Set([...defaultGeneralCategories, ...oldSnap.data().list]));
            setGeneralCategories(merged);
            setDoc(doc(db, 'settings', 'general_categories'), { list: merged }, { merge: true }).catch(() => {});
          } else {
            setGeneralCategories(defaultGeneralCategories);
            setDoc(doc(db, 'settings', 'general_categories'), { list: defaultGeneralCategories }, { merge: true }).catch(() => {});
          }
        }).catch(() => setGeneralCategories(defaultGeneralCategories));
      }
    }, (err) => console.warn("Error loading general categories:", err));

    // 2. Shisha categories (Empty by default until user creates them manually!)
    const unsubShisha = onSnapshot(doc(db, 'settings', 'shisha_categories'), (snap) => {
      if (snap.exists() && Array.isArray(snap.data().list)) {
        const filteredList = snap.data().list.filter((c: string) => !isGeneralCategory(c));
        if (filteredList.length !== snap.data().list.length) {
          setDoc(doc(db, 'settings', 'shisha_categories'), { list: filteredList }, { merge: true }).catch(() => {});
        }
        setShishaCategories(filteredList);
      } else {
        setShishaCategories([]);
      }
    }, (err) => console.warn("Error loading shisha categories:", err));

    // Also scan existing products to pick up any shisha categories (e.g. ماجیکبارەکان)
    getDocs(collection(db, 'products')).then(snap => {
      const cats: string[] = [];
      snap.docs.forEach(d => {
        const p = d.data();
        const cat = (p.category || '').trim();
        if (cat && !isGeneralCategory(cat) && p.section === 'shisha') {
          cats.push(cat);
        }
      });
      if (cats.length > 0) {
        setShishaCategories(prev => Array.from(new Set([...prev, ...cats])));
      }
    }).catch(() => {});

    return () => {
      unsubGen();
      unsubShisha();
    };
  }, []);

  // Sync categories and listen to Uncategorized Products in real-time
  useEffect(() => {
    syncAndCleanCategories(db);

    const unsubUncat = onSnapshot(collection(db, 'products'), (snapshot) => {
      const allDocs: any[] = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      const uncat = allDocs.filter(p => {
        const hasNoCat = !p.category || (typeof p.category === 'string' && p.category.trim() === '');
        if (!hasNoCat) return false;
        if (activeSection === 'shisha') {
          return p.section === 'shisha';
        } else if (activeSection === 'external') {
          return p.section === 'external';
        } else {
          return p.section !== 'shisha' && p.section !== 'external';
        }
      });
      setUncategorizedProducts(uncat);
    }, (err) => console.warn("Error loading uncategorized products:", err));

    return () => unsubUncat();
  }, [activeSection]);

  // Active categories strictly by section
  const categories = React.useMemo(() => {
    if (activeSection === 'shisha') {
      const dynamicCats = products
        .filter(p => isShishaProduct(p))
        .map(p => (p.category || '').trim())
        .filter(c => c && !isGeneralCategory(c));
      return Array.from(new Set([...shishaCategories, ...dynamicCats])).filter(c => !isGeneralCategory(c));
    } else if (activeSection === 'external') {
      return ['کاڵای دەرەکی', 'سەفەری', 'هەمەجۆر'];
    } else {
      return generalCategories;
    }
  }, [activeSection, shishaCategories, generalCategories, products]);

  // Handlers for Adding & Deleting Categories connected to Firestore
  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      alert("تکایە ناوی کەتەگۆری بنووسە.");
      return;
    }

    if (categories.includes(trimmed)) {
      alert("ئەم کەتەگۆرییە پێشتر بوونی هەیە لەم بەشەدا.");
      return;
    }

    setIsSavingCategory(true);
    try {
      if (activeSection === 'shisha') {
        const updated = [...shishaCategories, trimmed];
        await setDoc(doc(db, 'settings', 'shisha_categories'), { list: updated }, { merge: true });
        setShishaCategories(updated);
      } else {
        const updated = [...generalCategories, trimmed];
        await setDoc(doc(db, 'settings', 'general_categories'), { list: updated }, { merge: true });
        await setDoc(doc(db, 'settings', 'categories'), { list: updated }, { merge: true });
        setGeneralCategories(updated);
      }
      setNewCategoryName('');
      setIsAddCategoryModalOpen(false);
    } catch (err: any) {
      console.error("Error adding category:", err);
      alert("هەڵەیەک ڕوویدا لە کاتی زیادکردنی کەتەگۆری: " + (err.message || ''));
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;
    setIsDeletingCategory(true);
    try {
      if (activeSection === 'shisha') {
        const updated = shishaCategories.filter(c => c !== categoryToDelete);
        await setDoc(doc(db, 'settings', 'shisha_categories'), { list: updated }, { merge: true });
        setShishaCategories(updated);
      } else {
        const updated = generalCategories.filter(c => c !== categoryToDelete);
        await setDoc(doc(db, 'settings', 'general_categories'), { list: updated }, { merge: true });
        await setDoc(doc(db, 'settings', 'categories'), { list: updated }, { merge: true });
        setGeneralCategories(updated);
      }
      if (selectedCategoryFilter === categoryToDelete) {
        setSelectedCategoryFilter('all');
      }
      setCategoryToDelete(null);
    } catch (err: any) {
      console.error("Error deleting category:", err);
      alert("هەڵەیەک ڕوویدا لە کاتی سڕینەوەی کەتەگۆری: " + (err.message || ''));
    } finally {
      setIsDeletingCategory(false);
    }
  };

  const handleEditCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryToEdit) return;
    const oldName = categoryToEdit.trim();
    const newName = editedCategoryName.trim();
    if (!newName) {
      alert("تکایە ناوی کەتەگۆری بنووسە.");
      return;
    }
    if (oldName === newName) {
      setIsEditCategoryModalOpen(false);
      return;
    }

    setIsSavingEditedCategory(true);
    try {
      if (activeSection === 'shisha') {
        const updated = shishaCategories.map(c => c === oldName ? newName : c);
        await setDoc(doc(db, 'settings', 'shisha_categories'), { list: updated }, { merge: true });
        setShishaCategories(updated);
      } else {
        const updated = generalCategories.map(c => c === oldName ? newName : c);
        await setDoc(doc(db, 'settings', 'general_categories'), { list: updated }, { merge: true });
        await setDoc(doc(db, 'settings', 'categories'), { list: updated }, { merge: true });
        setGeneralCategories(updated);
      }

      // Batch update all products in Firestore with this category
      const q = query(collection(db, 'products'), where('category', '==', oldName));
      const prodsSnap = await getDocs(q);
      const updates = prodsSnap.docs.map(d => updateDoc(doc(db, 'products', d.id), { category: newName }));
      await Promise.all(updates);

      if (selectedCategoryFilter === oldName) {
        setSelectedCategoryFilter(newName);
      }

      setIsEditCategoryModalOpen(false);
      setCategoryToEdit(null);
      setEditedCategoryName('');
      alert(`ناوی کەتەگۆری بە سەرکەوتوویی گۆڕدرا بۆ «${newName}» و هەموو کاڵاکانی نوێکرانەوە.`);
    } catch (err: any) {
      console.error("Error editing category name:", err);
      alert("هەڵەیەک ڕوویدا لە کاتی دەستکاریکردنی ناوی کەتەگۆری: " + (err.message || ''));
    } finally {
      setIsSavingEditedCategory(false);
    }
  };
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);
  const [bulkEditData, setBulkEditData] = useState({
    price: '',
    wholesalePrice: '',
    costPrice: '',
    wholesaleCost: '',
    company: '',
    category: ''
  });

  const [productToDelete, setProductToDelete] = useState<string | null>(null);

  const handlePrintLabel = () => {
    window.print();
  };

  // OPTIMIZATION: High-performance caching for companies and settings
  useEffect(() => {
    const fetchSettingsAndCompanies = async () => {
      try {
        const cachedComp = cacheManager.getCompanies();
        const cachedCats = cacheManager.getCategories();

        if (cachedComp) {
          setCompanies(cachedComp);
        } else {
          const companySnap = await getDocs(collection(db, 'companies'));
          const companyList = companySnap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
          cacheManager.setCompanies(companyList);
          setCompanies(companyList);
        }


        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.usdExchangeRate) {
            setUsdExchangeRate(data.usdExchangeRate);
          }
        }
      } catch (e: any) {
        console.error("Error fetching settings/companies:", e);
        if (e.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      }
    };
    fetchSettingsAndCompanies();
  }, [setShowFirebaseSetup]);

  // isShishaProduct is imported from categoryUtils for strictly consistent isolation

  // OPTIMIZATION: Incremental snapshot updates via snapshot.docChanges()
  useEffect(() => {
    const isGridMode = selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && !searchTerm.trim() && !showAllProducts;

    if (isGridMode) {
      setProducts([]);
      setLoading(false);
      return;
    }

    // Restore from cache if available to prevent flash of empty state
    const cachedSecProds = cacheManager.getSectionProducts(activeSection);
    if (cachedSecProds && cachedSecProds.length > 0) {
      setProducts(cachedSecProds);
    } else {
      setLoading(true);
    }

    const queryConstraints: any[] = [];
    if (selectedCategoryFilter !== 'all') {
      const variants = getCategoryQueryVariants(selectedCategoryFilter);
      if (variants.length === 1) {
        queryConstraints.push(where('category', '==', variants[0]));
      } else {
        queryConstraints.push(where('category', 'in', variants));
      }
    } else if (selectedCompanyFilter !== 'all') {
      queryConstraints.push(where('company', '==', selectedCompanyFilter));
    }

    queryConstraints.push(limit(400));

    const q = query(collection(db, 'products'), ...queryConstraints);

    const unsubscribe = onSnapshot(q, (snapshot: any) => {
      const docs = snapshot.docs.map((docSnap: any) => {
        const item = { id: docSnap.id, ...docSnap.data() };
        cacheManager.upsertProduct(activeSection, item);
        return item;
      });
      setProducts(docs);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching products:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
    };
  }, [selectedCategoryFilter, selectedCompanyFilter, searchTerm, showAllProducts, activeSection, setShowFirebaseSetup]);

  const confirmDelete = async () => {
    if (productToDelete) {
      try {
        await deleteDoc(doc(db, 'products', productToDelete));
      } catch (error: any) {
        console.error("Error deleting product:", error);
        if (error.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        }
      } finally {
        setProductToDelete(null);
      }
    }
  };

  const openEditModal = (product: any) => {
    setEditingProduct(product);
    setIsModalOpen(true);
  };

  const filteredProducts = products.filter(p => {
    const matchesSection = activeSection === 'shisha' 
      ? isShishaProduct(p)
      : activeSection === 'external'
      ? p.section === 'external'
      : (!isShishaProduct(p) && p.section !== 'external');

    if (!matchesSection) return false;
    if (selectedCompanyFilter !== 'all' && p.company !== selectedCompanyFilter) return false;

    const normName = normalizeCategoryText(p.name || '');
    const isKhaltaSelected = isCategoryMatch('خەڵتەکان', selectedCategoryFilter);
    const isProdKhalta = isCategoryMatch('خەڵتەکان', p.category) || normName.includes('خلت') || normName.includes('خەلت');

    if (selectedCategoryFilter !== 'all') {
      if (isKhaltaSelected) {
        if (!isProdKhalta) return false;
      } else {
        if (!isCategoryMatch(p.category, selectedCategoryFilter)) return false;
      }
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase().trim();
      const matchesSearch = (p.name && p.name.toLowerCase().includes(term)) || 
        (p.company && p.company.toLowerCase().includes(term)) ||
        (p.barcode && p.barcode.includes(term)) ||
        (p.shortcutKey && p.shortcutKey.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    return true;
  });

  const toggleProductSelection = (id: string) => {
    const newSelection = new Set(selectedProductIds);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedProductIds(newSelection);
  };

  const toggleAllSelection = () => {
    if (selectedProductIds.size === filteredProducts.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(filteredProducts.map(p => p.id)));
    }
  };

  const handleBulkEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedProductIds.size === 0) return;

    setLoading(true);
    try {
      const updates: any = {};
      if (bulkEditData.price !== '') updates.price = Number(bulkEditData.price);
      if (bulkEditData.wholesalePrice !== '') updates.wholesalePrice = Number(bulkEditData.wholesalePrice);
      if (bulkEditData.costPrice !== '') updates.costPrice = Number(bulkEditData.costPrice);
      if (bulkEditData.wholesaleCost !== '') updates.wholesaleCost = Number(bulkEditData.wholesaleCost);
      if (bulkEditData.company !== '') updates.company = bulkEditData.company;
      if (bulkEditData.category !== '') {
        updates.category = bulkEditData.category;
        if (activeSection === 'shisha') {
          updates.section = 'shisha';
        }
      }

      if (Object.keys(updates).length > 0) {
        const promises = Array.from(selectedProductIds).map((id: string) => 
          updateDoc(doc(db, 'products', id), updates)
        );
        await Promise.all(promises);
      }
      
      setIsBulkEditModalOpen(false);
      setSelectedProductIds(new Set());
      setBulkEditData({
        price: '',
        wholesalePrice: '',
        costPrice: '',
        wholesaleCost: '',
        company: ''
      });
    } catch (error: any) {
      console.error("Error updating products:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی گۆڕینی کاڵاکان");
      }
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes('دەرمان')) return Beaker;
    if (name.includes('نێرگلە') || name.includes('توتون')) return Cigarette;
    if (name.includes('شیشە') || name.includes('شوشە')) return FlaskConical;
    if (name.includes('یاری')) return Dices;
    if (name.includes('ناریە') || name.includes('فەحم') || name.includes('ئاگر') || name.includes('هیتەر') || name.includes('غاز') || name.includes('تەباغ')) return Flame;
    if (name.includes('خواردنەوە') || name.includes('چای') || name.includes('کۆلا')) return CupSoda;
    if (name.includes('دیاری')) return Gift;
    if (name.includes('سەرە') || name.includes('سەری')) return Coffee;
    if (name.includes('مەقاش')) return Scissors;
    if (name.includes('قایش')) return Layers;
    if (name.includes('چەرخ')) return Zap;
    if (name.includes('ڤەیپ') || name.includes('پۆد')) return CloudFog;
    if (name.includes('جگەرە')) return Cigarette;
    if (name.includes('دەرەکی')) return PackageSearch;
    if (name.includes('سەفەری')) return Compass;
    if (name.includes('پاککەرەوە') || name.includes('فرچە')) return Sparkles;
    return Package;
  };

  const renderCategoryIcon = (catName: string) => {
    const name = catName.toLowerCase();
    if (name.includes('دەرمان') || name.includes('توتون')) {
      return <img src="/icons/darman.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('نێرگلە') || name.includes('نیرگله')) {
      return <img src="/icons/hookah.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('فەحم')) {
      return <img src="/icons/fahm.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('هیتەر') || name.includes('هیته ر')) {
      return <img src="/icons/heater.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('سیم')) {
      return <img src="/icons/seem.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    const norm = normalizeCategoryText(catName);
    if (norm.includes('خلت') || norm.includes('خەلت') || name.includes('خەڵت') || name.includes('خەلت')) {
      return <img src="/icons/khalta.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('سۆندە') || name.includes('سونده')) {
      return <img src="/icons/sonda.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('تیلە') || name.includes('تیله')) {
      return <img src="/icons/teela.png" alt={catName} className="w-10 h-10 object-contain drop-shadow-xs" />;
    }
    if (name.includes('ناریە') || name.includes('ئاریە')) {
      return <Flame size={32} className="text-orange-500 drop-shadow-xs" />;
    }
    if (name.includes('بەفر')) {
      return <Snowflake size={32} className="text-purple-500 drop-shadow-xs" />;
    }
    if (name.includes('شوشە') || name.includes('شیشە')) {
      return <FlaskConical size={32} className="text-teal-500 drop-shadow-xs" />;
    }
    if (name.includes('سەرە') || name.includes('سەری')) {
      return <Coffee size={32} className="text-teal-600 drop-shadow-xs" />;
    }
    if (name.includes('مەقاش')) {
      return <Scissors size={32} className="text-sky-500 drop-shadow-xs" />;
    }
    if (name.includes('تەباغ') || name.includes('غاز')) {
      return <Flame size={32} className="text-orange-500 drop-shadow-xs" />;
    }
    if (name.includes('قایش')) {
      return <Layers size={32} className="text-blue-500 drop-shadow-xs" />;
    }
    if (name.includes('خواردنەوە')) {
      return <CupSoda size={32} className="text-amber-500 drop-shadow-xs" />;
    }
    if (name.includes('دیاری')) {
      return <Gift size={32} className="text-rose-500 drop-shadow-xs" />;
    }
    if (name.includes('یاری')) {
      return <Dices size={32} className="text-purple-500 drop-shadow-xs" />;
    }
    if (name.includes('چەرخ')) {
      return <Zap size={32} className="text-yellow-500 drop-shadow-xs" />;
    }
    if (name.includes('ڤەیپ') || name.includes('پۆد')) {
      return <CloudFog size={32} className="text-slate-500 drop-shadow-xs" />;
    }
    if (name.includes('جگەرە')) {
      return <Cigarette size={32} className="text-stone-500 drop-shadow-xs" />;
    }
    if (name.includes('دەرەکی')) {
      return <PackageSearch size={32} className="text-purple-600 drop-shadow-xs" />;
    }
    if (name.includes('سەفەری')) {
      return <Compass size={32} className="text-emerald-500 drop-shadow-xs" />;
    }
    if (name.includes('پاککەرەوە') || name.includes('فرچە')) {
      return <Sparkles size={32} className="text-teal-500 drop-shadow-xs" />;
    }
    if (name.includes('هەمەجۆر')) {
      return <Package size={32} className="text-indigo-600 drop-shadow-xs" />;
    }
    const Icon = getCategoryIcon(catName);
    return <Icon size={32} className="text-indigo-600 drop-shadow-xs" />;
  };

  const isGridMode = selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && !searchTerm.trim() && !showAllProducts;

  const resetToCategoryGrid = () => {
    setSelectedCategoryFilter('all');
    setSelectedCompanyFilter('all');
    setSearchTerm('');
    setShowAllProducts(false);
  };

  return (
    <div className="space-y-6 print:h-auto print:block">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
            <Package className="text-indigo-600" size={28} />
            <span>بەڕێوەبردنی کاڵاکان</span>
          </h1>
          <p className="text-xs text-gray-500 font-medium mt-1">
            کاشی کەتەگۆرییەکان کلیک بکە بۆ بینینی کاڵاکان بەبێ ماندوکردنی داتابەیس
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {!isGridMode && (
            <button
              onClick={resetToCategoryGrid}
              className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl transition-all text-xs font-black shadow-sm"
            >
              <LayoutGrid size={18} />
              <span>کاشی کەتەگۆرییەکان</span>
            </button>
          )}

          <button
            onClick={() => {
              setEditingProduct(null);
              setIsModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all shadow-md text-xs font-black active:scale-95"
          >
            <Plus size={18} />
            <span>کالای نوێ</span>
          </button>
        </div>
      </div>

      <div className="flex gap-3 print:hidden overflow-x-auto pb-1">
        <button
          onClick={() => { setActiveSection('general'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'general' 
              ? 'bg-indigo-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی گشتی
        </button>
        <button
          onClick={() => { setActiveSection('shisha'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'shisha' 
              ? 'bg-purple-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          بەشی شیشە
        </button>
        <button
          onClick={() => { setActiveSection('external'); resetToCategoryGrid(); }}
          className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all ${
            activeSection === 'external' 
              ? 'bg-emerald-600 text-white shadow-md' 
              : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
          }`}
        >
          کاڵای دەرەکی
        </button>
      </div>

      {/* Global Quick Search Bar for Products */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center gap-3 print:hidden">
        <div className="relative flex-1 w-full">
          <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder={`گەڕانی خێرا لە کاڵاکانی ${activeSection === 'shisha' ? 'بەشی شیشە' : activeSection === 'external' ? 'کاڵای دەرەکی' : 'بەشی گشتی'} بەپێی ناو، بارکۆد، کۆدی کورت، براند...`}
            className="w-full pl-10 pr-11 py-2.5 bg-gray-50/80 hover:bg-gray-50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl text-sm font-bold text-gray-800 transition-all outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
          {searchTerm && (
            <span className="text-xs font-black text-indigo-700 bg-indigo-50 px-3 py-2 rounded-xl whitespace-nowrap border border-indigo-100">
              {filteredProducts.length} ئەنجام
            </span>
          )}
          {!isGridMode ? (
            <button
              onClick={resetToCategoryGrid}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shadow-xs active:scale-95 cursor-pointer"
            >
              <LayoutGrid size={16} />
              <span>گەڕانەوە بۆ کەتەگۆرییەکان</span>
            </button>
          ) : (
            <button
              onClick={() => setShowAllProducts(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm active:scale-95 cursor-pointer"
            >
              <Boxes size={16} />
              <span>بینینی هەموو کاڵاکان ({activeSection === 'shisha' ? 'بەشی شیشە' : activeSection === 'external' ? 'دەرەکی' : 'گشتی'})</span>
            </button>
          )}
        </div>
      </div>

      {/* VIEW MODE 1: Interactive Category Grid Cards (Saves Firebase Reads) */}
      {isGridMode ? (
        <div className="space-y-6 print:hidden">
          {/* Header Banner */}
          <div className={`rounded-3xl p-6 text-white shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 ${
            activeSection === 'shisha'
              ? 'bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950'
              : activeSection === 'external'
              ? 'bg-gradient-to-r from-emerald-900 via-teal-800 to-slate-900'
              : 'bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900'
          }`}>
            <div className="space-y-1 text-center md:text-right">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/15 rounded-full text-xs font-bold text-indigo-200">
                <Sparkles size={14} />
                {activeSection === 'shisha' ? 'بەشی تایبەتی شیشە و نێرگلە' : 'سیستەمی کاشی زیرەک (کەمکردنەوەی لیمیت)'}
              </span>
              <h2 className="text-xl font-black">
                {activeSection === 'shisha' 
                  ? 'کەتەگۆرییە تایبەتەکانی بەشی شیشە' 
                  : activeSection === 'external'
                  ? 'کەتەگۆرییەکانی کاڵای دەرەکی'
                  : 'کەتەگۆرییەکانی بەشی گشتی فرۆشگا'}
              </h2>
              <p className="text-xs text-indigo-200 font-medium max-w-xl">
                {activeSection === 'shisha'
                  ? 'هەموو کاڵاکانی بەشی شیشە و کەتەگۆرییە تایبەتەکانی لێرەن بەبێ تێکەڵبوونی کەتەگۆری بەشی گشتی.'
                  : 'بۆ پاراستنی لیمیتی داتابەیس و خێرایی، کلیک لەسەر هەر کەتەگۆرییەک بکە بۆ داواکردن و بینینی کاڵاکانی ئەو بەشە.'}
              </p>
            </div>

            <button
              onClick={() => setShowAllProducts(true)}
              className="px-5 py-3 bg-white hover:bg-indigo-50 text-indigo-900 font-black text-xs rounded-2xl shadow-lg transition-all flex items-center gap-2 shrink-0 active:scale-95 cursor-pointer"
            >
              <Boxes size={18} />
              <span>بینینی هەموو کاڵاکانی بەشەکە</span>
            </button>
          </div>

          {/* Categories Grid Cards */}
          <div>
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-black text-gray-700 flex items-center gap-2">
                <LayoutGrid size={18} className={activeSection === 'shisha' ? 'text-purple-600' : 'text-indigo-600'} />
                <span>کەتەگۆرییەکان ({categories.length} کەتەگۆری)</span>
              </h3>
              <button
                onClick={() => setIsAddCategoryModalOpen(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
              >
                <Plus size={16} />
                <span>+ زیادکردنی کەتەگۆری</span>
              </button>
            </div>

            {categories.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-purple-200 rounded-3xl p-8 sm:p-12 text-center flex flex-col items-center justify-center gap-3 shadow-xs">
                <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center shadow-xs">
                  <Sparkles size={32} />
                </div>
                <h3 className="text-lg font-black text-gray-900">
                  {activeSection === 'shisha' ? 'هیچ کەتەگۆرییەک لە بەشی شیشەدا نییە' : 'هیچ کەتەگۆرییەک لەم بەشەدا نییە'}
                </h3>
                <p className="text-xs text-gray-500 max-w-md leading-relaxed">
                  {activeSection === 'shisha' 
                    ? 'هەموو کەتەگۆرییە گشتییەکان لە بەشی گشتیدان. دەتوانیت لێرە بە دەستی خۆت بە ئارەزووی خۆت کەتەگۆرییەکان بۆ بەشی شیشە دروست بکەیت.'
                    : 'دەتوانیت کەتەگۆری نوێ زیاد بکەیت بۆ ئەم بەشە.'}
                </p>
                <button
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className="mt-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-2 transition-all active:scale-95 cursor-pointer"
                >
                  <Plus size={18} />
                  <span>دروستکردنی یەکەم کەتەگۆری نوێ</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {categories.map((cat, idx) => {
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedCategoryFilter(cat)}
                      className={`group relative bg-white border-2 rounded-3xl p-5 shadow-sm hover:shadow-xl transition-all duration-200 flex flex-col items-center justify-between text-center min-h-[140px] hover:-translate-y-1 cursor-pointer overflow-hidden ${
                        activeSection === 'shisha'
                          ? 'border-purple-100 hover:border-purple-500'
                          : 'border-gray-100 hover:border-indigo-500'
                      }`}
                    >
                      {/* Category Action Buttons: Edit & Delete */}
                      <div className="absolute top-2 left-2 flex items-center gap-1 z-10 opacity-0 group-hover:opacity-100 transition-all bg-white/90 backdrop-blur-xs rounded-xl shadow-xs p-0.5 border border-gray-100">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToEdit(cat);
                            setEditedCategoryName(cat);
                            setIsEditCategoryModalOpen(true);
                          }}
                          title={`دەستکاریکردنی ناوی کەتەگۆری ${cat}`}
                          className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Edit size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCategoryToDelete(cat);
                          }}
                          title={`سڕینەوەی کەتەگۆری ${cat}`}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>

                      <div className={`absolute top-0 right-0 left-0 h-1 bg-gradient-to-r opacity-0 group-hover:opacity-100 transition-opacity ${
                        activeSection === 'shisha' ? 'from-purple-500 to-indigo-500' : 'from-indigo-500 to-purple-500'
                      }`} />
                      
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-200 bg-slate-50 group-hover:bg-slate-100 group-hover:scale-110 shadow-2xs">
                        {renderCategoryIcon(cat)}
                      </div>

                      <div className="my-2">
                        <span className={`block font-black text-sm transition-colors ${
                          activeSection === 'shisha' ? 'text-gray-800 group-hover:text-purple-600' : 'text-gray-800 group-hover:text-indigo-600'
                        }`}>
                          {cat}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">کلیک بکە بۆ کاڵاکان</span>
                      </div>

                      <div className={`w-full py-1 rounded-xl text-[11px] font-bold transition-colors flex items-center justify-center gap-1 ${
                        activeSection === 'shisha'
                          ? 'bg-gray-50 group-hover:bg-purple-50 text-gray-500 group-hover:text-purple-700'
                          : 'bg-gray-50 group-hover:bg-indigo-50 text-gray-500 group-hover:text-indigo-700'
                      }`}>
                        <span>کردنەوە</span>
                        <ChevronLeft size={14} />
                      </div>
                    </button>
                  );
                })}

                {/* Add Category Tile at the end of the grid */}
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(true)}
                  className={`group bg-gray-50/70 hover:bg-white border-2 border-dashed rounded-3xl p-5 shadow-2xs hover:shadow-lg transition-all duration-200 flex flex-col items-center justify-center text-center min-h-[140px] hover:-translate-y-1 cursor-pointer ${
                    activeSection === 'shisha' ? 'border-purple-200 hover:border-purple-500' : 'border-indigo-200 hover:border-indigo-500'
                  }`}
                >
                  <div className={`w-12 h-12 bg-white rounded-2xl shadow-xs transition-all duration-200 flex items-center justify-center mb-2 ${
                    activeSection === 'shisha' 
                      ? 'text-purple-500 group-hover:bg-purple-600 group-hover:text-white' 
                      : 'text-indigo-500 group-hover:bg-indigo-600 group-hover:text-white'
                  }`}>
                    <Plus size={24} />
                  </div>
                  <span className={`font-black text-xs transition-colors ${
                    activeSection === 'shisha' ? 'text-gray-700 group-hover:text-purple-600' : 'text-gray-700 group-hover:text-indigo-600'
                  }`}>
                    کەتەگۆری نوێ
                  </span>
                  <span className="text-[10px] text-gray-400">زیادکردن بە دەست</span>
                </button>
              </div>
            )}
          </div>

          {/* Companies Grid Cards */}
          {companies.length > 0 && (
            <div className="pt-4">
              <h3 className="text-sm font-black text-gray-700 mb-3 flex items-center gap-2">
                <Building2 size={18} className="text-purple-600" />
                <span>شەریکەکان و براندەکان</span>
              </h3>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {companies.map((comp) => (
                  <button
                    key={comp.id}
                    onClick={() => setSelectedCompanyFilter(comp.name)}
                    className="bg-white border border-gray-100 hover:border-purple-400 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex items-center gap-3 text-right group hover:-translate-y-0.5"
                  >
                    <div className="p-2.5 bg-purple-50 group-hover:bg-purple-600 text-purple-600 group-hover:text-white rounded-xl transition-colors">
                      <Building2 size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block font-bold text-xs text-gray-800 truncate group-hover:text-purple-600">
                        {comp.name}
                      </span>
                      <span className="text-[10px] text-gray-400 block truncate">شەریکە</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Uncategorized Products Section */}
          <div className="pt-6">
            <div className="flex items-center justify-between mb-4 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-transparent p-4 rounded-3xl border border-amber-200/80 shadow-xs">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-md">
                  <PackageSearch size={22} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-gray-900">
                      کاڵا بێ کەتەگۆرییەکان
                    </h3>
                    <span className="px-2.5 py-0.5 bg-amber-500 text-white text-[11px] font-black rounded-full shadow-2xs">
                      {uncategorizedProducts.length} کاڵا
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    ئەو کاڵایانەی لە {activeSection === 'shisha' ? 'بەشی شیشە' : 'بەشی گشتی'}دا هێشتا کەتەگۆریان بۆ دانەنراوە
                  </p>
                </div>
              </div>
            </div>

            {uncategorizedProducts.length === 0 ? (
              <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-8 text-center flex flex-col items-center justify-center gap-2 text-gray-400 font-bold text-sm shadow-xs">
                <CheckCircle size={28} className="text-green-500" />
                <span>هیچ کاڵایەکی بێ کەتەگۆری لەم بەشەدا نییە. هەموو کاڵاکان لە ناو کەتەگۆریدان.</span>
              </div>
            ) : (
              <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-xs font-black">
                        <th className="px-6 py-4">ناوی کاڵا</th>
                        <th className="px-6 py-4">شەریکە</th>
                        <th className="px-6 py-4">تێچووی تاک</th>
                        <th className="px-6 py-4">نرخی فرۆشتن</th>
                        <th className="px-6 py-4">ستۆک</th>
                        <th className="px-6 py-4">بارکۆد</th>
                        <th className="px-6 py-4 text-center">کردارەکان</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {uncategorizedProducts.map((p) => (
                        <tr key={p.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="px-6 py-4 font-black text-gray-900 text-sm">
                            <div className="flex flex-col">
                              <span>{p.name}</span>
                              {p.isWeighed && <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">بە کێش</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500 font-bold text-xs">
                            {p.company || '-'}
                          </td>
                          <td className="px-6 py-4 text-gray-600 font-bold text-xs">
                            {(p.costPrice || 0).toLocaleString()} IQD
                          </td>
                          <td className="px-6 py-4 text-indigo-600 font-black text-sm">
                            {(p.price || 0).toLocaleString()} IQD
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-black ${
                              p.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                            }`}>
                              {p.stock} {p.isWeighed ? 'کگم' : 'دانە'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-500">
                            {p.barcode || '-'}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setLabelProduct(p)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-xl transition-colors cursor-pointer"
                                title="چاپکردنی لابل"
                              >
                                <Printer size={16} />
                              </button>
                              <button
                                onClick={() => openEditModal(p)}
                                className="px-3 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl transition-all cursor-pointer font-bold text-xs flex items-center gap-1 shadow-2xs"
                                title="دەستکاریکردن و دیاریکردنی کەتەگۆری"
                              >
                                <Edit size={14} />
                                <span>دیاریکردنی کەتەگۆری</span>
                              </button>
                              <button
                                onClick={() => setProductToDelete(p.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                                title="سڕینەوە"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* VIEW MODE 2: Filtered Products Table View */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
          {/* Active Filter Bar & Back Navigation */}
          <div className="p-4 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={resetToCategoryGrid}
                className="px-3 py-1.5 bg-white border border-gray-200 hover:border-indigo-500 text-indigo-700 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
              >
                <ArrowRight size={16} />
                <span>گەڕانەوە بۆ کاشیی کەتەگۆرییەکان</span>
              </button>

              <div className="flex items-center gap-2 bg-indigo-50 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-xl text-xs font-bold">
                <Tag size={14} className="text-indigo-600" />
                <span>
                  {selectedCategoryFilter !== 'all' && `کەتەگۆری: ${selectedCategoryFilter}`}
                  {selectedCompanyFilter !== 'all' && `شەریکە: ${selectedCompanyFilter}`}
                  {searchTerm && `گەڕان بۆ: "${searchTerm}"`}
                  {showAllProducts && selectedCategoryFilter === 'all' && selectedCompanyFilter === 'all' && 'هەموو کاڵاکان'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
              <span>ژمارەی کاڵای دۆزراوە:</span>
              <span className="px-2 py-0.5 bg-indigo-600 text-white rounded-md">{filteredProducts.length}</span>
            </div>
          </div>

          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <div className="flex gap-4 w-full sm:w-auto flex-wrap">
              <div className="relative max-w-md flex-1 sm:flex-none sm:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                  className="w-full pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">هەموو کەتەگۆرییەکان</option>
                {categories.map((c, idx) => (
                  <option key={idx} value={c}>{c}</option>
                ))}
              </select>
              <select
                value={selectedCompanyFilter}
                onChange={(e) => setSelectedCompanyFilter(e.target.value)}
                className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="all">هەموو شەریکەکان</option>
                {companies.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            {selectedProductIds.size > 0 && (
              <button
                onClick={() => setIsBulkEditModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-xl hover:bg-indigo-200 transition-colors font-medium"
              >
                <Edit size={18} />
                گۆڕینی بەکۆمەڵ ({selectedProductIds.size})
              </button>
            )}
          </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-sm font-medium text-gray-500 w-10">
                  <input
                    type="checkbox"
                    checked={filteredProducts.length > 0 && selectedProductIds.size === filteredProducts.length}
                    onChange={toggleAllSelection}
                    className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ناو</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">کەتەگۆری</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">شەریکە/جۆر</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">تێچووی دانە</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">نرخی دانە</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">تێچووی کۆ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">نرخی کۆ</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">قەبارەی تەک</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">قازانج (دانە)</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ستۆک</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">بارکۆد</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : filteredProducts.length === 0 ? (
                <tr><td colSpan={11} className="text-center py-8 text-gray-500">هیچ کالایەک نەدۆزرایەوە</td></tr>
              ) : (
                filteredProducts.map(product => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedProductIds.has(product.id)}
                        onChange={() => toggleProductSelection(product.id)}
                        className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                      />
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-900">
                      <div className="flex flex-col">
                        <span>{product.name}</span>
                        {product.isWeighed && <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full w-fit mt-1">بە کێش</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.category || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.company || '-'}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {(product.costPrice || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-gray-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-indigo-600 font-bold">
                      {product.price.toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-indigo-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {(product.wholesaleCost || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-gray-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-purple-600 font-bold">
                      {(product.wholesalePrice || 0).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-purple-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-medium">
                      {product.packSize || 1} دانە
                    </td>
                    <td className="px-6 py-4 text-green-600 font-bold">
                      {(product.price - (product.costPrice || 0)).toLocaleString()} IQD
                      {product.isWeighed && <span className="text-xs text-green-400 font-normal mr-1">/ کگم</span>}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${product.stock > 10 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {Number(product.stock.toFixed(3))} {product.isWeighed ? 'کگم' : 'دانە'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500 font-mono text-sm">{product.barcode}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setLabelProduct(product)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="چاپکردنی لابل"
                        >
                          <Printer size={18} />
                        </button>
                        <button
                          onClick={() => openEditModal(product)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setProductToDelete(product.id)}
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
      )}

      <ProductModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        editingProduct={editingProduct}
        activeSection={activeSection}
      />

      {/* Label Print Modal */}
      {labelProduct && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-bold text-gray-900">چاپکردنی لابل</h2>
            </div>
            <div className="p-6 flex justify-center">
              {/* The Label to Print */}
              <div className="border border-gray-300 p-4 w-64 text-center bg-white" dir="rtl">
                <h3 className="font-bold text-sm mb-1 truncate">{labelProduct.name}</h3>
                <p className="text-lg font-bold mb-2">{labelProduct.price.toLocaleString()} IQD</p>
                <div className="flex justify-center">
                  <Barcode value={labelProduct.barcode || '0000000000'} width={1.5} height={40} fontSize={12} />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50 flex gap-3">
              <button
                onClick={() => setLabelProduct(null)}
                className="flex-1 py-2 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
              >
                داخستن
              </button>
              <button
                onClick={handlePrintLabel}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                چاپکردن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Label for Printing */}
      {labelProduct && (
        <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999] print:p-0">
          <style type="text/css" media="print">
            {`
              @page {
                size: 50mm 30mm landscape;
                margin: 0;
              }
              html, body {
                width: 50mm;
                height: 30mm;
                margin: 0 !important;
                padding: 0 !important;
                overflow: hidden;
              }
              .print-label-wrapper {
                page-break-inside: avoid;
                page-break-after: avoid;
                page-break-before: avoid;
              }
            `}
          </style>
          <div ref={labelRef} className="print-label-wrapper w-[50mm] h-[30mm] flex flex-col items-center justify-center bg-white box-border p-1" dir="rtl">
            <h3 className="font-bold text-[11px] leading-tight mb-0.5 truncate w-full text-center px-1">{labelProduct.name}</h3>
            <p className="text-[13px] font-bold mb-0.5">{labelProduct.price.toLocaleString()} IQD</p>
            <div className="flex justify-center w-full overflow-hidden">
              <Barcode value={labelProduct.barcode || '0000000000'} width={1.2} height={25} fontSize={10} margin={0} displayValue={true} />
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={!!productToDelete}
        onClose={() => setProductToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی کالا"
        message="دڵنیایت لە سڕینەوەی ئەم کالایە؟ ئەم کردارە پاشگەزبوونەوەی نییە."
      />

      {/* Bulk Edit Modal */}
      {isBulkEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Edit className="text-indigo-600" />
              گۆڕینی بەکۆمەڵ ({selectedProductIds.size} کاڵا)
            </h2>
            <p className="text-sm text-gray-500 mb-6">تەنها ئەو خانانە پڕبکەرەوە کە دەتەوێت بیانگۆڕیت. ئەوانەی بەتاڵن وەک خۆیان دەمێننەوە.</p>
            
            <form onSubmit={handleBulkEditSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نرخی فرۆشتن (مفرد)</label>
                  <input
                    type="number"
                    value={bulkEditData.price}
                    onChange={(e) => setBulkEditData({...bulkEditData, price: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تێچووی مفرد</label>
                  <input
                    type="number"
                    value={bulkEditData.costPrice}
                    onChange={(e) => setBulkEditData({...bulkEditData, costPrice: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">نرخی فرۆشتن (جملە)</label>
                  <input
                    type="number"
                    value={bulkEditData.wholesalePrice}
                    onChange={(e) => setBulkEditData({...bulkEditData, wholesalePrice: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">تێچووی جملە</label>
                  <input
                    type="number"
                    value={bulkEditData.wholesaleCost}
                    onChange={(e) => setBulkEditData({...bulkEditData, wholesaleCost: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="بێ گۆڕانکاری..."
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">شەریکە</label>
                  <select
                    value={bulkEditData.company}
                    onChange={(e) => setBulkEditData({...bulkEditData, company: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">بێ گۆڕانکاری...</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">کەتەگۆری</label>
                  <select
                    value={bulkEditData.category}
                    onChange={(e) => setBulkEditData({...bulkEditData, category: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">بێ گۆڕانکاری...</option>
                    {categories.map((c, idx) => (
                      <option key={idx} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-6">
                <button
                  type="button"
                  onClick={() => setIsBulkEditModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50"
                >
                  {loading ? 'چاوەڕێبە...' : 'گۆڕینی کاڵاکان'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!categoryToDelete}
        onClose={() => setCategoryToDelete(null)}
        onConfirm={handleDeleteCategory}
        title="سڕینەوەی کەتەگۆری"
        message={`ئایا دڵنیایت لە سڕینەوەی کەتەگۆری «${categoryToDelete || ''}» لە ${activeSection === 'shisha' ? 'بەشی شیشە' : 'بەشی گشتی'}؟ ئەم کەتەگۆرییە لە فایربەیس و هەموو پەڕەکان دەسڕدرێتەوە.`}
      />

      {/* Add Category Modal */}
      {isAddCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Plus className="text-indigo-600" size={22} />
                <span>زیادکردنی کەتەگۆری نوێ</span>
              </h3>
              <button
                onClick={() => setIsAddCategoryModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddCategory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  بەش:
                </label>
                <div className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-black text-gray-700 flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${activeSection === 'shisha' ? 'bg-purple-600' : 'bg-indigo-600'}`} />
                  <span>{activeSection === 'shisha' ? 'بەشی شیشە' : 'بەشی گشتی'}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ناوی کەتەگۆری:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ناوی کەتەگۆری نوێ لێرە بنووسە..."
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm font-bold text-gray-800 outline-none transition-all"
                />
              </div>

              {newCategoryName.trim() && (
                <div className="p-3 bg-indigo-50/50 rounded-2xl flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-xs">
                    {renderCategoryIcon(newCategoryName.trim())}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 block">پێشبینینی ئایکۆن:</span>
                    <span className="text-xs font-black text-indigo-900">{newCategoryName.trim()}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddCategoryModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingCategory ? (
                    <span>پاشەکەوتکردن...</span>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>پاشەکەوتکردن لە فایربەیس</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Category Name Modal */}
      {isEditCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4 print:hidden animate-fade-in">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl border border-gray-100">
            <div className="flex justify-between items-center pb-4 border-b border-gray-100">
              <h3 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <Edit className="text-indigo-600" size={22} />
                <span>دەستکاریکردنی ناوی کەتەگۆری</span>
              </h3>
              <button
                onClick={() => setIsEditCategoryModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleEditCategory} className="space-y-4 mt-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ناوی کۆنی کەتەگۆری:
                </label>
                <div className="px-3.5 py-2.5 bg-gray-100 rounded-xl text-xs font-black text-gray-600">
                  {categoryToEdit}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  ناوی نوێی کەتەگۆری:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="ناوی نوێی کەتەگۆری لێرە بنووسە..."
                  value={editedCategoryName}
                  onChange={(e) => setEditedCategoryName(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 focus:border-indigo-500 focus:bg-white rounded-xl text-sm font-bold text-gray-800 outline-none transition-all"
                />
                <p className="text-[11px] text-gray-500 font-medium mt-1">
                  ناوی ئەم کەتەگۆرییە لە فایربەیس و لە سەرجەم ئەو کاڵایانەی ئەم کەتەگۆرییەیان هەیە بە شێوەیەکی ئۆتۆماتیکی نوێ دەکرێتەوە.
                </p>
              </div>

              {editedCategoryName.trim() && (
                <div className="p-3 bg-indigo-50/50 rounded-2xl flex items-center gap-3">
                  <div className="p-2.5 bg-white rounded-xl shadow-xs">
                    {renderCategoryIcon(editedCategoryName.trim())}
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 block">پێشبینینی ئایکۆن:</span>
                    <span className="text-xs font-black text-indigo-900">{editedCategoryName.trim()}</span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditCategoryModalOpen(false)}
                  className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  پاشگەزبوونەوە
                </button>
                <button
                  type="submit"
                  disabled={isSavingEditedCategory}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingEditedCategory ? (
                    <span>پاشەکەوتکردن...</span>
                  ) : (
                    <>
                      <CheckCircle size={16} />
                      <span>پاشەکەوتکردنی گۆڕانکاری</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
