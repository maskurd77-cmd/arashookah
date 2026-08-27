import React, { useState, useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { 
  collection, onSnapshot, addDoc, updateDoc, doc, getDoc, 
  query, orderBy, serverTimestamp, increment, limit, where, getDocs 
} from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Search, RotateCcw, AlertTriangle, FileText, Package, DollarSign, 
  ScanLine, Camera, CheckCircle, X, Plus, Minus, Printer, ArrowRight,
  History, Sparkles, Volume2, VolumeX, ShieldAlert, ShoppingBag
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { useReactToPrint } from 'react-to-print';
import { ReturnReceipt } from '../components/receipts/ReturnReceipt';
import { Html5QrcodeScanner } from 'html5-qrcode';

// Audio feedback synthesizers using Web Audio API
const playScanSuccessSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1800, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.09);
  } catch (e) {
    console.debug("Audio play error", e);
  }
};

const playScanErrorSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(320, audioCtx.currentTime);
    osc.frequency.setValueAtTime(220, audioCtx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.24);
  } catch (e) {
    console.debug("Audio play error", e);
  }
};

export default function Returns() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [returnsHistory, setReturnsHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [selectedSale, setSelectedSale] = useState<any>(null);
  const [returnItems, setReturnItems] = useState<any[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSearchingBarcode, setIsSearchingBarcode] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('general');
  const [viewMode, setViewMode] = useState<'return' | 'history'>('return');
  
  // Feedback banners
  const [scanNotification, setScanNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // Camera scanner modal
  const [isCameraScannerOpen, setIsCameraScannerOpen] = useState(false);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Printable return receipt state
  const [lastReturnData, setLastReturnData] = useState<any>(null);
  const [settings, setSettings] = useState<any>({ shopName: '', phone: '', address: '', receiptFooter: '' });
  const returnReceiptRef = useRef<HTMLDivElement>(null);
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const handlePrintReturnReceipt = useReactToPrint({
    contentRef: returnReceiptRef,
    documentTitle: `Return-${lastReturnData?.returnNumber || 'receipt'}`,
  });

  // Load shop settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'general'));
        if (snap.exists()) {
          setSettings(snap.data());
        }
      } catch (err) {
        console.warn("Could not load settings:", err);
      }
    };
    fetchSettings();
  }, []);

  // Subscribe to recent sales
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedSales = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(fetchedSales);
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching sales:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  // Subscribe to returns history
  useEffect(() => {
    const qReturns = query(collection(db, 'returns'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribeReturns = onSnapshot(qReturns, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReturnsHistory(fetched);
    }, (err) => console.warn("Could not fetch returns history:", err));

    return () => unsubscribeReturns();
  }, []);

  // Autofocus barcode input on mount and section change
  useEffect(() => {
    barcodeInputRef.current?.focus();
  }, [activeSection, viewMode]);

  // Helper to parse scanned raw barcode or QR payload
  const parseScannedCode = (rawCode: string): string => {
    let clean = rawCode.trim();
    // Remove surrounding asterisks if scanned from some barcode scanners like *REC-123*
    if (clean.startsWith('*') && clean.endsWith('*') && clean.length > 2) {
      clean = clean.substring(1, clean.length - 1);
    }
    // Check if it's JSON from QR code
    if (clean.startsWith('{') && clean.endsWith('}')) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.rcpt) return String(parsed.rcpt);
        if (parsed.invoice) return String(parsed.invoice);
        if (parsed.receiptNumber) return String(parsed.receiptNumber);
        if (parsed.origRcpt) return String(parsed.origRcpt);
      } catch (e) {
        // Fall back to clean
      }
    }
    return clean;
  };

  // Perform instant lookup when a barcode is scanned or entered
  const handleBarcodeLookup = async (codeToSearch: string) => {
    const code = parseScannedCode(codeToSearch);
    if (!code) return;

    setIsSearchingBarcode(true);
    setScanNotification(null);

    try {
      // 1. Search in-memory sales first
      let matchedSale = sales.find(s => 
        String(s.receiptNumber).toLowerCase() === code.toLowerCase() ||
        String(s.id).toLowerCase() === code.toLowerCase()
      );

      // 2. If not found in loaded list, query Firestore directly
      if (!matchedSale) {
        // Try receiptNumber query (ensure uppercase for REC- prefix)
        const upperCode = code.toUpperCase();
        const qByReceipt = query(collection(db, 'sales'), where('receiptNumber', '==', upperCode), limit(1));
        const snapByReceipt = await getDocs(qByReceipt);
        
        if (!snapByReceipt.empty) {
          const docItem = snapByReceipt.docs[0];
          matchedSale = { id: docItem.id, ...docItem.data() };
        } else {
          // Fallback to exact code just in case
          const qByReceiptExact = query(collection(db, 'sales'), where('receiptNumber', '==', code), limit(1));
          const snapExact = await getDocs(qByReceiptExact);
          if (!snapExact.empty) {
            const docItem = snapExact.docs[0];
            matchedSale = { id: docItem.id, ...docItem.data() };
          } else {
            // Try doc ID lookup
            const docSnap = await getDoc(doc(db, 'sales', code));
            if (docSnap.exists()) {
              matchedSale = { id: docSnap.id, ...docSnap.data() };
            }
          }
        }
      }

      if (matchedSale) {
        playScanSuccessSound();
        handleSelectSale(matchedSale);
        setScanNotification({
          type: 'success',
          message: `✅ وەسڵی #${matchedSale.receiptNumber} بە سەرکەوتوویی دۆزرایەوە (${(matchedSale.total || 0).toLocaleString()} IQD)`
        });
        setBarcodeInput('');
      } else {
        playScanErrorSound();
        setScanNotification({
          type: 'error',
          message: `❌ هیچ وەسڵێک نەدۆزرایەوە بەم بارکۆدە/ژمارەیە: "${code}"`
        });
      }
    } catch (err: any) {
      console.error("Barcode lookup error:", err);
      playScanErrorSound();
      setScanNotification({
        type: 'error',
        message: `هەڵەیەک ڕوویدا لە کاتی گەڕانی بارکۆد: ${err.message || ''}`
      });
    } finally {
      setIsSearchingBarcode(false);
      barcodeInputRef.current?.focus();
    }
  };

  // Camera scanner handler
  useEffect(() => {
    if (isCameraScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        'camera-return-reader',
        { 
          fps: 10, 
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true
        },
        /* verbose= */ false
      );
      scannerRef.current = scanner;

      scanner.render(
        (decodedText) => {
          setIsCameraScannerOpen(false);
          if (scannerRef.current) {
            scannerRef.current.clear().catch(console.error);
          }
          handleBarcodeLookup(decodedText);
        },
        (error) => {
          // Scan frame without code, ignore
        }
      );

      return () => {
        if (scannerRef.current) {
          scannerRef.current.clear().catch(console.error);
        }
      };
    }
  }, [isCameraScannerOpen]);

  const handleSelectSale = (sale: any) => {
    setSelectedSale(sale);
    // Initialize return items with 0 return quantity and compute max returnable
    setReturnItems(sale.items.map((item: any) => {
      const alreadyReturned = item.returnedQuantity || 0;
      const originalQty = item.quantity || 1;
      const maxReturn = Math.max(0, originalQty - alreadyReturned);
      return {
        ...item,
        returnQuantity: 0,
        maxReturn: maxReturn
      };
    }));
  };

  const handleReturnQuantityChange = (index: number, quantity: number) => {
    const newReturnItems = [...returnItems];
    const item = newReturnItems[index];
    const validQuantity = Math.max(0, Math.min(quantity, item.maxReturn));
    newReturnItems[index].returnQuantity = validQuantity;
    setReturnItems(newReturnItems);
  };

  const handleReturnAll = () => {
    setReturnItems(returnItems.map(item => ({
      ...item,
      returnQuantity: item.maxReturn
    })));
  };

  const handleResetReturn = () => {
    setReturnItems(returnItems.map(item => ({
      ...item,
      returnQuantity: 0
    })));
  };

  const calculateReturnSubtotal = () => {
    return returnItems.reduce((total, item) => {
      if (item.isGift) return total;
      let pricePerUnit = item.price;
      if (item.isWholesale) {
        pricePerUnit = item.wholesalePrice || item.price;
      }
      return total + (pricePerUnit * (item.returnQuantity || 0));
    }, 0);
  };

  const calculateReturnDiscount = () => {
    if (!selectedSale || !selectedSale.discount || selectedSale.subtotal === 0) return 0;
    const returnSubtotal = calculateReturnSubtotal();
    const returnRatio = returnSubtotal / selectedSale.subtotal;
    return Math.round(selectedSale.discount * returnRatio);
  };

  const calculateReturnTotal = () => {
    return Math.max(0, calculateReturnSubtotal() - calculateReturnDiscount());
  };

  const handleProcessReturn = async () => {
    const itemsToReturn = returnItems.filter(item => item.returnQuantity > 0);
    
    if (itemsToReturn.length === 0) {
      alert('⚠️ هیچ کاڵایەک دیاری نەکراوە بۆ گەڕانەوە. تکایە بڕی ئەو کاڵایانە دیاری بکە کە دەگەڕێندرێنەوە.');
      return;
    }

    const returnSubtotal = calculateReturnSubtotal();
    const returnDiscount = calculateReturnDiscount();
    const returnTotal = calculateReturnTotal();

    const confirmMsg = `دڵنیایت لە گەڕاندنەوەی ${itemsToReturn.length} جۆر کاڵا بە بڕی (${returnTotal.toLocaleString()} IQD)؟`;
    if (!window.confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      const returnNumber = `RET-${Date.now().toString().slice(-6)}`;

      // 1. Create a return record in Firestore
      const returnDoc = {
        returnNumber: returnNumber,
        saleId: selectedSale.id,
        receiptNumber: selectedSale.receiptNumber || 'نەزانراو',
        customerName: selectedSale.customerName || 'کڕیاری گشتی',
        paymentMethod: selectedSale.paymentMethod || 'cash',
        items: itemsToReturn.map(item => ({
          id: item.id || '',
          originalId: item.originalId || item.id || '',
          name: item.name || '',
          returnQuantity: item.returnQuantity || 0,
          price: item.price || 0,
          isWholesale: item.isWholesale || false,
          isGift: item.isGift || false,
          packSize: item.packSize || 1,
          wholesalePrice: item.wholesalePrice || 0
        })),
        subtotalAmount: returnSubtotal || 0,
        discountAmount: returnDiscount || 0,
        totalAmount: returnTotal || 0,
        createdAt: serverTimestamp(),
      };

      const returnDocRef = await addDoc(collection(db, 'returns'), returnDoc);

      // Automatically print
      flushSync(() => {
        setLastReturnData({
          ...returnDoc,
          id: returnDocRef.id,
          returnNumber,
          originalReceiptNumber: selectedSale.receiptNumber,
          totalRefundAmount: returnTotal
        });
      });

      // 2. Update original sale with returned quantities and recalculated totals
      const updatedItems = selectedSale.items.map((saleItem: any) => {
        const returnedItem = itemsToReturn.find(i => (i.id === saleItem.id) || (i.originalId && i.originalId === saleItem.id));
        if (returnedItem) {
          return {
            ...saleItem,
            returnedQuantity: (saleItem.returnedQuantity || 0) + returnedItem.returnQuantity
          };
        }
        return saleItem;
      });

      const newSubtotal = Math.max(0, (selectedSale.subtotal || selectedSale.total) - returnSubtotal);
      const newDiscount = Math.max(0, (selectedSale.discount || 0) - returnDiscount);
      const newTotal = Math.max(0, selectedSale.total - returnTotal);
      
      let newAmountPaid = selectedSale.amountPaid || 0;
      if (selectedSale.paymentMethod === 'cash') {
        newAmountPaid = newTotal;
      } else if (selectedSale.paymentMethod === 'debt') {
        const remainingDebt = selectedSale.total - (selectedSale.amountPaid || 0);
        if (returnTotal > remainingDebt) {
          newAmountPaid = Math.max(0, (selectedSale.amountPaid || 0) - (returnTotal - remainingDebt));
        }
      }

      await updateDoc(doc(db, 'sales', selectedSale.id), {
        items: updatedItems,
        total: newTotal || 0,
        subtotal: newSubtotal || 0,
        discount: newDiscount || 0,
        amountPaid: newAmountPaid || 0,
        hasReturns: true
      });

      // 3. Update inventory (increment stock back to warehouse)
      for (const item of itemsToReturn) {
        const productId = item.originalId || item.id;
        if (!productId) continue;
        const productRef = doc(db, 'products', productId);
        
        let stockToReturn = item.returnQuantity;
        if (item.isWholesale && item.packSize > 1) {
          stockToReturn = item.returnQuantity * item.packSize;
        }

        await updateDoc(productRef, {
          stock: increment(stockToReturn)
        }).catch(err => console.error("Failed to update inventory for return:", err));
      }

      // 4. Update debt if it was a debt sale
      if (selectedSale.paymentMethod === 'debt' && selectedSale.customerId && selectedSale.customerId !== 'new') {
        const debtRef = doc(db, 'debts', selectedSale.customerId);
        await updateDoc(debtRef, {
          totalAmount: increment(-returnTotal),
          remainingAmount: increment(-returnTotal)
        }).catch(err => console.error("Failed to update debt for return:", err));
      }

      playScanSuccessSound();
      setScanNotification({
        type: 'success',
        message: `🎉 گەڕاندنەوەی وەسڵی #${selectedSale.receiptNumber} بە سەرکەوتوویی ئەنجامدرا! کۆی پارەی گەڕاوە: ${returnTotal.toLocaleString()} IQD`
      });

      // Print then reset state
      handlePrintReturnReceipt();
      flushSync(() => {
        setSelectedSale(null);
        setReturnItems([]);
      });

    } catch (error: any) {
      console.error("Error processing return:", error);
      playScanErrorSound();
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert('هەڵەیەک ڕوویدا لە کاتی گەڕانەوە: ' + (error.message || ''));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredSales = sales.filter(sale => 
    (sale.section === activeSection || (!sale.section && activeSection === 'general')) &&
    (String(sale.receiptNumber || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(sale.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 pb-12" dir="rtl">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <RotateCcw className="text-rose-600" size={28} />
            گەڕاندنەوەی کاڵا و وەسڵ
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            سکانکردنی ڕاستەوخۆی بارکۆدی پسوڵە و گەڕاندنەوەی دڵنیای کاڵاکان بۆ مەخزەن
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-white rounded-xl shadow-xs border border-gray-200 p-1 flex">
            <button
              onClick={() => setViewMode('return')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'return' 
                  ? 'bg-rose-600 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <RotateCcw size={16} />
              گەڕاندنەوەی نوێ
            </button>
            <button
              onClick={() => setViewMode('history')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                viewMode === 'history' 
                  ? 'bg-gray-900 text-white shadow-xs' 
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <History size={16} />
              مێژووی گەڕاندنەوە ({returnsHistory.length})
            </button>
          </div>
        </div>
      </div>

      {/* Prominent High-Contrast Barcode Scanning Bar */}
      <div className="bg-gradient-to-r from-rose-900 via-slate-900 to-indigo-950 p-4 sm:p-5 rounded-2xl shadow-md text-white border border-rose-800/40">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 text-rose-400">
              <ScanLine size={28} className="animate-pulse" />
            </div>
            <div>
              <h3 className="font-black text-base text-white">سکانی بارکۆدی وەسڵی کڕیار</h3>
              <p className="text-xs text-rose-200">بارکۆدی سەر وەسڵەکە سکان بکە تا ڕاستەوخۆ کاڵاکان بارببن</p>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={barcodeInputRef}
                type="text"
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleBarcodeLookup(barcodeInput);
                  }
                }}
                placeholder="بارکۆد سکان بکە یان ژمارەی وەسڵ بنووسە و Enter داگرە..."
                className="w-full bg-white/95 text-gray-950 font-mono font-bold text-sm sm:text-base py-3 px-4 rounded-xl border-2 border-rose-400/50 focus:border-rose-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/30 placeholder:text-gray-400 shadow-inner"
              />
              {barcodeInput && (
                <button
                  onClick={() => setBarcodeInput('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-1"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            <button
              onClick={() => handleBarcodeLookup(barcodeInput)}
              disabled={isSearchingBarcode || !barcodeInput.trim()}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm transition-all shadow-sm flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 active:scale-95"
            >
              <Search size={18} />
              <span>گەڕان</span>
            </button>

            <button
              onClick={() => setIsCameraScannerOpen(true)}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold text-sm transition-all border border-white/20 flex items-center gap-2 shrink-0 active:scale-95"
              title="سکان بە کامێرای مۆبایل یان لاپتۆپ"
            >
              <Camera size={18} />
              <span className="hidden sm:inline">کامێرا</span>
            </button>
          </div>
        </div>

        {/* Scan Status Feedback Alert */}
        {scanNotification && (
          <div className={`mt-3 p-3 rounded-xl flex items-center justify-between text-xs font-black animate-fadeIn ${
            scanNotification.type === 'success' ? 'bg-emerald-500 text-white' :
            scanNotification.type === 'error' ? 'bg-rose-500 text-white' : 'bg-blue-500 text-white'
          }`}>
            <div className="flex items-center gap-2">
              {scanNotification.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
              <span>{scanNotification.message}</span>
            </div>
            <button onClick={() => setScanNotification(null)} className="p-1 hover:opacity-80">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {viewMode === 'history' ? (
        /* ================= RETURNS HISTORY VIEW ================= */
        <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
            <div>
              <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
                <History size={20} className="text-gray-700" />
                تۆماری گەڕاندنەوەکانی پێشوو
              </h2>
              <p className="text-xs text-gray-500">بینین و چاپکردنەوەی پسوڵەی ئەو کاڵایانەی گەڕێندراونەتەوە</p>
            </div>
            <span className="px-3 py-1 bg-gray-200 text-gray-800 rounded-lg text-xs font-bold font-mono">
              کۆی تۆمارەکان: {returnsHistory.length}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-100/70 text-gray-700 font-bold border-b border-gray-200">
                <tr>
                  <th className="py-3 px-4">ژمارەی گەڕاندنەوە</th>
                  <th className="py-3 px-4">وەسڵی فرۆشتن</th>
                  <th className="py-3 px-4">کڕیار</th>
                  <th className="py-3 px-4">بەروار و کات</th>
                  <th className="py-3 px-4">کاڵا گەڕاوەکان</th>
                  <th className="py-3 px-4 text-left">کۆی پارەی گەڕاوە</th>
                  <th className="py-3 px-4 text-center">کردارەکان</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returnsHistory.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-400">
                      هیچ گەڕاندنەوەیەک تۆمار نەکراوە تا ئێستا.
                    </td>
                  </tr>
                ) : (
                  returnsHistory.map((retItem) => (
                    <tr key={retItem.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="py-3 px-4 font-mono font-black text-rose-700">
                        #{retItem.returnNumber || retItem.id.slice(0, 8)}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900">
                        #{retItem.receiptNumber}
                      </td>
                      <td className="py-3 px-4 font-medium text-gray-800">
                        {retItem.customerName || 'کڕیاری گشتی'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono" dir="ltr">
                        {retItem.createdAt ? format(retItem.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : '---'}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {retItem.items?.map((it: any, idx: number) => (
                            <span key={idx} className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded text-[10.5px] border border-gray-200">
                              {it.name} <strong className="text-rose-700">({it.returnQuantity}x)</strong>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-left font-mono font-black text-rose-600 text-sm">
                        {Math.round(retItem.totalAmount || 0).toLocaleString()} IQD
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => {
                            setLastReturnData({
                              ...retItem,
                              originalReceiptNumber: retItem.receiptNumber,
                              totalRefundAmount: retItem.totalAmount,
                            });
                            setTimeout(() => handlePrintReturnReceipt(), 100);
                          }}
                          className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-xs font-bold transition-colors inline-flex items-center gap-1 border border-gray-300"
                        >
                          <Printer size={14} />
                          <span>چاپکردنەوە</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* ================= ACTIVE RETURN WORKFLOW ================= */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Section filter & Sales Receipts Explorer (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            {/* Section tabs */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-1.5 flex overflow-x-auto gap-1">
              <button
                onClick={() => {
                  setActiveSection('general');
                  setSelectedSale(null);
                  setReturnItems([]);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSection === 'general' 
                    ? 'bg-indigo-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                بەشی گشتی
              </button>
              <button
                onClick={() => {
                  setActiveSection('shisha');
                  setSelectedSale(null);
                  setReturnItems([]);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSection === 'shisha' 
                    ? 'bg-purple-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                بەشی شیشە
              </button>
              <button
                onClick={() => {
                  setActiveSection('external');
                  setSelectedSale(null);
                  setReturnItems([]);
                }}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                  activeSection === 'external' 
                    ? 'bg-emerald-600 text-white shadow-xs' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                کاڵای دەرەکی
              </button>
            </div>

            {/* Quick text search */}
            <div className="bg-white p-3 rounded-2xl shadow-xs border border-gray-200">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                <input
                  type="text"
                  placeholder="گەڕان بەپێی وەسڵ یان کڕیار..."
                  className="w-full pl-3 pr-9 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-rose-500 focus:bg-white focus:outline-none"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            {/* Recent Sales List */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden flex flex-col h-[520px]">
              <div className="p-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                <span className="font-bold text-gray-700 text-xs">دوایین پسوڵەکان</span>
                <span className="text-[11px] text-gray-500 font-mono">{filteredSales.length} وەسڵ</span>
              </div>

              <div className="overflow-y-auto flex-1 p-2 space-y-2">
                {loading ? (
                  <div className="text-center py-8 text-gray-400 text-xs">بارکردنی وەسڵەکان...</div>
                ) : filteredSales.length === 0 ? (
                  <div className="text-center py-8 text-gray-400 text-xs">هیچ وەسڵێک نەدۆزرایەوە</div>
                ) : (
                  filteredSales.map(sale => {
                    const isSelected = selectedSale?.id === sale.id;
                    const itemsCount = sale.items?.length || 0;
                    return (
                      <button
                        key={sale.id}
                        onClick={() => handleSelectSale(sale)}
                        className={`w-full text-right p-3.5 rounded-xl border transition-all ${
                          isSelected 
                            ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20 shadow-xs' 
                            : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-mono font-black text-xs text-gray-900">
                            #{sale.receiptNumber}
                          </span>
                          <span className="text-[10px] text-gray-400 font-mono" dir="ltr">
                            {sale.createdAt ? format(sale.createdAt.toDate(), 'MM/dd HH:mm') : ''}
                          </span>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-gray-600 font-medium truncate max-w-[120px]">
                            {sale.customerName || 'کڕیاری گشتی'}
                          </span>
                          <span className="font-mono font-black text-rose-600">
                            {(sale.total || 0).toLocaleString()} IQD
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400 mt-1 pt-1 border-t border-gray-100">
                          <span>{itemsCount} جۆر کاڵا</span>
                          <span className={`px-1.5 py-0.2 rounded font-bold ${
                            sale.paymentMethod === 'debt' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {sale.paymentMethod === 'debt' ? 'قەرز' : 'کاش'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Selected Receipt Inspection & Return Processor (8 cols) */}
          <div className="lg:col-span-8">
            {selectedSale ? (
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 overflow-hidden flex flex-col">
                {/* Sale Overview Header */}
                <div className="p-5 border-b border-gray-200 bg-gray-50/90 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 bg-rose-600 text-white rounded-md text-xs font-black font-mono">
                        #{selectedSale.receiptNumber}
                      </span>
                      <h2 className="text-base font-black text-gray-900">
                        وردەکاری وەسڵی فرۆشتن
                      </h2>
                      {selectedSale.hasReturns && (
                        <span className="px-2 py-0.5 bg-amber-100 text-amber-900 rounded text-[10px] font-black border border-amber-300">
                          پێشتر کاڵای لێ گەڕێندراوەتەوە
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      کڕیار: <strong className="text-gray-900">{selectedSale.customerName || 'کڕیاری گشتی'}</strong> • 
                      بەروار: <span className="font-mono">{selectedSale.createdAt ? format(selectedSale.createdAt.toDate(), 'yyyy/MM/dd HH:mm') : ''}</span> • 
                      شێواز: <strong className="text-gray-900">{selectedSale.paymentMethod === 'cash' ? 'نەقد (کاش)' : 'قەرز'}</strong>
                    </p>
                  </div>

                  <div className="text-left bg-white px-4 py-2 rounded-xl border border-gray-200 shadow-2xs">
                    <p className="text-[10px] text-gray-500 font-bold">کۆی گشتی وەسڵ</p>
                    <p className="text-lg font-black text-rose-600 font-mono">
                      {(selectedSale.total || 0).toLocaleString()} IQD
                    </p>
                  </div>
                </div>

                {/* Quick Selection Toolbar */}
                <div className="px-5 py-3 bg-gray-100/60 border-b border-gray-200 flex justify-between items-center text-xs">
                  <span className="font-bold text-gray-700">لیستی کاڵاکانی وەسڵ بۆ گەڕاندنەوە:</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleReturnAll}
                      className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-900 rounded-lg font-bold text-xs transition-colors border border-rose-300"
                    >
                      گەڕاندنەوەی هەمووی (Return All)
                    </button>
                    <button
                      onClick={handleResetReturn}
                      className="px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg font-bold text-xs transition-colors border border-gray-300"
                    >
                      سڕینەوەی هەڵبژاردن
                    </button>
                  </div>
                </div>

                {/* Items Table */}
                <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200 sticky top-0 z-10">
                      <tr>
                        <th className="py-3 px-4">ناوی کاڵا</th>
                        <th className="py-3 px-3 text-center">نرخی دانە</th>
                        <th className="py-3 px-3 text-center">کڕدراو</th>
                        <th className="py-3 px-3 text-center">گەڕاوەی پێشوو</th>
                        <th className="py-3 px-3 text-center">شیاوی گەڕاندنەوە</th>
                        <th className="py-3 px-4 text-center w-48">بڕی گەڕاندنەوە</th>
                        <th className="py-3 px-4 text-left">کۆی گەڕاوە</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {returnItems.map((item, index) => {
                        const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                        const isExhausted = item.maxReturn === 0;
                        const lineReturnTotal = unitPrice * (item.returnQuantity || 0);

                        return (
                          <tr 
                            key={index} 
                            className={`transition-colors ${
                              isExhausted ? 'bg-gray-50/70 opacity-60' :
                              item.returnQuantity > 0 ? 'bg-rose-50/40 font-bold' : 'hover:bg-gray-50/50'
                            }`}
                          >
                            <td className="py-3 px-4">
                              <div className="font-bold text-gray-900">{item.name}</div>
                              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 mt-0.5">
                                {item.isWholesale && <span className="bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-bold">جملە</span>}
                                {item.isGift && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-bold">هەدیە</span>}
                                {item.category && <span>پۆل: {item.category}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-bold text-gray-800">
                              {item.isGift ? 'دیاری' : unitPrice.toLocaleString()}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-gray-700">
                              {item.quantity}
                            </td>
                            <td className="py-3 px-3 text-center font-mono text-amber-700 font-bold">
                              {item.returnedQuantity || 0}
                            </td>
                            <td className="py-3 px-3 text-center font-mono font-black text-gray-900">
                              {item.maxReturn}
                            </td>
                            <td className="py-3 px-4 text-center">
                              {isExhausted ? (
                                <span className="text-[11px] text-gray-400 font-bold">هەمووی گەڕاوەتەوە</span>
                              ) : (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => handleReturnQuantityChange(index, (item.returnQuantity || 0) - 1)}
                                    disabled={item.returnQuantity <= 0}
                                    className="w-7 h-7 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <Minus size={14} />
                                  </button>

                                  <input
                                    type="number"
                                    min="0"
                                    max={item.maxReturn}
                                    value={item.returnQuantity === 0 ? '' : item.returnQuantity}
                                    onChange={(e) => handleReturnQuantityChange(index, Number(e.target.value))}
                                    placeholder="0"
                                    className="w-14 text-center py-1 bg-white border border-gray-300 rounded-lg font-mono font-bold text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                  />

                                  <button
                                    onClick={() => handleReturnQuantityChange(index, (item.returnQuantity || 0) + 1)}
                                    disabled={item.returnQuantity >= item.maxReturn}
                                    className="w-7 h-7 bg-rose-600 hover:bg-rose-700 text-white rounded-lg flex items-center justify-center font-black disabled:opacity-30 disabled:cursor-not-allowed"
                                  >
                                    <Plus size={14} />
                                  </button>

                                  <button
                                    onClick={() => handleReturnQuantityChange(index, item.maxReturn)}
                                    className="text-[10px] text-rose-700 hover:underline px-1.5 py-1 font-bold"
                                    title="گەڕاندنەوەی تەواوی بڕ"
                                  >
                                    تەواو
                                  </button>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-left font-mono font-black text-rose-700">
                              {lineReturnTotal > 0 ? `${lineReturnTotal.toLocaleString()} IQD` : '٠'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Refund Calculations & Execute Section */}
                <div className="p-5 border-t border-gray-200 bg-gray-50 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-500 font-bold block">کۆی کاڵای گەڕاوە</span>
                      <span className="text-base font-black text-gray-900 font-mono">
                        {calculateReturnSubtotal().toLocaleString()} IQD
                      </span>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-gray-200">
                      <span className="text-[10px] text-gray-500 font-bold block">داشکاندنی هاوتا</span>
                      <span className="text-base font-black text-amber-700 font-mono">
                        -{calculateReturnDiscount().toLocaleString()} IQD
                      </span>
                    </div>

                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl">
                      <span className="text-[10px] text-rose-700 font-bold block">کۆی پارەی گەڕاوە (سافی)</span>
                      <span className="text-xl font-black text-rose-700 font-mono">
                        {calculateReturnTotal().toLocaleString()} IQD
                      </span>
                    </div>
                  </div>

                  {/* Payment settlement method note */}
                  <div className="text-xs bg-white p-3 rounded-xl border border-gray-200 flex items-center justify-between">
                    <span className="text-gray-600">
                      شێوازی حیساباتی گەڕانەوە: <strong>{selectedSale.paymentMethod === 'debt' ? 'کەمکردنەوە لە قەرزی کڕیار' : 'گەڕاندنەوەی پارەی کاش لە قاصە'}</strong>
                    </span>
                    <span className="text-gray-400 font-mono text-[11px]">
                      ژمارەی کاڵا دیاریکراوەکان: {returnItems.filter(i => i.returnQuantity > 0).reduce((sum, i) => sum + i.returnQuantity, 0)} دانە
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedSale(null);
                        setReturnItems([]);
                      }}
                      className="py-3 px-5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-bold text-xs transition-colors"
                    >
                      داخستن
                    </button>

                    <button
                      onClick={handleProcessReturn}
                      disabled={isProcessing || !returnItems.some(i => i.returnQuantity > 0)}
                      className="flex-1 py-3.5 px-6 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-sm transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99]"
                    >
                      {isProcessing ? (
                        <span>پرۆسێس دەکرێت...</span>
                      ) : (
                        <>
                          <RotateCcw size={18} />
                          <span>پەسەندکردن و گەڕاندنەوەی کاڵاکان بۆ مەخزەن ({calculateReturnTotal().toLocaleString()} IQD)</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Empty selection placeholder */
              <div className="bg-white rounded-2xl shadow-xs border border-gray-200 p-12 text-center flex flex-col items-center justify-center min-h-[460px] text-gray-400">
                <div className="w-20 h-20 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mb-4 border border-rose-100 shadow-inner">
                  <ScanLine size={40} />
                </div>
                <h3 className="text-lg font-black text-gray-800 mb-1">
                  وەسڵێک هەڵبژێرە یان بارکۆدەکەی سکان بکە
                </h3>
                <p className="text-xs text-gray-500 max-w-sm leading-relaxed mb-6">
                  کاتێک بارکۆدی پسوڵەی کڕیار سکان دەکەیت، دەستبەجێ هەموو کاڵاکانی وەسڵەکە لێرە باردەبن و دەتوانیت بە ئاسانی کاڵاکان بگەڕێنیتەوە.
                </p>
                <button
                  onClick={() => barcodeInputRef.current?.focus()}
                  className="px-5 py-2.5 bg-gray-900 text-white rounded-xl font-bold text-xs hover:bg-black transition-colors flex items-center gap-2"
                >
                  <ScanLine size={16} />
                  <span>تەرکیز لەسەر خانەی سکان</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hidden Return Receipt for Printing */}
      <div className="hidden">
        {lastReturnData && (
          <ReturnReceipt
            ref={returnReceiptRef}
            settings={settings}
            returnNumber={lastReturnData.returnNumber || 'RET-001'}
            originalReceiptNumber={lastReturnData.originalReceiptNumber || lastReturnData.receiptNumber || '---'}
            returnDate={new Date()}
            customerName={lastReturnData.customerName}
            items={lastReturnData.items || []}
            subtotalAmount={lastReturnData.subtotalAmount || lastReturnData.totalAmount || 0}
            discountAmount={lastReturnData.discountAmount || 0}
            totalRefundAmount={lastReturnData.totalRefundAmount || lastReturnData.totalAmount || 0}
            paymentMethod={lastReturnData.paymentMethod || 'cash'}
          />
        )}
      </div>

      {/* Camera Barcode Scanner Modal */}
      {isCameraScannerOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-gray-200 text-right">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-black text-gray-900 text-base flex items-center gap-2">
                <Camera size={20} className="text-rose-600" />
                سکانکردنی وەسڵ بە کامێرا
              </h3>
              <button
                onClick={() => setIsCameraScannerOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <p className="text-xs text-gray-600 mb-4">
              کامێرای ئامێرەکەت ڕووبەڕووی بارکۆد یان کۆدی QR ی وەسڵەکە ڕابگرە:
            </p>

            <div id="camera-return-reader" className="w-full rounded-xl overflow-hidden border border-gray-300"></div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setIsCameraScannerOpen(false)}
                className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl font-bold text-xs transition-colors"
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
