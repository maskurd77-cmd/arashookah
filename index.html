import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, doc, query, orderBy, serverTimestamp, increment } from 'firebase/firestore';
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
    const qSales = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
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
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">گۆڕینەوەی کاڵا</h1>
        <div className="flex gap-2 bg-gray-100 p-1 rounded-xl">
          <button
            onClick={() => {
              setExchangeMode('internal');
              setNewItems([]);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${exchangeMode === 'internal' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            گۆڕینەوەی پسوولە
          </button>
          <button
            onClick={() => {
              setExchangeMode('external');
              setNewItems([]);
              setSelectedSale(null);
            }}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${exchangeMode === 'external' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
          >
            گۆڕینەوەی دەرەکی
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Search and Sales List OR External Items Form */}
        {exchangeMode === 'internal' ? (
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی ژمارەی وەسڵ..."
                  className="w-full pl-4 pr-10 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
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
                      className={`w-full text-right p-4 rounded-xl border transition-all ${
                        selectedSale?.id === sale.id 
                          ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                          : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-bold text-gray-900">#{sale.receiptNumber}</span>
                        <span className="text-sm text-gray-500">
                          {sale.createdAt ? format(sale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-gray-600">{sale.customerName || 'کڕیاری گشتی'}</span>
                        <span className="font-bold text-indigo-600">{sale.total.toLocaleString()} IQD</span>
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
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">ناوی کاڵا</label>
                  <input
                    type="text"
                    value={externalItemForm.name}
                    onChange={e => setExternalItemForm({...externalItemForm, name: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    placeholder="نموونە: نێرگلەی بەکارهاتوو"
                  />
                </div>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">دانە</label>
                    <input
                      type="number"
                      min="1"
                      value={externalItemForm.quantity === 0 ? '' : externalItemForm.quantity}
                      onChange={e => setExternalItemForm({...externalItemForm, quantity: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm text-gray-600 mb-1">نرخی خەمڵێنراو (دانە)</label>
                    <input
                      type="number"
                      min="0"
                      value={externalItemForm.price === 0 ? '' : externalItemForm.price}
                      onChange={e => setExternalItemForm({...externalItemForm, price: Number(e.target.value)})}
                      className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <button
                  onClick={() => {
                    if (!externalItemForm.name) return;
                    setExternalItems([...externalItems, { ...externalItemForm, id: Date.now().toString() }]);
                    setExternalItemForm({ name: '', quantity: 1, price: 0 });
                  }}
                  className="w-full py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  زیادکردن
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[calc(100vh-420px)]">
              <div className="p-4 border-b border-gray-100 bg-gray-50">
                <h2 className="font-bold text-gray-700">لیستی کاڵا هێنراوەکان</h2>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {externalItems.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">هیچ کاڵایەک زیاد نەکراوە</p>
                ) : (
                  externalItems.map(item => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div>
                        <p className="font-bold text-sm text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{item.quantity} دانە × {item.price.toLocaleString()} IQD</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-indigo-600">{(item.quantity * item.price).toLocaleString()}</span>
                        <button onClick={() => setExternalItems(externalItems.filter(i => i.id !== item.id))} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg">
                          <Trash2 size={16} />
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
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 h-[calc(100vh-140px)] flex flex-col items-center justify-center text-gray-400">
              <RotateCcw size={64} className="mb-4 opacity-20" />
              <p className="text-xl font-medium">وەسڵێک هەڵبژێرە بۆ گۆڕینەوە</p>
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
                      <RotateCcw className="text-red-500" size={20} />
                      کاڵا گەڕاوەکان
                    </h3>
                    <table className="w-full text-right">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">کاڵا</th>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">نرخ</th>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">بڕی گەڕانەوە</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {returnItems.map((item, index) => (
                          <tr key={index} className={item.maxReturn === 0 ? 'bg-gray-50 opacity-60' : ''}>
                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-gray-600">{(item.isWholesale ? item.wholesalePrice : item.price).toLocaleString()} IQD</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="0"
                                max={item.maxReturn}
                                value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                onChange={(e) => handleReturnQuantityChange(index, Number(e.target.value))}
                                disabled={item.maxReturn === 0}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                                placeholder="0"
                              />
                              <span className="text-xs text-gray-500 mr-2">لە {item.maxReturn}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* New Items Section */}
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Package className="text-green-500" size={20} />
                    کاڵا نوێیەکان
                  </h3>
                  
                  <div className="relative mb-4">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                      type="text"
                      placeholder="گەڕان بۆ کاڵای نوێ..."
                      className="w-full pl-4 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500"
                      value={productSearchTerm}
                      onChange={(e) => setProductSearchTerm(e.target.value)}
                    />
                    {productSearchTerm && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                        {filteredProducts.map(product => (
                          <button
                            key={product.id}
                            onClick={() => handleAddNewItem(product)}
                            className="w-full text-right px-4 py-2 hover:bg-gray-50 border-b border-gray-100 flex justify-between items-center"
                          >
                            <span>{product.name}</span>
                            <span className="text-indigo-600 font-bold">{product.price.toLocaleString()} IQD</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {newItems.length > 0 && (
                    <table className="w-full text-right">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">کاڵا</th>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">نرخ</th>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500">دانە</th>
                          <th className="px-4 py-2 text-sm font-medium text-gray-500"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {newItems.map((item) => (
                          <tr key={item.id}>
                            <td className="px-4 py-3 font-medium text-gray-900">{item.name}</td>
                            <td className="px-4 py-3 text-gray-600">{item.price.toLocaleString()} IQD</td>
                            <td className="px-4 py-3">
                              <input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => handleNewItemQuantityChange(item.id, Number(e.target.value))}
                                className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="px-4 py-3 text-left">
                              <button onClick={() => handleRemoveNewItem(item.id)} className="text-red-500 hover:text-red-700">
                                <Trash2 size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-gray-100 bg-gray-50">
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex justify-between items-center text-red-600">
                    <span>کۆی پارەی گەڕاوە:</span>
                    <span className="font-bold">- {calculateReturnTotal().toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between items-center text-green-600">
                    <span>کۆی پارەی نوێ:</span>
                    <span className="font-bold">+ {calculateNewItemsTotal().toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between items-center text-lg pt-3 border-t border-gray-200">
                    <span className="font-bold text-gray-700">ئەنجام:</span>
                    <span className={`text-2xl font-bold ${calculateNewItemsTotal() - calculateReturnTotal() > 0 ? 'text-indigo-600' : 'text-orange-600'}`}>
                      {(calculateNewItemsTotal() - calculateReturnTotal()).toLocaleString()} IQD
                      <span className="text-sm font-normal text-gray-500 ml-2">
                        {calculateNewItemsTotal() - calculateReturnTotal() > 0 ? '(پێویستە بدرێت)' : '(دەگەڕێندرێتەوە)'}
                      </span>
                    </span>
                  </div>
                </div>
                
                <button
                  onClick={handleProcessExchange}
                  disabled={isProcessing || (calculateReturnTotal() === 0 && calculateNewItemsTotal() === 0)}
                  className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
