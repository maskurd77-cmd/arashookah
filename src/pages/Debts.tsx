import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, DollarSign, History, X, TrendingUp, TrendingDown, Users, Edit, Trash2, PlusCircle, Printer, AlertCircle, FileText, Download, MessageCircle, ArrowUpDown, FileSpreadsheet } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useReactToPrint } from 'react-to-print';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Debts() {
  const { setShowFirebaseSetup } = useAuth();
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('unpaid');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'highest' | 'lowest'>('newest');
  
  const [isNewDebtModalOpen, setIsNewDebtModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAddPurchaseModalOpen, setIsAddPurchaseModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [debtToDelete, setDebtToDelete] = useState<any>(null);
  const [selectedDebt, setSelectedDebt] = useState<any>(null);

  const [newDebtData, setNewDebtData] = useState({
    customerName: '',
    phone: '',
    totalAmount: 0,
    paidAmount: 0,
    note: '',
  });

  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentNote, setPaymentNote] = useState('');
  
  const [purchaseAmount, setPurchaseAmount] = useState(0);
  const [purchaseNote, setPurchaseNote] = useState('');

  const [editData, setEditData] = useState({ customerName: '', phone: '', note: '' });
  const [settings, setSettings] = useState<any>({});

  const printRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `مێژووی_قەرز_${selectedDebt?.customerName || ''}`,
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsDoc = await getDoc(doc(db, 'settings', 'general'));
        if (settingsDoc.exists()) {
          setSettings(settingsDoc.data());
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      }
    };
    fetchSettings();

    setLoading(true);
    const q = query(collection(db, 'debts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      setDebts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching debts:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleNewDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const remainingAmount = newDebtData.totalAmount - newDebtData.paidAmount;
      const debtDoc = {
        ...newDebtData,
        remainingAmount,
        status: remainingAmount <= 0 ? 'paid' : 'unpaid',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        payments: newDebtData.paidAmount > 0 ? [{
          amount: newDebtData.paidAmount,
          date: new Date().toISOString(),
          note: 'پارەی سەرەتا'
        }] : [],
        purchases: newDebtData.totalAmount > 0 ? [{
          amount: newDebtData.totalAmount,
          date: new Date().toISOString(),
          note: newDebtData.note || 'قەرزی سەرەتا'
        }] : []
      };

      await addDoc(collection(db, 'debts'), debtDoc);
      setIsNewDebtModalOpen(false);
      setNewDebtData({ customerName: '', phone: '', totalAmount: 0, paidAmount: 0, note: '' });
    } catch (error: any) {
      console.error("Error adding debt:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا");
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || paymentAmount <= 0) return;

    setLoading(true);
    try {
      const newPaidAmount = selectedDebt.paidAmount + paymentAmount;
      const newRemainingAmount = selectedDebt.totalAmount - newPaidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'paid' : 'unpaid';

      const newPayment = {
        amount: paymentAmount,
        date: new Date().toISOString(),
        note: paymentNote || 'پێدانی بەشێک لە قەرز'
      };

      await updateDoc(doc(db, 'debts', selectedDebt.id), {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        updatedAt: serverTimestamp(),
        payments: [...(selectedDebt.payments || []), newPayment]
      });

      setIsPaymentModalOpen(false);
      setSelectedDebt(null);
      setPaymentAmount(0);
      setPaymentNote('');
    } catch (error: any) {
      console.error("Error updating debt:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || purchaseAmount <= 0) return;

    setLoading(true);
    try {
      const newTotalAmount = selectedDebt.totalAmount + purchaseAmount;
      const newRemainingAmount = newTotalAmount - selectedDebt.paidAmount;
      const newStatus = newRemainingAmount <= 0 ? 'paid' : 'unpaid';

      const newPurchase = {
        amount: purchaseAmount,
        date: new Date().toISOString(),
        note: purchaseNote || 'زیادکردنی قەرز'
      };

      await updateDoc(doc(db, 'debts', selectedDebt.id), {
        totalAmount: newTotalAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
        updatedAt: serverTimestamp(),
        purchases: [...(selectedDebt.purchases || []), newPurchase]
      });

      setIsAddPurchaseModalOpen(false);
      setSelectedDebt(null);
      setPurchaseAmount(0);
      setPurchaseNote('');
    } catch (error: any) {
      console.error("Error updating debt:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt) return;
    setLoading(true);
    try {
      await updateDoc(doc(db, 'debts', selectedDebt.id), {
        customerName: editData.customerName,
        phone: editData.phone,
        note: editData.note,
        updatedAt: serverTimestamp(),
      });
      setIsEditModalOpen(false);
      setSelectedDebt(null);
    } catch (error: any) {
      console.error("Error editing debt:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا");
      }
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!debtToDelete) return;
    try {
      await deleteDoc(doc(db, 'debts', debtToDelete.id));
      setDebtToDelete(null);
    } catch (error: any) {
      console.error("Error deleting debt:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      } else {
        alert("هەڵەیەک ڕوویدا لە کاتی سڕینەوە");
      }
    }
  };

  const filteredAndSortedDebts = debts.filter(d => {
    const matchesSearch = d.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || d.phone.includes(searchTerm);
    const matchesStatus = filterStatus === 'all' ? true : d.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    if (sortBy === 'newest') return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (sortBy === 'oldest') return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    if (sortBy === 'highest') return b.remainingAmount - a.remainingAmount;
    if (sortBy === 'lowest') return a.remainingAmount - b.remainingAmount;
    return 0;
  });

  const exportToCSV = () => {
    const headers = ['ناوی کڕیار', 'ژمارەی مۆبایل', 'قەرزی کۆن', 'قەرزی نوێ', 'پارەی دراو', 'قەرزی ماوە', 'دۆخ', 'تێبینی'];
    const csvData = filteredAndSortedDebts.map(d => {
      const oldDebt = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : d.totalAmount;
      const newDebt = d.totalAmount - oldDebt;
      return [
        d.customerName,
        d.phone || '',
        oldDebt,
        newDebt,
        d.paidAmount,
        d.remainingAmount,
        d.status === 'paid' ? 'پاکتاوکراو' : 'قەرزار',
        d.note || ''
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `دەفتەری_قەرز_${new Date().toLocaleDateString('en-GB')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendWhatsApp = (debt: any) => {
    if (!debt.phone) {
      alert("ژمارەی مۆبایل تۆمار نەکراوە بۆ ئەم کڕیارە");
      return;
    }
    let phone = debt.phone.replace(/\s+/g, '');
    if (phone.startsWith('0')) {
      phone = '964' + phone.substring(1);
    } else if (!phone.startsWith('964') && !phone.startsWith('+')) {
      phone = '964' + phone;
    }
    phone = phone.replace('+', '');

    const message = `سڵاو بەڕێز ${debt.customerName}،\nبڕی ${debt.remainingAmount.toLocaleString()} دینار قەرزت لەلایە.\nتکایە ئاگادار بە.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getCombinedHistory = (debt: any) => {
    const payments = (debt.payments || []).map((p: any) => ({ ...p, type: 'payment' }));
    const purchases = (debt.purchases || []).map((p: any, index: number) => ({ ...p, type: 'purchase', isFirst: index === 0 }));
    return [...payments, ...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const exportCustomerHistoryToExcel = async () => {
    if (!selectedDebt) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('کەشفی حساب');

    worksheet.views = [{ rightToLeft: true }];

    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = settings.shopName || 'کەشفی حساب';
    titleCell.font = { name: 'Tahoma', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:E2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = `کڕیار: ${selectedDebt.customerName} | مۆبایل: ${selectedDebt.phone || '-'}`;
    subTitleCell.font = { name: 'Tahoma', size: 12 };
    subTitleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    worksheet.getCell('A4').value = 'کۆی قەرز:';
    worksheet.getCell('B4').value = selectedDebt.totalAmount;
    worksheet.getCell('B4').numFmt = '#,##0';
    worksheet.getCell('B4').font = { bold: true };

    worksheet.getCell('D4').value = 'پارەی دراو:';
    worksheet.getCell('E4').value = selectedDebt.paidAmount;
    worksheet.getCell('E4').numFmt = '#,##0';
    worksheet.getCell('E4').font = { bold: true, color: { argb: 'FF059669' } };

    worksheet.getCell('A5').value = 'قەرزی ماوە:';
    worksheet.getCell('B5').value = selectedDebt.remainingAmount;
    worksheet.getCell('B5').numFmt = '#,##0';
    worksheet.getCell('B5').font = { bold: true, color: { argb: 'FFDC2626' } };

    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['بەروار', 'جۆر', 'وردەکاری', 'بڕی پارە (IQD)', 'کاڵاکان']);
    headerRow.font = { name: 'Tahoma', size: 12, bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 30;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 50;

    const history = getCombinedHistory(selectedDebt);
    history.forEach(item => {
      const date = new Date(item.date).toLocaleString('en-GB');
      const type = item.type === 'purchase' ? 'کڕین (قەرز)' : 'پێدانی پارە';
      const note = item.note || '-';
      const amount = item.amount;
      
      let itemsStr = '';
      if (item.type === 'purchase' && item.items) {
        itemsStr = item.items.map((i: any) => `${i.name} (${i.quantity} ${i.isWholesale ? 'کارتۆن' : 'دانە'})`).join('، ');
      }

      const row = worksheet.addRow([date, type, note, amount, itemsStr]);
      
      row.getCell(4).numFmt = '#,##0';
      row.getCell(4).font = { bold: true, color: { argb: item.type === 'purchase' ? 'FFDC2626' : 'FF059669' } };
      
      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
        };
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `کەشفی_حساب_${selectedDebt.customerName}_${new Date().toLocaleDateString('en-GB')}.xlsx`);
  };

  const getDaysAgo = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffTime = Math.abs(new Date().getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'ئەمڕۆ';
    if (diffDays === 1) return 'دوێنێ';
    return `${diffDays} ڕۆژ لەمەوپێش`;
  };

  // Calculate Stats
  const totalOldDebt = debts.reduce((sum, d) => {
    const old = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : d.totalAmount;
    return sum + old;
  }, 0);
  const totalNewDebt = debts.reduce((sum, d) => {
    const old = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : d.totalAmount;
    return sum + (d.totalAmount - old);
  }, 0);
  const totalPaidAmount = debts.reduce((sum, d) => sum + d.paidAmount, 0);
  const totalRemainingAmount = debts.reduce((sum, d) => sum + d.remainingAmount, 0);
  const activeDebtorsCount = debts.filter(d => d.status === 'unpaid').length;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">دەفتەری قەرز</h1>
          <p className="text-gray-500 mt-1">بەڕێوەبردنی قەرزەکان و پارەدانەکان بە شێوەیەکی پێشکەوتوو</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-sm font-medium justify-center"
          >
            <Download size={20} />
            <span className="hidden sm:inline">ئێکسڵ</span>
          </button>
          <button
            onClick={() => setIsNewDebtModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-sm hover:shadow-md font-medium justify-center"
          >
            <Plus size={20} />
            تۆمارکردنی قەرزی نوێ
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0">
              <FileText size={20} />
            </div>
            <p className="text-sm font-medium text-gray-500">قەرزی کۆن</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalOldDebt.toLocaleString()} <span className="text-xs font-normal text-gray-500">IQD</span></p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center shrink-0">
              <PlusCircle size={20} />
            </div>
            <p className="text-sm font-medium text-gray-500">قەرزی نوێ</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalNewDebt.toLocaleString()} <span className="text-xs font-normal text-gray-500">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-50 text-green-600 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={20} />
            </div>
            <p className="text-sm font-medium text-gray-500">پارەی وەرگیراو</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalPaidAmount.toLocaleString()} <span className="text-xs font-normal text-gray-500">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-red-50 text-red-600 rounded-xl flex items-center justify-center shrink-0">
              <TrendingDown size={20} />
            </div>
            <p className="text-sm font-medium text-gray-500">قەرزی ماوە</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{totalRemainingAmount.toLocaleString()} <span className="text-xs font-normal text-gray-500">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center shrink-0">
              <Users size={20} />
            </div>
            <p className="text-sm font-medium text-gray-500">قەرزارەکان</p>
          </div>
          <p className="text-xl font-bold text-gray-900">{activeDebtorsCount} <span className="text-xs font-normal text-gray-500">کەس</span></p>
        </motion.div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col lg:flex-row justify-between items-center gap-4">
          <div className="relative w-full lg:w-96">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناو یان ژمارە مۆبایل..."
              className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-col sm:flex-row w-full lg:w-auto gap-3">
            <div className="relative w-full sm:w-48">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <ArrowUpDown size={18} />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-4 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all appearance-none text-sm font-medium text-gray-700"
              >
                <option value="newest">نوێترین</option>
                <option value="oldest">کۆنترین</option>
                <option value="highest">زۆرترین قەرز</option>
                <option value="lowest">کەمترین قەرز</option>
              </select>
            </div>

            <div className="flex bg-gray-100 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'all' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                هەمووی
              </button>
              <button
                onClick={() => setFilterStatus('unpaid')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'unpaid' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                قەرزارەکان
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`flex-1 sm:flex-none px-4 py-2 rounded-lg text-sm font-medium transition-all ${filterStatus === 'paid' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                پاکتاوکراو
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">کڕیار</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">مۆبایل</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">قەرزی کۆن</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">قەرزی نوێ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">پارەی دراو</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">ماوە</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600">دۆخ</th>
                <th className="px-6 py-4 text-sm font-semibold text-gray-600 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-gray-500">بارکردن...</p>
                  </td>
                </tr>
              ) : filteredAndSortedDebts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="text-gray-400" size={32} />
                    </div>
                    <p className="text-gray-500 font-medium">هیچ داتایەک نەدۆزرایەوە</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedDebts.map((debt, index) => {
                  const oldDebt = debt.purchases && debt.purchases.length > 0 ? debt.purchases[0].amount : debt.totalAmount;
                  const newDebt = debt.totalAmount - oldDebt;
                  const progress = debt.totalAmount > 0 ? Math.min(100, Math.round((debt.paidAmount / debt.totalAmount) * 100)) : 0;
                  return (
                  <motion.tr 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    key={debt.id} 
                    className="hover:bg-gray-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{debt.customerName}</div>
                      {debt.note && <div className="text-xs text-gray-500 mt-1 truncate max-w-[150px]">{debt.note}</div>}
                    </td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-sm" dir="ltr">{debt.phone || '-'}</td>
                    <td className="px-6 py-4 font-semibold text-gray-600">{oldDebt.toLocaleString()}</td>
                    <td className="px-6 py-4 font-semibold text-orange-600">{newDebt > 0 ? '+' + newDebt.toLocaleString() : '0'}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <span className="text-green-600 font-semibold">{debt.paidAmount.toLocaleString()}</span>
                        <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[80px]">
                          <div className="bg-green-500 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-red-600 font-bold bg-red-50/30">{debt.remainingAmount.toLocaleString()}</td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${debt.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                          {debt.status === 'paid' ? 'پاکتاوکراو' : 'قەرزار'}
                        </span>
                        <span className="text-xs text-gray-400 font-medium">
                          {getDaysAgo(debt.updatedAt || debt.createdAt)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => sendWhatsApp(debt)}
                          disabled={!debt.phone}
                          className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="ناردنی نامەی وەتسئەپ"
                        >
                          <MessageCircle size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setIsPaymentModalOpen(true);
                          }}
                          disabled={debt.status === 'paid'}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          title="وەرگرتنی پارە (کەمکردنەوەی قەرز)"
                        >
                          <DollarSign size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setIsAddPurchaseModalOpen(true);
                          }}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="پێدانی قەرزی نوێ (زیادکردنی قەرز)"
                        >
                          <PlusCircle size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setIsHistoryModalOpen(true);
                          }}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="مێژووی مامەڵەکان"
                        >
                          <History size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDebt(debt);
                            setEditData({ customerName: debt.customerName, phone: debt.phone, note: debt.note || '' });
                            setIsEditModalOpen(true);
                          }}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="دەستکاری"
                        >
                          <Edit size={18} />
                        </button>
                        <button
                          onClick={() => setDebtToDelete(debt)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="سڕینەوە"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Debt Modal */}
      <AnimatePresence>
        {isNewDebtModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-indigo-50/50">
                <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                  <PlusCircle className="text-indigo-600" />
                  تۆمارکردنی قەرزی نوێ
                </h2>
                <button onClick={() => setIsNewDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleNewDebt} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ناوی کڕیار <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newDebtData.customerName}
                      onChange={(e) => setNewDebtData({...newDebtData, customerName: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                      placeholder="ناوی سیانی"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">ژمارەی مۆبایل</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={newDebtData.phone}
                      onChange={(e) => setNewDebtData({...newDebtData, phone: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors text-left"
                      placeholder="0750 000 0000"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">کۆی قەرز (IQD) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newDebtData.totalAmount || ''}
                      onChange={(e) => setNewDebtData({...newDebtData, totalAmount: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors font-bold text-red-600"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">پارەی پێشەکی دراو (IQD)</label>
                    <input
                      type="number"
                      min="0"
                      max={newDebtData.totalAmount}
                      value={newDebtData.paidAmount || ''}
                      onChange={(e) => setNewDebtData({...newDebtData, paidAmount: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors font-bold text-green-600"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="bg-blue-50 p-4 rounded-xl flex justify-between items-center border border-blue-100">
                  <span className="text-blue-800 font-medium">قەرزی ماوە:</span>
                  <span className="text-xl font-bold text-blue-900">{(newDebtData.totalAmount - newDebtData.paidAmount).toLocaleString()} IQD</span>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">تێبینی</label>
                  <textarea
                    rows={2}
                    value={newDebtData.note}
                    onChange={(e) => setNewDebtData({...newDebtData, note: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors resize-none"
                    placeholder="هەر تێبینییەک دەربارەی ئەم قەرزە..."
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewDebtModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newDebtData.totalAmount <= 0}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? 'چاوەڕێبە...' : 'تۆمارکردن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Payment Modal (Receive Money) */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-green-50/50">
                <h2 className="text-xl font-bold text-green-900 flex items-center gap-2">
                  <DollarSign className="text-green-600" />
                  وەرگرتنی پارەی قەرز
                </h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">کڕیار:</span>
                    <span className="font-bold text-gray-900">{selectedDebt.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-500 text-sm">قەرزی ماوە:</span>
                    <span className="font-bold text-red-600 text-lg">{selectedDebt.remainingAmount.toLocaleString()} IQD</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">بڕی پارەی وەرگیراو (IQD) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedDebt.remainingAmount}
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xl font-bold text-green-600 text-center bg-green-50/30"
                    placeholder="0"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setPaymentAmount(selectedDebt.remainingAmount)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 transition-colors">هەمووی</button>
                    <button type="button" onClick={() => setPaymentAmount(selectedDebt.remainingAmount / 2)} className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded text-gray-700 transition-colors">نیوەی</button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">تێبینی (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="بۆ نموونە: پارەی نەقدی دا"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || paymentAmount <= 0 || paymentAmount > selectedDebt.remainingAmount}
                    className="flex-1 py-3 px-4 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? 'چاوەڕێبە...' : 'وەرگرتن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Purchase Modal (Increase Debt) */}
      <AnimatePresence>
        {isAddPurchaseModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-red-50/50">
                <h2 className="text-xl font-bold text-red-900 flex items-center gap-2">
                  <PlusCircle className="text-red-600" />
                  پێدانی قەرزی نوێ
                </h2>
                <button onClick={() => setIsAddPurchaseModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddPurchase} className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500 text-sm">کڕیار:</span>
                    <span className="font-bold text-gray-900">{selectedDebt.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-500 text-sm">قەرزی پێشوو:</span>
                    <span className="font-bold text-red-600">{selectedDebt.remainingAmount.toLocaleString()} IQD</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">بڕی قەرزی نوێ (IQD) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={purchaseAmount || ''}
                    onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 text-xl font-bold text-red-600 text-center bg-red-50/30"
                    placeholder="0"
                  />
                </div>
                
                {purchaseAmount > 0 && (
                  <div className="bg-red-50 p-3 rounded-xl flex justify-between items-center border border-red-100">
                    <span className="text-red-800 font-medium text-sm">کۆی قەرز دوای ئەمە:</span>
                    <span className="text-lg font-bold text-red-900">{(selectedDebt.remainingAmount + purchaseAmount).toLocaleString()} IQD</span>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">تێبینی (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    value={purchaseNote}
                    onChange={(e) => setPurchaseNote(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 bg-gray-50 focus:bg-white transition-colors"
                    placeholder="بۆ نموونە: کڕینی ٢ شیشە"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddPurchaseModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || purchaseAmount <= 0}
                    className="flex-1 py-3 px-4 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? 'چاوەڕێبە...' : 'زیادکردنی قەرز'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Modal */}
      <AnimatePresence>
        {isEditModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit className="text-gray-600" />
                  دەستکاریکردنی زانیاری
                </h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-sm">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ناوی کڕیار <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editData.customerName}
                    onChange={(e) => setEditData({...editData, customerName: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">ژمارەی مۆبایل</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editData.phone}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors text-left"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">تێبینی</label>
                  <textarea
                    rows={2}
                    value={editData.note}
                    onChange={(e) => setEditData({...editData, note: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white transition-colors resize-none"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-3 px-4 bg-white border border-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !editData.customerName}
                    className="flex-1 py-3 px-4 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-md"
                  >
                    {loading ? 'چاوەڕێبە...' : 'پاشەکەوتکردن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <History className="text-indigo-600" />
                    مێژووی مامەڵەکان
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">کڕیار: <span className="font-bold text-gray-700">{selectedDebt.customerName}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportCustomerHistoryToExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg hover:bg-emerald-100 transition-colors font-medium shadow-sm"
                  >
                    <FileSpreadsheet size={18} />
                    <span className="hidden sm:inline">ئێکسڵ</span>
                  </button>
                  <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium shadow-sm"
                  >
                    <Printer size={18} />
                    <span className="hidden sm:inline">چاپکردن (PDF)</span>
                  </button>
                  <button
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-lg transition-colors shadow-sm"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50">
                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {getCombinedHistory(selectedDebt).length === 0 ? (
                    <div className="text-center py-12 bg-white rounded-xl border border-gray-100 relative z-10">
                      <History className="mx-auto text-gray-300 mb-3" size={32} />
                      <p className="text-gray-500 font-medium">هیچ مامەڵەیەک تۆمار نەکراوە</p>
                    </div>
                  ) : (
                    getCombinedHistory(selectedDebt).map((item: any, index: number) => (
                      <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          {item.type === 'purchase' ? (
                            <div className="w-full h-full rounded-full bg-red-100 text-red-600 flex items-center justify-center"><TrendingUp size={16} /></div>
                          ) : (
                            <div className="w-full h-full rounded-full bg-green-100 text-green-600 flex items-center justify-center"><TrendingDown size={16} /></div>
                          )}
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                          <div className="flex justify-between items-start mb-1">
                            <span className={`font-bold ${item.type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
                              {item.type === 'purchase' ? (item.isFirst ? 'قەرزی کۆن' : 'قەرزی نوێ') : 'پێدانی پارە'}
                            </span>
                            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-md" dir="ltr">
                              {new Date(item.date).toLocaleDateString('en-GB')} {new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <div className={`text-xl font-bold mb-2 ${item.type === 'purchase' ? 'text-red-700' : 'text-green-700'}`}>
                            {item.type === 'purchase' ? '+' : '-'}{item.amount.toLocaleString()} <span className="text-sm font-normal">IQD</span>
                          </div>
                          {item.note && (
                            <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                              {item.note}
                            </div>
                          )}
                          {item.receiptNumber && (
                            <div className="text-xs text-gray-500 mb-2">
                              ژمارەی پسوڵە: <span className="font-bold">{item.receiptNumber}</span>
                            </div>
                          )}
                          {item.items && item.items.length > 0 && (
                            <div className="mt-2 text-sm border-t border-gray-100 pt-2">
                              <p className="font-bold text-gray-700 mb-1">کاڵاکان:</p>
                              <ul className="list-disc list-inside text-gray-600 space-y-1">
                                {item.items.map((cartItem: any, idx: number) => (
                                  <li key={idx}>
                                    {cartItem.name} - {cartItem.quantity} {cartItem.isWholesale ? 'کارتۆن' : 'دانە'}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!debtToDelete}
        onClose={() => setDebtToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی قەرز"
        message={`دڵنیایت لە سڕینەوەی تەواوی قەرزەکانی "${debtToDelete?.customerName}"؟ ئەم کردارە پاشگەزبوونەوەی نییە و هەموو مێژووی مامەڵەکانی ئەم کەسە دەسڕێتەوە.`}
      />

      {/* Hidden Print Component */}
      <div className="hidden">
        {selectedDebt && (
          <div ref={printRef} className="p-8 bg-white text-black font-sans w-full max-w-4xl mx-auto" dir="rtl" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            {/* Print Header */}
            <div className="flex justify-between items-start border-b-2 border-gray-800 pb-6 mb-6">
              <div>
                <h1 className="text-3xl font-bold mb-2">{settings.shopName || 'ناوی دوکان'}</h1>
                <p className="text-gray-600">کەشفی حسابی کڕیار</p>
              </div>
              <div className="text-left">
                <p className="font-bold text-lg">{selectedDebt.customerName}</p>
                <p className="text-gray-600" dir="ltr">{selectedDebt.phone || '-'}</p>
                <p className="text-gray-600 mt-2">بەروار: {new Date().toLocaleDateString('ku-IQ')}</p>
              </div>
            </div>

            {/* Print Summary Cards */}
            <div className="flex gap-4 mb-8">
              <div className="flex-1 bg-gray-50 p-4 rounded-lg border border-gray-200 text-center">
                <p className="text-sm text-gray-500 mb-1">کۆی گشتی قەرز</p>
                <p className="text-xl font-bold">{selectedDebt.totalAmount.toLocaleString()} IQD</p>
              </div>
              <div className="flex-1 bg-green-50 p-4 rounded-lg border border-green-200 text-center">
                <p className="text-sm text-green-600 mb-1">کۆی پارەی دراو</p>
                <p className="text-xl font-bold text-green-700">{selectedDebt.paidAmount.toLocaleString()} IQD</p>
              </div>
              <div className="flex-1 bg-red-50 p-4 rounded-lg border border-red-200 text-center">
                <p className="text-sm text-red-600 mb-1">قەرزی ماوە</p>
                <p className="text-xl font-bold text-red-700">{selectedDebt.remainingAmount.toLocaleString()} IQD</p>
              </div>
            </div>

            {/* Print History Table */}
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-100 border-b-2 border-gray-300">
                  <th className="py-3 px-4 font-bold text-gray-700">بەروار</th>
                  <th className="py-3 px-4 font-bold text-gray-700">جۆر</th>
                  <th className="py-3 px-4 font-bold text-gray-700">وردەکاری</th>
                  <th className="py-3 px-4 font-bold text-gray-700 text-left">بڕ (IQD)</th>
                </tr>
              </thead>
              <tbody>
                {getCombinedHistory(selectedDebt).map((item: any, index: number) => (
                  <React.Fragment key={index}>
                    <tr className="border-b border-gray-200">
                      <td className="py-3 px-4 text-gray-600" dir="ltr">{new Date(item.date).toLocaleString('en-GB')}</td>
                      <td className="py-3 px-4 font-bold">
                        {item.type === 'purchase' ? <span className="text-red-600">کڕین (قەرز)</span> : <span className="text-green-600">پێدانی پارە</span>}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {item.note || '-'}
                        {item.receiptNumber && <span className="text-xs bg-gray-100 px-2 py-1 rounded ml-2">وەسڵی #{item.receiptNumber}</span>}
                      </td>
                      <td className={`py-3 px-4 font-bold text-left ${item.type === 'purchase' ? 'text-red-600' : 'text-green-600'}`}>
                        {item.type === 'purchase' ? '+' : '-'}{item.amount.toLocaleString()}
                      </td>
                    </tr>
                    {item.type === 'purchase' && item.items && item.items.length > 0 && (
                      <tr className="bg-gray-50/50 border-b border-gray-200">
                        <td colSpan={4} className="py-2 px-8">
                          <div className="text-sm text-gray-500 mb-1 font-bold">کاڵاکانی ئەم وەسڵە:</div>
                          <ul className="list-disc list-inside text-sm text-gray-600 grid grid-cols-2 gap-1">
                            {item.items.map((cartItem: any, i: number) => (
                              <li key={i}>
                                {cartItem.name} - {cartItem.quantity} {cartItem.isWholesale ? 'کارتۆن' : 'دانە'} 
                                ({(cartItem.price * cartItem.quantity).toLocaleString()} IQD)
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
            
            <div className="mt-12 pt-8 border-t border-gray-200 flex justify-between text-gray-500 text-sm">
              <p>دەرکراوە لەلایەن سیستەمی فرۆشیاری</p>
              <p>بەرواری دەرکردن: {new Date().toLocaleString('ku-IQ')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
