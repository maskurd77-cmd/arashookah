import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, increment, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Search, RotateCcw, Package, DollarSign, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';

export default function Exchanges() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [newItems, setNewItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [exchangeMode, setExchangeMode] = useState<'internal' | 'external'>('internal');
  const [externalItems, setExternalItems] = useState<any[]>([]);
  const [externalItemForm, setExternalItemForm] = useState({ name: '', quantity: 1, price: 0 });

  useEffect(() => {
    setLoading(true);
    const qSales = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
    const unsubSales = onSnapshot(qSales, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error: any) => {
      if (error.code === 'permission-denied') setShowFirebaseSetup(true);
      setLoading(false);
    });

    const qProducts = query(collection(db, 'products'));
    const unsubProducts = onSnapshot(qProducts, (snapshot) => {
      setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubSales();
      unsubProducts();
    };
  }, [setShowFirebaseSetup]);

  const filteredSales = sales.filter(sale => 
    sale.receiptNumber?.toString().includes(searchTerm) ||
    sale.customerName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(product => 
    product.name.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
    product.barcode?.includes(productSearchTerm)
  ).slice(0, 10);

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    setReturnItems(sale.items.map((item: any) => ({
      ...item,
      returnQuantity: 0,
      maxReturn: item.quantity - (item.returnedQuantity || 0)
    })));
  };

  const handleReturnQuantityChange = (index: number, quantity: number) => {
    const newReturnItems = [...returnItems];
    const item = newReturnItems[index];
    newReturnItems[index].returnQuantity = Math.max(0, Math.min(quantity, item.maxReturn));
    setReturnItems(newReturnItems);
  };

  const calculateReturnTotal = () => {
    if (exchangeMode === 'external') {
      return externalItems.reduce((total, item) => total + (item.price * item.quantity), 0);
    }
    return returnItems.reduce((total, item) => {
      if (item.isGift) return total;
      let pricePerUnit = item.price;
      if (item.isWholesale) {
        pricePerUnit = item.wholesalePrice || item.price;
      }
      return total + (pricePerUnit * item.returnQuantity);
    }, 0);
  };

  const handleAddNewItem = (product: any) => {
    const existing = newItems.find(item => item.id === product.id);
    if (existing) {
      setNewItems(newItems.map(item => 
        item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
      ));
    } else {
      setNewItems([...newItems, { ...product, quantity: 1, isWholesale: false }]);
    }
    setProductSearchTerm('');
  };

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
            // handleAddNewItem needs access to latest newItems, so it's safer to use a functional state update 
            // but we can just call it and it will work if we include newItems in dependency array
            handleAddNewItem(product);
          }
          barcode = '';
        }
      } else if (e.key.length === 1) {
        barcode += e.key;
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const shortcutProduct = products.find(p => p.shortcutKey && p.shortcutKey.toLowerCase() === barcode.toLowerCase());
          if (shortcutProduct && barcode.length <= 5) {
            handleAddNewItem(shortcutProduct);
            barcode = '';
          } else {
            barcode = '';
          }
        }, 500);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products, newItems]);

  const handleRemoveNewItem = (id: string) => {
    setNewItems(newItems.filter(item => item.id !== id));
  };

  const handleNewItemQuantityChange = (id: string, quantity: number) => {
    if (quantity <= 0) {
      handleRemoveNewItem(id);
      return;
    }
    setNewItems(newItems.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const calculateNewItemsTotal = () => {
    return newItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleProcessExchange = async () => {
    if (exchangeMode === 'external') {
      if (externalItems.length === 0 && newItems.length === 0) {
        alert('تکایە کاڵا دیاری بکە بۆ گۆڕینەوە');
        return;
      }

      setIsProcessing(true);
      try {
        const returnTotal = calculateReturnTotal();
        const newTotal = calculateNewItemsTotal();
        const difference = newTotal - returnTotal;

        // 1. Create exchange record
        await addDoc(collection(db, 'exchanges'), {
          isExternal: true,
          returnedItems: externalItems.map(item => ({
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          newItems: newItems.map(item => ({
            id: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price
          })),
          returnTotal,
          newTotal,
          difference,
          createdAt: serverTimestamp(),
        });

        // 2. Create a new sale for new items and update inventory
        if (newItems.length > 0) {
          const newReceiptNumber = Math.floor(100000 + Math.random() * 900000);
          await addDoc(collection(db, 'sales'), {
            receiptNumber: newReceiptNumber,
            items: newItems.map(item => ({
              id: item.id,
              originalId: item.id,
              name: item.name,
              quantity: item.quantity,
              price: item.price,
              costPrice: item.costPrice || 0,
              wholesaleCost: item.wholesaleCost || 0,
              wholesalePrice: item.wholesalePrice || 0,
              packSize: item.packSize || 1,
              isWholesale: item.isWholesale || false,
              isWeighed: item.isWeighed || false,
              isGift: false
            })),
            subtotal: newTotal,
            discount: 0,
            total: newTotal,
            amountPaid: difference > 0 ? difference : 0,
            paymentMethod: 'cash',
            customerName: 'کڕیاری گۆڕینەوەی دەرەکی',
            section: 'general',
            createdAt: serverTimestamp(),
            isExchange: true,
            isExternalExchange: true
          });

          for (const item of newItems) {
            const productRef = doc(db, 'products', item.id);
            let stockToDeduct = item.quantity;
            if (item.isWholesale && item.packSize > 1) {
              stockToDeduct = item.quantity * item.packSize;
            }
            await updateDoc(productRef, { stock: increment(-stockToDeduct) }).catch(e => console.error(e));
          }
        }

        alert('گۆڕینەوەی دەرەکی بە سەرکەوتوویی ئەنجامدرا');
        setExternalItems([]);
        setNewItems([]);
      } catch (error: any) {
        console.error("Error processing external exchange:", error);
        if (error.code === 'permission-denied') {
          setShowFirebaseSetup(true);
        } else {
          alert('هەڵەیەک ڕوویدا لە کاتی گۆڕینەوە');
        }
      } finally {
        setIsProcessing(false);
      }
      return;
    }

    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    if (itemsToReturn.length === 0 && newItems.length === 0) {
      alert('تکایە کاڵا دیاری بکە بۆ گۆڕینەوە');
      return;
    }

    setIsProcessing(true);
    try {
      const returnTotal = calculateReturnTotal();
      const newTotal = calculateNewItemsTotal();
      const difference = newTotal - returnTotal;

      // 1. Create exchange record
      await addDoc(collection(db, 'exchanges'), {
        saleId: selectedSale.id,
        receiptNumber: selectedSale.receiptNumber,
        returnedItems: itemsToReturn.map(item => ({
          id: item.id,
          originalId: item.originalId || item.id,
          name: item.name,
          quantity: item.returnQuantity,
          price: item.price
        })),
        newItems: newItems.map(item => ({
          id: item.id,
          name: item.name,
          quantity: item.quantity,
          price: item.price
        })),
        returnTotal,
        newTotal,
        difference,
        createdAt: serverTimestamp(),
      });

      // 2. Update original sale with returned quantities
      if (itemsToReturn.length > 0) {
        const updatedItems = selectedSale.items.map((saleItem: any) => {
          const returnedItem = itemsToReturn.find(i => i.id === saleItem.id);
          if (returnedItem) {
            return {
              ...saleItem,
              returnedQuantity: (saleItem.returnedQuantity || 0) + returnedItem.returnQuantity
            };
          }
          return saleItem;
        });

        const newSubtotal = Math.max(0, selectedSale.subtotal - returnTotal);
        const newSaleTotal = Math.max(0, selectedSale.total - returnTotal);
        
        let newAmountPaid = selectedSale.amountPaid || 0;
        if (selectedSale.paymentMethod === 'cash') {
          newAmountPaid = newSaleTotal;
        } else if (selectedSale.paymentMethod === 'debt') {
          const remainingDebt = selectedSale.total - (selectedSale.amountPaid || 0);
          if (returnTotal > remainingDebt) {
            newAmountPaid = Math.max(0, (selectedSale.amountPaid || 0) - (returnTotal - remainingDebt));
          }
        }

        await updateDoc(doc(db, 'sales', selectedSale.id), {
          items: updatedItems,
          total: newSaleTotal,
          subtotal: newSubtotal,
          amountPaid: newAmountPaid,
          hasReturns: true
        });

        // Update inventory for returned items
        for (const item of itemsToReturn) {
          const productId = item.originalId || item.id;
          const productRef = doc(db, 'products', productId);
          let stockToReturn = item.returnQuantity;
          if (item.isWholesale && item.packSize > 1) {
            stockToReturn = item.returnQuantity * item.packSize;
          }
          await updateDoc(productRef, { stock: increment(stockToReturn) }).catch(e => console.error(e));
        }
      }

      // 3. Create a new sale for new items and update inventory
      if (newItems.length > 0) {
        const newReceiptNumber = Math.floor(100000 + Math.random() * 900000);
        await addDoc(collection(db, 'sales'), {
          receiptNumber: newReceiptNumber,
          items: newItems.map(item => ({
            id: item.id,
            originalId: item.id,
            name: item.name,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice || 0,
            wholesaleCost: item.wholesaleCost || 0,
            wholesalePrice: item.wholesalePrice || 0,
            packSize: item.packSize || 1,
            isWholesale: item.isWholesale || false,
            isWeighed: item.isWeighed || false,
            isGift: false
          })),
          subtotal: newTotal,
          discount: 0,
          total: newTotal,
          amountPaid: newTotal, // Assuming cash exchange for now
          paymentMethod: 'cash',
          customerName: selectedSale.customerName || 'کڕیاری گۆڕینەوە',
          section: selectedSale.section || 'general',
          createdAt: serverTimestamp(),
          isExchange: true,
          exchangeRef: selectedSale.receiptNumber
        });

        for (const item of newItems) {
          const productRef = doc(db, 'products', item.id);
          let stockToDeduct = item.quantity;
          if (item.isWholesale && item.packSize > 1) {
            stockToDeduct = item.quantity * item.packSize;
          }
          await updateDoc(productRef, { stock: increment(-stockToDeduct) }).catch(e => console.error(e));
        }
      }

      alert('گۆڕینەوە بە سەرکەوتوویی ئەنجامدرا');
      setSelectedSale(null);
      setReturnItems([]);
      setNewItems([]);
    } catch (error: any) {
      console.error("Error processing exchange:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('هەڵەیەک ڕوویدا لە کاتی گۆڕینەوە');
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2">
          <RotateCcw className="text-indigo-500" size={28} />
          گۆڕینەوەی کاڵا
        </h1>
        <div className="flex gap-2 bg-gray-100 p-1.5 rounded-xl">
          <button
            onClick={() => {
              setExchangeMode('internal');
              setNewItems([]);
            }}
            className={`px-5 py-2.5 rounded-lg font-bold transition-all ${exchangeMode === 'internal' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
          >
            گۆڕینەوەی ناوخۆیی (بە پسوولە)
          </button>
          <button
            onClick={() => {
              setExchangeMode('external');
              setNewItems([]);
              setSelectedSale(null);
            }}
            className={`px-5 py-2.5 rounded-lg font-bold transition-all ${exchangeMode === 'external' ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-black/5' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/50'}`}
          >
            گۆڕینەوەی دەرەکی
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search and Sales List OR External Items Form */}
        {exchangeMode === 'internal' ? (
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 sticky top-0 z-10">
              <div className="relative">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-indigo-400" size={20} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی ژمارەی وەسڵ یان ناوی کڕیار..."
                  className="w-full pl-4 pr-12 py-3 bg-gray-50 border-0 ring-1 ring-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-gray-700"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-220px)]">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-gray-700">وەسڵەکان</h2>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {loading ? (
                  <p className="text-center text-gray-500 py-4">بارکردن...</p>
                ) : filteredSales.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">هیچ وەسڵێک نەدۆزرایەوە</p>
                ) : (
                  filteredSales.map(sale => (
                    <button
                      key={sale.id}
                      onClick={() => handleSelectSale(sale)}
                      className={`w-full text-right p-4 rounded-xl border transition-all duration-200 group flex flex-col gap-2 ${
                        selectedSale?.id === sale.id 
                          ? 'bg-indigo-600 border-indigo-600 shadow-md text-white scale-[1.02]' 
                          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200 hover:shadow-sm'
                      }`}
                    >
                      <div className="flex justify-between items-center w-full">
                        <span className={`font-black text-lg ${selectedSale?.id === sale.id ? 'text-white' : 'text-gray-900 group-hover:text-indigo-600 transition-colors'}`}>
                          #{sale.receiptNumber}
                        </span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${selectedSale?.id === sale.id ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-500'}`}>
                          {sale.createdAt ? format(sale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center w-full">
                        <span className={`text-sm flex items-center gap-1.5 ${selectedSale?.id === sale.id ? 'text-indigo-100' : 'text-gray-600'}`}>
                           <Package size={14} />
                           {sale.items?.length || 0} جۆر
                        </span>
                        <span className={`font-bold ${selectedSale?.id === sale.id ? 'text-white' : 'text-emerald-600'}`}>
                          {sale.total.toLocaleString()} IQD
                        </span>
                      </div>
                      <div className={`text-sm mt-1 pt-2 border-t ${selectedSale?.id === sale.id ? 'border-indigo-500/50 text-indigo-50' : 'border-gray-50 text-gray-500'}`}>
                        {sale.customerName || 'کڕیاری گشتی'}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <h2 className="font-bold text-gray-700 mb-4">کاڵا هێنراوەکان (دەرەکی)</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">ناوی کاڵا</label>
                  <input
                    type="text"
                    value={externalItemForm.name}
                    onChange={e => setExternalItemForm({...externalItemForm, name: e.target.value})}
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-medium"
                    placeholder="نموونە: نێرگلەی بەکارهاتوو"
                  />
                </div>
                <div className="flex gap-4">
                  <div className="flex-1">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">دانە</label>
                    <input
                      type="number"
                      min="1"
                      value={externalItemForm.quantity === 0 ? '' : externalItemForm.quantity}
                      onChange={e => setExternalItemForm({...externalItemForm, quantity: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-center"
                    />
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">نرخی خەمڵێنراو (دانە)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        value={externalItemForm.price === 0 ? '' : externalItemForm.price}
                        onChange={e => setExternalItemForm({...externalItemForm, price: Number(e.target.value)})}
                        className="w-full pl-12 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all font-bold text-left direction-ltr"
                      />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">IQD</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!externalItemForm.name) return;
                    setExternalItems([...externalItems, { ...externalItemForm, id: Date.now().toString() }]);
                    setExternalItemForm({ name: '', quantity: 1, price: 0 });
                  }}
                  disabled={!externalItemForm.name || externalItemForm.price <= 0}
                  className="w-full py-3 mt-2 bg-emerald-50 text-emerald-600 rounded-xl font-bold hover:bg-emerald-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus size={20} />
                  زیادکردنی کاڵا
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-420px)]">
              <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                <h2 className="font-bold text-gray-700 flex items-center gap-2">
                  <Package size={18} className="text-gray-400" />
                  لیستی کاڵا هێنراوەکان
                </h2>
                <span className="bg-gray-200 text-gray-700 text-xs font-bold px-2 py-1 rounded-lg">
                  {externalItems.length}
                </span>
              </div>
              <div className="overflow-y-auto flex-1 p-3 space-y-2">
                {externalItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400 opacity-60">
                    <Package size={48} className="mb-3" />
                    <p className="font-medium">هیچ کاڵایەک زیاد نەکراوە</p>
                  </div>
                ) : (
                  externalItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3.5 bg-white border border-gray-100 rounded-xl hover:border-gray-300 transition-colors shadow-sm group">
                      <div className="flex flex-col gap-1">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <div className="flex items-center gap-2">
                          <span className="bg-indigo-50 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-md">
                            {item.quantity} دانە
                          </span>
                          <span className="text-xs font-medium text-gray-500">
                            × {item.price.toLocaleString()} IQD
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-emerald-600">{(item.quantity * item.price).toLocaleString()} <span className="text-xs text-emerald-600/70">IQD</span></span>
                        <button onClick={() => setExternalItems(externalItems.filter(i => i.id !== item.id))} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Right Column: Exchange Details */}
        <div className="lg:col-span-2">
          {exchangeMode === 'internal' && !selectedSale ? (
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-gray-400 p-8 text-center">
              <div className="bg-gray-50 p-6 rounded-full mb-6 ring-8 ring-gray-50/50">
                <RotateCcw size={64} className="text-gray-300" />
              </div>
              <h3 className="text-2xl font-black text-gray-700 mb-2">وەسڵێک هەڵبژێرە</h3>
              <p className="text-gray-500 max-w-md">بۆ بینینی کاڵاکان و دەستپێکردنی گۆڕینەوە، تکایە یەکێک لە وەسڵەکانی لیستی لای ڕاست هەڵبژێرە یان بەدوایدا بگەڕێ.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col h-[calc(100vh-140px)]">
              <div className="p-6 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                    {exchangeMode === 'internal' ? `وردەکاری وەسڵ #${selectedSale?.receiptNumber}` : 'وردەکاری گۆڕینەوەی دەرەکی'}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {exchangeMode === 'internal' ? (selectedSale?.customerName || 'کڕیاری گشتی') : 'کڕیاری گۆڕینەوەی دەرەکی'}
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Returned Items Section */}
                {exchangeMode === 'internal' && (
                  <div>
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <RotateCcw className="text-rose-500" size={20} />
                      کاڵا گەڕاوەکان
                    </h3>
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">کاڵا</th>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">نرخ</th>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">بڕی گەڕانەوە</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {returnItems.map((item, index) => (
                            <tr key={index} className={`transition-colors ${item.maxReturn === 0 ? 'bg-gray-50/50 opacity-60' : 'hover:bg-gray-50/50'}`}>
                              <td className="px-5 py-3 font-bold text-gray-800">{item.name}</td>
                              <td className="px-5 py-3 text-gray-600 font-medium">{(item.isWholesale ? item.wholesalePrice : item.price).toLocaleString()} IQD</td>
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min="0"
                                    max={item.maxReturn}
                                    value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                    onChange={(e) => handleReturnQuantityChange(index, Number(e.target.value))}
                                    disabled={item.maxReturn === 0}
                                    className="w-24 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 font-bold text-center transition-all disabled:opacity-50"
                                    placeholder="0"
                                  />
                                  <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-1 rounded-md">لە {item.maxReturn}</span>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* New Items Section */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Package className="text-green-500" size={20} />
                    کاڵا نوێیەکان
                  </h3>
                  
                  <div className="relative mb-6">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                    <input
                      type="text"
                      placeholder="گەڕان بۆ کاڵای نوێ (ناوی کاڵا یان بارکۆد)..."
                      className="w-full pl-4 pr-12 py-3.5 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition-all font-medium text-gray-700 shadow-sm"
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                    />
                    {productSearchTerm && (
                      <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-xl max-h-72 overflow-y-auto">
                        {filteredProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => handleAddNewItem(product)}
                            className="w-full text-right px-5 py-3 hover:bg-emerald-50 border-b border-gray-100 flex justify-between items-center transition-colors group"
                          >
                            <span className="font-bold text-gray-700 group-hover:text-emerald-700">{product.name}</span>
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded-lg group-hover:bg-emerald-100 transition-colors">
                              {product.price.toLocaleString()} IQD
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {newItems.length > 0 && (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">کاڵا</th>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">نرخ</th>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600">دانە</th>
                            <th className="px-5 py-3 text-sm font-bold text-gray-600 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {newItems.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                              <td className="px-5 py-3 font-bold text-gray-800">{item.name}</td>
                              <td className="px-5 py-3 text-gray-600 font-medium">{item.price.toLocaleString()} IQD</td>
                              <td className="px-5 py-3">
                                <input
                                  type="number"
                                  min="1"
                                  value={item.quantity}
                                  onChange={(e) => handleNewItemQuantityChange(item.id, Number(e.target.value))}
                                  className="w-24 px-3 py-1.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-bold text-center transition-all"
                                />
                              </td>
                              <td className="px-5 py-3 text-left">
                                <button onClick={() => handleRemoveNewItem(item.id)} className="text-red-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors">
                                  <Trash2 size={18} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50/80 rounded-b-2xl">
                <div className="flex flex-col gap-4 mb-8">
                  <div className="flex justify-between items-center text-rose-600 bg-rose-50/50 p-3 rounded-xl border border-rose-100/50">
                    <span className="font-bold">کۆی پارەی گەڕاوە:</span>
                    <span className="font-black text-lg">- {calculateReturnTotal().toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between items-center text-emerald-600 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100/50">
                    <span className="font-bold">کۆی پارەی نوێ:</span>
                    <span className="font-black text-lg">+ {calculateNewItemsTotal().toLocaleString()} IQD</span>
                  </div>
                  <div className={`flex justify-between items-center text-lg p-5 rounded-2xl border-2 shadow-sm mt-2 ${calculateNewItemsTotal() - calculateReturnTotal() > 0 ? 'bg-indigo-50 border-indigo-200 text-indigo-900' : calculateNewItemsTotal() - calculateReturnTotal() < 0 ? 'bg-orange-50 border-orange-200 text-orange-900' : 'bg-gray-50 border-gray-200 text-gray-900'}`}>
                    <span className="font-black text-xl">ئەنجام:</span>
                    <div className="flex flex-col items-end">
                      <span className={`text-3xl font-black tracking-tight ${calculateNewItemsTotal() - calculateReturnTotal() > 0 ? 'text-indigo-600' : calculateNewItemsTotal() - calculateReturnTotal() < 0 ? 'text-orange-600' : 'text-gray-700'}`}>
                        {Math.abs(calculateNewItemsTotal() - calculateReturnTotal()).toLocaleString()} IQD
                      </span>
                      <span className={`text-sm font-bold mt-1 px-2 py-0.5 rounded-md ${calculateNewItemsTotal() - calculateReturnTotal() > 0 ? 'bg-indigo-100 text-indigo-700' : calculateNewItemsTotal() - calculateReturnTotal() < 0 ? 'bg-orange-100 text-orange-700' : 'bg-gray-200 text-gray-600'}`}>
                        {calculateNewItemsTotal() - calculateReturnTotal() > 0 ? 'پێویستە بدرێت لەلایەن کڕیار' : calculateNewItemsTotal() - calculateReturnTotal() < 0 ? 'دەگەڕێندرێتەوە بۆ کڕیار' : 'هیچ بڕەیەک نییە'}
                      </span>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleProcessExchange}
                  disabled={isProcessing || (calculateReturnTotal() === 0 && calculateNewItemsTotal() === 0)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-black text-lg hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transform active:scale-[0.98]"
                >
                  {isProcessing ? 'پرۆسێس دەکرێت...' : 'ئەنجامدانی گۆڕینەوە'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
