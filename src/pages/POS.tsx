import React, { useState, useEffect, useRef, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { collection, addDoc, setDoc, serverTimestamp, doc, updateDoc, increment, arrayUnion, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/CartContext';
import { Camera, Search, Plus, Minus, Trash2, Printer, CreditCard, ShoppingCart, Package, UserPlus, Clock, Scale, Coins, Calculator, CheckCircle, X, Pause, List, ScanLine, Gift, Edit, Smartphone, Wifi, WifiOff, Battery, BatteryCharging, BatteryMedium, BatteryFull, BatteryLow, Maximize, Minimize, LayoutGrid, Tag, ArrowRight, Leaf, Wind, Flame, Beaker, Gamepad2, ThermometerSun, PackageSearch, Droplet, Coffee, Scissors, Layers, Zap, Wrench, Sparkles, CloudFog, Box, ShoppingBag, Star, Heart, Music, Book, Briefcase, Umbrella, Bell, Cigarette, Activity, Coffee as CupSoda, FileBox, Grape, FlaskConical, Dices, Cuboid, Blocks, GlassWater, Play, Snowflake, Compass, Percent } from 'lucide-react';
import { cacheProducts, getCachedProducts } from '../services/db';
import { hasPack, getPackSize, getPackPrice, asPackLine } from '../utils/packUtils';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { useReactToPrint } from 'react-to-print';
import { isProductInSection, SECTION_LABELS, StoreSection } from '../utils/sectionUtils';
import { getScaleConfig, parseScaleBarcode, matchesScaleCode, quantityFromScaleLabel, roundWeighedPrice, getActiveRoundingConfig } from '../utils/scaleBarcode';
import { ThermalReceipt } from '../components/receipts/ThermalReceipt';
import { A4Receipt } from '../components/receipts/A4Receipt';
import { defaultGeneralCategories, isGeneralCategory, isShishaProduct as checkIsShisha, isCategoryMatch, normalizeCategoryText, detectCategoryFromNameOrCat, getCanonicalCategoryName, deduplicateCategories } from '../utils/categoryUtils';

export default function POS() {
  const { setShowFirebaseSetup, userData } = useAuth();
  const canEditImages = userData?.role === 'admin' || userData?.role === 'manager';
  const { activeShift, setOpenStartModal } = useShift();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fastCode, setFastCode] = useState('');
  const [loading, setLoading] = useState(true);
  const { cart, addToCart, removeFromCart, updateQuantity, setItemDiscount, toggleGift, clearCart, discount, setDiscount, additionalCharge, setAdditionalCharge, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart } = useCart();
  const [discountModalItem, setDiscountModalItem] = useState<{
    item: any;
    value: string;
    mode: 'amount' | 'percent';
  } | null>(null);
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'debt', 'fib'
  const [paymentCurrency, setPaymentCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidUsd, setAmountPaidUsd] = useState(0);
  const [lastReceiptNumber, setLastReceiptNumber] = useState<string>('');
  const receiptRef = useRef<HTMLDivElement>(null);
  const a4ReceiptRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState<any>({ shopName: 'aras hookah shop', phone: '', address: '', receiptFooter: 'دروستکراوە لەلایەن ماس مێنو' });
  const [activeSection, setActiveSection] = useState<StoreSection>('general');
  const [isWholesale, setIsWholesale] = useState(false);
  const [usdExchangeRate, setUsdExchangeRate] = useState(1500);
  const [isUpdatingRate, setIsUpdatingRate] = useState(false);
  
  // Debt specific states
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [checkoutState, setCheckoutState] = useState<'idle' | 'processing' | 'success-print' | 'success-no-print'>('idle');
  
  // Weighed Product State
  const [selectedWeighedProduct, setSelectedWeighedProduct] = useState<any>(null);
  // Several products share the scanned barcode (e.g. one barcode for all flavours): cashier picks one
  const [barcodeChoices, setBarcodeChoices] = useState<{ product: any; mode: 'single' | 'pack' }[] | null>(null);
  const [weighedAmount, setWeighedAmount] = useState<string>('');
  const [weighedPrice, setWeighedPrice] = useState<string>('');
  // Unlinked scale barcode state
  const [unlinkedScaleScan, setUnlinkedScaleScan] = useState<{
    itemCode: string;
    value: number;
    valueType: 'weight' | 'price';
    rawCode: string;
  } | null>(null);
  const [linkingProduct, setLinkingProduct] = useState(false);
  const [linkingSearch, setLinkingSearch] = useState('');
  


  const [generalCustomCategories, setGeneralCustomCategories] = useState<string[]>([]);
  const [shishaCustomCategories, setShishaCustomCategories] = useState<string[]>([]);
  const [packetCustomCategories, setPacketCustomCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  // The window that lists one type's products ('__all__' = every type of the category)
  const [typePanel, setTypePanel] = useState<string | null>(null);
  const [categoryIcons, setCategoryIcons] = useState<Record<string, string>>({});
  // Pictures for the types (companies) shown inside a category, stored in settings/company_icons
  const [companyIcons, setCompanyIcons] = useState<Record<string, string>>({});
  const [companyDocLogos, setCompanyDocLogos] = useState<Record<string, string>>({});
  const companyImageInputRef = useRef<HTMLInputElement>(null);
  const [companyImageTarget, setCompanyImageTarget] = useState<string | null>(null);

  // External product modals & state
  const [isAddExternalModalOpen, setIsAddExternalModalOpen] = useState(false);
  const [isQuickCustomModalOpen, setIsQuickCustomModalOpen] = useState(false);

  const [newExtName, setNewExtName] = useState('');
  const [newExtPrice, setNewExtPrice] = useState('');
  const [newExtCost, setNewExtCost] = useState('');
  const [newExtStock, setNewExtStock] = useState('100');
  const [newExtCategory, setNewExtCategory] = useState('کاڵای دەرەکی');
  const [isSubmittingExternal, setIsSubmittingExternal] = useState(false);

  // Quick custom item state
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemQty, setCustomItemQty] = useState('1');

  const handleSaveNewExternalProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newExtName.trim() || !newExtPrice) {
      alert("تکایە ناوی کاڵا و نرخی فرۆشتن بنووسە.");
      return;
    }
    setIsSubmittingExternal(true);
    try {
      const priceNum = parseFloat(newExtPrice) || 0;
      const costNum = parseFloat(newExtCost) || 0;
      const stockNum = parseFloat(newExtStock) || 0;

      const newDoc = {
        name: newExtName.trim(),
        price: priceNum,
        costPrice: costNum,
        stock: stockNum,
        category: newExtCategory.trim() || 'کاڵای دەرەکی',
        company: 'دەرەکی',
        section: 'external',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'products'), newDoc);
      const createdProduct = { id: docRef.id, ...newDoc };

      addToCart(createdProduct);

      setNewExtName('');
      setNewExtPrice('');
      setNewExtCost('');
      setNewExtStock('100');
      setIsAddExternalModalOpen(false);
      alert("✅ کاڵای دەرەکی بە سەرکەوتوویی زیادکرا و خستریتە سەبەتە!");
    } catch (err: any) {
      console.error("Error saving external product:", err);
      alert("❌ هەڵەیەک ڕوویدا لە زیادکردنی کاڵای دەرەکی.");
    } finally {
      setIsSubmittingExternal(false);
    }
  };

  const handleAddQuickCustomItemToCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customItemName.trim() || !customItemPrice) {
      alert("تکایە ناوی کاڵا و نرخ بنووسە.");
      return;
    }
    const priceNum = parseFloat(customItemPrice) || 0;
    const qtyNum = parseInt(customItemQty) || 1;

    const customProduct = {
      id: 'ext-custom-' + Date.now(),
      name: customItemName.trim(),
      price: priceNum,
      costPrice: 0,
      stock: 9999,
      category: 'کاڵای دەستی',
      company: 'دەرەکی',
      section: 'external',
      isCustom: true
    };

    for (let i = 0; i < qtyNum; i++) {
      addToCart(customProduct);
    }

    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemQty('1');
    setIsQuickCustomModalOpen(false);
  };

  const handleProductClick = useCallback((product: any, forceMode?: 'single' | 'pack') => {
    // A scanned pack barcode always sells a pack; a scanned unit barcode always sells a unit.
    // Without a forced mode, the تەک / کۆتە toggle decides.
    const asPack = forceMode ? (forceMode === 'pack' && hasPack(product)) : isWholesale;
    const productToAdd = asPack ? asPackLine(product) : { ...product, isWholesale: false };

    if (product.isWeighed) {
      setSelectedWeighedProduct(productToAdd);
      setWeighedAmount('');
      setWeighedPrice('');
    } else {
      addToCart(productToAdd);
    }
  }, [isWholesale, addToCart, activeSection]);

  const handlePrintAction = useReactToPrint({
    contentRef: receiptRef,
    documentTitle: 'Receipt',
    onAfterPrint: () => {
      clearCart();
      setIsCheckoutModalOpen(false);
      setAmountPaid(0);
      setPaymentMethod('cash');
      setSelectedCustomerId('');
      setIsNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCheckoutState('idle');
    }
  });

  const handlePrintA4Action = useReactToPrint({
    contentRef: a4ReceiptRef,
    documentTitle: 'A4 Receipt',
    onAfterPrint: () => {
      clearCart();
      setIsCheckoutModalOpen(false);
      setAmountPaid(0);
      setPaymentMethod('cash');
      setSelectedCustomerId('');
      setIsNewCustomer(false);
      setNewCustomerName('');
      setNewCustomerPhone('');
      setCheckoutState('idle');
    }
  });

  useEffect(() => {
    let unsubSettings: () => void;
    let unsubDebts: () => void;
    let unsubProducts: () => void;
    let unsubCatGen: () => void;
    let unsubCatShisha: () => void;
    let unsubCatPacket: () => void;
    let unsubCompanyIcons: () => void;
    let unsubCompanies: () => void;
    let unsubCatIcons: () => void;

    const loadData = async () => {
      try {
        // Load Settings
        const docRef = doc(db, 'settings', 'general');
        unsubSettings = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as any;
            setSettings(data);
            if (data.usdExchangeRate && !isUpdatingRate) {
              setUsdExchangeRate(data.usdExchangeRate);
            }
          }
        }, (e: any) => console.warn("Could not load settings:", e));

        // Load Categories in Realtime
        unsubCatGen = onSnapshot(doc(db, 'settings', 'general_categories'), (snap) => {
          if (snap.exists() && Array.isArray(snap.data().list)) {
            setGeneralCustomCategories(deduplicateCategories(snap.data().list));
          } else {
            setGeneralCustomCategories(defaultGeneralCategories);
          }
        }, (err) => console.warn("Error loading general categories:", err));

        unsubCatShisha = onSnapshot(doc(db, 'settings', 'shisha_categories'), (snap) => {
          if (snap.exists() && Array.isArray(snap.data().list)) {
            setShishaCustomCategories(deduplicateCategories(snap.data().list.filter((c: string) => !isGeneralCategory(c))));
          } else {
            setShishaCustomCategories([]);
          }
        }, (err) => console.warn("Error loading shisha categories:", err));

        unsubCompanyIcons = onSnapshot(doc(db, 'settings', 'company_icons'), (snap) => {
          setCompanyIcons(snap.exists() ? (snap.data().icons || {}) : {});
        }, (err) => console.warn("Error loading company icons:", err));

        unsubCompanies = onSnapshot(collection(db, 'companies'), (snap) => {
          const compMap: Record<string, string> = {};
          snap.docs.forEach(d => {
            const data = d.data();
            if (data.name && data.logoUrl) {
              compMap[data.name] = data.logoUrl;
            }
          });
          setCompanyDocLogos(compMap);
        }, (err) => console.warn("Error loading companies in POS:", err));

        unsubCatPacket = onSnapshot(doc(db, 'settings', 'packet_categories'), (snap) => {
          setPacketCustomCategories(snap.exists() && Array.isArray(snap.data().list) ? deduplicateCategories(snap.data().list) : []);
        }, (err) => console.warn("Error loading packet categories:", err));

        // Load Category Custom Icons in Realtime
        unsubCatIcons = onSnapshot(doc(db, 'settings', 'category_icons'), (snap) => {
          if (snap.exists()) {
            const data = snap.data();
            setCategoryIcons(data.icons || data || {});
          }
        }, (err) => console.warn("Error loading category icons:", err));

        // Load Customers (Debts)
        const q = query(collection(db, 'debts'), orderBy('createdAt', 'desc'));
        unsubDebts = onSnapshot(q, (querySnapshot) => {
          setCustomers(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }, (e: any) => console.warn("Could not load customers:", e));

        // Try to load from cache first for instant render
        const cached = await getCachedProducts();
        if (cached && cached.length > 0) {
          setProducts(cached);
          setLoading(false);
        }

        // Fetch from Firestore and update cache
        unsubProducts = onSnapshot(collection(db, 'products'), async (productsSnapshot) => {
          const fetchedProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          setProducts(fetchedProducts);
          await cacheProducts(fetchedProducts);
          setLoading(false);
        }, (e: any) => {
          console.warn("Could not fetch products from server:", e);
          if (e.code === 'permission-denied') {
            setShowFirebaseSetup(true);
          }
          setLoading(false);
        });

      } catch (error: any) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };

    loadData();

    return () => {
      if (unsubSettings) unsubSettings();
      if (unsubDebts) unsubDebts();
      if (unsubProducts) unsubProducts();
      if (unsubCatGen) unsubCatGen();
      if (unsubCatShisha) unsubCatShisha();
      if (unsubCatPacket) unsubCatPacket();
      if (unsubCompanyIcons) unsubCompanyIcons();
      if (unsubCompanies) unsubCompanies();
      if (unsubCatIcons) unsubCatIcons();
    };
  }, [setShowFirebaseSetup]);

  // The Firestore list is the only source (defaults are applied by the loader only when the list does not exist),
  // so deleted default categories never flash on screen while loading
  const generalCategories = generalCustomCategories;

  const shishaCategories = React.useMemo(() => {
    // Dynamic categories from all products belonging to shisha
    const dynamicCats = products
      .filter(p => checkIsShisha(p))
      .map(p => (p.category || '').trim())
      .filter(c => c && !isGeneralCategory(c));
    return deduplicateCategories([...shishaCustomCategories, ...dynamicCats]).filter(c => !isGeneralCategory(c));
  }, [shishaCustomCategories, products]);

  const packetCategories = React.useMemo(() => {
    const dynamicCats = products
      .filter(p => p.section === 'packet')
      .map(p => (p.category || '').trim())
      .filter(Boolean);
    return deduplicateCategories([...packetCustomCategories, ...dynamicCats]);
  }, [packetCustomCategories, products]);

  // Categories shown as tiles for the active section
  const sectionCategories = activeSection === 'shisha' ? shishaCategories : activeSection === 'packet' ? packetCategories : generalCategories;
  const hasCategoryTiles = activeSection === 'general' || activeSection === 'shisha' || activeSection === 'packet';

  const openTypePanel = (company: string | null) => {
    setSelectedCompany(company || 'all');
    setTypePanel(company || '__all__');
  };
  const closeTypePanel = () => {
    setTypePanel(null);
    setSelectedCompany('all');
  };

  useEffect(() => {
    if (!typePanel) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeTypePanel(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [typePanel]);

  // A search, a new category or a new section always closes the type window
  useEffect(() => {
    setTypePanel(null);
  }, [selectedCategory, activeSection]);

  // One product grid used by the main area and the type window
  const renderProductGrid = (list: any[]) => (
    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
      {list.map((product: any) => {
        const displayPrice = Number(isWholesale ? (product.wholesalePrice || product.price) : product.price) || 0;
        const stock = Number(Number(product.stock || 0).toFixed(3));
        const lowStock = stock <= 0;
        return (
          <button
            key={product.id}
            onClick={() => handleProductClick(product)}
            className={`relative flex flex-col text-right p-2.5 rounded-xl border bg-white transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer active:scale-[0.98] ${
              isWholesale ? 'border-purple-100 hover:border-purple-300' : `border-gray-200 ${sectionTheme.hover}`
            }`}
          >
            <div className="flex items-start justify-between gap-1 mb-1.5">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isWholesale ? 'bg-purple-50 text-purple-500' : `${sectionTheme.soft} ${sectionTheme.text}`}`}>
                {product.isWeighed ? <Scale size={18} /> : <Package size={18} />}
              </div>
              {product.shortcutKey && (
                <span className="text-[10px] font-mono font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded" dir="ltr">{product.shortcutKey}</span>
              )}
            </div>
            <span className="font-bold text-[12px] text-gray-800 line-clamp-2 leading-tight min-h-[2.1em]">{product.name}</span>
            <span className={`mt-1 font-black text-sm ${isWholesale ? 'text-purple-600' : sectionTheme.text}`}>
              {displayPrice.toLocaleString()} <span className="text-[10px] font-bold opacity-70">IQD{product.isWeighed ? ' / کگم' : ''}</span>
            </span>
            {isWholesale && (
              <div className="w-full flex flex-col text-[9px] mt-1 gap-0.5">
                <span className="text-purple-700 font-bold bg-purple-50 rounded px-1 py-0.5">کۆ: {(product.wholesalePrice || 0).toLocaleString()}</span>
                <span className="text-rose-700 font-bold bg-rose-50 rounded px-1 py-0.5">تێچوو: {(product.wholesaleCost || product.costPrice * (product.packSize || 1) || 0).toLocaleString()}</span>
              </div>
            )}
            <span className={`mt-1.5 self-start text-[10px] font-bold px-1.5 py-0.5 rounded-md ${lowStock ? 'bg-rose-50 text-rose-600' : 'bg-gray-100 text-gray-500'}`}>
              ستۆک: {stock} {product.isWeighed ? 'کگم' : 'دانە'}
            </span>
          </button>
        );
      })}
    </div>
  );

  // Switching section empties the cart (a sale belongs to one section)
  const switchSection = (sec: StoreSection) => {
    if (sec === activeSection) return;
    if (cart.length > 0 && !window.confirm('گۆڕینی بەش سەبەتەکەت بەتاڵ دەکاتەوە. دڵنیایت؟')) return;
    if (cart.length > 0) clearCart();
    setActiveSection(sec);
    setSelectedCategory('all');
    setSelectedCompany('all');
    setTypePanel(null);
  };

  const pickCompanyImage = (company: string) => {
    setCompanyImageTarget(company);
    companyImageInputRef.current?.click();
  };

  const handleCompanyImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const company = companyImageTarget;
    e.target.value = '';
    if (!file || !company) return;
    if (!file.type.startsWith('image/')) {
      alert('تکایە تەنها فایلی وێنە هەڵبژێرە');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = async () => {
        // Keep transparent and auto-convert white strokes to dark charcoal while keeping colors
        const MAX = 260;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imgData.data;
        const totalPixels = canvas.width * canvas.height;
        let transparentPixels = 0;
        let whitePixels = 0;
        let visiblePixels = 0;

        for (let i = 0; i < data.length; i += 4) {
          const a = data[i + 3];
          if (a < 40) {
            transparentPixels++;
          } else {
            visiblePixels++;
            const r = data[i], g = data[i + 1], b = data[i + 2];
            const lum = (r * 299 + g * 587 + b * 114) / 1000;
            const sat = Math.max(r, g, b) - Math.min(r, g, b);
            if (lum > 175 && sat < 35) {
              whitePixels++;
            }
          }
        }

        const isWhiteOnTransparent = transparentPixels > (totalPixels * 0.04) && visiblePixels > 20 && (whitePixels / visiblePixels > 0.35);
        if (isWhiteOnTransparent) {
          for (let i = 0; i < data.length; i += 4) {
            const a = data[i + 3];
            if (a >= 25) {
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const lum = (r * 299 + g * 587 + b * 114) / 1000;
              const sat = Math.max(r, g, b) - Math.min(r, g, b);
              if (lum > 170 && sat < 35) {
                data[i] = 24;
                data[i + 1] = 24;
                data[i + 2] = 27;
              }
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        const dataUrl = canvas.toDataURL('image/png');
        try {
          await setDoc(doc(db, 'settings', 'company_icons'), { icons: { [company]: dataUrl } }, { merge: true });
        } catch (err: any) {
          console.error('Error saving company image:', err);
          alert('هەڵەیەک ڕوویدا لە پاشەکەوتکردنی وێنەکە: ' + (err?.message || ''));
        }
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const removeCompanyImage = async (company: string) => {
    if (!window.confirm(`وێنەی «${company}» لاببرێت؟`)) return;
    const next = { ...companyIcons };
    delete next[company];
    try {
      await setDoc(doc(db, 'settings', 'company_icons'), { icons: next });
    } catch (err: any) {
      alert('هەڵەیەک ڕوویدا: ' + (err?.message || ''));
    }
  };

  const sectionTheme = {
    general: { solid: 'bg-indigo-600', soft: 'bg-indigo-50', text: 'text-indigo-700', ring: 'ring-indigo-500', border: 'border-indigo-200', hover: 'hover:border-indigo-400' },
    shisha: { solid: 'bg-purple-600', soft: 'bg-purple-50', text: 'text-purple-700', ring: 'ring-purple-500', border: 'border-purple-200', hover: 'hover:border-purple-400' },
    packet: { solid: 'bg-amber-600', soft: 'bg-amber-50', text: 'text-amber-700', ring: 'ring-amber-500', border: 'border-amber-200', hover: 'hover:border-amber-400' },
    external: { solid: 'bg-emerald-600', soft: 'bg-emerald-50', text: 'text-emerald-700', ring: 'ring-emerald-500', border: 'border-emerald-200', hover: 'hover:border-emerald-400' },
  }[activeSection];

  const isShishaProduct = useCallback((p: any) => {
    return checkIsShisha(p);
  }, []);

  const availableCompanies = React.useMemo(() => {
    if (selectedCategory === 'all') return [];
    const companies = products
      .filter(p => {
        const matchesSection = isProductInSection(p, activeSection);
        const effectiveCategory = p.category || detectCategoryFromNameOrCat(p.category, p.name)?.category;
        const matchesCat = isCategoryMatch(effectiveCategory, selectedCategory);
        return matchesSection && matchesCat && p.company;
      })
      .map(p => p.company);
    return Array.from(new Set(companies));
  }, [products, selectedCategory, activeSection, isShishaProduct]);

  const filteredProducts = products.filter(p => {
    const matchesSection = isProductInSection(p, activeSection);

    if (!matchesSection) return false;

    const effectiveCategory = p.category || detectCategoryFromNameOrCat(p.category, p.name)?.category;

    // RULE: Any product in general or shisha that has been assigned to a category must NOT appear in the root 'all' view when not searching!
    // It should ONLY appear when its category is clicked.
    // Products whose category no longer exists in the list stay visible here, so nothing can disappear.
    if (hasCategoryTiles && selectedCategory === 'all' && !searchTerm.trim()) {
      const visibleCategories = sectionCategories;
      if (effectiveCategory && visibleCategories.some(c => isCategoryMatch(effectiveCategory, c))) {
        return false;
      }
    }

    if (selectedCategory !== 'all') {
      if (!isCategoryMatch(effectiveCategory, selectedCategory)) {
        return false;
      }
    }
    if (selectedCompany !== 'all' && p.company !== selectedCompany) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const matchesSearch = (p.name && p.name.toLowerCase().includes(term)) || 
        (p.barcode && String(p.barcode).includes(term)) ||
        (p.packBarcode && String(p.packBarcode).includes(term)) ||
        (p.shortcutKey && p.shortcutKey.toLowerCase().includes(term));
      if (!matchesSearch) return false;
    }
    if (isWholesale && (!p.wholesalePrice || p.wholesalePrice <= 0)) return false;
    return true;
  });

  // If selected category changes, reset company
  useEffect(() => {
    setSelectedCompany('all');
  }, [selectedCategory]);

  // Finds every product a scanned/typed code refers to (unit barcode, pack barcode or shortcut key)
  const findProductsByCode = useCallback((rawCode: string) => {
    const code = rawCode.trim();
    if (!code) return [];
    const lower = code.toLowerCase();
    const matches: { product: any; mode?: 'single' | 'pack' }[] = [];
    for (const p of products) {
      if (p.barcode && String(p.barcode).trim().toLowerCase() === lower) {
        matches.push({ product: p, mode: 'single' });
      } else if (p.packBarcode && String(p.packBarcode).trim().toLowerCase() === lower) {
        matches.push({ product: p, mode: 'pack' });
      } else if (p.shortcutKey && String(p.shortcutKey).trim().toLowerCase() === lower) {
        matches.push({ product: p });
      }
    }
    return matches;
  }, [products]);

  // Link an unlinked scale barcode directly to a product from the modal
  const handleLinkScaleProduct = async (product: any) => {
    if (!unlinkedScaleScan) return;
    setLinkingProduct(true);
    try {
      await updateDoc(doc(db, 'products', product.id), {
        isWeighed: true,
        scaleCode: unlinkedScaleScan.itemCode,
      });

      const updatedProduct = {
        ...product,
        isWeighed: true,
        scaleCode: unlinkedScaleScan.itemCode,
      };

      const parsed: any = {
        flag: unlinkedScaleScan.rawCode.slice(0, 2),
        itemCode: unlinkedScaleScan.itemCode,
        value: unlinkedScaleScan.value,
        valueType: unlinkedScaleScan.valueType,
        checkDigitOk: true,
        rawCode: unlinkedScaleScan.rawCode,
      };

      const qty = quantityFromScaleLabel(parsed, updatedProduct, usdExchangeRate) || 1;
      const unitPrice = updatedProduct.price || 0;
      let rawPrice = unitPrice * qty;
      if (parsed.valueType === 'price') {
        if (updatedProduct.isUsdMode || parsed.value < 500) {
          rawPrice = parsed.value * (usdExchangeRate || 1500);
        } else {
          rawPrice = parsed.value;
        }
      }
      const scaleConfig = getScaleConfig(settings?.scaleBarcode);
      const roundingRes = roundWeighedPrice(rawPrice, scaleConfig.rounding);

      addToCart({ ...updatedProduct, isWholesale: false }, qty, {
        linePrice: roundingRes.rounded,
        rawLinePrice: roundingRes.raw,
        forceSeparateLine: true,
      });
      setUnlinkedScaleScan(null);
      setLinkingSearch('');
    } catch (err) {
      console.error('Error linking product to scale code:', err);
      alert('هەڵەیەک ڕوویدا لە کاتی بەستنەوەی کاڵاکە');
    } finally {
      setLinkingProduct(false);
    }
  };

  // Handles scanned barcodes (normal, pack, shortcuts, or scale labels)
  const handleScannedCode = useCallback((rawCode: string) => {
    const code = String(rawCode || '').trim();
    if (!code) return false;

    // First: Check if this is a scale barcode (TM-30A / EAN-13 weight or price label)
    const scaleConfig = getScaleConfig(settings?.scaleBarcode);
    const parsedScale = parseScaleBarcode(code, scaleConfig);

    if (parsedScale) {
      const product = products.find(p => matchesScaleCode(p, parsedScale.itemCode));
      if (product) {
        const qty = quantityFromScaleLabel(parsedScale, product, usdExchangeRate);
        if (qty && qty > 0) {
          const unitPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;
          let rawPrice = (unitPrice || 0) * qty;

          if (parsedScale.valueType === 'price') {
            if (product.isUsdMode || parsedScale.value < 500) {
              rawPrice = parsedScale.value * (usdExchangeRate || 1500);
            } else {
              rawPrice = parsedScale.value;
            }
          }

          const roundingRes = roundWeighedPrice(rawPrice, scaleConfig.rounding);

          addToCart({ ...product, isWholesale: false }, qty, {
            linePrice: roundingRes.rounded,
            rawLinePrice: roundingRes.raw,
            forceSeparateLine: true,
          });
          return true;
        } else {
          alert('کێش یان نرخی ناو بارکۆدی قەپان دروست نییە');
          return true;
        }
      } else {
        // Weighed sticker scanned, but not linked to any product yet -> open interactive modal
        setUnlinkedScaleScan({
          itemCode: parsedScale.itemCode,
          value: parsedScale.value,
          valueType: parsedScale.valueType,
          rawCode: parsedScale.rawCode,
        });
        return true;
      }
    }

    // Second: Normal barcode matching
    const matches = findProductsByCode(code);
    if (matches.length === 1) {
      handleProductClick(matches[0].product, matches[0].mode);
      return true;
    } else if (matches.length > 1) {
      setBarcodeChoices(matches.map(m => ({ product: m.product, mode: m.mode || (isWholesale ? 'pack' : 'single') })));
      return true;
    }

    return false;
  }, [findProductsByCode, handleProductClick, isWholesale, settings, products, addToCart, usdExchangeRate]);

  // Keyboard selection inside the barcode chooser: 1-9 picks, Escape closes
  useEffect(() => {
    if (!barcodeChoices) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setBarcodeChoices(null);
      } else if (/^[1-9]$/.test(e.key)) {
        const choice = barcodeChoices[Number(e.key) - 1];
        if (choice) {
          handleProductClick(choice.product, choice.mode);
          setBarcodeChoices(null);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [barcodeChoices, handleProductClick]);

  // Barcode and Shortcut scanner listener
  useEffect(() => {
    if (barcodeChoices || unlinkedScaleScan) return;
    let barcode = '';
    let timeout: any;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter') {
        if (barcode) {
          handleScannedCode(barcode);
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          // If 8 or more characters arrived rapidly, it's a barcode scan without Enter suffix
          if (barcode.length >= 8) {
            handleScannedCode(barcode);
            barcode = '';
            return;
          }
          const shortcutProduct = products.find(p => p.shortcutKey && p.shortcutKey.toLowerCase() === barcode.toLowerCase());
          if (shortcutProduct && barcode.length <= 5) {
            handleProductClick(shortcutProduct);
            barcode = '';
          } else {
            barcode = '';
          }
        }, 300);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, handleProductClick, handleScannedCode, barcodeChoices, unlinkedScaleScan]);

  const handleUpdateExchangeRate = async (newRate: number) => {
    setUsdExchangeRate(newRate);
    setIsUpdatingRate(true);
    try {
      await updateDoc(doc(db, 'settings', 'general'), {
        usdExchangeRate: newRate
      });
    } catch (error) {
      console.error("Error updating exchange rate:", error);
    } finally {
      setTimeout(() => setIsUpdatingRate(false), 1000);
    }
  };

  const handleCheckout = async (shouldPrint: boolean | 'a4' = true) => {
    if (cart.length === 0) return;

    if (!activeShift) {
      alert("⚠️ ناتوانیت فرۆشتن بکەیت! تکایە سەرەتا شەفت دەستپێبکە.");
      setCheckoutState('idle');
      setIsCheckoutModalOpen(false);
      setOpenStartModal(true);
      return;
    }
    
    if (paymentMethod === 'debt') {
      if (!isNewCustomer && !selectedCustomerId) {
        alert("تکایە کڕیار هەڵبژێرە");
        return;
      }
      if (isNewCustomer && !newCustomerName) {
        alert("تکایە ناوی کڕیار بنووسە");
        return;
      }
    }

    setCheckoutState('processing');

    try {
      const receiptNumber = `REC-${Date.now()}`;
      setLastReceiptNumber(receiptNumber);
      
      let finalCustomerId = paymentMethod === 'debt' ? selectedCustomerId : null;

      // Handle Debt First
      if (paymentMethod === 'debt') {
        const remainingAmount = total - amountPaid;
        const purchaseEntry = {
          amount: remainingAmount || 0, // Only the unpaid part is logged as debt
          date: new Date().toISOString(),
          note: `کڕینی نوێ (کۆی گشتی: ${total} - دراو: ${amountPaid})`,
          receiptNumber: receiptNumber,
          subtotal: subtotal || 0,
          discount: discount || 0,
          additionalCharge: additionalCharge || 0,
          total: total || 0,
          items: cart.map(item => ({
            id: item.originalId || item.id || '',
            name: item.name || '',
            quantity: item.quantity || 1,
            price: item.price || 0,
            wholesalePrice: item.wholesalePrice || 0,
            costPrice: item.costPrice || 0,
            wholesaleCost: item.wholesaleCost || 0,
            isWholesale: item.isWholesale || false,
            isGift: item.isGift || false,
            isWeighed: item.isWeighed || false,
            linePrice: item.linePrice,
            rawLinePrice: item.rawLinePrice,
            itemDiscount: Number(item.itemDiscount) || 0,
            category: item.category || '',
            packSize: item.packSize || 1
          }))
        };

        if (isNewCustomer) {
          // The id is generated locally, so the sale is always linked to the customer (also offline)
          const newDebtRef = doc(collection(db, 'debts'));
          finalCustomerId = newDebtRef.id;
          setDoc(newDebtRef, {
            customerName: newCustomerName || '',
            phone: newCustomerPhone || '',
            totalAmount: remainingAmount || 0,
            paidAmount: 0,
            remainingAmount: remainingAmount || 0,
            status: remainingAmount <= 0 ? 'paid' : 'unpaid',
            createdAt: serverTimestamp(),
            payments: [],
            purchases: [purchaseEntry]
          }).catch((error: any) => {
            console.error("Error adding debt:", error);
            if (error.code === 'permission-denied') setShowFirebaseSetup(true);
          });
        } else {
          // Atomic increments: two devices selling to the same customer can no longer overwrite each other
          const customer = customers.find(c => c.id === selectedCustomerId);
          const estimatedRemaining = (customer?.remainingAmount || 0) + remainingAmount;
          updateDoc(doc(db, 'debts', selectedCustomerId), {
            totalAmount: increment(remainingAmount || 0),
            remainingAmount: increment(remainingAmount || 0),
            status: estimatedRemaining <= 0 ? 'paid' : 'unpaid',
            purchases: arrayUnion(purchaseEntry)
          }).catch((error: any) => {
            console.error("Error updating debt:", error);
            if (error.code === 'permission-denied') setShowFirebaseSetup(true);
          });
        }
      }

      const orderData = {
        items: cart.filter(item => item != null).map(item => ({
          id: item.id || '',
          originalId: item.originalId || item.id || '',
          name: item.name || '',
          price: item.price || 0,
          wholesalePrice: item.wholesalePrice || 0,
          packSize: item.packSize || 1,
          costPrice: item.costPrice || 0,
          wholesaleCost: item.wholesaleCost || 0,
          quantity: item.quantity || 1,
          barcode: item.barcode || '',
          isWeighed: item.isWeighed || false,
          isWholesale: item.isWholesale || false,
          isGift: item.isGift || false,
          linePrice: item.linePrice,
          rawLinePrice: item.rawLinePrice,
          itemDiscount: Number(item.itemDiscount) || 0,
          category: item.category || ''
        })),
        subtotal: subtotal || 0,
        discount: discount || 0,
        additionalCharge: additionalCharge || 0,
        total: total || 0,
        paymentMethod: paymentMethod || 'cash',
        paymentCurrency: paymentCurrency || 'IQD',
        amountPaid: amountPaid || 0,
        amountPaidUsd: paymentCurrency === 'USD' ? amountPaidUsd : (usdExchangeRate > 0 ? Number(((amountPaid || 0) / usdExchangeRate).toFixed(2)) : 0),
        usdExchangeRate: usdExchangeRate || 1500,
        createdAt: serverTimestamp(),
        receiptNumber: receiptNumber,
        customerId: finalCustomerId,
        section: activeSection || 'general',
      };

      // Fire and forget for offline support
      addDoc(collection(db, 'sales'), orderData).catch((error: any) => {
        console.error("Error adding sale:", error);
        if (error.code === 'permission-denied') setShowFirebaseSetup(true);
      });

      // Update inventory
      for (const item of cart) {
        const productId = item.originalId || item.id;
        if (!productId) continue;
        
        let stockToDeduct = item.quantity || 1;
        if (item.isWholesale) {
          stockToDeduct = (item.quantity || 1) * (item.packSize || 1);
        }
        
        const productRef = doc(db, 'products', productId);
        updateDoc(productRef, {
          stock: increment(-stockToDeduct)
        }).catch((error: any) => {
          console.error("Error updating inventory:", error);
          if (error.code === 'permission-denied') setShowFirebaseSetup(true);
        });
      }

      flushSync(() => {
        setCheckoutState(shouldPrint ? 'success-print' : 'success-no-print');
      });

      if (shouldPrint === 'a4') {
        handlePrintA4Action();
      } else if (shouldPrint) {
        handlePrintAction();
      } else {
        setTimeout(() => {
          clearCart();
          setIsCheckoutModalOpen(false);
          setAmountPaid(0);
          setPaymentMethod('cash');
          setSelectedCustomerId('');
          setIsNewCustomer(false);
          setNewCustomerName('');
          setNewCustomerPhone('');
          setCheckoutState('idle');
        }, 2000);
      }

    } catch (error: any) {
      console.error("Checkout error:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی فرۆشتن: " + (error.message || ""));
      }
      setCheckoutState('idle');
    }
  };

  const handleFastCodeSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && fastCode.trim() !== '') {
      if (handleScannedCode(fastCode)) {
        setFastCode('');
      } else {
        alert('هیچ کاڵایەک نەدۆزرایەوە بەم کۆدە یان بارکۆدە');
        setFastCode('');
      }
    }
  };

  const quickAmounts = [5000, 10000, 25000, 50000];

  const getFallbackConfig = (name: string) => {
    const genericIcons = [Package, Box, ShoppingBag, Star, Heart, Music, Book, Briefcase, Umbrella, Bell, Zap, CloudFog, Activity, FileBox];
    const genericColors = ['text-indigo-500', 'text-blue-500', 'text-teal-500', 'text-cyan-500', 'text-fuchsia-500', 'text-pink-500', 'text-rose-500', 'text-amber-500', 'text-orange-500', 'text-lime-500'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    hash = Math.abs(hash);
    const Icon = genericIcons[hash % genericIcons.length];
    const color = genericColors[hash % genericColors.length];
    return { Icon, color };
  };

  const getCategoryIcon = (categoryName: string) => {
    const canonical = getCanonicalCategoryName(categoryName);
    const customIcon = (
      categoryIcons[categoryName] || 
      categoryIcons[categoryName.trim()] || 
      categoryIcons[canonical] || 
      ((canonical === 'ماجیکبارەکان' || categoryName.includes('ماجیک')) ? (categoryIcons['ماجیکبارەکان'] || categoryIcons['ماجیک بارەکان']) : '') || 
      ''
    ).trim();
    if (customIcon) {
      return (
        <img
          src={customIcon}
          alt={categoryName}
          className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 rounded-xl transition-transform group-hover:scale-105"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    if (canonical === 'ماجیکبارەکان' || categoryName.includes('ماجیک')) {
      return <Sparkles className="w-12 h-12 sm:w-14 sm:h-14 mb-1.5 text-purple-600 drop-shadow-xs transition-transform group-hover:scale-105" />;
    }
    switch(categoryName) {
      case 'دەرمان':
      case 'توتون':
        return <img src="/icons/darman.png" alt="دەرمان" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'نێرگلە':
      case 'شیشە نێرگلە':
        return <img src="/icons/hookah.png" alt="نێرگلە" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'فەحم':
        return <img src="/icons/fahm.png" alt="فەحم" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'هیتەر':
      case 'هیته ر':
        return <img src="/icons/heater.png" alt="هیتەر" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'سیم':
        return <img src="/icons/seem.png" alt="سیم" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'خەڵتەکان':
      case 'خەلتەکان':
      case 'خەڵتە':
      case 'خەلتە':
      case 'خلتەکان':
      case 'خلتە':
        return <img src="/icons/khalta.png" alt="خەڵتەکان" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'سۆندە':
      case 'سۆندەکان':
      case 'سونده':
      case 'سونده کان':
        return <img src="/icons/sonda.png" alt="سۆندە" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'تیلە':
      case 'تیلەکان':
      case 'تیله':
      case 'تیله کان':
        return <img src="/icons/teela.png" alt="تیلە" className="w-16 h-16 sm:w-20 sm:h-20 max-h-[58%] object-contain drop-shadow-xs mb-1.5 transition-transform group-hover:scale-105" />;
      case 'شوشەکان':
      case 'شوشە':
      case 'شوشه':
      case 'شیشە':
        return <FlaskConical size={42} className="mb-1.5 text-teal-500 transition-transform group-hover:scale-105" />;
      case 'یاریەکان':
      case 'یاری':
        return <Dices size={42} className="mb-1.5 text-purple-500 transition-transform group-hover:scale-105" />;
      case 'مەقاشەکان':
      case 'مەقاش':
      case 'مقاش':
        return <Scissors size={42} className="mb-1.5 text-sky-500 transition-transform group-hover:scale-105" />;
      case 'سەرەکەکان':
      case 'سەرەکان':
      case 'سەرە':
        return <Coffee size={42} className="mb-1.5 text-teal-500 transition-transform group-hover:scale-105" />;
      case 'تەباغی غاز':
      case 'غاز':
        return <Flame size={42} className="mb-1.5 text-orange-500 transition-transform group-hover:scale-105" />;
      case 'قایش وبنی دار و تنفیس':
      case 'قایش وبنی...':
      case 'قایش و بنی':
      case 'قایش':
        return <Layers size={42} className="mb-1.5 text-blue-500 transition-transform group-hover:scale-105" />;
      case 'ئەدوات بەفر':
      case 'أدوات بەفر':
      case 'بەفر':
        return <Snowflake size={42} className="mb-1.5 text-purple-500 transition-transform group-hover:scale-105" />;
      case 'ناریەکان':
      case 'ناریەكان':
      case 'ناریە':
      case 'ئاریەکان':
        return <Flame size={42} className="mb-1.5 text-orange-500 transition-transform group-hover:scale-105" />;
      case 'کاڵای دەرەکی':
        return <PackageSearch size={42} className="mb-1.5 text-purple-600 transition-transform group-hover:scale-105" />;
      case 'سەفەری':
        return <Compass size={42} className="mb-1.5 text-emerald-500 transition-transform group-hover:scale-105" />;
      case 'دیاری':
        return <Gift size={42} className="mb-1.5 text-rose-500 transition-transform group-hover:scale-105" />;
      case 'پاککەرەوە و فرچە':
      case 'پاککەرەوە':
      case 'فرچە':
        return <Sparkles size={42} className="mb-1.5 text-teal-400 transition-transform group-hover:scale-105" />;
      case 'ڤەیپ و پۆد':
      case 'ڤەیپ':
      case 'پۆد':
        return <CloudFog size={42} className="mb-1.5 text-slate-500 transition-transform group-hover:scale-105" />;
      case 'هەمەجۆر':
        return <Package size={42} className="mb-1.5 text-indigo-500 transition-transform group-hover:scale-105" />;
      case 'دەمە': return <UserPlus size={42} className="mb-1.5 text-pink-400 transition-transform group-hover:scale-105" />;
      case 'قەمچی': return <Scissors size={42} className="mb-1.5 text-gray-500 transition-transform group-hover:scale-105" />;
      case 'قەزدیق': 
      case 'فۆیل': return <Layers size={42} className="mb-1.5 text-slate-400 transition-transform group-hover:scale-105" />;
      case 'ئاو': return <Droplet size={42} className="mb-1.5 text-blue-400 transition-transform group-hover:scale-105" />;
      case 'خواردنەوە': return <CupSoda size={42} className="mb-1.5 text-orange-400 transition-transform group-hover:scale-105" />;
      case 'چەرخ': return <Zap size={42} className="mb-1.5 text-yellow-500 transition-transform group-hover:scale-105" />;
      case 'پارچەکان': return <Wrench size={42} className="mb-1.5 text-gray-600 transition-transform group-hover:scale-105" />;
      case 'پاتری': return <Battery size={42} className="mb-1.5 text-green-500 transition-transform group-hover:scale-105" />;
      case 'شەربەت': return <GlassWater size={42} className="mb-1.5 text-rose-400 transition-transform group-hover:scale-105" />;
      case 'جگەرە': return <Cigarette size={42} className="mb-1.5 text-stone-500 transition-transform group-hover:scale-105" />;
      default: {
        const { Icon, color } = getFallbackConfig(categoryName);
        return <Icon size={42} className={`mb-1.5 ${color} transition-transform group-hover:scale-105`} />;
      }
    }
  };

  const getCategoryIconSmall = (categoryName: string) => {
    const canonical = getCanonicalCategoryName(categoryName);
    const customIcon = (
      categoryIcons[categoryName] || 
      categoryIcons[categoryName.trim()] || 
      categoryIcons[canonical] || 
      ((canonical === 'ماجیکبارەکان' || categoryName.includes('ماجیک')) ? (categoryIcons['ماجیکبارەکان'] || categoryIcons['ماجیک بارەکان']) : '') || 
      ''
    ).trim();
    if (customIcon) {
      return (
        <img
          src={customIcon}
          alt={categoryName}
          className="w-5 h-5 object-contain inline-block drop-shadow-xs rounded-sm"
          onError={(e) => {
            (e.currentTarget as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
    if (canonical === 'ماجیکبارەکان' || categoryName.includes('ماجیک')) {
      return <Sparkles size={20} className="text-purple-600 inline-block" />;
    }
    switch(categoryName) {
      case 'دەرمان':
      case 'توتون':
        return <img src="/icons/darman.png" alt="دەرمان" className="w-5 h-5 object-contain inline-block" />;
      case 'نێرگلە':
      case 'شیشە نێرگلە':
        return <img src="/icons/hookah.png" alt="نێرگلە" className="w-5 h-5 object-contain inline-block" />;
      case 'فەحم':
        return <img src="/icons/fahm.png" alt="فەحم" className="w-5 h-5 object-contain inline-block" />;
      case 'هیتەر':
      case 'هیته ر':
        return <img src="/icons/heater.png" alt="هیتەر" className="w-5 h-5 object-contain inline-block" />;
      case 'سیم':
        return <img src="/icons/seem.png" alt="سیم" className="w-5 h-5 object-contain inline-block" />;
      case 'خەڵتەکان':
      case 'خەلتەکان':
      case 'خەڵتە':
      case 'خەلتە':
      case 'خلتەکان':
      case 'خلتە':
        return <img src="/icons/khalta.png" alt="خەڵتەکان" className="w-5 h-5 object-contain inline-block" />;
      case 'سۆندە':
      case 'سۆندەکان':
      case 'سونده':
      case 'سونده کان':
        return <img src="/icons/sonda.png" alt="سۆندە" className="w-5 h-5 object-contain inline-block" />;
      case 'تیلە':
      case 'تیلەکان':
      case 'تیله':
      case 'تیله کان':
        return <img src="/icons/teela.png" alt="تیلە" className="w-5 h-5 object-contain inline-block" />;
      case 'شوشەکان':
      case 'شوشە':
      case 'شوشه':
      case 'شیشە':
        return <FlaskConical size={20} className="text-teal-500 inline-block" />;
      case 'یاریەکان':
      case 'یاری':
        return <Dices size={20} className="text-purple-500 inline-block" />;
      case 'مەقاشەکان':
      case 'مەقاش':
      case 'مقاش':
        return <Scissors size={20} className="text-sky-500 inline-block" />;
      case 'سەرەکەکان':
      case 'سەرەکان':
      case 'سەرە':
        return <Coffee size={20} className="text-teal-500 inline-block" />;
      case 'تەباغی غاز':
      case 'غاز':
        return <Flame size={20} className="text-orange-500 inline-block" />;
      case 'قایش وبنی دار و تنفیس':
      case 'قایش وبنی...':
      case 'قایش و بنی':
      case 'قایش':
        return <Layers size={20} className="text-blue-500 inline-block" />;
      case 'ئەدوات بەفر':
      case 'أدوات بەفر':
      case 'بەفر':
        return <Snowflake size={20} className="text-purple-500 inline-block" />;
      case 'ناریەکان':
      case 'ناریەكان':
      case 'ناریە':
      case 'ئاریەکان':
        return <Flame size={20} className="text-orange-500 inline-block" />;
      case 'کاڵای دەرەکی':
        return <PackageSearch size={20} className="text-purple-600 inline-block" />;
      case 'سەفەری':
        return <Compass size={20} className="text-emerald-500 inline-block" />;
      case 'دیاری':
        return <Gift size={20} className="text-rose-500 inline-block" />;
      case 'پاککەرەوە و فرچە':
      case 'پاککەرەوە':
      case 'فرچە':
        return <Sparkles size={20} className="text-teal-400 inline-block" />;
      case 'ڤەیپ و پۆد':
      case 'ڤەیپ':
      case 'پۆد':
        return <CloudFog size={20} className="text-slate-500 inline-block" />;
      case 'هەمەجۆر':
        return <Package size={20} className="text-indigo-500 inline-block" />;
      case 'دەمە': return <UserPlus size={20} />;
      case 'قەمچی': return <Scissors size={20} />;
      case 'قەزدیق': 
      case 'فۆیل': return <Layers size={20} />;
      case 'ئاو': return <Droplet size={20} />;
      case 'خواردنەوە': return <CupSoda size={20} />;
      case 'چەرخ': return <Zap size={20} />;
      case 'پارچەکان': return <Wrench size={20} />;
      case 'پاتری': return <Battery size={20} />;
      case 'شەربەت': return <GlassWater size={20} />;
      case 'جگەرە': return <Cigarette size={20} />;
      default: {
        const { Icon } = getFallbackConfig(categoryName);
        return <Icon size={20} />;
      }
    }
  };

  const inTypeView = hasCategoryTiles && selectedCategory !== 'all' && availableCompanies.length > 0 && !searchTerm.trim();
  // With types available, the main area shows only the products that have no type; the rest open in the type window
  const visibleMainProducts = inTypeView && !typePanel ? filteredProducts.filter(p => !p.company) : filteredProducts;

  return (
    <div className={`flex flex-col gap-4 print:block h-full`}>
      <div className={`flex gap-4 print:h-auto print:block flex-1 overflow-hidden`}>
        {/* Products Section */}
        <div className="relative flex-1 min-w-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200/70 overflow-hidden print:hidden">
          {/* Toolbar: search, quick code, retail/wholesale, dollar rate */}
          <div className="px-3 py-2.5 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-shadow"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      if (handleScannedCode(searchTerm.trim())) {
                        setSearchTerm('');
                      }
                    }
                  }}
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute left-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-700 rounded-lg" title="سڕینەوە">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="relative w-44">
                <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                <input
                  type="text"
                  placeholder="کۆدی خێرا / بارکۆد"
                  className="w-full pl-3 pr-10 py-2.5 text-sm bg-indigo-50/70 text-indigo-900 border border-indigo-100 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none placeholder:text-indigo-300 font-bold"
                  value={fastCode}
                  onChange={(e) => setFastCode(e.target.value)}
                  onKeyDown={handleFastCodeSubmit}
                  dir="ltr"
                />
              </div>
              <div className="flex items-center bg-gray-100 rounded-xl p-1">
                <button
                  onClick={() => setIsWholesale(false)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-sm transition-all ${!isWholesale ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  مفرد (دانە)
                </button>
                <button
                  onClick={() => setIsWholesale(true)}
                  className={`px-3.5 py-1.5 rounded-lg font-bold text-sm transition-all ${isWholesale ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  جملە (کۆ)
                </button>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-100" title="نرخی دۆلار">
                <span className="text-xs font-black text-emerald-700 whitespace-nowrap">$1 =</span>
                <input
                  type="number"
                  value={usdExchangeRate}
                  onChange={(e) => handleUpdateExchangeRate(Number(e.target.value))}
                  className="w-20 px-2 py-1 text-center text-sm font-bold text-emerald-700 bg-white border border-emerald-200 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                  dir="ltr"
                />
              </div>
            </div>
          </div>

          {/* Scrollable content: categories, types and products */}
          <div className="flex-1 overflow-y-auto p-3 bg-gray-50/40">
            {!activeShift && (
              <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-4 rounded-2xl mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg border border-rose-400">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-white/10 rounded-xl">
                    <Clock size={26} className="animate-pulse text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-black text-base">⚠️ هیچ شەفتێک دەستپێنەکراوە!</h3>
                    <p className="text-xs text-rose-100 font-bold">سیستەم ڕێگە بە فرۆشتن و دەرکردنی وەسڵ نادات تاوەکو سەرەتا شەفت دەستپێنەکەیت.</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpenStartModal(true)}
                  className="px-5 py-2.5 bg-white hover:bg-rose-50 text-rose-700 font-black text-sm rounded-xl transition-all shadow-md shrink-0 flex items-center gap-2 active:scale-95"
                >
                  <Play size={18} className="fill-rose-700" />
                  <span>دەستپێکردنی شەفت</span>
                </button>
              </div>
            )}

            {activeSection === 'external' && (
              <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-4 mb-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 text-emerald-950 font-bold">
                  <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-md">
                    <Package size={22} />
                  </div>
                  <div>
                    <span className="block text-base font-black">بەشی کاڵای دەرەکی</span>
                    <span className="text-xs text-emerald-700 font-medium">زیادکردنی کاڵای نوێ بۆ کۆگا یان ڕاستەوخۆ بۆ سەبەتە (ئەدمین &amp; کاشێر)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setIsAddExternalModalOpen(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Plus size={16} />
                    <span>زیادکردنی کاڵای نوێ (کۆگا)</span>
                  </button>
                  <button
                    onClick={() => setIsQuickCustomModalOpen(true)}
                    className="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-md flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <Zap size={16} />
                    <span>کاڵای دەستی بۆ سەبەتە</span>
                  </button>
                </div>
              </div>
            )}

            {/* Category tiles */}
            {hasCategoryTiles && selectedCategory === 'all' && !searchTerm.trim() && (
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2 px-0.5">
                  <h3 className="text-sm font-black text-gray-700 flex items-center gap-1.5">
                    <LayoutGrid size={16} className={sectionTheme.text} />
                    کەتەگۆرییەکان
                  </h3>
                  <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${sectionTheme.soft} ${sectionTheme.text}`}>{SECTION_LABELS[activeSection]}</span>
                </div>
                {activeSection !== 'general' && sectionCategories.length === 0 ? (
                  <div className={`py-8 text-center text-xs font-bold text-gray-400 bg-white rounded-2xl border border-dashed ${sectionTheme.border}`}>
                    هیچ کەتەگۆرییەک بۆ {SECTION_LABELS[activeSection]} دروست نەکراوە. دەتوانیت لە بەشی کاڵاکان کەتەگۆری نوێ دروست بکەیت.
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-2.5">
                    {sectionCategories.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => { setSelectedCategory(cat); setSelectedCompany('all'); }}
                        className={`group aspect-square flex flex-col items-center justify-between p-2 rounded-2xl border bg-white text-gray-700 shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer border-gray-200 ${sectionTheme.hover}`}
                      >
                        <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden pt-1">
                          {getCategoryIcon(cat)}
                        </div>
                        <span className="text-xs sm:text-[13px] font-black text-center leading-tight line-clamp-2 px-1 pb-0.5">{cat}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Inside a category: header + type (company) tiles */}
            {hasCategoryTiles && selectedCategory !== 'all' && (
              <div className="mb-3 space-y-2.5">
                <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-2xl px-2.5 py-2 shadow-xs">
                  <button
                    onClick={() => { setSelectedCategory('all'); setSelectedCompany('all'); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                  >
                    <ArrowRight size={16} />
                    گەڕانەوە
                  </button>
                  <span className={`font-black text-base flex items-center gap-2 ${sectionTheme.text}`}>
                    {getCategoryIconSmall(selectedCategory)}
                    {selectedCategory}
                  </span>
                  {selectedCompany !== 'all' && (
                    <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                      <span>/</span>
                      <span className="text-gray-800">{selectedCompany}</span>
                    </span>
                  )}
                  <span className={`mr-auto text-[11px] px-2.5 py-0.5 rounded-full font-bold ${sectionTheme.soft} ${sectionTheme.text}`}>
                    {SECTION_LABELS[activeSection]}
                  </span>
                </div>

                {availableCompanies.length > 0 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                    <button
                      onClick={() => openTypePanel(null)}
                      className={`group aspect-square flex flex-col items-center justify-between p-2 rounded-2xl border transition-all cursor-pointer hover:-translate-y-0.5 ${sectionTheme.solid} text-white border-transparent shadow-md hover:shadow-lg`}
                    >
                      <div className="flex-1 w-full flex items-center justify-center min-h-0 pt-1">
                        <LayoutGrid size={32} className="transition-transform group-hover:scale-110" />
                      </div>
                      <span className="text-[11px] font-black leading-tight text-center pb-0.5">هەموو جۆرەکان</span>
                    </button>
                    {availableCompanies.map((comp: unknown, idx: number) => {
                      const name = comp as string;
                      const img = companyIcons[name] || companyDocLogos[name];
                      const isActive = selectedCompany === name;
                      return (
                        <div
                          key={idx}
                          role="button"
                          tabIndex={0}
                          onClick={() => openTypePanel(name)}
                          onKeyDown={(e) => { if (e.key === 'Enter') openTypePanel(name); }}
                          className={`group relative aspect-square flex flex-col items-center justify-between p-2 rounded-2xl border bg-white transition-all cursor-pointer hover:-translate-y-0.5 ${
                            isActive ? `ring-2 ${sectionTheme.ring} border-transparent shadow-md` : `border-gray-200 ${sectionTheme.hover} hover:shadow-md`
                          }`}
                        >
                          <div className="flex-1 w-full flex items-center justify-center min-h-0 overflow-hidden pt-1">
                            {img ? (
                              <img
                                src={img}
                                alt={name}
                                className="w-full h-full max-h-16 object-contain rounded-xl drop-shadow-xs transition-transform group-hover:scale-105"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl font-black ${sectionTheme.soft} ${sectionTheme.text} transition-transform group-hover:scale-105`}>
                                {name.trim().charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className={`text-[11px] font-black leading-tight text-center line-clamp-2 px-0.5 pb-0.5 ${isActive ? sectionTheme.text : 'text-gray-700'}`}>{name}</span>
                          {canEditImages && (
                            <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => { e.stopPropagation(); pickCompanyImage(name); }}
                                className="p-1 bg-white/95 border border-gray-200 rounded-lg text-gray-600 hover:text-indigo-600 shadow-xs"
                                title="دانانی وێنە"
                              >
                                <Camera size={12} />
                              </button>
                              {img && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); removeCompanyImage(name); }}
                                  className="p-1 bg-white/95 border border-gray-200 rounded-lg text-gray-600 hover:text-rose-600 shadow-xs"
                                  title="لابردنی وێنە"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                <input ref={companyImageInputRef} type="file" accept="image/*" className="hidden" onChange={handleCompanyImageFile} />
              </div>
            )}

            {/* Products */}
            {loading ? (
              <div className="flex justify-center items-center py-16 text-gray-400 font-bold">بارکردن...</div>
            ) : hasCategoryTiles && selectedCategory === 'all' && !searchTerm.trim() && filteredProducts.length === 0 ? (
              sectionCategories.length > 0 ? (
                <div className="flex flex-col items-center justify-center text-gray-400 gap-2 py-6">
                  <p className="text-sm font-bold">کەتەگۆرییەک هەڵبژێرە بۆ بینینی کاڵاکان</p>
                </div>
              ) : null
            ) : (
              <div className="space-y-2.5">
                {hasCategoryTiles && selectedCategory === 'all' && !searchTerm.trim() && filteredProducts.length > 0 && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                      کاڵاکانی بێ کەتەگۆری ({filteredProducts.length})
                    </span>
                  </div>
                )}
                {inTypeView && visibleMainProducts.length > 0 && (
                  <div className="flex items-center gap-2 px-0.5">
                    <span className="text-xs font-bold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-lg">
                      کاڵاکانی بێ جۆر ({visibleMainProducts.length})
                    </span>
                  </div>
                )}
                {inTypeView && visibleMainProducts.length === 0 ? null : visibleMainProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-2 py-12">
                    <PackageSearch size={44} className="opacity-40" />
                    <p className="text-sm font-bold">هیچ کاڵایەک نەدۆزرایەوە</p>
                  </div>
                ) : renderProductGrid(visibleMainProducts)}
              </div>
            )}
          </div>

          {/* Type window: one type's products, opened from the type tiles */}
          {typePanel && (
            <div className="absolute inset-0 z-30 flex flex-col bg-gray-50" role="dialog" aria-modal="true">
              <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-200 bg-white shadow-xs`}>
                <button
                  onClick={closeTypePanel}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-black text-white shadow-sm transition-all active:scale-95 ${sectionTheme.solid}`}
                  title="گەڕانەوە (Esc)"
                >
                  <ArrowRight size={18} />
                  گەڕانەوە
                </button>
                <div className={`w-11 h-11 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden shrink-0`}>
                  {typePanel !== '__all__' && companyIcons[typePanel] ? (
                    <img src={companyIcons[typePanel]} alt={typePanel} className="w-full h-full object-contain" />
                  ) : typePanel === '__all__' ? (
                    <LayoutGrid size={22} className={sectionTheme.text} />
                  ) : (
                    <span className={`text-lg font-black ${sectionTheme.text}`}>{typePanel.trim().charAt(0)}</span>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="font-black text-gray-900 text-base leading-tight truncate">
                    {typePanel === '__all__' ? 'هەموو جۆرەکان' : typePanel}
                  </h3>
                  <p className="text-[11px] font-bold text-gray-500 flex items-center gap-1">
                    {getCategoryIconSmall(selectedCategory)}
                    <span>{selectedCategory}</span>
                    <span>•</span>
                    <span>{filteredProducts.length} کاڵا</span>
                  </p>
                </div>
                <span className={`mr-auto text-[11px] px-2.5 py-1 rounded-full font-bold ${sectionTheme.soft} ${sectionTheme.text}`}>
                  {SECTION_LABELS[activeSection]}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-3">
                {filteredProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-gray-400 gap-2 py-16">
                    <PackageSearch size={44} className="opacity-40" />
                    <p className="text-sm font-bold">هیچ کاڵایەک لەم جۆرەدا نییە</p>
                  </div>
                ) : renderProductGrid(filteredProducts)}
              </div>
            </div>
          )}

          {/* Section bar (bottom) */}
          <div className="border-t border-gray-200 bg-white p-2">
            <div className="grid grid-cols-4 gap-2">
              {([
                { key: 'general', label: 'بەشی گشتی', Icon: LayoutGrid, on: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25', off: 'text-indigo-700 hover:bg-indigo-50' },
                { key: 'shisha', label: 'بەشی شیشە', Icon: Wind, on: 'bg-purple-600 text-white shadow-md shadow-purple-600/25', off: 'text-purple-700 hover:bg-purple-50' },
                { key: 'packet', label: 'بەشی پاکەت', Icon: Box, on: 'bg-amber-600 text-white shadow-md shadow-amber-600/25', off: 'text-amber-700 hover:bg-amber-50' },
                { key: 'external', label: 'کاڵای دەرەکی', Icon: PackageSearch, on: 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25', off: 'text-emerald-700 hover:bg-emerald-50' },
              ] as { key: StoreSection; label: string; Icon: any; on: string; off: string }[]).map(({ key, label, Icon, on, off }) => (
                <button
                  key={key}
                  onClick={() => switchSection(key)}
                  className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-black text-sm transition-all border ${
                    activeSection === key ? `${on} border-transparent` : `bg-gray-50 border-gray-200 ${off}`
                  }`}
                >
                  <Icon size={18} />
                  <span className="truncate">{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-80 xl:w-96 shrink-0 bg-white rounded-2xl shadow-sm border border-gray-200/70 flex flex-col overflow-hidden print:hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gradient-to-l from-indigo-600 to-indigo-700 text-white flex justify-between items-center">
            <h2 className="text-lg font-black flex items-center gap-2">
              <ShoppingCart size={22} />
              سەبەتە
              <span className="text-xs font-black bg-white/20 px-2 py-0.5 rounded-full">{cart.length}</span>
            </h2>
            <div className="flex items-center gap-1">
              {heldCarts.length > 0 && (
                <button
                  onClick={() => setIsHeldCartsModalOpen(true)}
                  className="relative p-2 hover:bg-white/15 rounded-lg transition-colors"
                  title="سەبەتە ڕاگیراوەکان"
                >
                  <List size={18} />
                  <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
                    {heldCarts.length}
                  </span>
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={() => {
                    const name = window.prompt('ناوی کڕیار یان تێبینی بۆ ئەم سەبەتەیە بنووسە:');
                    if (name !== null) {
                      holdCart(name);
                    }
                  }}
                  className="px-2 py-1.5 hover:bg-white/15 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                  title="ڕاگرتنی سەبەتە"
                >
                  <Pause size={15} />
                  ڕاگرتن
                </button>
              )}
              {cart.length > 0 && (
                <button
                  onClick={() => {
                    if (window.confirm('دڵنیایت لە سڕینەوەی هەموو کاڵاکانی سەبەتەکە؟')) {
                      clearCart();
                    }
                  }}
                  className="px-2 py-1.5 hover:bg-rose-500/80 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold"
                  title="سڕینەوەی هەمووی"
                >
                  <Trash2 size={15} />
                  بەتاڵکردن
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50/50">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center">
                  <ShoppingCart size={32} className="opacity-40" />
                </div>
                <p className="font-bold text-sm">سەبەتەکە بەتاڵە</p>
                <p className="text-[11px]">کاڵایەک هەڵبژێرە یان بارکۆد سکان بکە</p>
              </div>
            ) : (
              cart.map((item, index) => {
                let rawLineTotal = 0;
                if (!item.isGift) {
                  if (item.linePrice !== undefined && item.linePrice !== null) {
                    rawLineTotal = item.linePrice;
                  } else {
                    rawLineTotal = item.isWholesale ? (item.wholesalePrice || item.price) * item.quantity : item.price * item.quantity;
                  }
                }
                const itemDisc = item.isGift ? 0 : (Number(item.itemDiscount) || 0);
                const itemTotal = Math.max(0, rawLineTotal - itemDisc);
                const unitPrice = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
                return (
                  <div key={item.id} className={`p-2.5 rounded-xl border bg-white shadow-xs ${item.isGift ? 'border-orange-200 bg-orange-50/60' : (itemDisc > 0 ? 'border-rose-200 bg-rose-50/20' : 'border-gray-200')}`}>
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 text-[10px] font-black text-gray-400 bg-gray-100 rounded-md w-5 h-5 flex items-center justify-center shrink-0">{index + 1}</span>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-gray-800 text-[13px] leading-tight line-clamp-2">{item.name}</h4>
                        <div className="flex flex-wrap items-center gap-1 mt-1">
                          {item.isGift && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full font-bold">هەدیە</span>}
                          {item.isWholesale && !item.isGift && (
                            <span className="text-[10px] text-purple-700 bg-purple-100 px-1.5 py-0.5 rounded-full font-bold">کۆ</span>
                          )}
                          {item.isWeighed && (
                            <span className="text-[10px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full flex items-center gap-0.5 font-bold">
                              <Scale size={10} />
                              کێش
                            </span>
                          )}
                          {!item.isGift && (
                            <span className="text-[10px] text-gray-500 font-bold">{Number(unitPrice || 0).toLocaleString()}{item.isWeighed ? ' / کگم' : ''}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-0.5 shrink-0">
                        <button
                          onClick={() => setDiscountModalItem({
                            item,
                            value: item.itemDiscount ? String(item.itemDiscount) : '',
                            mode: 'amount'
                          })}
                          className={`p-1.5 rounded-lg transition-colors ${itemDisc > 0 ? 'text-rose-600 bg-rose-100 font-bold shadow-2xs' : 'text-gray-400 hover:bg-rose-50 hover:text-rose-600'}`}
                          title="داشکاندن بۆ ئەم کاڵایە"
                        >
                          <Percent size={14} />
                        </button>
                        <button onClick={() => toggleGift(item.id)} className={`p-1.5 rounded-lg transition-colors ${item.isGift ? 'text-orange-600 bg-orange-100' : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`} title="هەدیە">
                          <Gift size={14} />
                        </button>
                        <button onClick={() => removeFromCart(item.id)} className="p-1.5 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="سڕینەوە">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <div className="flex items-center bg-gray-50 rounded-lg border border-gray-200 h-8">
                        <button onClick={() => updateQuantity(item.id, item.quantity + (item.isWeighed ? 0.25 : 1))} className="px-2 h-full hover:bg-gray-200 rounded-r-lg text-gray-700 transition-colors" title="زیادکردن">
                          <Plus size={14} />
                        </button>
                        <div className="flex items-center justify-center w-14 px-1 gap-0.5">
                          <input
                            type="number"
                            min="0"
                            step={item.isWeighed ? "0.001" : "1"}
                            value={item.quantity === 0 ? '' : Number(item.quantity.toFixed(3))}
                            onChange={(e) => {
                              const val = e.target.value;
                              updateQuantity(item.id, val === '' ? 0 : Number(val));
                            }}
                            className="w-full text-center font-black text-gray-900 bg-transparent border-none focus:ring-0 p-0 text-sm"
                            dir="ltr"
                          />
                          {item.isWeighed && <span className="text-[9px] text-gray-500 font-bold">کگم</span>}
                        </div>
                        <button onClick={() => updateQuantity(item.id, item.quantity - (item.isWeighed ? 0.25 : 1))} className="px-2 h-full hover:bg-gray-200 rounded-l-lg text-gray-700 transition-colors" title="کەمکردنەوە">
                          <Minus size={14} />
                        </button>
                      </div>
                      <div className="flex flex-col items-end">
                        {itemDisc > 0 && !item.isGift && (
                          <span className="text-[11px] text-gray-400 line-through font-mono">
                            {Math.round(rawLineTotal).toLocaleString()} IQD
                          </span>
                        )}
                        <span className={`font-black text-sm ${item.isGift ? 'text-orange-600 line-through opacity-60' : (itemDisc > 0 ? 'text-rose-600' : 'text-indigo-700')}`}>
                          {item.isGift ? '0' : Math.round(itemTotal).toLocaleString()} <span className="text-[10px] font-bold opacity-70">IQD</span>
                        </span>
                        {itemDisc > 0 && !item.isGift && (
                          <button
                            onClick={() => setDiscountModalItem({
                              item,
                              value: String(itemDisc),
                              mode: 'amount'
                            })}
                            className="text-[9.5px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded-md mt-0.5 border border-rose-200 flex items-center gap-1 transition-colors"
                            title="گۆڕین یان سڕینەوەی داشکاندن"
                          >
                            <Percent size={9} />
                            داشکاندن: -{itemDisc.toLocaleString()}
                          </button>
                        )}
                        {item.isWeighed && !item.isGift && item.linePrice !== undefined && item.rawLinePrice !== undefined && item.linePrice !== item.rawLinePrice && (
                          <span className="text-[9.5px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-md mt-0.5 border border-amber-200/80" title={`نرخی کێشی ئەسڵی: ${item.rawLinePrice.toLocaleString()} IQD`}>
                            خڕکراوە لە {item.rawLinePrice.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-3 border-t border-gray-200 bg-white space-y-2">
            <div className="flex justify-between text-sm text-gray-600 font-bold">
              <span>کۆی کاڵاکان:</span>
              <span className="font-black text-gray-800">{subtotal.toLocaleString()} IQD</span>
            </div>
            {(() => {
              const totalItemDiscounts = cart.reduce((acc, it) => acc + (it.isGift ? 0 : (Number(it.itemDiscount) || 0)), 0);
              if (totalItemDiscounts <= 0) return null;
              return (
                <div className="flex justify-between text-xs text-rose-600 font-bold bg-rose-50/70 border border-rose-100 rounded-lg px-2.5 py-1">
                  <span className="flex items-center gap-1">
                    <Percent size={11} />
                    داشکاندنی سەر کاڵاکان:
                  </span>
                  <span className="font-mono">-{totalItemDiscounts.toLocaleString()} IQD</span>
                </div>
              );
            })()}
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-gray-500">داشکاندنی گشتی</span>
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-left text-sm font-bold border border-gray-200 rounded-lg focus:ring-2 focus:border-transparent outline-none bg-rose-50/40"
                  dir="ltr"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-bold text-gray-500">پارەی زیادە</span>
                <input
                  type="number"
                  value={additionalCharge}
                  onChange={(e) => setAdditionalCharge(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-left text-sm font-bold border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-400 focus:border-transparent outline-none bg-emerald-50/40"
                  dir="ltr"
                />
              </label>
            </div>
            <div className="flex justify-between items-center bg-indigo-50 border border-indigo-100 rounded-xl px-3 py-2.5">
              <span className="font-black text-indigo-900">کۆی کۆتایی</span>
              <div className="text-left">
                <span className="block text-xl font-black text-indigo-700">{total.toLocaleString()} <span className="text-xs font-bold">IQD</span></span>
                {usdExchangeRate > 0 && total > 0 && (
                  <span className="block text-[11px] font-bold text-emerald-700" dir="ltr">≈ ${(total / usdExchangeRate).toFixed(2)}</span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                if (!activeShift) {
                  alert("⚠️ دەبێت سەرەتا شەفت دەستپێبکەیت پێش ئەوەی بتوانیت فرۆشتن/پارەدان بکەیت!");
                  setOpenStartModal(true);
                  return;
                }
                setIsCheckoutModalOpen(true);
              }}
              disabled={cart.length === 0}
              className="w-full py-3.5 px-4 bg-gradient-to-l from-indigo-600 to-indigo-700 text-white rounded-xl font-black hover:from-indigo-700 hover:to-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 text-lg active:scale-[0.99]"
            >
              <CreditCard size={22} />
              پارەدان
            </button>
          </div>
        </div>

      {/* Checkout Modal */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 bg-gray-50 z-50 flex flex-col print:hidden">
          <div className="bg-white w-full h-full overflow-hidden flex flex-col max-w-3xl mx-auto shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <CreditCard className="text-indigo-600" />
                تەواوکردنی پارەدان
              </h2>
              <button 
                onClick={() => setIsCheckoutModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 flex flex-col">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
                <div className="space-y-6 h-fit">
                  {/* Total Amount Card */}
                  <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl p-6 text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-white/10 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
                <div className="relative z-10 flex flex-col items-center justify-center">
                  <span className="text-indigo-100 font-medium mb-1">کۆی گشتی داواکاری</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-black tracking-tight">{total.toLocaleString()}</span>
                    <span className="text-lg font-medium text-indigo-200">IQD</span>
                  </div>
                  {usdExchangeRate > 0 && (
                    <div className="mt-2 text-xs font-bold text-emerald-100 bg-emerald-500/30 border border-emerald-300/30 px-3 py-1 rounded-full flex items-center gap-1.5">
                      <span>بەرامبەر بە دۆلار:</span>
                      <span className="text-sm font-black text-white">${(total / usdExchangeRate).toFixed(2)} USD</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Payment Method Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700">شێوازی پارەدان</label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      paymentMethod === 'cash' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Coins size={28} className={`mb-2 ${paymentMethod === 'cash' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="font-bold text-base">نەقد</span>
                    {paymentMethod === 'cash' && (
                      <div className="absolute top-2 right-2 text-indigo-600">
                        <CheckCircle size={18} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => setPaymentMethod('fib')}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      paymentMethod === 'fib' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Smartphone size={28} className={`mb-2 ${paymentMethod === 'fib' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="font-bold text-base">FIB</span>
                    {paymentMethod === 'fib' && (
                      <div className="absolute top-2 right-2 text-indigo-600">
                        <CheckCircle size={18} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => setPaymentMethod('debt')}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all duration-200 ${
                      paymentMethod === 'debt' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard size={28} className={`mb-2 ${paymentMethod === 'debt' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="font-bold text-base">قەرز</span>
                    {paymentMethod === 'debt' && (
                      <div className="absolute top-2 right-2 text-indigo-600">
                        <CheckCircle size={18} />
                      </div>
                    )}
                  </button>
                </div>
              </div>

              {/* Debt Section */}
              {paymentMethod === 'debt' && (
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                    <label className="text-base font-bold text-gray-900 flex items-center gap-2">
                      <UserPlus size={18} className="text-indigo-600" />
                      زانیاری کڕیار
                    </label>
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setIsNewCustomer(false)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${!isNewCustomer ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        پێشوو
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNewCustomer(true)}
                        className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${isNewCustomer ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        نوێ
                      </button>
                    </div>
                  </div>

                  {isNewCustomer ? (
                    <div className="space-y-4 pt-2">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ناوی کڕیار</label>
                        <input
                          type="text"
                          placeholder="ناوی سیانی..."
                          value={newCustomerName}
                          onChange={(e) => setNewCustomerName(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">ژمارەی مۆبایل</label>
                        <input
                          type="text"
                          placeholder="0750..."
                          dir="ltr"
                          value={newCustomerPhone}
                          onChange={(e) => setNewCustomerPhone(e.target.value)}
                          className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-left"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">گەڕان بۆ کڕیار</label>
                      <select
                        value={selectedCustomerId}
                        onChange={(e) => setSelectedCustomerId(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-gray-900 font-medium"
                      >
                        <option value="">کڕیارێک هەڵبژێرە...</option>
                        {customers.map(c => (
                          <option key={c.id} value={c.id}>{c.customerName} {c.phone ? `- ${c.phone}` : ''}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              )}
              </div>

              <div className="space-y-6 h-fit">
                {/* Amount Paid Section */}
                <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
                  {/* Currency Selection Tabs */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">دراوی پارەدان</label>
                    <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentCurrency('IQD');
                          if (amountPaidUsd > 0 && usdExchangeRate > 0) {
                            setAmountPaid(Math.round(amountPaidUsd * usdExchangeRate));
                          }
                        }}
                        className={`py-2 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                          paymentCurrency === 'IQD'
                            ? 'bg-white text-indigo-700 shadow-sm border border-gray-200'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        <span>دینار (IQD)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentCurrency('USD');
                          if (amountPaid > 0 && usdExchangeRate > 0) {
                            setAmountPaidUsd(Number((amountPaid / usdExchangeRate).toFixed(2)));
                          } else {
                            const defaultUsd = Number((total / usdExchangeRate).toFixed(2));
                            setAmountPaidUsd(defaultUsd);
                            setAmountPaid(total);
                          }
                        }}
                        className={`py-2 px-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${
                          paymentCurrency === 'USD'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        <span>دۆلار ($ USD)</span>
                      </button>
                    </div>
                  </div>

                  {paymentCurrency === 'IQD' ? (
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">پارەی وەرگیراو (IQD)</label>
                      <div className="relative">
                        <input
                          type="text"
                          value={amountPaid ? amountPaid.toLocaleString() : ''}
                          readOnly
                          placeholder="0"
                          className="w-full pl-16 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-2xl font-black text-gray-900 transition-all text-left"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">IQD</div>
                      </div>
                      {amountPaid > 0 && usdExchangeRate > 0 && (
                        <p className="text-xs text-indigo-600 font-bold mt-1 text-left">
                          بەرامبەر بە دۆلار: ${(amountPaid / usdExchangeRate).toFixed(2)} USD
                        </p>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-bold text-emerald-800 mb-2 flex justify-between items-center">
                        <span>پارەی وەرگیراو (دۆلار - $)</span>
                        <span className="text-xs text-gray-500 font-normal">نرخی ڕۆژ: 1$ = {usdExchangeRate.toLocaleString()} IQD</span>
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="any"
                          value={amountPaidUsd || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setAmountPaidUsd(val);
                            setAmountPaid(Math.round(val * usdExchangeRate));
                          }}
                          placeholder="0"
                          className="w-full pl-12 pr-4 py-4 bg-emerald-50/50 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-2xl font-black text-emerald-900 transition-all text-left"
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-600 font-black text-xl">$</div>
                      </div>
                      <div className="mt-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                        <span>بڕ بە دینار (گۆڕدراو):</span>
                        <span className="text-sm font-black text-emerald-900">{(amountPaidUsd * usdExchangeRate).toLocaleString()} IQD</span>
                      </div>
                    </div>
                  )}

                  {/* Keypad & Quick Amounts */}
                  {paymentCurrency === 'IQD' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2" dir="ltr">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button
                            key={num}
                            onClick={() => {
                              const nextVal = Number(`${amountPaid}${num}`);
                              setAmountPaid(nextVal);
                              if (usdExchangeRate > 0) setAmountPaidUsd(Number((nextVal / usdExchangeRate).toFixed(2)));
                            }}
                            className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setAmountPaid(0);
                            setAmountPaidUsd(0);
                          }}
                          className="py-3 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                        >
                          C
                        </button>
                        <button
                          onClick={() => {
                            const nextVal = Number(`${amountPaid}0`);
                            setAmountPaid(nextVal);
                            if (usdExchangeRate > 0) setAmountPaidUsd(Number((nextVal / usdExchangeRate).toFixed(2)));
                          }}
                          className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                        >
                          0
                        </button>
                        <button
                          onClick={() => {
                            const nextVal = Number(`${amountPaid}000`);
                            setAmountPaid(nextVal);
                            if (usdExchangeRate > 0) setAmountPaidUsd(Number((nextVal / usdExchangeRate).toFixed(2)));
                          }}
                          className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                        >
                          000
                        </button>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-4">
                        {quickAmounts.map(amount => (
                          <button
                            key={amount}
                            onClick={() => {
                              const nextVal = amountPaid + amount;
                              setAmountPaid(nextVal);
                              if (usdExchangeRate > 0) setAmountPaidUsd(Number((nextVal / usdExchangeRate).toFixed(2)));
                            }}
                            className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm transition-colors border border-indigo-100"
                          >
                            +{amount.toLocaleString()}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setAmountPaid(total);
                            if (usdExchangeRate > 0) setAmountPaidUsd(Number((total / usdExchangeRate).toFixed(2)));
                          }}
                          className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm transition-colors border border-emerald-100 col-span-4 mt-1"
                        >
                          پارەی تەواو ({total.toLocaleString()} IQD)
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="grid grid-cols-3 gap-2" dir="ltr">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                          <button
                            key={num}
                            onClick={() => {
                              const nextVal = Number(`${amountPaidUsd}${num}`);
                              setAmountPaidUsd(nextVal);
                              setAmountPaid(Math.round(nextVal * usdExchangeRate));
                            }}
                            className="py-3 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                          >
                            {num}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            setAmountPaidUsd(0);
                            setAmountPaid(0);
                          }}
                          className="py-3 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                        >
                          C
                        </button>
                        <button
                          onClick={() => {
                            const nextVal = Number(`${amountPaidUsd}0`);
                            setAmountPaidUsd(nextVal);
                            setAmountPaid(Math.round(nextVal * usdExchangeRate));
                          }}
                          className="py-3 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                        >
                          0
                        </button>
                        <button
                          onClick={() => {
                            const exactUsd = Number((total / usdExchangeRate).toFixed(2));
                            setAmountPaidUsd(exactUsd);
                            setAmountPaid(total);
                          }}
                          className="py-3 bg-emerald-100 border border-emerald-200 hover:bg-emerald-200 text-emerald-800 rounded-xl font-bold text-sm transition-all shadow-sm active:scale-95"
                        >
                          تەواو
                        </button>
                      </div>

                      <div className="grid grid-cols-5 gap-1.5 mt-3">
                        {[5, 10, 20, 50, 100].map(usdVal => (
                          <button
                            key={usdVal}
                            onClick={() => {
                              const nextVal = amountPaidUsd + usdVal;
                              setAmountPaidUsd(nextVal);
                              setAmountPaid(Math.round(nextVal * usdExchangeRate));
                            }}
                            className="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-xs transition-colors border border-emerald-100"
                          >
                            +${usdVal}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            const exactUsd = Number((total / usdExchangeRate).toFixed(2));
                            setAmountPaidUsd(exactUsd);
                            setAmountPaid(total);
                          }}
                          className="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors border border-emerald-600 col-span-5 mt-1"
                        >
                          تەواوی دۆلار (${(total / usdExchangeRate).toFixed(2)})
                        </button>
                      </div>
                    </>
                  )}

                  {/* Change / Remaining Debt Calculation */}
                  {amountPaid > total && paymentMethod === 'cash' && (
                    <div className="flex justify-between items-center text-lg font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100 mt-4">
                      <span className="flex items-center gap-2"><Coins size={20} /> پارەی گەڕاوە (باقی):</span>
                      <div className="text-left">
                        <div>{(amountPaid - total).toLocaleString()} IQD</div>
                        {usdExchangeRate > 0 && (
                          <div className="text-xs text-emerald-600 font-medium">
                            (${((amountPaid - total) / usdExchangeRate).toFixed(2)})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {paymentMethod === 'debt' && (
                    <div className={`flex justify-between items-center text-lg font-bold p-4 rounded-xl border mt-4 ${
                      amountPaid >= total 
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                        : 'text-rose-700 bg-rose-50 border-rose-100'
                    }`}>
                      <span className="flex items-center gap-2"><Calculator size={20} /> قەرزی ماوە:</span>
                      <div className="text-left">
                        <div>{Math.max(0, total - amountPaid).toLocaleString()} IQD</div>
                        {usdExchangeRate > 0 && total - amountPaid > 0 && (
                          <div className="text-xs opacity-80 font-medium">
                            (${((total - amountPaid) / usdExchangeRate).toFixed(2)})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 flex flex-col gap-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={checkoutState !== 'idle'}
                  className="py-4 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-emerald-600/20"
                >
                  <CheckCircle size={24} />
                  <span className="text-sm">تەواوکردن</span>
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={checkoutState !== 'idle'}
                  className="py-4 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-indigo-600/20"
                >
                  <Printer size={24} />
                  <span className="text-sm">وەسڵی بچووک</span>
                </button>

                <button
                  onClick={() => handleCheckout('a4')}
                  disabled={checkoutState !== 'idle'}
                  className="py-4 px-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-blue-600/20"
                >
                  <Printer size={24} />
                  <span className="text-sm">وەسڵی A4</span>
                </button>
              </div>
              <button
                onClick={() => setIsCheckoutModalOpen(false)}
                disabled={checkoutState !== 'idle'}
                className="w-full py-3 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Receipt for Printing */}
      <div className="hidden">
        <ThermalReceipt
          ref={receiptRef}
          settings={settings}
          receiptNumber={lastReceiptNumber || '---'}
          date={new Date()}
          paymentMethod={paymentMethod}
          paymentCurrency={paymentCurrency}
          customerName={isNewCustomer ? newCustomerName : customers.find(c => c.id === selectedCustomerId)?.customerName}
          customerPhone={isNewCustomer ? newCustomerPhone : customers.find(c => c.id === selectedCustomerId)?.phone}
          items={cart}
          subtotal={subtotal}
          discount={discount}
          additionalCharge={additionalCharge}
          total={total}
          amountPaid={amountPaid}
          amountPaidUsd={amountPaidUsd}
          usdExchangeRate={usdExchangeRate}
        />

        {/* --- A4 Receipt --- */}
        <A4Receipt
          ref={a4ReceiptRef}
          settings={settings}
          receiptNumber={lastReceiptNumber || '---'}
          date={new Date()}
          paymentMethod={paymentMethod}
          paymentCurrency={paymentCurrency}
          customerName={isNewCustomer ? newCustomerName : customers.find(c => c.id === selectedCustomerId)?.customerName}
          customerPhone={isNewCustomer ? newCustomerPhone : customers.find(c => c.id === selectedCustomerId)?.phone}
          items={cart}
          subtotal={subtotal}
          discount={discount}
          additionalCharge={additionalCharge}
          total={total}
          amountPaid={amountPaid}
          amountPaidUsd={amountPaidUsd}
          usdExchangeRate={usdExchangeRate}
        />
      </div>

      {/* Shared Barcode Chooser Modal */}
      {barcodeChoices && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 print:hidden" onClick={() => setBarcodeChoices(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <div>
                <h3 className="text-lg font-black text-gray-900">کام کاڵا؟</h3>
                <p className="text-xs text-gray-500 font-medium mt-0.5">ئەم بارکۆدە بۆ چەند کاڵایەک دانراوە. ژمارە (١-٩) دابگرە یان کلیک بکە.</p>
              </div>
              <button onClick={() => setBarcodeChoices(null)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl">
                <X size={20} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2 space-y-1">
              {barcodeChoices.map((choice, idx) => {
                const isPack = choice.mode === 'pack' && hasPack(choice.product);
                const price = isPack ? getPackPrice(choice.product) : choice.product.price;
                return (
                  <button
                    key={`${choice.product.id}-${choice.mode}`}
                    onClick={() => { handleProductClick(choice.product, choice.mode); setBarcodeChoices(null); }}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-indigo-50 border border-transparent hover:border-indigo-100 text-right transition-colors"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-indigo-100 text-indigo-700 font-black flex items-center justify-center">{idx + 1}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block font-bold text-gray-900 truncate">{choice.product.name}</span>
                      <span className="block text-xs text-gray-500 font-medium">
                        {isPack ? `تەک (${getPackSize(choice.product)} دانە)` : 'دانە'} · ستۆک: {choice.product.stock ?? 0}
                      </span>
                    </span>
                    <span className="font-black text-indigo-600 shrink-0">{(price || 0).toLocaleString()}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Unlinked Scale Barcode Helper Modal */}
      {unlinkedScaleScan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 print:hidden" onClick={() => setUnlinkedScaleScan(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-100" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 bg-gradient-to-r from-amber-500 to-amber-600 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <Scale size={22} className="text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black">بەستنەوەی ستیکەری قەپان</h3>
                  <p className="text-xs text-amber-100 mt-0.5">
                    کۆدی قەپان: <span className="font-mono font-bold bg-white/20 px-1.5 py-0.5 rounded">{unlinkedScaleScan.itemCode}</span> — {unlinkedScaleScan.valueType === 'weight' ? `کێش: ${unlinkedScaleScan.value} کگم` : `نرخ: $${unlinkedScaleScan.value}`}
                  </p>
                </div>
              </div>
              <button onClick={() => setUnlinkedScaleScan(null)} className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-xl transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <p className="text-xs font-bold text-gray-600">
                ئەم ستیکەرەی قەپان لە سیستەم بە هیچ کاڵایەک نەبەستراوەتەوە. کام کاڵایەی پێ دەبەستیتەوە؟ (بە یەک کلیک پاشەکەوت دەبێت و دەچێتە سەبەتە):
              </p>

              <div className="relative">
                <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="گەڕان بەدوای کاڵاکەدا (بۆ نموونە: kastro)..."
                  value={linkingSearch}
                  onChange={(e) => setLinkingSearch(e.target.value)}
                  className="w-full pr-9 pl-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-bold"
                  autoFocus
                />
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1.5 divide-y divide-gray-50">
                {products
                  .filter(p => !linkingSearch.trim() || p.name?.toLowerCase().includes(linkingSearch.toLowerCase()))
                  .slice(0, 15)
                  .map(p => (
                    <button
                      key={p.id}
                      disabled={linkingProduct}
                      onClick={() => handleLinkScaleProduct(p)}
                      className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-amber-50 border border-transparent hover:border-amber-200 text-right transition-colors group"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center font-bold text-xs shrink-0 group-hover:scale-105 transition-transform">
                          <Scale size={16} />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-gray-800">{p.name}</div>
                          <div className="text-[11px] text-gray-400 font-medium">
                            {p.isUsdMode && p.usdPrice ? `$${p.usdPrice} / کگم` : `${(p.price || 0).toLocaleString()} IQD`}
                            {p.scaleCode ? ` • کۆدی کۆن: ${p.scaleCode}` : ''}
                          </div>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100/70 group-hover:bg-amber-600 group-hover:text-white px-3 py-1.5 rounded-lg transition-colors">
                        بەستنەوە و زیادکردن
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Weighed Product Modal */}
      {selectedWeighedProduct && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 print:hidden">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold mb-1">
                  {selectedWeighedProduct.name}
                </h2>
                <p className="text-indigo-100 flex items-center gap-1">
                  <Calculator size={16} />
                  نرخی کیلۆیەک: <span className="font-bold text-white">{selectedWeighedProduct.price.toLocaleString()} IQD</span>
                </p>
              </div>
              <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                <Scale size={32} className="text-white" />
              </div>
            </div>
            
            <div className="p-6 space-y-8 overflow-y-auto flex-1">
              {/* Weight Options */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-gray-800">
                  <Scale size={20} className="text-indigo-600" />
                  <label className="font-bold text-lg">بەپێی کێش (کیلۆ)</label>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <button
                    onClick={() => {
                      const raw = 0.25 * selectedWeighedProduct.price;
                      const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                      addToCart(selectedWeighedProduct, 0.25, {
                        linePrice: res.rounded,
                        rawLinePrice: res.raw,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all border-2 border-indigo-100 hover:border-indigo-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">0.25</span>
                    <span className="text-xs text-indigo-500 font-normal">چارەک</span>
                  </button>
                  <button
                    onClick={() => {
                      const raw = 0.5 * selectedWeighedProduct.price;
                      const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                      addToCart(selectedWeighedProduct, 0.5, {
                        linePrice: res.rounded,
                        rawLinePrice: res.raw,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all border-2 border-indigo-100 hover:border-indigo-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">0.50</span>
                    <span className="text-xs text-indigo-500 font-normal">نیو</span>
                  </button>
                  <button
                    onClick={() => {
                      const raw = 1.0 * selectedWeighedProduct.price;
                      const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                      addToCart(selectedWeighedProduct, 1, {
                        linePrice: res.rounded,
                        rawLinePrice: res.raw,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all border-2 border-indigo-100 hover:border-indigo-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">1.00</span>
                    <span className="text-xs text-indigo-500 font-normal">کیلۆ</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="کێشی تر..."
                      value={weighedAmount}
                      onChange={(e) => {
                        setWeighedAmount(e.target.value);
                        setWeighedPrice('');
                      }}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-indigo-500 text-lg font-medium transition-colors"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">kg</span>
                  </div>
                  <button
                    onClick={() => {
                      if (weighedAmount && Number(weighedAmount) > 0) {
                        const raw = Number(weighedAmount) * selectedWeighedProduct.price;
                        const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                        addToCart(selectedWeighedProduct, Number(weighedAmount), {
                          linePrice: res.rounded,
                          rawLinePrice: res.raw,
                          forceSeparateLine: true
                        });
                        setSelectedWeighedProduct(null);
                      }
                    }}
                    disabled={!weighedAmount || Number(weighedAmount) <= 0}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-200"
                  >
                    زیادکردن
                  </button>
                </div>
                {Number(weighedAmount) > 0 && (() => {
                  const raw = Number(weighedAmount) * selectedWeighedProduct.price;
                  const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                  const isDiff = res.rounded !== res.raw;
                  return (
                    <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${isDiff ? 'bg-indigo-50/80 border-indigo-200 text-indigo-950' : 'bg-gray-100/70 border-gray-200 text-gray-700'}`}>
                      <span>
                        نرخی کێش: <span className={`font-mono ${isDiff ? 'line-through text-gray-400 font-normal mr-1' : ''}`}>{res.raw.toLocaleString()} IQD</span>
                      </span>
                      <span className="flex items-center gap-1.5 font-black text-sm text-indigo-700">
                        نرخی خڕکراوە: {res.rounded.toLocaleString()} IQD
                        {isDiff && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${res.difference < 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'}`}>
                            {res.difference < 0 ? `${res.difference.toLocaleString()} IQD` : `+${res.difference.toLocaleString()} IQD`}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>

              <div className="relative py-2 flex items-center justify-center">
                <div className="absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <span className="relative bg-white px-4 text-sm font-bold text-gray-400 uppercase tracking-wider">یان</span>
              </div>

              {/* Price Options */}
              <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
                <div className="flex items-center gap-2 mb-4 text-gray-800">
                  <Coins size={20} className="text-emerald-600" />
                  <label className="font-bold text-lg">بەپێی بڕی پارە (IQD)</label>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <button
                    onClick={() => {
                      const qty = Number((1000 / selectedWeighedProduct.price).toFixed(3));
                      addToCart(selectedWeighedProduct, qty, {
                        linePrice: 1000,
                        rawLinePrice: 1000,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">1,000</span>
                    <span className="text-xs text-emerald-500 font-normal">IQD</span>
                  </button>
                  <button
                    onClick={() => {
                      const qty = Number((2000 / selectedWeighedProduct.price).toFixed(3));
                      addToCart(selectedWeighedProduct, qty, {
                        linePrice: 2000,
                        rawLinePrice: 2000,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">2,000</span>
                    <span className="text-xs text-emerald-500 font-normal">IQD</span>
                  </button>
                  <button
                    onClick={() => {
                      const qty = Number((5000 / selectedWeighedProduct.price).toFixed(3));
                      addToCart(selectedWeighedProduct, qty, {
                        linePrice: 5000,
                        rawLinePrice: 5000,
                        forceSeparateLine: true
                      });
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">5,000</span>
                    <span className="text-xs text-emerald-500 font-normal">IQD</span>
                  </button>
                </div>
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <input
                      type="number"
                      min="0"
                      step="250"
                      placeholder="بڕی پارەی تر..."
                      value={weighedPrice}
                      onChange={(e) => {
                        setWeighedPrice(e.target.value);
                        setWeighedAmount('');
                      }}
                      className="w-full pl-14 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-emerald-500 text-lg font-medium transition-colors"
                    />
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-sm">IQD</span>
                  </div>
                  <button
                    onClick={() => {
                      if (weighedPrice && Number(weighedPrice) > 0) {
                        const raw = Number(weighedPrice);
                        const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                        const qty = Number((res.rounded / selectedWeighedProduct.price).toFixed(3));
                        addToCart(selectedWeighedProduct, qty, {
                          linePrice: res.rounded,
                          rawLinePrice: res.raw,
                          forceSeparateLine: true
                        });
                        setSelectedWeighedProduct(null);
                      }
                    }}
                    disabled={!weighedPrice || Number(weighedPrice) <= 0}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-200"
                  >
                    زیادکردن
                  </button>
                </div>
                {Number(weighedPrice) > 0 && (() => {
                  const raw = Number(weighedPrice);
                  const res = roundWeighedPrice(raw, settings?.scaleBarcode?.rounding);
                  const isDiff = res.rounded !== res.raw;
                  return (
                    <div className={`mt-3 p-3 rounded-xl border flex items-center justify-between text-xs font-bold transition-all ${isDiff ? 'bg-emerald-50/80 border-emerald-200 text-emerald-950' : 'bg-gray-100/70 border-gray-200 text-gray-700'}`}>
                      <span>
                        بڕی داواکراو: <span className={`font-mono ${isDiff ? 'line-through text-gray-400 font-normal mr-1' : ''}`}>{res.raw.toLocaleString()} IQD</span>
                      </span>
                      <span className="flex items-center gap-1.5 font-black text-sm text-emerald-700">
                        خڕدەکرێتەوە بۆ: {res.rounded.toLocaleString()} IQD
                        {isDiff && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold ${res.difference < 0 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'}`}>
                            {res.difference < 0 ? `${res.difference.toLocaleString()} IQD` : `+${res.difference.toLocaleString()} IQD`}
                          </span>
                        )}
                      </span>
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="p-5 border-t border-gray-100 bg-white">
              <button
                onClick={() => setSelectedWeighedProduct(null)}
                className="w-full py-4 px-4 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-lg"
              >
                پاشگەزبوونەوە
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Item Discount Modal (داشکاندن بۆ یەک کاڵا) */}
      {discountModalItem && (() => {
        const item = discountModalItem.item;
        const unitPrice = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
        let baseLineTotal = 0;
        if (item.linePrice !== undefined && item.linePrice !== null) {
          baseLineTotal = item.linePrice;
        } else {
          baseLineTotal = unitPrice * item.quantity;
        }

        const inputVal = parseFloat(discountModalItem.value) || 0;
        let calculatedDiscount = 0;
        if (discountModalItem.mode === 'percent') {
          calculatedDiscount = Math.round((baseLineTotal * Math.min(100, Math.max(0, inputVal))) / 100);
        } else {
          calculatedDiscount = Math.min(baseLineTotal, Math.max(0, inputVal));
        }

        const finalPrice = Math.max(0, baseLineTotal - calculatedDiscount);

        const handleApply = () => {
          setItemDiscount(item.id, calculatedDiscount);
          setDiscountModalItem(null);
        };

        const handleRemove = () => {
          setItemDiscount(item.id, 0);
          setDiscountModalItem(null);
        };

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 print:hidden" onClick={() => setDiscountModalItem(null)}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden text-right border border-gray-100 animate-in fade-in zoom-in-95 duration-150" dir="rtl" onClick={(e) => e.stopPropagation()}>
              {/* Header */}
              <div className="p-5 bg-gradient-to-r from-rose-600 to-pink-600 text-white flex justify-between items-center">
                <div className="flex items-center gap-2.5">
                  <div className="p-2.5 bg-white/20 rounded-xl">
                    <Percent size={20} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black leading-tight">داشکاندن بۆ یەک کاڵا</h3>
                    <p className="text-xs text-rose-100 mt-0.5 line-clamp-1">{item.name}</p>
                  </div>
                </div>
                <button onClick={() => setDiscountModalItem(null)} className="p-1 hover:bg-white/20 rounded-xl text-white">
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Item Summary Card */}
                <div className="bg-gray-50 border border-gray-200/70 rounded-2xl p-3.5 flex items-center justify-between text-xs font-bold">
                  <div>
                    <span className="text-gray-500 block text-[11px]">بڕی کاڵا:</span>
                    <span className="text-gray-800 font-mono text-sm">{item.quantity} {item.isWeighed ? 'کگم' : 'دانە'}</span>
                  </div>
                  <div className="text-left" dir="ltr">
                    <span className="text-gray-500 block text-[11px] text-right">نرخی ئەسڵی:</span>
                    <span className="text-gray-900 font-black text-sm">{Math.round(baseLineTotal).toLocaleString()} IQD</span>
                  </div>
                </div>

                {/* Mode Switcher: IQD vs % */}
                <div className="grid grid-cols-2 gap-2 bg-gray-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDiscountModalItem(prev => prev ? { ...prev, mode: 'amount', value: prev.mode === 'percent' ? String(calculatedDiscount) : prev.value } : null)}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${discountModalItem.mode === 'amount' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    داشکاندن بە دینار (IQD)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountModalItem(prev => prev ? { ...prev, mode: 'percent', value: '' } : null)}
                    className={`py-2 rounded-lg text-xs font-black transition-all ${discountModalItem.mode === 'percent' ? 'bg-white text-rose-600 shadow-xs' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    داشکاندن بە سەدی (%)
                  </button>
                </div>

                {/* Quick Presets */}
                {discountModalItem.mode === 'amount' ? (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5">داشکاندنی خێرا:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[500, 1000, 2000, 5000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setDiscountModalItem(prev => prev ? { ...prev, value: String(amt) } : null)}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all ${inputVal === amt ? 'bg-rose-50 border-rose-300 text-rose-700 font-black' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                        >
                          {amt >= 1000 ? `${amt / 1000} هەزار` : amt}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-500 mb-1.5">ڕێژەی خێرا:</label>
                    <div className="grid grid-cols-4 gap-2">
                      {[5, 10, 15, 20].map(pct => (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => setDiscountModalItem(prev => prev ? { ...prev, value: String(pct) } : null)}
                          className={`py-2 text-xs font-bold rounded-xl border transition-all ${inputVal === pct ? 'bg-rose-50 border-rose-300 text-rose-700 font-black' : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-700'}`}
                        >
                          %{pct}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input Field */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">
                    {discountModalItem.mode === 'amount' ? 'بڕی داشکاندن (دینار)' : 'ڕێژەی داشکاندن (لە سەدا %)'}
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max={discountModalItem.mode === 'percent' ? 100 : baseLineTotal}
                      step={discountModalItem.mode === 'percent' ? 1 : 250}
                      autoFocus
                      dir="ltr"
                      value={discountModalItem.value}
                      onChange={(e) => setDiscountModalItem(prev => prev ? { ...prev, value: e.target.value } : null)}
                      placeholder={discountModalItem.mode === 'amount' ? 'بۆ نموونە: 1000' : 'بۆ نموونە: 10'}
                      className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-base font-bold text-gray-900 focus:bg-white focus:border-rose-500 outline-none font-mono"
                    />
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                      {discountModalItem.mode === 'amount' ? 'IQD' : '%'}
                    </span>
                  </div>
                </div>

                {/* Preview Card */}
                <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-1.5 text-xs font-bold">
                  <div className="flex justify-between text-gray-600">
                    <span>نرخی پێش داشکاندن:</span>
                    <span className="font-mono">{Math.round(baseLineTotal).toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between text-rose-600 font-black">
                    <span>بڕی داشکاندن:</span>
                    <span className="font-mono">-{calculatedDiscount.toLocaleString()} IQD</span>
                  </div>
                  <div className="border-t border-rose-200/80 pt-1.5 flex justify-between items-center text-rose-900">
                    <span className="font-black text-sm">نرخی کۆتایی کاڵا:</span>
                    <span className="font-black text-base text-rose-700 font-mono">{finalPrice.toLocaleString()} IQD</span>
                  </div>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="p-4 border-t border-gray-100 bg-gray-50/50 flex gap-2">
                <button
                  type="button"
                  onClick={handleApply}
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-1.5 active:scale-98"
                >
                  جێبەجێکردن
                </button>
                {item.itemDiscount && item.itemDiscount > 0 && (
                  <button
                    type="button"
                    onClick={handleRemove}
                    className="px-4 py-3 bg-white hover:bg-gray-100 text-rose-600 border border-rose-200 font-bold text-xs rounded-xl transition-all"
                  >
                    سڕینەوەی داشکاندن
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDiscountModalItem(null)}
                  className="px-4 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold text-xs rounded-xl transition-all"
                >
                  داخستن
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Held Carts Modal */}
      {isHeldCartsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-gray-100 bg-indigo-50 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-indigo-900 flex items-center gap-2">
                <List size={28} className="text-indigo-600" />
                سەبەتە ڕاگیراوەکان
              </h2>
              <button
                onClick={() => setIsHeldCartsModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-white rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {heldCarts.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <List size={48} className="mx-auto mb-4 opacity-20" />
                  <p className="text-lg">هیچ سەبەتەیەکی ڕاگیراو نییە</p>
                </div>
              ) : (
                heldCarts.map((hc) => (
                  <div key={hc.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-lg text-gray-800">{hc.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-md">
                          {new Date(hc.timestamp).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {hc.items.length} کاڵا • کۆی گشتی: {Math.round(Math.max(0, hc.items.reduce((acc, item) => acc + item.price * item.quantity, 0) - hc.discount)).toLocaleString()} IQD
                      </p>
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => {
                          if (cart.length > 0) {
                            if (window.confirm('سەبەتەی ئێستا کاڵای تێدایە. دەتەوێت سەبەتەی ئێستا ڕابگریت پێش هێنانەوەی ئەم سەبەتەیە؟')) {
                              const name = window.prompt('ناوی کڕیار یان تێبینی بۆ سەبەتەی ئێستا بنووسە:');
                              if (name !== null) {
                                holdCart(name);
                              } else {
                                return;
                              }
                            } else if (!window.confirm('دڵنیایت دەتەوێت سەبەتەی ئێستا بسڕیتەوە و ئەم سەبەتەیە بهێنیتەوە؟')) {
                              return;
                            }
                          }
                          resumeCart(hc.id);
                          setIsHeldCartsModalOpen(false);
                        }}
                        className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <ShoppingCart size={18} />
                        هێنانەوە
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('دڵنیایت لە سڕینەوەی ئەم سەبەتە ڕاگیراوە؟')) {
                            removeHeldCart(hc.id);
                          }
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-red-100"
                        title="سڕینەوە"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <button
                onClick={() => setIsHeldCartsModalOpen(false)}
                className="w-full py-3 px-4 bg-white border-2 border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 hover:border-gray-300 transition-all text-lg"
              >
                داخستن
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Add New External Product to Firestore */}
      {isAddExternalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-right" dir="rtl">
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Package size={22} />
                <h3 className="text-xl font-black">زیادکردنی کاڵای دەرەکی بۆ کۆگا</h3>
              </div>
              <button onClick={() => setIsAddExternalModalOpen(false)} className="p-1 hover:bg-white/20 rounded-xl text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveNewExternalProduct} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ناوی کاڵای دەرەکی *</label>
                <input
                  type="text"
                  required
                  placeholder="مژل: تووتنی تایبەت دەرەکی، تامی خاریجی..."
                  value={newExtName}
                  onChange={(e) => setNewExtName(e.target.value)}
                  className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-emerald-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">نرخی فرۆشتن (IQD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="250"
                    required
                    placeholder="0"
                    value={newExtPrice}
                    onChange={(e) => setNewExtPrice(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-black text-emerald-600 focus:bg-white focus:border-emerald-600 outline-none text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">نرخی تێچوو / کڕین</label>
                  <input
                    type="number"
                    min="0"
                    step="250"
                    placeholder="0"
                    value={newExtCost}
                    onChange={(e) => setNewExtCost(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-700 focus:bg-white focus:border-emerald-600 outline-none text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ستۆک (عەدەد)</label>
                  <input
                    type="number"
                    min="1"
                    value={newExtStock}
                    onChange={(e) => setNewExtStock(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-800 focus:bg-white focus:border-emerald-600 outline-none text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">جۆر / کاتەگۆری</label>
                  <input
                    type="text"
                    value={newExtCategory}
                    onChange={(e) => setNewExtCategory(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-800 focus:bg-white focus:border-emerald-600 outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmittingExternal}
                  className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  <span>تۆمارکردن &amp; زیادکردن بۆ سەبەتە</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddExternalModalOpen(false)}
                  className="px-4 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-2xl"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Add Quick Custom Item directly to Cart */}
      {isQuickCustomModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-gray-100 overflow-hidden text-right" dir="rtl">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-5 text-white flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Zap size={22} />
                <h3 className="text-xl font-black">کاڵای دەستی / خزمەتگوزاری سەبەتە</h3>
              </div>
              <button onClick={() => setIsQuickCustomModalOpen(false)} className="p-1 hover:bg-white/20 rounded-xl text-white">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddQuickCustomItemToCart} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">ناوی کاڵا یان خزمەتگوزاری *</label>
                <input
                  type="text"
                  required
                  placeholder="مژل: چاککردنەوەی شیشە، دروستکردنی تامی تایبەت..."
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-indigo-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">نرخ (IQD) *</label>
                  <input
                    type="number"
                    min="0"
                    step="250"
                    required
                    placeholder="0"
                    value={customItemPrice}
                    onChange={(e) => setCustomItemPrice(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-black text-indigo-600 focus:bg-white focus:border-indigo-600 outline-none text-left dir-ltr"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">ژمارە (عەدەد)</label>
                  <input
                    type="number"
                    min="1"
                    value={customItemQty}
                    onChange={(e) => setCustomItemQty(e.target.value)}
                    className="w-full p-3 bg-gray-50 border-2 border-gray-200 rounded-2xl text-sm font-bold text-gray-800 focus:bg-white focus:border-indigo-600 outline-none text-left dir-ltr"
                  />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="submit"
                  className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Zap size={18} />
                  <span>زیادکردنی ڕاستەوخۆ بۆ سەبەتە</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsQuickCustomModalOpen(false)}
                  className="px-4 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-sm rounded-2xl"
                >
                  پاشگەزبوونەوە
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
