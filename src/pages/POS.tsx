import React, { useState, useEffect, useRef, useCallback } from 'react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, increment, getDoc, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useCart } from '../context/CartContext';
import { Search, Plus, Minus, Trash2, Printer, CreditCard, ShoppingCart, Package, UserPlus, Clock, Scale, Coins, Calculator, CheckCircle, X, Pause, List, ScanLine, Gift, Edit } from 'lucide-react';
import { cacheProducts, getCachedProducts } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useReactToPrint } from 'react-to-print';

export default function POS() {
  const { setShowFirebaseSetup } = useAuth();
  const [products, setProducts] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const { cart, addToCart, removeFromCart, updateQuantity, toggleGift, clearCart, discount, setDiscount, subtotal, total, heldCarts, holdCart, resumeCart, removeHeldCart } = useCart();
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [isHeldCartsModalOpen, setIsHeldCartsModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountPaid, setAmountPaid] = useState(0);
  const receiptRef = useRef<HTMLDivElement>(null);
  const [settings, setSettings] = useState({ shopName: 'aras hookah shop', phone: '', address: '', receiptFooter: 'Powered By Mas Menu' });
  const [activeSection, setActiveSection] = useState<'general' | 'shisha'>('general');
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
  
  const [categories, setCategories] = useState<string[]>(['دەرمان', 'نێرگلە', 'یاریەکان', 'فەحم', 'هیتەر']);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleProductClick = useCallback((product: any) => {
    const priceToUse = isWholesale ? (product.wholesalePrice || product.price) : product.price;
    const productToAdd = { ...product, price: priceToUse };
    
    if (product.isWeighed) {
      setSelectedWeighedProduct(productToAdd);
      setWeighedAmount('');
      setWeighedPrice('');
    } else {
      addToCart(productToAdd);
    }
  }, [isWholesale, addToCart]);

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

  const filteredProducts = products.filter(p => 
    (p.section === activeSection || (!p.section && activeSection === 'general')) &&
    (selectedCategory === 'all' || p.category === selectedCategory) &&
    (p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (p.barcode && p.barcode.includes(searchTerm))) &&
    (!isWholesale || (isWholesale && p.wholesalePrice && p.wholesalePrice > 0))
  );

  // Barcode scanner listener
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
          const product = filteredProducts.find(p => p.barcode === barcode);
          if (product) {
            handleProductClick(product);
          }
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          barcode = '';
        }, 100); // Reset if typing is too slow (not a scanner)
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredProducts, handleProductClick]);

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

  const handleCheckout = async (shouldPrint: boolean = true) => {
    if (cart.length === 0) return;
    
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
      const orderData = {
        items: cart,
        subtotal,
        discount,
        total,
        paymentMethod,
        amountPaid,
        createdAt: serverTimestamp(),
        receiptNumber: `REC-${Date.now()}`,
        customerId: paymentMethod === 'debt' ? (isNewCustomer ? 'new' : selectedCustomerId) : null,
        section: activeSection,
      };

      // Fire and forget for offline support
      addDoc(collection(db, 'sales'), orderData).catch((error: any) => {
        console.error("Error adding sale:", error);
        if (error.code === 'permission-denied') setShowFirebaseSetup(true);
      });

      // Handle Debt
      if (paymentMethod === 'debt') {
        const remainingAmount = total - amountPaid;
        
        if (isNewCustomer) {
          // Create new debt record
          const debtDoc = {
            customerName: newCustomerName,
            phone: newCustomerPhone,
            totalAmount: total,
            paidAmount: amountPaid,
            remainingAmount: remainingAmount,
            status: remainingAmount <= 0 ? 'paid' : 'unpaid',
            createdAt: serverTimestamp(),
            payments: amountPaid > 0 ? [{
              amount: amountPaid,
              date: new Date().toISOString(),
              note: 'پارەی سەرەتا لە کاتی کڕین'
            }] : []
          };
          addDoc(collection(db, 'debts'), debtDoc).catch((error: any) => {
            console.error("Error adding debt:", error);
            if (error.code === 'permission-denied') setShowFirebaseSetup(true);
          });
        } else {
          // Update existing debt record
          const customerRef = doc(db, 'debts', selectedCustomerId);
          const customer = customers.find(c => c.id === selectedCustomerId);
          
          if (customer) {
            const newTotalAmount = customer.totalAmount + total;
            const newPaidAmount = customer.paidAmount + amountPaid;
            const newRemainingAmount = newTotalAmount - newPaidAmount;
            
            const payments = [...(customer.payments || [])];
            if (amountPaid > 0) {
              payments.push({
                amount: amountPaid,
                date: new Date().toISOString(),
                note: 'پێدانی بەشێک لە کاتی کڕینی نوێ'
              });
            }

            const purchases = [...(customer.purchases || [])];
            purchases.push({
              amount: total,
              date: new Date().toISOString(),
              note: 'کڕینی نوێ'
            });

            updateDoc(customerRef, {
              totalAmount: newTotalAmount,
              paidAmount: newPaidAmount,
              remainingAmount: newRemainingAmount,
              status: newRemainingAmount <= 0 ? 'paid' : 'unpaid',
              payments: payments,
              purchases: purchases
            }).catch((error: any) => {
              console.error("Error updating debt:", error);
              if (error.code === 'permission-denied') setShowFirebaseSetup(true);
            });
          }
        }
      }

      // Update inventory
      for (const item of cart) {
        const productId = item.originalId || item.id;
        const productRef = doc(db, 'products', productId);
        updateDoc(productRef, {
          stock: increment(-item.quantity)
        }).catch((error: any) => {
          console.error("Error updating inventory:", error);
          if (error.code === 'permission-denied') setShowFirebaseSetup(true);
        });
      }

      setCheckoutState(shouldPrint ? 'success-print' : 'success-no-print');

      if (shouldPrint) {
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
        alert("هەڵەیەک ڕوویدا لە کاتی فرۆشتن");
      }
      setCheckoutState('idle');
    }
  };

  const quickAmounts = [5000, 10000, 25000, 50000];

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-6 print:h-auto print:block">
      {/* Products Section */}
      <div className="flex-1 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
          <div className="p-4 border-b border-gray-100 flex flex-col gap-4">
            <div className="flex gap-4">
              <button
                onClick={() => {
                  if (cart.length > 0 && activeSection !== 'general') {
                    if (window.confirm('گۆڕینی بەش سەبەتەکەت بەتاڵ دەکاتەوە. دڵنیایت؟')) {
                      clearCart();
                      setActiveSection('general');
                    }
                  } else {
                    setActiveSection('general');
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
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
                    }
                  } else {
                    setActiveSection('shisha');
                  }
                }}
                className={`flex-1 py-3 rounded-xl font-bold transition-all ${
                  activeSection === 'shisha' 
                    ? 'bg-purple-600 text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                بەشی شیشە
              </button>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex justify-between items-center gap-4">
                <div className="flex-1 flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="گەڕان بەپێی ناو یان بارکۆد..."
                      className="w-full pl-4 pr-10 py-3 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
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
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                <button
                  onClick={() => setSelectedCategory('all')}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    selectedCategory === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  هەمووی
                </button>
                {categories.map((cat, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                      selectedCategory === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center items-center h-full">بارکردن...</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map(product => {
                const displayPrice = isWholesale ? (product.wholesalePrice || product.price) : product.price;
                return (
                <div
                  key={product.id}
                  onClick={() => handleProductClick(product)}
                  className={`relative flex flex-col items-center p-4 rounded-xl transition-colors border text-right group cursor-pointer ${isWholesale ? 'bg-purple-50/50 hover:bg-purple-50 border-transparent hover:border-purple-200' : 'bg-gray-50 hover:bg-indigo-50 border-transparent hover:border-indigo-100'}`}
                >
                  <div className={`w-24 h-24 rounded-lg mb-3 flex items-center justify-center ${isWholesale ? 'bg-purple-100 text-purple-400' : 'bg-gray-200 text-gray-400'}`}>
                    <Package size={32} />
                  </div>
                  <span className="font-medium text-sm line-clamp-2 mb-1 w-full">{product.name}</span>
                  <span className={`font-bold w-full ${isWholesale ? 'text-purple-600' : 'text-indigo-600'}`}>
                    {displayPrice.toLocaleString()} IQD
                    {product.isWeighed && <span className={`text-xs font-normal mr-1 ${isWholesale ? 'text-purple-400' : 'text-gray-400'}`}>/ کگم</span>}
                  </span>
                  {isWholesale && (
                    <div className="w-full flex flex-col text-[10px] mt-1 gap-0.5">
                      <span className="text-purple-700 font-bold bg-purple-100 rounded px-1.5 py-0.5">کۆ: {(product.wholesalePrice || 0).toLocaleString()} IQD</span>
                      <span className="text-rose-700 font-bold bg-rose-100 rounded px-1.5 py-0.5">تێچوو: {(product.wholesaleCost || product.costPrice * (product.packSize || 1) || 0).toLocaleString()} IQD</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-400 w-full mt-1">ستۆک: {Number(product.stock.toFixed(3))} {product.isWeighed ? 'کگم' : 'دانە'}</span>
                </div>
              )})}
            </div>
          )}
        </div>
      </div>

      {/* Cart Section */}
      <div className="w-96 bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col print:hidden">
        <div className="p-4 border-b border-gray-100 bg-indigo-50 rounded-t-2xl flex justify-between items-center">
          <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
            <ShoppingCart size={20} />
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

        <div className="flex-1 overflow-y-auto p-2 space-y-2">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-400">
              <ShoppingCart size={48} className="mb-4 opacity-20" />
              <p>سەبەتەکە بەتاڵە</p>
            </div>
          ) : (
            cart.map(item => {
              let itemTotal = 0;
              let packs = 0;
              let pieces = item.quantity;
              
              if (!item.isGift) {
                if (item.isWholesale) {
                  itemTotal = (item.wholesalePrice || item.price) * item.quantity;
                } else if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
                  packs = Math.floor(item.quantity / item.packSize);
                  pieces = item.quantity % item.packSize;
                  itemTotal = (packs * item.wholesalePrice) + (pieces * item.price);
                } else {
                  itemTotal = item.price * item.quantity;
                }
              }

              return (
              <div key={item.id} className={`flex items-center p-2 rounded-lg border shadow-sm gap-2 ${item.isGift ? 'bg-orange-50 border-orange-200' : 'bg-gray-50 border-gray-100'}`}>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-gray-800 text-xs truncate flex items-center gap-1">
                    {item.name}
                    {item.isGift && <span className="text-[10px] bg-orange-500 text-white px-1.5 py-0.5 rounded-full">هەدیە</span>}
                  </h4>
                  <div className="flex flex-col gap-0.5 mt-0.5">
                    <p className={`font-bold text-sm ${item.isGift ? 'text-orange-600 line-through opacity-50' : 'text-indigo-600'}`}>
                      {item.isGift ? '0' : Math.round(itemTotal).toLocaleString()} IQD
                    </p>
                    {item.isWholesale && !item.isGift && (
                      <span className="text-[9px] text-purple-600 bg-purple-100 px-1 py-0.5 rounded-full w-fit">
                        کۆ × {(item.wholesalePrice || item.price).toLocaleString()}
                      </span>
                    )}
                    {!item.isWholesale && packs > 0 && !item.isGift && (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[9px] text-purple-600 bg-purple-100 px-1 py-0.5 rounded-full w-fit">
                          {packs} پاکەت (کۆ) × {item.wholesalePrice.toLocaleString()}
                        </span>
                        {pieces > 0 && (
                          <span className="text-[9px] text-indigo-600 bg-indigo-100 px-1 py-0.5 rounded-full w-fit">
                            {pieces} دانە (تاک) × {item.price.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {item.isWeighed && !item.isGift && (
                      <span className="text-[9px] text-gray-500 bg-gray-200 px-1 py-0.5 rounded-full flex items-center gap-1 w-fit">
                        <Scale size={8} />
                        {item.price.toLocaleString()}/kg
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <div className="flex gap-1 self-end">
                    <button onClick={() => toggleGift(item.id)} className={`p-1 rounded-lg transition-colors ${item.isGift ? 'text-orange-600 bg-orange-100' : 'text-gray-400 hover:bg-orange-50 hover:text-orange-500'}`} title="هەدیە">
                      <Gift size={12} />
                    </button>
                    <button onClick={() => removeFromCart(item.id)} className="p-1 text-red-500 hover:bg-red-100 rounded-lg transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="flex items-center bg-white rounded-lg border border-gray-200 p-0.5">
                    <button onClick={() => updateQuantity(item.id, item.quantity - (item.isWeighed ? 0.25 : 1))} className="p-0.5 hover:bg-gray-100 rounded-md text-gray-600 transition-colors">
                      <Minus size={12} />
                    </button>
                    <div className="flex flex-col items-center justify-center w-10 px-0.5">
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
                        className="w-full text-center font-bold text-gray-900 bg-transparent border-none focus:ring-0 p-0 text-xs"
                        dir="ltr"
                      />
                      {item.isWeighed && <span className="text-[8px] text-gray-500 -mt-1 font-medium">کگم</span>}
                    </div>
                    <button onClick={() => updateQuantity(item.id, item.quantity + (item.isWeighed ? 0.25 : 1))} className="p-0.5 hover:bg-gray-100 rounded-md text-gray-600 transition-colors">
                      <Plus size={12} />
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
          <div className="flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-200">
            <span>کۆی کۆتایی:</span>
            <span className="text-indigo-600">{total.toLocaleString()} IQD</span>
          </div>

          <div className="pt-4">
            <button
              onClick={() => setIsCheckoutModalOpen(true)}
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
                </div>
              </div>
              
              {/* Payment Method Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700">شێوازی پارەدان</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setPaymentMethod('cash')}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${
                      paymentMethod === 'cash' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <Coins size={32} className={`mb-2 ${paymentMethod === 'cash' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="font-bold text-lg">نەقد</span>
                    {paymentMethod === 'cash' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle size={20} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => setPaymentMethod('debt')}
                    className={`relative overflow-hidden flex flex-col items-center justify-center p-4 rounded-2xl border-2 transition-all duration-200 ${
                      paymentMethod === 'debt' 
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md scale-[1.02]' 
                        : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard size={32} className={`mb-2 ${paymentMethod === 'debt' ? 'text-indigo-600' : 'text-gray-400'}`} />
                    <span className="font-bold text-lg">قەرز</span>
                    {paymentMethod === 'debt' && (
                      <div className="absolute top-3 right-3 text-indigo-600">
                        <CheckCircle size={20} />
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
                </div>
                
                {/* Numeric Keypad */}
                <div className="grid grid-cols-3 gap-2" dir="ltr">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <button
                      key={num}
                      onClick={() => setAmountPaid(Number(`${amountPaid}${num}`))}
                      className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmountPaid(0)}
                    className="py-3 bg-red-50 border border-red-100 hover:bg-red-100 text-red-600 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                  >
                    C
                  </button>
                  <button
                    onClick={() => setAmountPaid(Number(`${amountPaid}0`))}
                    className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                  >
                    0
                  </button>
                  <button
                    onClick={() => setAmountPaid(Number(`${amountPaid}000`))}
                    className="py-3 bg-white border border-gray-200 hover:bg-gray-50 hover:border-indigo-300 text-gray-900 rounded-xl font-bold text-xl transition-all shadow-sm active:scale-95"
                  >
                    000
                  </button>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-4">
                  {quickAmounts.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setAmountPaid(amountPaid + amount)}
                      className="py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl font-bold text-sm transition-colors border border-indigo-100"
                    >
                      +{amount.toLocaleString()}
                    </button>
                  ))}
                  <button
                    onClick={() => setAmountPaid(total)}
                    className="py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold text-sm transition-colors border border-emerald-100 col-span-4 mt-1"
                  >
                    پارەی تەواو ({total.toLocaleString()})
                  </button>
                </div>

                {/* Change / Remaining Debt Calculation */}
                {amountPaid > total && paymentMethod === 'cash' && (
                  <div className="flex justify-between items-center text-lg font-bold text-emerald-700 bg-emerald-50 p-4 rounded-xl border border-emerald-100 mt-4">
                    <span className="flex items-center gap-2"><Coins size={20} /> پارەی گەڕاوە (باقی):</span>
                    <span>{(amountPaid - total).toLocaleString()} IQD</span>
                  </div>
                )}
                {paymentMethod === 'debt' && (
                  <div className={`flex justify-between items-center text-lg font-bold p-4 rounded-xl border mt-4 ${
                    amountPaid >= total 
                      ? 'text-emerald-700 bg-emerald-50 border-emerald-100' 
                      : 'text-rose-700 bg-rose-50 border-rose-100'
                  }`}>
                    <span className="flex items-center gap-2"><Calculator size={20} /> قەرزی ماوە:</span>
                    <span>{Math.max(0, total - amountPaid).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
              </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-6 border-t border-gray-100 bg-white shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)] z-10 flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleCheckout(false)}
                  disabled={checkoutState !== 'idle'}
                  className="py-4 px-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-emerald-600/20"
                >
                  <CheckCircle size={24} />
                  <span>{checkoutState !== 'idle' ? 'چاوەڕێبە...' : 'تەواوکردن'}</span>
                </button>

                <button
                  onClick={() => handleCheckout(true)}
                  disabled={checkoutState !== 'idle'}
                  className="py-4 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-[0.98] flex flex-col items-center justify-center gap-1 disabled:opacity-50 disabled:active:scale-100 shadow-sm shadow-indigo-600/20"
                >
                  <Printer size={24} />
                  <span>{checkoutState !== 'idle' ? 'چاوەڕێبە...' : 'چاپکردن و تەواو'}</span>
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
          <p className="text-sm text-gray-600 mb-4">{new Date().toLocaleString('ku-IQ')}</p>
          
          {paymentMethod === 'debt' && (
            <div className="border border-gray-300 rounded-lg p-2 mb-4 text-sm text-right">
              <p className="font-bold mb-1">کڕیار: {isNewCustomer ? newCustomerName : customers.find(c => c.id === selectedCustomerId)?.customerName}</p>
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
                  let itemTotal = item.price * item.quantity;
                  if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
                    const packs = Math.floor(item.quantity / item.packSize);
                    const pieces = item.quantity % item.packSize;
                    itemTotal = (packs * item.wholesalePrice) + (pieces * item.price);
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
    </div>
  );
}
