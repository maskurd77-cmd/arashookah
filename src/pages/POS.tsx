import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/CartContext';
import { Search, Plus, Minus, Trash2, Printer, CreditCard, ShoppingCart, Package, UserPlus, Clock, Scale, Coins, Calculator, CheckCircle, X, Pause, List, ScanLine, Gift, Edit, Smartphone, Wifi, WifiOff, Battery, BatteryCharging, BatteryMedium, BatteryFull, BatteryLow, Maximize, Minimize, LayoutGrid, Tag, ArrowRight, Leaf, Wind, Flame, Beaker, Gamepad2, ThermometerSun, PackageSearch, Droplet, Coffee, Scissors, Layers, Zap, Wrench, Sparkles, CloudFog, Box, ShoppingBag, Star, Heart, Music, Book, Briefcase, Umbrella, Bell, Cigarette, Activity, Coffee as CupSoda, FileBox, Grape, FlaskConical, Dices, Cuboid, Blocks, GlassWater, Play } from 'lucide-react';
import { cacheProducts, getCachedProducts } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { useReactToPrint } from 'react-to-print';

export default function POS() {
  const { setShowFirebaseSetup } = useAuth();
  const { activeShift, setOpenStartModal } = useShift();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [fastCode, setFastCode] = useState('');
  const [loading, setLoading] = useState(true);
  const { cart, addToCart, removeFromCart, updateQuantity, toggleGift, clearCart, discount, setDiscount, additionalCharge, setAdditionalCharge, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart } = useCart();
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash', 'debt', 'fib'
  const [paymentCurrency, setPaymentCurrency] = useState<'IQD' | 'USD'>('IQD');
  const [amountPaid, setAmountPaid] = useState(0);
  const [amountPaidUsd, setAmountPaidUsd] = useState(0);
  const receiptRef = useRef<HTMLDivElement>(null);
  const a4ReceiptRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState({ shopName: 'aras hookah shop', phone: '', address: '', receiptFooter: 'دروستکراوە لەلایەن ماس مێنو' });
  const [activeSection, setActiveSection] = useState<'general' | 'shisha' | 'external'>('general');
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
  const [weighedAmount, setWeighedAmount] = useState<string>('');
  const [weighedPrice, setWeighedPrice] = useState<string>('');
  
  const [categories, setCategories] = useState<string[]>(['دەرمان', 'نێرگلە', 'شیشە', 'یاریەکان', 'فەحم', 'هیتەر']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedCompany, setSelectedCompany] = useState<string>('all');

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

  const handleProductClick = useCallback((product: any) => {
    const priceToUse = isWholesale ? (product.wholesalePrice || product.price) : product.price;
    const productToAdd = { ...product, price: priceToUse, isWholesale: isWholesale };
    
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

        // Load Categories
        const catRef = doc(db, 'settings', 'categories');
        const catSnap = await getDoc(catRef);
        if (catSnap.exists()) {
          const data = catSnap.data();
          if (data.list && data.list.length > 0) {
            setCategories(data.list);
          }
        }

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
    };
  }, [setShowFirebaseSetup]);

  const availableCompanies = React.useMemo(() => {
    if (selectedCategory === 'all') return [];
    const companies = products
      .filter(p => (p.section === activeSection || (!p.section && activeSection === 'general')) && p.category === selectedCategory && p.company)
      .map(p => p.company);
    return Array.from(new Set(companies));
  }, [products, selectedCategory, activeSection]);

  const filteredProducts = products.filter(p => 
    (p.section === activeSection || (!p.section && activeSection === 'general')) &&
    (selectedCategory === 'all' || p.category === selectedCategory) &&
    (selectedCompany === 'all' || p.company === selectedCompany) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm)) ||
    (p.shortcutKey && p.shortcutKey.toLowerCase().includes(searchTerm.toLowerCase()))) &&
    (!isWholesale || (isWholesale && p.wholesalePrice && p.wholesalePrice > 0))
  );

  // If selected category changes, reset company
  useEffect(() => {
    setSelectedCompany('all');
  }, [selectedCategory]);

  // Barcode and Shortcut scanner listener
  useEffect(() => {
    let barcode = '';
    let timeout: any;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === 'Enter') {
        if (barcode) {
          const product = products.find(p => p.barcode === barcode || (p.shortcutKey && p.shortcutKey.toLowerCase() === barcode.toLowerCase()));
          if (product) {
            handleProductClick(product);
          }
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          // If we typed something short and it's a shortcut key, we can auto-submit it if we want,
          // but requiring Enter is safer to avoid accidental triggers.
          // However, for single-character shortcuts, we can trigger immediately if it's not a fast barcode sequence.
          const shortcutProduct = products.find(p => p.shortcutKey && p.shortcutKey.toLowerCase() === barcode.toLowerCase());
          if (shortcutProduct && barcode.length <= 5) {
            handleProductClick(shortcutProduct);
            barcode = '';
          } else {
            barcode = '';
          }
        }, 500); // Reset if typing is too slow (not a scanner), OR process shortcut
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, handleProductClick]);

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
      
      let finalCustomerId = paymentMethod === 'debt' ? selectedCustomerId : null;

      // Handle Debt First
      if (paymentMethod === 'debt') {
        const remainingAmount = total - amountPaid;
        
        if (isNewCustomer) {
          // Create new debt record
          const debtDoc = {
            customerName: newCustomerName || '',
            phone: newCustomerPhone || '',
            totalAmount: remainingAmount || 0,
            paidAmount: 0, // We already subtracted amountPaid from the new totalAmount (remaining)
            remainingAmount: remainingAmount || 0,
            status: remainingAmount <= 0 ? 'paid' : 'unpaid',
            createdAt: serverTimestamp(),
            payments: [],
            purchases: [{
              amount: remainingAmount, // Only log the remaining as purchase
              date: new Date().toISOString(),
              note: `کڕینی نوێ (کۆی گشتی: ${total} - دراو: ${amountPaid})`,
              receiptNumber: receiptNumber,
              items: cart.map(item => ({
                id: item.originalId || item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                wholesalePrice: item.wholesalePrice || 0,
                isWholesale: item.isWholesale || false,
                isGift: item.isGift || false,
                packSize: item.packSize || 1
              }))
            }]
          };
          try {
            const newDebtRef = await addDoc(collection(db, 'debts'), debtDoc);
            finalCustomerId = newDebtRef.id;
          } catch (error: any) {
            console.error("Error adding debt:", error);
            if (error.code === 'permission-denied') setShowFirebaseSetup(true);
          }
        } else {
          // Update existing debt record
          const customerRef = doc(db, 'debts', selectedCustomerId);
          const customer = customers.find(c => c.id === selectedCustomerId);
          
          if (customer) {
            // We only add the remaining amount to the debt total!
            const newTotalAmount = customer.totalAmount + remainingAmount;
            const newPaidAmount = customer.paidAmount; // We don't log amountPaid as a debt payment
            const newRemainingAmount = newTotalAmount - newPaidAmount;
            
            const payments = [...(customer.payments || [])];
            // No payment logged here, because we only log the *unpaid* portion above

            const purchases = [...(customer.purchases || [])];
            purchases.push({
              amount: remainingAmount, // Only log the remaining as purchase
              date: new Date().toISOString(),
              note: `کڕینی نوێ (کۆی گشتی: ${total} - دراو: ${amountPaid})`,
              receiptNumber: receiptNumber,
              items: cart.map(item => ({
                id: item.originalId || item.id,
                name: item.name,
                quantity: item.quantity,
                price: item.price,
                wholesalePrice: item.wholesalePrice || 0,
                isWholesale: item.isWholesale || false,
                isGift: item.isGift || false,
                packSize: item.packSize || 1
              }))
            });

            updateDoc(customerRef, {
              totalAmount: newTotalAmount || 0,
              paidAmount: newPaidAmount || 0,
              remainingAmount: newRemainingAmount || 0,
              status: newRemainingAmount <= 0 ? 'paid' : 'unpaid',
              payments: payments.map(p => ({
                amount: p.amount || 0,
                date: p.date || new Date().toISOString(),
                note: p.note || ''
              })),
              purchases: purchases.map(p => ({
                amount: p.amount || 0,
                date: p.date || new Date().toISOString(),
                note: p.note || '',
                receiptNumber: p.receiptNumber || '',
                items: p.items || []
              }))
            }).catch((error: any) => {
              console.error("Error updating debt:", error);
              if (error.code === 'permission-denied') setShowFirebaseSetup(true);
            });
          }
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
          isGift: item.isGift || false
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

      setCheckoutState(shouldPrint ? 'success-print' : 'success-no-print');

      if (shouldPrint === 'a4') {
        setTimeout(() => {
          handlePrintA4Action();
        }, 2000);
      } else if (shouldPrint) {
        setTimeout(() => {
          handlePrintAction();
        }, 2000);
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
      const code = fastCode.trim().toLowerCase();
      const product = products.find(p => 
        (p.barcode && p.barcode.toLowerCase() === code) || 
        (p.shortcutKey && p.shortcutKey.toLowerCase() === code)
      );
      if (product) {
        handleProductClick(product);
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
    switch(categoryName) {
      case 'دەرمان': return <Grape size={32} className="mb-3 text-emerald-500" />;
      case 'نێرگلە': return <FlaskConical size={32} className="mb-3 text-sky-500" />;
      case 'شیشە': return <Beaker size={32} className="mb-3 text-blue-500" />;
      case 'یاریەکان': return <Dices size={32} className="mb-3 text-purple-500" />;
      case 'فەحم': return <Cuboid size={32} className="mb-3 text-stone-700" />;
      case 'هیتەر': return <ThermometerSun size={32} className="mb-3 text-rose-500" />;
      case 'کاڵای دەرەکی': return <PackageSearch size={32} className="mb-3 text-slate-600" />;
      case 'سۆندە': return <Activity size={32} className="mb-3 text-indigo-400" />;
      case 'دەمە': return <UserPlus size={32} className="mb-3 text-pink-400" />;
      case 'سەرە': return <Coffee size={32} className="mb-3 text-amber-600" />;
      case 'قەمچی': 
      case 'مەقاش': return <Scissors size={32} className="mb-3 text-gray-500" />;
      case 'قەزدیق': 
      case 'فۆیل': return <Layers size={32} className="mb-3 text-slate-400" />;
      case 'ئاو': return <Droplet size={32} className="mb-3 text-blue-400" />;
      case 'خواردنەوە': return <CupSoda size={32} className="mb-3 text-orange-400" />;
      case 'چەرخ': return <Zap size={32} className="mb-3 text-yellow-500" />;
      case 'پارچەکان': return <Wrench size={32} className="mb-3 text-gray-600" />;
      case 'پاککەرەوە': return <Sparkles size={32} className="mb-3 text-teal-400" />;
      case 'پاتری': return <Battery size={32} className="mb-3 text-green-500" />;
      case 'ڤەیپ': return <CloudFog size={32} className="mb-3 text-slate-500" />;
      case 'شەربەت': return <GlassWater size={32} className="mb-3 text-rose-400" />;
      case 'جگەرە': return <Cigarette size={32} className="mb-3 text-stone-500" />;
      default: {
        const { Icon, color } = getFallbackConfig(categoryName);
        return <Icon size={32} className={`mb-3 ${color}`} />;
      }
    }
  };

  const getCategoryIconSmall = (categoryName: string) => {
    switch(categoryName) {
      case 'دەرمان': return <Grape size={20} />;
      case 'نێرگلە': return <FlaskConical size={20} />;
      case 'شیشە': return <Beaker size={20} />;
      case 'یاریەکان': return <Dices size={20} />;
      case 'فەحم': return <Cuboid size={20} />;
      case 'هیتەر': return <ThermometerSun size={20} />;
      case 'کاڵای دەرەکی': return <PackageSearch size={20} />;
      case 'سۆندە': return <Activity size={20} />;
      case 'دەمە': return <UserPlus size={20} />;
      case 'سەرە': return <Coffee size={20} />;
      case 'قەمچی': 
      case 'مەقاش': return <Scissors size={20} />;
      case 'قەزدیق': 
      case 'فۆیل': return <Layers size={20} />;
      case 'ئاو': return <Droplet size={20} />;
      case 'خواردنەوە': return <CupSoda size={20} />;
      case 'چەرخ': return <Zap size={20} />;
      case 'پارچەکان': return <Wrench size={20} />;
      case 'پاککەرەوە': return <Sparkles size={20} />;
      case 'پاتری': return <Battery size={20} />;
      case 'ڤەیپ': return <CloudFog size={20} />;
      case 'شەربەت': return <GlassWater size={20} />;
      case 'جگەرە': return <Cigarette size={20} />;
      default: {
        const { Icon } = getFallbackConfig(categoryName);
        return <Icon size={20} />;
      }
    }
  };

  return (
    <div className={`flex flex-col gap-4 print:block h-full`}>
      <div className={`flex gap-4 print:h-auto print:block flex-1 overflow-hidden`}>
        {/* Products Section */}
        <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
            <div className="p-3 border-b border-gray-100 flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (cart.length > 0 && activeSection !== 'general') {
                    if (window.confirm('گۆڕینی بەش سەبەتەکەت بەتاڵ دەکاتەوە. دڵنیایت؟')) {
                      clearCart();
                      setActiveSection('general');
                      setSelectedCategory('all');
                      setSelectedCompany('all');
                    }
                  } else {
                    setActiveSection('general');
                    setSelectedCategory('all');
                    setSelectedCompany('all');
                  }
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  activeSection === 'general' 
                    ? 'bg-indigo-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                بەشی گشتی
              </button>
              <button
                onClick={() => {
                  if (cart.length > 0 && activeSection !== 'shisha') {
                    if (window.confirm('گۆڕینی بەش سەبەتەکەت بەتاڵ دەکاتەوە. دڵنیایت؟')) {
                      clearCart();
                      setActiveSection('shisha');
                      setSelectedCategory('all');
                      setSelectedCompany('all');
                    }
                  } else {
                    setActiveSection('shisha');
                    setSelectedCategory('all');
                    setSelectedCompany('all');
                  }
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  activeSection === 'shisha' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                بەشی شیشە
              </button>
              <button
                onClick={() => {
                  if (cart.length > 0 && activeSection !== 'external') {
                    if (window.confirm('گۆڕینی بەش سەبەتەکەت بەتاڵ دەکاتەوە. دڵنیایت؟')) {
                      clearCart();
                      setActiveSection('external');
                      setSelectedCategory('all');
                      setSelectedCompany('all');
                    }
                  } else {
                    setActiveSection('external');
                    setSelectedCategory('all');
                    setSelectedCompany('all');
                  }
                }}
                className={`flex-1 py-2 rounded-xl font-bold transition-all ${
                  activeSection === 'external' 
                    ? 'bg-emerald-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                کاڵای دەرەکی
              </button>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center gap-3">
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                      className="w-full pl-4 pr-10 py-2 text-sm bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="relative w-48">
                    <ScanLine className="absolute right-3 top-1/2 -translate-y-1/2 text-indigo-400" size={18} />
                    <input
                      type="text"
                      placeholder="کۆدی خێرا یان بارکۆد..."
                      className="w-full pl-4 pr-10 py-2 text-sm bg-indigo-50 text-indigo-900 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 placeholder:text-indigo-300 font-medium"
                      value={fastCode}
                      onChange={(e) => setFastCode(e.target.value)}
                      onKeyDown={handleFastCodeSubmit}
                      dir="ltr"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 rounded-xl p-1">
                    <button
                      onClick={() => setIsWholesale(false)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${!isWholesale ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      مفرد (دانە)
                    </button>
                    <button
                      onClick={() => setIsWholesale(true)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition-all ${isWholesale ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      جملە (کۆ)
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-green-50 px-3 py-2 rounded-xl border border-green-100">
                    <span className="text-sm font-bold text-green-700 whitespace-nowrap">$1 =</span>
                    <input
                      type="number"
                      value={usdExchangeRate}
                      onChange={(e) => handleUpdateExchangeRate(Number(e.target.value))}
                      className="w-24 px-2 py-1 text-center font-bold text-green-700 bg-white border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>
              
              {/* Category Filter */}
              {activeSection === 'general' && (
                selectedCategory === 'all' ? (
                  <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-9 gap-3 pb-2 mt-2">
                    {categories.map((cat, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategory(cat)}
                        className="flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all bg-white text-gray-700 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 shadow-sm hover:-translate-y-1 hover:shadow-md"
                      >
                        {getCategoryIcon(cat)}
                        <span className="text-sm font-bold text-center leading-tight line-clamp-2">{cat}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 mt-2">
                    <div className="flex items-center gap-3 pb-2 border-b border-gray-100">
                      <button
                        onClick={() => setSelectedCategory('all')}
                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-bold transition-colors"
                      >
                        <ArrowRight size={16} />
                        گەڕانەوە
                      </button>
                      <span className="font-bold text-indigo-700 text-lg flex items-center gap-2">
                        {getCategoryIconSmall(selectedCategory)}
                        {selectedCategory}
                      </span>
                    </div>

                    {/* Subcategory (Company) Filter */}
                    {availableCompanies.length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        <button
                          onClick={() => setSelectedCompany('all')}
                          className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                            selectedCompany === 'all'
                              ? 'bg-gray-800 text-white border-gray-800'
                              : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
                          }`}
                        >
                          هەموو جۆرەکان
                        </button>
                        {availableCompanies.map((comp: unknown, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCompany(comp as string)}
                            className={`px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors border ${
                              selectedCompany === comp
                                ? 'bg-gray-800 text-white border-gray-800'
                                : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'
                            }`}
                          >
                            {comp as string}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>

        <div className="flex-1 overflow-y-auto p-3">
          {!activeShift && (
            <div className="bg-gradient-to-r from-rose-600 to-rose-700 text-white p-4 rounded-2xl mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-lg border-2 border-rose-400">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/10 rounded-xl">
                  <Clock size={28} className="animate-pulse text-amber-300" />
                </div>
                <div>
                  <h3 className="font-black text-base sm:text-lg">⚠️ هیچ شەفتێک دەستپێنەکراوە!</h3>
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
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-200/80 rounded-2xl p-4 mb-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
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

          {loading ? (
            <div className="flex justify-center items-center h-full">بارکردن...</div>
          ) : activeSection === 'general' && selectedCategory === 'all' && searchTerm === '' ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-4 opacity-50">
              <LayoutGrid size={64} />
              <p className="text-lg font-bold">تکایە بەشێک هەڵبژێرە بۆ بینینی کاڵاکان</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {filteredProducts.map(product => {
                const displayPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;
                return (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`relative flex flex-col items-center p-2 rounded-xl transition-colors border text-right group cursor-pointer ${isWholesale ? 'bg-purple-50/50 hover:bg-purple-50 border-transparent hover:border-purple-200' : 'bg-gray-50 hover:bg-indigo-50 border-transparent hover:border-indigo-100'}`}
                >
                  <div className={`w-12 h-12 rounded-lg mb-1 flex items-center justify-center ${isWholesale ? 'bg-purple-100 text-purple-400' : 'bg-gray-200 text-gray-400'}`}>
                    <Package size={20} />
                  </div>
                  <span className="font-medium text-[11px] line-clamp-2 mb-1 w-full leading-tight">{product.name}</span>
                  <span className={`font-bold text-xs w-full ${isWholesale ? 'text-purple-600' : 'text-indigo-600'}`}>
                    {displayPrice.toLocaleString()} IQD
                    {product.isWeighed && <span className={`text-[10px] font-normal mr-1 ${isWholesale ? 'text-purple-400' : 'text-gray-400'}`}>/ کگم</span>}
                  </span>
                  {isWholesale && (
                    <div className="w-full flex flex-col text-[9px] mt-1 gap-0.5">
                      <span className="text-purple-700 font-bold bg-purple-100 rounded px-1 py-0.5">کۆ: {(product.wholesalePrice || 0).toLocaleString()}</span>
                      <span className="text-rose-700 font-bold bg-rose-100 rounded px-1 py-0.5">تێچوو: {(product.wholesaleCost || product.costPrice * (product.packSize || 1) || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <span className="text-[10px] text-gray-400 w-full mt-1">ستۆک: {Number(product.stock.toFixed(3))} {product.isWeighed ? 'کگم' : 'دانە'}</span>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-80 lg:w-80 xl:w-96 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col print:hidden">
        <div className="p-4 border-b border-gray-100 bg-indigo-50 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
            <ShoppingCart size={24} />
            سەبەتە
          </h2>
          <div className="flex items-center gap-2">
            {heldCarts.length > 0 && (
              <button
                onClick={() => setIsHeldCartsModalOpen(true)}
                className="relative p-1.5 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                title="سەبەتە ڕاگیراوەکان"
              >
                <List size={18} />
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">
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
                className="text-orange-500 hover:text-orange-700 hover:bg-orange-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                title="ڕاگرتنی سەبەتە"
              >
                <Pause size={16} />
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
                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-colors flex items-center gap-1 text-sm font-medium"
                title="سڕینەوەی هەمووی"
              >
                <Trash2 size={16} />
                بەتاڵکردن
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>سەبەتەکە بەتاڵە</p>
            </div>
          ) : (
            cart.map((item, index) => {
              let itemTotal = 0;
              let packs = 0;
              let pieces = item.quantity;
              
              if (!item.isGift) {
                if (item.isWholesale) {
                  itemTotal = (item.wholesalePrice || item.price) * item.quantity;
                } else {
                  itemTotal = item.price * item.quantity;
                }
              }

              return (
              <div key={item.id} className={`flex items-center p-2 rounded-lg border shadow-sm gap-2 ${item.isGift ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
                <span className="font-bold text-gray-400 text-xs w-4 text-center shrink-0">{index + 1}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-xs truncate flex items-center gap-1.5">
                    {item.name}
                    {item.isGift && <span className="text-[9px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">هەدیە</span>}
                  </h4>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className={`font-bold text-sm ${item.isGift ? 'text-orange-600 line-through opacity-50' : 'text-indigo-600'}`}>
                      {item.isGift ? '0' : Math.round(itemTotal).toLocaleString()} IQD
                    </p>
                    {item.isWholesale && !item.isGift && (
                      <span className="text-[10px] text-purple-600 bg-purple-100 px-1.5 py-0.5 rounded-full">
                        کۆ × {(item.wholesalePrice || item.price).toLocaleString()}
                      </span>
                    )}
                    {item.isWeighed && !item.isGift && (
                      <span className="text-[10px] text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                        <Scale size={10} />
                        {item.price.toLocaleString()}/kg
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-1.5 shrink-0">
                  <div className="flex flex-col gap-1">
                    <button onClick={() => toggleGift(item.id)} className={`p-1 rounded transition-colors ${item.isGift ? 'text-orange-600 bg-orange-100' : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`} title="هەدیە">
                      <Gift size={14} />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-100 rounded transition-colors" title="سڕینەوە">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5 shadow-sm h-8">
                    <button onClick={() => updateQuantity(item.id, item.quantity - (item.isWeighed ? 0.25 : 1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors h-full">
                      <Minus size={14} />
                    </button>
                    <div className="flex flex-col items-center justify-center w-10 px-1">
                      <input
                        type="number"
                        min="0"
                        step={item.isWeighed ? "0.001" : "1"}
                        value={item.quantity === 0 ? '' : Number(item.quantity.toFixed(3))}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') {
                            updateQuantity(item.id, 0);
                          } else {
                            updateQuantity(item.id, Number(val));
                          }
                        }}
                        className="w-full text-center font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0 text-xs h-4"
                        dir="ltr"
                      />
                      {item.isWeighed && <span className="text-[8px] text-gray-500 font-medium">کگم</span>}
                    </div>
                    <button onClick={() => updateQuantity(item.id, item.quantity + (item.isWeighed ? 0.25 : 1))} className="p-1 hover:bg-gray-100 rounded text-gray-600 transition-colors h-full">
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )})
          )}
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl space-y-3">
          <div className="flex justify-between text-sm text-gray-600">
            <span>کۆی گشتی:</span>
            <span>{subtotal.toLocaleString()} IQD</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>داشکاندن:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value))}
                className="w-24 px-2 py-1 text-left border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span>IQD</span>
            </div>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>پارەی زیادە:</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={additionalCharge}
                onChange={(e) => setAdditionalCharge(Number(e.target.value))}
                className="w-24 px-2 py-1 text-left border border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
              />
              <span>IQD</span>
            </div>
          </div>
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>کۆی کۆتایی:</span>
            <span className="text-indigo-600">{total.toLocaleString()} IQD</span>
          </div>

          <div className="pt-4">
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
              className="w-full py-4 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-indigo-600/20 text-lg"
            >
              <CreditCard size={24} />
              پارەدان
            </button>
          </div>
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
        <div ref={receiptRef} className="p-4 w-80 text-center font-sans mx-auto bg-white text-black" dir="rtl">
          <h1 className="text-2xl font-bold mb-1">{settings.shopName}</h1>
          {settings.address && <p className="text-sm text-gray-600 mb-1">{settings.address}</p>}
          {settings.phone && <p className="text-sm text-gray-600 mb-2" dir="ltr">{settings.phone}</p>}
          <p className="text-sm text-gray-600 mb-2">{new Date().toLocaleString('ku-IQ')}</p>
          <p className={`text-sm font-bold mb-4 ${paymentMethod === 'fib' ? 'text-blue-600' : 'text-gray-800'}`}>
            شێوازی پارەدان: {paymentMethod === 'cash' ? 'نەقد' : (paymentMethod === 'fib' ? 'FIB' : 'قەرز')}
          </p>
          
          {paymentMethod === 'debt' && (
            <div className="border border-gray-300 rounded-lg p-2 mb-4 text-sm text-right">
              <p className="font-bold mb-1">کڕیار: {isNewCustomer ? newCustomerName : customers.find(c => c.id === selectedCustomerId)?.customerName}</p>
              {customers.find(c => c.id === selectedCustomerId)?.phone && (
                <p className="text-gray-600 mb-1" dir="ltr">{customers.find(c => c.id === selectedCustomerId)?.phone}</p>
              )}
              {isNewCustomer && newCustomerPhone && (
                <p className="text-gray-600 mb-1" dir="ltr">{newCustomerPhone}</p>
              )}
              <p className="text-gray-600">شێوازی پارەدان: قەرز</p>
            </div>
          )}

          <div className="border-t border-b border-dashed border-gray-400 py-4 mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right">
                  <th className="pb-2">کالا</th>
                  <th className="pb-2 text-center">ژمارە/کێش</th>
                  <th className="pb-2 text-left">نرخ</th>
                </tr>
              </thead>
              <tbody>
                {cart.map(item => {
                  let itemTotal = 0;
                  if (!item.isGift) {
                    if (item.isWholesale) {
                      itemTotal = (item.wholesalePrice || item.price) * item.quantity;
                    } else {
                      itemTotal = item.price * item.quantity;
                    }
                  }
                  return (
                  <tr key={item.id}>
                    <td className="py-1">{item.name}</td>
                    <td className="py-1 text-center">{item.isWeighed ? `${Number(item.quantity.toFixed(3))} kg` : item.quantity}</td>
                    <td className="py-1 text-left">{Math.round(itemTotal).toLocaleString()}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          <div className="space-y-1 text-sm font-bold">
            <div className="flex justify-between">
              <span>کۆی گشتی:</span>
              <span>{subtotal.toLocaleString()} IQD</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between">
                <span>داشکاندن:</span>
                <span>{discount.toLocaleString()} IQD</span>
              </div>
            )}
            {additionalCharge > 0 && (
              <div className="flex justify-between">
                <span>پارەی زیادە:</span>
                <span>{additionalCharge.toLocaleString()} IQD</span>
              </div>
            )}
            <div className="flex justify-between text-lg mt-2 pt-2 border-t border-gray-400">
              <span>کۆی کۆتایی:</span>
              <span>{total.toLocaleString()} IQD</span>
            </div>
            {paymentMethod === 'debt' && (
              <>
                <div className="flex justify-between text-gray-600 mt-1">
                  <span>پارەی دراو:</span>
                  <span>{amountPaid.toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between text-red-600 mt-1">
                  <span>قەرزی ماوە:</span>
                  <span>{Math.max(0, total - amountPaid).toLocaleString()} IQD</span>
                </div>
              </>
            )}
          </div>
          <p className="mt-8 text-xs text-gray-500 font-bold">{settings.receiptFooter}</p>
        </div>

        {/* --- A4 Receipt --- */}
        <div ref={a4ReceiptRef} className="p-10 w-[794px] h-[1123px] font-sans mx-auto bg-white text-black" dir="rtl">
          <div className="flex justify-between items-start border-b-2 border-indigo-600 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-indigo-900 mb-2">{settings.shopName}</h1>
              <p className="text-lg text-gray-600 mb-1">{settings.address}</p>
              <p className="text-lg text-gray-600 font-medium" dir="ltr">{settings.phone}</p>
            </div>
            <div className="text-left">
              <h2 className="text-3xl font-light text-gray-400 mb-2">وەسڵی فرۆشتن</h2>
              <p className="text-lg text-gray-600 mb-1">بەروار: <span className="font-bold text-gray-900">{new Date().toLocaleDateString('ku-IQ')}</span></p>
              <p className="text-lg text-gray-600 mb-1">کات: <span className="font-bold text-gray-900">{new Date().toLocaleTimeString('ku-IQ')}</span></p>
              <p className="text-lg text-gray-600">شێوازی پارەدان: <span className="font-bold text-gray-900">{paymentMethod === 'cash' ? 'نەقد' : (paymentMethod === 'fib' ? 'FIB' : 'قەرز')}</span></p>
            </div>
          </div>
          
          {paymentMethod === 'debt' && (
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6 mb-8">
              <h3 className="text-xl font-bold text-gray-900 border-b border-gray-200 pb-3 mb-4">زانیاری کڕیار (قەرز)</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-gray-600 mb-1">ناوی کڕیار</p>
                  <p className="text-lg font-bold">{isNewCustomer ? newCustomerName : customers.find(c => c.id === selectedCustomerId)?.customerName}</p>
                </div>
                <div>
                  <p className="text-gray-600 mb-1">ژمارەی مۆبایل</p>
                  <p className="text-lg font-bold font-mono" dir="ltr">
                    {isNewCustomer ? newCustomerPhone : (customers.find(c => c.id === selectedCustomerId)?.phone || 'بەردەست نییە')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="mb-8 min-h-[400px]">
            <table className="w-full text-lg">
              <thead>
                <tr className="bg-indigo-50 text-indigo-900">
                  <th className="py-3 px-4 text-right rounded-r-xl">کاڵا</th>
                  <th className="py-3 px-4 text-center">بڕ / کێش</th>
                  <th className="py-3 px-4 text-center">نرخی دانە</th>
                  <th className="py-3 px-4 text-left rounded-l-xl">کۆی نرخ</th>
                </tr>
              </thead>
              <tbody>
                {cart.map((item, idx) => {
                  let itemTotal = 0;
                  let unitPrice = 0;
                  if (!item.isGift) {
                    unitPrice = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
                    itemTotal = unitPrice * item.quantity;
                  }
                  return (
                  <tr key={item.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="py-4 px-4 font-bold border-b border-gray-100">{item.name}</td>
                    <td className="py-4 px-4 text-center border-b border-gray-100">{item.isWeighed ? `${Number(item.quantity.toFixed(3))} kg` : item.quantity}</td>
                    <td className="py-4 px-4 text-center border-b border-gray-100">{item.isGift ? 'دیاری' : unitPrice.toLocaleString()}</td>
                    <td className="py-4 px-4 text-left font-bold border-b border-gray-100">{item.isGift ? '0' : Math.round(itemTotal).toLocaleString()}</td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
          
          <div className="flex justify-end pt-6 border-t-2 border-indigo-100">
            <div className="w-1/2 bg-gray-50 rounded-2xl p-6">
              <div className="space-y-3 text-lg">
                <div className="flex justify-between">
                  <span className="text-gray-600">کۆی گشتی:</span>
                  <span className="font-bold">{subtotal.toLocaleString()} IQD</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-indigo-600">
                    <span>داشکاندن:</span>
                    <span className="font-bold">{discount.toLocaleString()} IQD</span>
                  </div>
                )}
                {additionalCharge > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>پارەی زیادە:</span>
                    <span className="font-bold">{additionalCharge.toLocaleString()} IQD</span>
                  </div>
                )}
                <div className="flex justify-between text-2xl font-bold mt-4 pt-4 border-t border-gray-200 text-indigo-900">
                  <span>کۆی کۆتایی:</span>
                  <span>{total.toLocaleString()} IQD</span>
                </div>
                {paymentMethod === 'debt' && (
                  <>
                    <div className="flex justify-between text-gray-500 mt-2">
                      <span>پارەی دراو:</span>
                      <span className="font-bold">{amountPaid.toLocaleString()} IQD</span>
                    </div>
                    <div className="flex justify-between text-rose-600 mt-1 text-xl">
                      <span>قەرزی ماوە:</span>
                      <span className="font-bold">{Math.max(0, total - amountPaid).toLocaleString()} IQD</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="mt-16 text-center text-gray-400">
            <p className="font-bold tracking-wide">{settings.receiptFooter}</p>
          </div>
        </div>
      </div>

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
                      addToCart(selectedWeighedProduct, 0.25);
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all border-2 border-indigo-100 hover:border-indigo-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">0.25</span>
                    <span className="text-xs text-indigo-500 font-normal">چارەک</span>
                  </button>
                  <button
                    onClick={() => {
                      addToCart(selectedWeighedProduct, 0.5);
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-indigo-700 rounded-xl font-bold hover:bg-indigo-50 transition-all border-2 border-indigo-100 hover:border-indigo-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">0.50</span>
                    <span className="text-xs text-indigo-500 font-normal">نیو</span>
                  </button>
                  <button
                    onClick={() => {
                      addToCart(selectedWeighedProduct, 1);
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
                        addToCart(selectedWeighedProduct, Number(weighedAmount));
                        setSelectedWeighedProduct(null);
                      }
                    }}
                    disabled={!weighedAmount || Number(weighedAmount) <= 0}
                    className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-indigo-200"
                  >
                    زیادکردن
                  </button>
                </div>
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
                      const qty = 1000 / selectedWeighedProduct.price;
                      addToCart(selectedWeighedProduct, qty);
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">1,000</span>
                  </button>
                  <button
                    onClick={() => {
                      const qty = 2000 / selectedWeighedProduct.price;
                      addToCart(selectedWeighedProduct, qty);
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">2,000</span>
                  </button>
                  <button
                    onClick={() => {
                      const qty = 5000 / selectedWeighedProduct.price;
                      addToCart(selectedWeighedProduct, qty);
                      setSelectedWeighedProduct(null);
                    }}
                    className="py-3 px-2 bg-white text-emerald-700 rounded-xl font-bold hover:bg-emerald-50 transition-all border-2 border-emerald-100 hover:border-emerald-300 shadow-sm flex flex-col items-center justify-center gap-1"
                  >
                    <span className="text-lg">5,000</span>
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
                        const qty = Number(weighedPrice) / selectedWeighedProduct.price;
                        addToCart(selectedWeighedProduct, qty);
                        setSelectedWeighedProduct(null);
                      }
                    }}
                    disabled={!weighedPrice || Number(weighedPrice) <= 0}
                    className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-emerald-200"
                  >
                    زیادکردن
                  </button>
                </div>
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
