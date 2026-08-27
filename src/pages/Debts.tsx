import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Plus, Search, DollarSign, History, X, TrendingUp, TrendingDown, Users, Edit, Trash2, PlusCircle, Printer, AlertCircle, FileText, Download, MessageCircle, ArrowUpDown, FileSpreadsheet, CheckCircle, Eye, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useReactToPrint } from 'react-to-print';
import { KashfHisabA4 } from '../components/receipts/KashfHisabA4';
import { GeneralDebtsReportA4 } from '../components/receipts/GeneralDebtsReportA4';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { cacheManager } from '../lib/cache';

export default function Debts() {
  const { userData, setShowFirebaseSetup } = useAuth();
  const isAdmin = userData?.role === 'admin' || userData?.email === 'nabaz@hookah.com' || userData?.email === 'kurdb234@gmail.com';
  
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

  // Kashf Hisab Individual Modal
  const [isKashfModalOpen, setIsKashfModalOpen] = useState(false);
  const [kashfDebt, setKashfDebt] = useState<any>(null);

  // General Debts Report A4 Modal
  const [isGeneralReportModalOpen, setIsGeneralReportModalOpen] = useState(false);
  const [generalReportFilter, setGeneralReportFilter] = useState<'all' | 'unpaid' | 'paid'>('unpaid');

  // Admin Debt Adjustment States
  const [isAdminAdjusting, setIsAdminAdjusting] = useState(false);
  const [adminAdjustmentType, setAdminAdjustmentType] = useState<'add' | 'subtract' | 'set'>('add');
  const [adminAmount, setAdminAmount] = useState<number>(0);
  const [adminNote, setAdminNote] = useState<string>('');

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

  // Individual Kashf Hisab Print Ref
  const kashfPrintRef = useRef<HTMLDivElement>(null);
  const handlePrintKashf = useReactToPrint({
    contentRef: kashfPrintRef,
    documentTitle: `کەشفی_حسابی_${kashfDebt?.customerName || selectedDebt?.customerName || 'کڕیار'}`,
  });

  // General All-Customers Debts Report Print Ref
  const generalReportPrintRef = useRef<HTMLDivElement>(null);
  const handlePrintGeneralReport = useReactToPrint({
    contentRef: generalReportPrintRef,
    documentTitle: `کەشفی_حسابی_گشتی_قەرزەکان_${new Date().toLocaleDateString('en-GB')}`,
  });

  // Payment receipts (Small 80mm & A4)
  const smallReceiptRef = useRef<HTMLDivElement>(null);
  const a4ReceiptRef = useRef<HTMLDivElement>(null);
  const [paymentReceiptData, setPaymentReceiptData] = useState<any>(null);
  const [isPaymentSuccessModalOpen, setIsPaymentSuccessModalOpen] = useState(false);

  const closePaymentSuccessModal = () => {
    setIsPaymentSuccessModalOpen(false);
    setPaymentReceiptData(null);
  };

  const handlePrintSmall = useReactToPrint({
    contentRef: smallReceiptRef,
    documentTitle: 'وەسڵی_پێدانی_قەرز_80mm',
    onAfterPrint: closePaymentSuccessModal
  });

  const handlePrintA4 = useReactToPrint({
    contentRef: a4ReceiptRef,
    documentTitle: 'وەسڵی_پێدانی_قەرز_A4',
    onAfterPrint: closePaymentSuccessModal
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

    const cachedDebts = cacheManager.getDebts();
    if (cachedDebts && cachedDebts.length > 0) {
      setDebts(cachedDebts);
      setLoading(false);
    } else {
      setLoading(true);
    }

    const q = query(collection(db, 'debts'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (querySnapshot) => {
      const updated = cacheManager.applyDebtSnapshotChanges(querySnapshot);
      setDebts(updated);
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

      const receiptD = {
         customerName: selectedDebt.customerName,
         phone: selectedDebt.phone,
         paidAmount: paymentAmount,
         remainingAmount: newRemainingAmount,
         totalAmount: selectedDebt.totalAmount,
         date: new Date().toISOString(),
         note: paymentNote || 'پێدانی بەشێک لە قەرز'
      };
      
      setPaymentReceiptData(receiptD);
      setIsPaymentSuccessModalOpen(true);

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

  const handleAdminDebtAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebt || !isAdmin || adminAmount <= 0) return;
    setLoading(true);
    try {
      let newTotal = selectedDebt.totalAmount || 0;
      let newPaid = selectedDebt.paidAmount || 0;

      if (adminAdjustmentType === 'add') {
        newTotal += adminAmount;
      } else if (adminAdjustmentType === 'subtract') {
        newTotal = Math.max(0, newTotal - adminAmount);
      } else if (adminAdjustmentType === 'set') {
        newTotal = adminAmount;
      }

      const newRemaining = Math.max(0, newTotal - newPaid);
      const newStatus = newRemaining <= 0 ? 'paid' : 'unpaid';

      const adjustmentRecord = {
        amount: adminAmount,
        date: new Date().toISOString(),
        note: `دەستکاری تایبەتی ئەدمین (${adminAdjustmentType === 'add' ? 'زیادکردن' : adminAdjustmentType === 'subtract' ? 'کەمکردنەوە' : 'ڕێکخستنی نوێ'})${adminNote ? ': ' + adminNote : ''}`,
        byAdmin: true
      };

      const updatedPurchases = [...(selectedDebt.purchases || []), adjustmentRecord];

      await updateDoc(doc(db, 'debts', selectedDebt.id), {
        totalAmount: newTotal,
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus,
        purchases: updatedPurchases,
        updatedAt: serverTimestamp()
      });

      setSelectedDebt((prev: any) => ({
        ...prev,
        totalAmount: newTotal,
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus,
        purchases: updatedPurchases
      }));

      setIsAdminAdjusting(false);
      setAdminAmount(0);
      setAdminNote('');
    } catch (error: any) {
      console.error("Error modifying debt as admin:", error);
      alert("هەڵەیەک ڕوویدا لە دەستکاریکردنی قەرزدا");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteHistoryEntry = async (entryToDelete: any) => {
    if (!selectedDebt || !isAdmin) return;
    if (!window.confirm("دڵنیایت لە سڕینەوەی ئەم مامەڵەیە لە مێژوودا؟")) return;

    try {
      let newPurchases = selectedDebt.purchases || [];
      let newPayments = selectedDebt.payments || [];

      if (entryToDelete.type === 'purchase') {
        newPurchases = newPurchases.filter((p: any) => !(p.date === entryToDelete.date && p.amount === entryToDelete.amount));
      } else if (entryToDelete.type === 'payment') {
        newPayments = newPayments.filter((p: any) => !(p.date === entryToDelete.date && p.amount === entryToDelete.amount));
      }

      const newTotal = newPurchases.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const newPaid = newPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0);
      const newRemaining = Math.max(0, newTotal - newPaid);
      const newStatus = newRemaining <= 0 ? 'paid' : 'unpaid';

      await updateDoc(doc(db, 'debts', selectedDebt.id), {
        purchases: newPurchases,
        payments: newPayments,
        totalAmount: newTotal,
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus,
        updatedAt: serverTimestamp()
      });

      setSelectedDebt((prev: any) => ({
        ...prev,
        purchases: newPurchases,
        payments: newPayments,
        totalAmount: newTotal,
        paidAmount: newPaid,
        remainingAmount: newRemaining,
        status: newStatus
      }));
    } catch (err) {
      console.error("Error deleting history entry:", err);
      alert("سڕینەوەی مامەڵەکە سەرکەوتوو نەبوو");
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
    const matchesSearch = (d.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || (d.phone || '').includes(searchTerm);
    const matchesStatus = filterStatus === 'all' ? true : d.status === filterStatus;
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    const aTime = a.updatedAt?.seconds || a.createdAt?.seconds || 0;
    const bTime = b.updatedAt?.seconds || b.createdAt?.seconds || 0;
    if (sortBy === 'newest') return bTime - aTime;
    if (sortBy === 'oldest') return aTime - bTime;
    if (sortBy === 'highest') return (b.remainingAmount || 0) - (a.remainingAmount || 0);
    if (sortBy === 'lowest') return (a.remainingAmount || 0) - (b.remainingAmount || 0);
    return 0;
  });

  const generalReportDebts = debts.filter(d => {
    if (generalReportFilter === 'unpaid') return (d.remainingAmount || 0) > 0;
    if (generalReportFilter === 'paid') return (d.remainingAmount || 0) <= 0;
    return true;
  });

  const exportToCSV = () => {
    const headers = ['ناوی کڕیار', 'ژمارەی مۆبایل', 'قەرزی کۆن', 'قەرزی نوێ', 'پارەی دراو', 'قەرزی ماوە', 'دۆخ', 'تێبینی'];
    const csvData = filteredAndSortedDebts.map(d => {
      const oldDebt = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : d.totalAmount;
      const newDebt = (d.totalAmount || 0) - oldDebt;
      return [
        d.customerName,
        d.phone || '',
        oldDebt,
        newDebt,
        d.paidAmount || 0,
        d.remainingAmount || 0,
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

    const shopName = settings.shopName || 'فرۆشگا';
    const message = `سڵاو بەڕێز ${debt.customerName}،\nئاگادارتان دەکەینەوە لە ${shopName}:\nکۆی قەرز: ${(debt.totalAmount || 0).toLocaleString()} IQD\nبڕی دراو: ${(debt.paidAmount || 0).toLocaleString()} IQD\nقەرزی ماوە: ${(debt.remainingAmount || 0).toLocaleString()} IQD\nسوپاس بۆ هاوکاریتان.`;
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getCombinedHistory = (debt: any) => {
    if (!debt) return [];
    const payments = (debt.payments || []).map((p: any) => ({ ...p, type: 'payment' }));
    const purchases = (debt.purchases || []).map((p: any, index: number) => ({ ...p, type: 'purchase', isFirst: index === 0 }));
    return [...payments, ...purchases].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const exportCustomerHistoryToExcel = async (debtTarget = selectedDebt) => {
    if (!debtTarget) return;

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('کەشفی حساب');

    worksheet.views = [{ rightToLeft: true }];

    worksheet.mergeCells('A1:E1');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${settings.shopName || 'فرۆشگا'} - کەشفی حسابی کڕیار`;
    titleCell.font = { name: 'Tahoma', size: 16, bold: true };
    titleCell.alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:E2');
    const subTitleCell = worksheet.getCell('A2');
    subTitleCell.value = `کڕیار: ${debtTarget.customerName} | مۆبایل: ${debtTarget.phone || '-'} | بەروار: ${new Date().toLocaleDateString('ku-IQ')}`;
    subTitleCell.font = { name: 'Tahoma', size: 11 };
    subTitleCell.alignment = { horizontal: 'center' };

    worksheet.addRow([]);

    worksheet.getCell('A4').value = 'کۆی گشتی کڕینەکان:';
    worksheet.getCell('B4').value = debtTarget.totalAmount || 0;
    worksheet.getCell('B4').numFmt = '#,##0';
    worksheet.getCell('B4').font = { bold: true };

    worksheet.getCell('D4').value = 'کۆی واسڵکراو:';
    worksheet.getCell('E4').value = debtTarget.paidAmount || 0;
    worksheet.getCell('E4').numFmt = '#,##0';
    worksheet.getCell('E4').font = { bold: true, color: { argb: 'FF059669' } };

    worksheet.getCell('A5').value = 'قەرزی ماوە (باڵانس):';
    worksheet.getCell('B5').value = debtTarget.remainingAmount || 0;
    worksheet.getCell('B5').numFmt = '#,##0';
    worksheet.getCell('B5').font = { bold: true, color: { argb: 'FFDC2626' } };

    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['بەروار و کات', 'جۆری جوڵە', 'ڕوونکردنەوە', 'بڕی پارە (IQD)', 'کاڵاکان']);
    headerRow.font = { name: 'Tahoma', size: 11, bold: true };
    headerRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.border = {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    worksheet.getColumn(1).width = 22;
    worksheet.getColumn(2).width = 16;
    worksheet.getColumn(3).width = 32;
    worksheet.getColumn(4).width = 20;
    worksheet.getColumn(5).width = 45;

    const history = getCombinedHistory(debtTarget);
    history.forEach(item => {
      const date = new Date(item.date).toLocaleString('en-GB');
      const type = item.type === 'purchase' ? 'کڕین (قەرز)' : 'واسلکردنی پارە';
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
    saveAs(blob, `کەشفی_حساب_${debtTarget.customerName}_${new Date().toLocaleDateString('en-GB')}.xlsx`);
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

  // Open Kashf Hisab Modal for a customer
  const handleOpenKashfModal = (debt: any) => {
    setKashfDebt(debt);
    setSelectedDebt(debt);
    setIsKashfModalOpen(true);
  };

  // Calculate Stats
  const totalOldDebt = debts.reduce((sum, d) => {
    const old = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : (d.totalAmount || 0);
    return sum + old;
  }, 0);
  const totalNewDebt = debts.reduce((sum, d) => {
    const old = d.purchases && d.purchases.length > 0 ? d.purchases[0].amount : (d.totalAmount || 0);
    return sum + ((d.totalAmount || 0) - old);
  }, 0);
  const totalPaidAmount = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
  const totalRemainingAmount = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
  const activeDebtorsCount = debts.filter(d => (d.remainingAmount || 0) > 0).length;

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4 bg-white p-5 rounded-2xl border border-gray-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
              <FileText size={22} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-gray-900 tracking-tight">دەفتەری قەرز و کەشفی حسابات</h1>
              <p className="text-xs text-gray-500 font-medium">بەڕێوەبردنی قەرزەکان، واسڵکردنی پارە، و چاپکردنی کەشفی حسابی A4 بە شێوازی پرۆفیشناڵ</p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full xl:w-auto">
          {/* General A4 Statement Report Button */}
          <button
            onClick={() => setIsGeneralReportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all shadow-xs font-bold text-sm"
            title="چاپکردنی کەشفی حسابی گشتی بۆ سەرجەم قەرزارەکان بە شێوازی A4"
          >
            <Printer size={18} className="text-indigo-300" />
            <span>کەشفی حسابی گشتی (A4)</span>
          </button>

          {/* Export Excel Button */}
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all shadow-2xs font-bold text-sm"
          >
            <Download size={18} className="text-emerald-600" />
            <span>هەناردەی ئێکسڵ</span>
          </button>

          {/* Add New Debt */}
          <button
            onClick={() => setIsNewDebtModalOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-xs font-bold text-sm"
          >
            <Plus size={18} />
            <span>تۆمارکردنی قەرزی نوێ</span>
          </button>
        </div>
      </div>

      {/* Stats Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-white p-4 rounded-2xl shadow-2xs border border-gray-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center shrink-0 border border-blue-100">
              <FileText size={16} />
            </div>
            <p className="text-xs font-bold text-gray-500">قەرزی کۆن</p>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">{totalOldDebt.toLocaleString()} <span className="text-[11px] font-normal text-gray-500">IQD</span></p>
        </motion.div>
        
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-white p-4 rounded-2xl shadow-2xs border border-gray-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center shrink-0 border border-amber-100">
              <PlusCircle size={16} />
            </div>
            <p className="text-xs font-bold text-gray-500">قەرزی نوێ</p>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">{totalNewDebt.toLocaleString()} <span className="text-[11px] font-normal text-gray-500">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-white p-4 rounded-2xl shadow-2xs border border-gray-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center shrink-0 border border-emerald-100">
              <TrendingUp size={16} />
            </div>
            <p className="text-xs font-bold text-gray-500">پارەی وەرگیراو</p>
          </div>
          <p className="text-lg font-black text-emerald-800 font-mono">{totalPaidAmount.toLocaleString()} <span className="text-[11px] font-normal text-emerald-600">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="bg-rose-50/70 p-4 rounded-2xl shadow-2xs border border-rose-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-rose-100 text-rose-700 rounded-lg flex items-center justify-center shrink-0 border border-rose-200">
              <TrendingDown size={16} />
            </div>
            <p className="text-xs font-black text-rose-900">کۆی قەرزی ماوە</p>
          </div>
          <p className="text-lg font-black text-rose-950 font-mono">{totalRemainingAmount.toLocaleString()} <span className="text-[11px] font-bold text-rose-700">IQD</span></p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="bg-white p-4 rounded-2xl shadow-2xs border border-gray-200">
          <div className="flex items-center gap-2.5 mb-2">
            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-lg flex items-center justify-center shrink-0 border border-purple-100">
              <Users size={16} />
            </div>
            <p className="text-xs font-bold text-gray-500">قەرزارە چالاکەکان</p>
          </div>
          <p className="text-lg font-black text-gray-900 font-mono">{activeDebtorsCount} <span className="text-[11px] font-normal text-gray-500">کەس</span></p>
        </motion.div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white rounded-2xl shadow-2xs border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col lg:flex-row justify-between items-center gap-4 bg-gray-50/50">
          <div className="relative w-full lg:w-96">
            <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="گەڕان بەپێی ناوی کڕیار یان ژمارە مۆبایل..."
              className="w-full pl-4 pr-10 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm font-medium transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex flex-wrap sm:flex-nowrap w-full lg:w-auto gap-3 items-center">
            <div className="relative w-full sm:w-48">
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                <ArrowUpDown size={16} />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full pl-4 pr-9 py-2 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all appearance-none text-xs font-bold text-gray-700"
              >
                <option value="newest">نوێترین بەروار</option>
                <option value="oldest">کۆنترین بەروار</option>
                <option value="highest">زۆرترین قەرز</option>
                <option value="lowest">کەمترین قەرز</option>
              </select>
            </div>

            <div className="flex bg-gray-200/70 p-1 rounded-xl w-full sm:w-auto">
              <button
                onClick={() => setFilterStatus('all')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'all' ? 'bg-white text-gray-950 shadow-2xs' : 'text-gray-600 hover:text-gray-950'}`}
              >
                هەمووی ({debts.length})
              </button>
              <button
                onClick={() => setFilterStatus('unpaid')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'unpaid' ? 'bg-white text-rose-700 shadow-2xs' : 'text-gray-600 hover:text-gray-950'}`}
              >
                قەرزارەکان ({debts.filter(d => (d.remainingAmount || 0) > 0).length})
              </button>
              <button
                onClick={() => setFilterStatus('paid')}
                className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${filterStatus === 'paid' ? 'bg-white text-emerald-800 shadow-2xs' : 'text-gray-600 hover:text-gray-950'}`}
              >
                پاکتاوکراو ({debts.filter(d => (d.remainingAmount || 0) <= 0).length})
              </button>
            </div>
          </div>
        </div>

        {/* Debts Table with ALWAYS VISIBLE Action Buttons */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-900 text-white font-bold text-xs">
              <tr>
                <th className="px-5 py-3.5">ناوی کڕیار</th>
                <th className="px-4 py-3.5">مۆبایل</th>
                <th className="px-4 py-3.5">قەرزی کۆن</th>
                <th className="px-4 py-3.5">قەرزی نوێ</th>
                <th className="px-4 py-3.5">پارەی دراو</th>
                <th className="px-4 py-3.5">قەرزی ماوە</th>
                <th className="px-4 py-3.5 text-center">دۆخ</th>
                <th className="px-5 py-3.5 text-center min-w-[340px]">کردارەکان (کەشفی حساب و پارەدان)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-indigo-500 border-t-transparent"></div>
                    <p className="mt-2 text-gray-500 font-medium text-xs">بارکردنی زانیارییەکان...</p>
                  </td>
                </tr>
              ) : filteredAndSortedDebts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <AlertCircle className="text-gray-400" size={28} />
                    </div>
                    <p className="text-gray-600 font-bold">هیچ تۆمارێکی قەرز نەدۆزرایەوە</p>
                    <p className="text-xs text-gray-400 mt-1">دەتوانیت لە ڕێگەی دوگمەی سەرەوە قەرزی نوێ زیاد بکەیت</p>
                  </td>
                </tr>
              ) : (
                filteredAndSortedDebts.map((debt, index) => {
                  const oldDebt = debt.purchases && debt.purchases.length > 0 ? debt.purchases[0].amount : (debt.totalAmount || 0);
                  const newDebt = (debt.totalAmount || 0) - oldDebt;
                  const progress = (debt.totalAmount || 0) > 0 ? Math.min(100, Math.round(((debt.paidAmount || 0) / (debt.totalAmount || 1)) * 100)) : 0;
                  const isPaid = (debt.remainingAmount || 0) <= 0;

                  return (
                    <motion.tr 
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(index * 0.03, 0.3) }}
                      key={debt.id} 
                      className="hover:bg-indigo-50/30 transition-colors"
                    >
                      {/* Customer Name */}
                      <td className="px-5 py-3.5">
                        <div className="font-black text-gray-950 text-sm">{debt.customerName}</div>
                        {debt.note && <div className="text-[11px] text-gray-500 mt-0.5 truncate max-w-[160px]">{debt.note}</div>}
                      </td>

                      {/* Phone */}
                      <td className="px-4 py-3.5 text-gray-700 font-mono text-xs font-bold" dir="ltr">
                        {debt.phone || '-'}
                      </td>

                      {/* Old Debt */}
                      <td className="px-4 py-3.5 font-bold font-mono text-gray-700 text-xs">
                        {Math.round(oldDebt).toLocaleString()}
                      </td>

                      {/* New Debt */}
                      <td className="px-4 py-3.5 font-bold font-mono text-amber-700 text-xs">
                        {newDebt > 0 ? '+' + Math.round(newDebt).toLocaleString() : '0'}
                      </td>

                      {/* Paid Amount & Progress Bar */}
                      <td className="px-4 py-3.5">
                        <div className="flex flex-col gap-1">
                          <span className="text-emerald-800 font-black font-mono text-xs">
                            {Math.round(debt.paidAmount || 0).toLocaleString()}
                          </span>
                          <div className="w-full bg-gray-200 rounded-full h-1.5 max-w-[70px]">
                            <div className="bg-emerald-600 h-1.5 rounded-full" style={{ width: `${progress}%` }}></div>
                          </div>
                        </div>
                      </td>

                      {/* Remaining Amount */}
                      <td className={`px-4 py-3.5 font-black font-mono text-sm ${isPaid ? 'text-gray-400' : 'text-rose-900 bg-rose-50/50'}`}>
                        {Math.round(debt.remainingAmount || 0).toLocaleString()} <span className="text-[10px] font-normal text-gray-500">IQD</span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-[10px] font-black border ${
                            isPaid 
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                              : 'bg-rose-100 text-rose-950 border-rose-300'
                          }`}>
                            {isPaid ? 'پاکتاوکراو' : 'قەرزار'}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">
                            {getDaysAgo(debt.updatedAt || debt.createdAt)}
                          </span>
                        </div>
                      </td>

                      {/* ALWAYS VISIBLE ACTION BUTTONS ON SCREEN */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-center gap-1.5 flex-wrap">
                          {/* 1. KASHF HISAB A4 (Preview & Print) */}
                          <button
                            onClick={() => handleOpenKashfModal(debt)}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                            title="پیشاندانی کەشفی حسابی A4 و چاپکردنی"
                          >
                            <FileText size={14} className="text-blue-600" />
                            <span>کەشف A4</span>
                          </button>

                          {/* 2. RECEIVE PAYMENT (واسڵکردن) */}
                          <button
                            onClick={() => {
                              setSelectedDebt(debt);
                              setIsPaymentModalOpen(true);
                            }}
                            disabled={isPaid}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                            title="وەرگرتنی پارە (واسڵکردن)"
                          >
                            <DollarSign size={14} className="text-emerald-600" />
                            <span>واسڵکردن</span>
                          </button>

                          {/* 3. ADD DEBT PURCHASE (قەرزی نوێ) */}
                          <button
                            onClick={() => {
                              setSelectedDebt(debt);
                              setIsAddPurchaseModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 rounded-lg text-xs font-bold transition-all shadow-2xs"
                            title="زیادکردنی قەرزی نوێ"
                          >
                            <PlusCircle size={14} className="text-amber-600" />
                            <span>+ قەرز</span>
                          </button>

                          {/* 4. HISTORY (مێژوو) */}
                          <button
                            onClick={() => {
                              setSelectedDebt(debt);
                              setIsHistoryModalOpen(true);
                            }}
                            className="p-1.5 bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all shadow-2xs"
                            title="مێژووی تەواوی مامەڵەکان"
                          >
                            <History size={15} />
                          </button>

                          {/* 5. WHATSAPP (وەتسئەپ) */}
                          <button
                            onClick={() => sendWhatsApp(debt)}
                            disabled={!debt.phone}
                            className="p-1.5 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-2xs"
                            title="ئاگادارکردنەوە لە ڕێگەی وەتسئەپ"
                          >
                            <MessageCircle size={15} />
                          </button>

                          {/* 6. EDIT (دەستکاری) */}
                          <button
                            onClick={() => {
                              setSelectedDebt(debt);
                              setEditData({ customerName: debt.customerName, phone: debt.phone || '', note: debt.note || '' });
                              setIsEditModalOpen(true);
                            }}
                            className="p-1.5 bg-gray-50 text-gray-700 hover:bg-gray-100 border border-gray-300 rounded-lg transition-all shadow-2xs"
                            title="دەستکاریکردنی زانیاری کڕیار"
                          >
                            <Edit size={15} />
                          </button>

                          {/* 7. DELETE (سڕینەوە) */}
                          <button
                            onClick={() => setDebtToDelete(debt)}
                            className="p-1.5 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 rounded-lg transition-all shadow-2xs"
                            title="سڕینەوەی هەژمار"
                          >
                            <Trash2 size={15} />
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

      {/* ========================================================================= */}
      {/* MODAL 1: KASHF HISAB A4 (Single Customer Statement Preview & Print)       */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isKashfModalOpen && kashfDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200"
            >
              {/* Modal Topbar */}
              <div className="p-4 sm:p-5 border-b border-gray-200 flex justify-between items-center bg-slate-900 text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <FileText size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">کەشفی حسابی کڕیار (A4 Statement)</h2>
                    <p className="text-xs text-slate-300 font-medium">کڕیار: <span className="font-bold text-white">{kashfDebt.customerName}</span></p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => exportCustomerHistoryToExcel(kashfDebt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    <FileSpreadsheet size={15} />
                    <span className="hidden sm:inline">ئێکسڵ</span>
                  </button>

                  <button
                    onClick={() => sendWhatsApp(kashfDebt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all"
                  >
                    <MessageCircle size={15} />
                    <span className="hidden sm:inline">وەتسئەپ</span>
                  </button>

                  <button
                    onClick={handlePrintKashf}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs transition-all"
                  >
                    <Printer size={16} />
                    <span>چاپکردنی A4</span>
                  </button>

                  <button 
                    onClick={() => setIsKashfModalOpen(false)} 
                    className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors ml-1"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Live A4 Sheet Preview */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
                <div className="bg-white shadow-xl rounded-xl border border-gray-300 overflow-hidden scale-90 sm:scale-100 origin-top">
                  <KashfHisabA4
                    ref={kashfPrintRef}
                    settings={settings}
                    customerName={kashfDebt.customerName}
                    customerPhone={kashfDebt.phone}
                    totalAmount={kashfDebt.totalAmount || 0}
                    paidAmount={kashfDebt.paidAmount || 0}
                    remainingAmount={kashfDebt.remainingAmount || 0}
                    history={getCombinedHistory(kashfDebt)}
                    statementDate={new Date()}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 2: GENERAL DEBTS STATEMENT (All Customers A4 Statement)             */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isGeneralReportModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden border border-gray-200"
            >
              {/* Topbar */}
              <div className="p-4 sm:p-5 border-b border-gray-200 flex flex-wrap justify-between items-center gap-3 bg-slate-950 text-white shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs">
                    <Printer size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-black tracking-tight">کەشفی حسابی گشتی قەرزەکان (A4 Report)</h2>
                    <p className="text-xs text-slate-300 font-medium">سەرجەم حسابات و باڵانسی کڕیارانی قەرز لە یەک ڕاپۆرتدا</p>
                  </div>
                </div>

                {/* Filter Selector inside Modal */}
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-800 p-1 rounded-xl text-xs">
                    <button
                      onClick={() => setGeneralReportFilter('all')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${generalReportFilter === 'all' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
                    >
                      هەمووی ({debts.length})
                    </button>
                    <button
                      onClick={() => setGeneralReportFilter('unpaid')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${generalReportFilter === 'unpaid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
                    >
                      قەرزارەکان ({debts.filter(d => (d.remainingAmount || 0) > 0).length})
                    </button>
                    <button
                      onClick={() => setGeneralReportFilter('paid')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition-all ${generalReportFilter === 'paid' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-300 hover:text-white'}`}
                    >
                      پاکتاوکراو ({debts.filter(d => (d.remainingAmount || 0) <= 0).length})
                    </button>
                  </div>

                  <button
                    onClick={handlePrintGeneralReport}
                    className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-xs transition-all"
                  >
                    <Printer size={16} />
                    <span>چاپکردنی ڕاپۆرت (A4)</span>
                  </button>

                  <button 
                    onClick={() => setIsGeneralReportModalOpen(false)} 
                    className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-xl transition-colors"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Scrollable Live A4 General Report Preview */}
              <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-slate-100 flex justify-center">
                <div className="bg-white shadow-xl rounded-xl border border-gray-300 overflow-hidden scale-90 sm:scale-100 origin-top">
                  <GeneralDebtsReportA4
                    ref={generalReportPrintRef}
                    settings={settings}
                    debts={generalReportDebts}
                    filterStatus={generalReportFilter}
                    reportDate={new Date()}
                  />
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 3: NEW DEBT MODAL                                                   */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isNewDebtModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-gray-200"
            >
              <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-indigo-50/50">
                <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                  <PlusCircle className="text-indigo-600" />
                  تۆمارکردنی قەرزی نوێ
                </h2>
                <button onClick={() => setIsNewDebtModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-2xs">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleNewDebt} className="p-6 space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">ناوی کڕیار <span className="text-red-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newDebtData.customerName}
                      onChange={(e) => setNewDebtData({...newDebtData, customerName: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white text-sm font-bold"
                      placeholder="ناوی تەواو"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">ژمارەی مۆبایل</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={newDebtData.phone}
                      onChange={(e) => setNewDebtData({...newDebtData, phone: e.target.value})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white text-sm font-bold text-left"
                      placeholder="0750 000 0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">کۆی قەرز (IQD) <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newDebtData.totalAmount || ''}
                      onChange={(e) => setNewDebtData({...newDebtData, totalAmount: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white font-mono font-bold text-red-600 text-base"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1.5">پارەی پێشەکی دراو (IQD)</label>
                    <input
                      type="number"
                      min="0"
                      max={newDebtData.totalAmount}
                      value={newDebtData.paidAmount || ''}
                      onChange={(e) => setNewDebtData({...newDebtData, paidAmount: Number(e.target.value)})}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white font-mono font-bold text-emerald-600 text-base"
                      placeholder="0"
                    />
                  </div>
                </div>
                
                <div className="bg-indigo-50 p-4 rounded-xl flex justify-between items-center border border-indigo-100">
                  <span className="text-indigo-900 font-bold text-sm">قەرزی ماوەی سەرەتا:</span>
                  <span className="text-xl font-black text-indigo-950 font-mono">{(newDebtData.totalAmount - newDebtData.paidAmount).toLocaleString()} IQD</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی</label>
                  <textarea
                    rows={2}
                    value={newDebtData.note}
                    onChange={(e) => setNewDebtData({...newDebtData, note: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50 focus:bg-white text-sm resize-none"
                    placeholder="هەر تێبینییەک دەربارەی ئەم قەرزە..."
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsNewDebtModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 transition-colors text-sm"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || newDebtData.totalAmount <= 0}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs text-sm"
                  >
                    {loading ? 'چاوەڕێبە...' : 'تۆمارکردن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 4: PAYMENT MODAL (Receive Money / واسڵکردن)                        */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
            >
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-emerald-50/50">
                <h2 className="text-xl font-bold text-emerald-900 flex items-center gap-2">
                  <DollarSign className="text-emerald-600" />
                  وەرگرتنی پارەی قەرز (واسڵکردن)
                </h2>
                <button onClick={() => setIsPaymentModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-2xs">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-bold">کڕیار:</span>
                    <span className="font-black text-gray-950 text-sm">{selectedDebt.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600 text-xs font-bold">قەرزی ماوە:</span>
                    <span className="font-black text-rose-900 text-base font-mono">{(selectedDebt.remainingAmount || 0).toLocaleString()} IQD</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">بڕی پارەی واسڵکراو (IQD) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    max={selectedDebt.remainingAmount}
                    value={paymentAmount || ''}
                    onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-emerald-300 rounded-xl focus:ring-2 focus:ring-emerald-500 text-2xl font-black text-emerald-700 text-center bg-emerald-50/30 font-mono"
                    placeholder="0"
                  />
                  <div className="mt-2 flex gap-2">
                    <button type="button" onClick={() => setPaymentAmount(selectedDebt.remainingAmount)} className="text-xs bg-emerald-100 hover:bg-emerald-200 text-emerald-900 px-3 py-1 rounded-lg font-bold transition-colors">هەموو قەرزەکە</button>
                    <button type="button" onClick={() => setPaymentAmount(Math.round(selectedDebt.remainingAmount / 2))} className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded-lg font-bold text-gray-800 transition-colors">نیوەی قەرز</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    value={paymentNote}
                    onChange={(e) => setPaymentNote(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-gray-50 focus:bg-white text-sm"
                    placeholder="بۆ نموونە: پارەی نەقدی درا"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPaymentModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 text-sm"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || paymentAmount <= 0 || paymentAmount > selectedDebt.remainingAmount}
                    className="flex-1 py-2.5 px-4 bg-emerald-600 text-white rounded-xl font-black hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-xs text-sm"
                  >
                    {loading ? 'چاوەڕێبە...' : 'وەرگرتن و چاپکردنی وەسڵ'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 5: ADD PURCHASE MODAL (Increase Debt / + قەرز)                      */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isAddPurchaseModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
            >
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-rose-50/50">
                <h2 className="text-xl font-bold text-rose-900 flex items-center gap-2">
                  <PlusCircle className="text-rose-600" />
                  زیادکردنی قەرزی نوێ
                </h2>
                <button onClick={() => setIsAddPurchaseModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-2xs">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleAddPurchase} className="p-6 space-y-5">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-xs font-bold">کڕیار:</span>
                    <span className="font-black text-gray-950 text-sm">{selectedDebt.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                    <span className="text-gray-600 text-xs font-bold">قەرزی پێشوو:</span>
                    <span className="font-black text-rose-900 text-base font-mono">{(selectedDebt.remainingAmount || 0).toLocaleString()} IQD</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">بڕی قەرزی نوێ (IQD) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={purchaseAmount || ''}
                    onChange={(e) => setPurchaseAmount(Number(e.target.value))}
                    className="w-full px-4 py-3 border border-rose-300 rounded-xl focus:ring-2 focus:ring-rose-500 text-2xl font-black text-rose-700 text-center bg-rose-50/30 font-mono"
                    placeholder="0"
                  />
                </div>
                
                {purchaseAmount > 0 && (
                  <div className="bg-rose-50 p-3.5 rounded-xl flex justify-between items-center border border-rose-200">
                    <span className="text-rose-900 font-bold text-xs">کۆی قەرز دوای ئەمە:</span>
                    <span className="text-base font-black text-rose-950 font-mono">{((selectedDebt.remainingAmount || 0) + purchaseAmount).toLocaleString()} IQD</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی (ئارەزوومەندانە)</label>
                  <input
                    type="text"
                    value={purchaseNote}
                    onChange={(e) => setPurchaseNote(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-rose-500 bg-gray-50 focus:bg-white text-sm"
                    placeholder="بۆ نموونە: کڕینی کاڵای نوێ"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddPurchaseModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 text-sm"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || purchaseAmount <= 0}
                    className="flex-1 py-2.5 px-4 bg-rose-600 text-white rounded-xl font-black hover:bg-rose-700 transition-colors disabled:opacity-50 shadow-xs text-sm"
                  >
                    {loading ? 'چاوەڕێبە...' : 'زیادکردنی قەرز'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 6: EDIT CUSTOMER INFO                                               */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200"
            >
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Edit className="text-gray-600" />
                  دەستکاریکردنی زانیاری کڕیار
                </h2>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-white p-1.5 rounded-full shadow-2xs">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleEdit} className="p-6 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ناوی کڕیار <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    value={editData.customerName}
                    onChange={(e) => setEditData({...editData, customerName: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm font-bold"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">ژمارەی مۆبایل</label>
                  <input
                    type="text"
                    dir="ltr"
                    value={editData.phone}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm font-bold text-left"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1.5">تێبینی</label>
                  <textarea
                    rows={2}
                    value={editData.note}
                    onChange={(e) => setEditData({...editData, note: e.target.value})}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 bg-gray-50 focus:bg-white text-sm resize-none"
                  />
                </div>
                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50 text-sm"
                  >
                    پاشگەزبوونەوە
                  </button>
                  <button
                    type="submit"
                    disabled={loading || !editData.customerName}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 text-white rounded-xl font-black hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs text-sm"
                  >
                    {loading ? 'چاوەڕێبە...' : 'پاشەکەوتکردن'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* MODAL 7: TRANSACTION HISTORY & ADMIN ADJUSTMENTS                         */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isHistoryModalOpen && selectedDebt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] border border-gray-200"
            >
              <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
                <div>
                  <h2 className="text-xl font-black text-gray-900 flex items-center gap-2">
                    <History className="text-indigo-600" />
                    مێژووی مامەڵەکان
                  </h2>
                  <p className="text-xs text-gray-500 mt-1">کڕیار: <span className="font-bold text-gray-800">{selectedDebt.customerName}</span></p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleOpenKashfModal(selectedDebt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 rounded-xl hover:bg-indigo-100 transition-colors text-xs font-bold shadow-2xs"
                  >
                    <FileText size={15} />
                    <span>کەشف A4</span>
                  </button>
                  <button
                    onClick={() => exportCustomerHistoryToExcel(selectedDebt)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl hover:bg-emerald-100 transition-colors text-xs font-bold shadow-2xs"
                  >
                    <FileSpreadsheet size={15} />
                    <span>ئێکسڵ</span>
                  </button>
                  <button
                    onClick={() => setIsHistoryModalOpen(false)}
                    className="p-2 text-gray-400 hover:text-gray-600 bg-white border border-gray-200 rounded-xl transition-colors shadow-2xs"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>
              
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50/50 space-y-6">
                {/* Admin Only Debt Control Box */}
                {isAdmin && (
                  <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 shadow-2xs">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 bg-amber-600 text-white rounded-lg text-[10px] font-black">ئەدمین</span>
                        <h3 className="text-xs font-bold text-amber-900">دەستکاریکردنی تایبەتی بڕی قەرز (تەنیا ئەدمین)</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAdminAdjusting(!isAdminAdjusting)}
                        className="text-xs font-bold text-amber-800 bg-amber-100/80 hover:bg-amber-200 px-3 py-1.5 rounded-lg transition-colors border border-amber-300"
                      >
                        {isAdminAdjusting ? 'داخستن' : 'دەستکاریکردنی قەرز'}
                      </button>
                    </div>

                    {isAdminAdjusting && (
                      <form onSubmit={handleAdminDebtAdjustment} className="mt-3 pt-3 border-t border-amber-200/60 space-y-4">
                        <div className="grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => setAdminAdjustmentType('add')}
                            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                              adminAdjustmentType === 'add'
                                ? 'bg-red-600 text-white shadow-xs'
                                : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                          >
                            <PlusCircle size={14} />
                            زیادکردن (+)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminAdjustmentType('subtract')}
                            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                              adminAdjustmentType === 'subtract'
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                          >
                            <DollarSign size={14} />
                            کەمکردنەوە (-)
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdminAdjustmentType('set')}
                            className={`py-2 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-1 ${
                              adminAdjustmentType === 'set'
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                          >
                            <Edit size={14} />
                            ڕێکخستن (=)
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                              {adminAdjustmentType === 'add' ? 'بڕی زیادکراو (IQD)' : adminAdjustmentType === 'subtract' ? 'بڕی کەمکراوە (IQD)' : 'بڕی نوێ (IQD)'}
                            </label>
                            <input
                              type="number"
                              required
                              min="1"
                              value={adminAmount || ''}
                              onChange={(e) => setAdminAmount(Number(e.target.value))}
                              placeholder="0"
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-bold text-gray-900 text-sm focus:ring-2 focus:ring-amber-500 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">هۆکار / تێبینی</label>
                            <input
                              type="text"
                              value={adminNote}
                              onChange={(e) => setAdminNote(e.target.value)}
                              placeholder="تێبینی دەستکاری ئەدمین..."
                              className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl font-medium text-gray-900 text-sm focus:ring-2 focus:ring-amber-500"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setIsAdminAdjusting(false);
                              setAdminAmount(0);
                              setAdminNote('');
                            }}
                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-xl font-bold text-xs hover:bg-gray-50"
                          >
                            پاشگەزبوونەوە
                          </button>
                          <button
                            type="submit"
                            disabled={loading || adminAmount <= 0}
                            className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold text-xs shadow-xs transition-all disabled:opacity-50"
                          >
                            {loading ? 'چاوەڕێبە...' : 'جێبەجێکردن'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Timeline movements */}
                <div className="space-y-3">
                  {getCombinedHistory(selectedDebt).length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-gray-200">
                      <History className="mx-auto text-gray-300 mb-2" size={30} />
                      <p className="text-gray-500 font-bold text-xs">هیچ مامەڵەیەک تۆمار نەکراوە</p>
                    </div>
                  ) : (
                    getCombinedHistory(selectedDebt).map((item: any, index: number) => (
                      <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 shadow-2xs flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs ${item.type === 'purchase' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800'}`}>
                            {item.type === 'purchase' ? <TrendingUp size={18} /> : <TrendingDown size={18} />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-black ${item.type === 'purchase' ? 'text-rose-900' : 'text-emerald-900'}`}>
                                {item.type === 'purchase' ? (item.isFirst ? 'قەرزی سەرەتا' : 'کڕین (قەرز)') : 'واسلکردنی پارە'}
                              </span>
                              {item.receiptNumber && (
                                <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded font-mono font-bold">
                                  #{item.receiptNumber}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-gray-500 mt-0.5 font-mono" dir="ltr">
                              {new Date(item.date).toLocaleString('ku-IQ')}
                            </p>
                            {item.note && <p className="text-xs text-gray-700 mt-1 font-medium">{item.note}</p>}
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100">
                          <div className={`text-base font-black font-mono ${item.type === 'purchase' ? 'text-rose-900' : 'text-emerald-900'}`}>
                            {item.type === 'purchase' ? '+' : '-'}{Math.round(item.amount).toLocaleString()} IQD
                          </div>
                          {isAdmin && (
                            <button
                              type="button"
                              onClick={() => handleDeleteHistoryEntry(item)}
                              className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                              title="سڕینەوەی ئەم تۆمارە"
                            >
                              <Trash2 size={15} />
                            </button>
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

      {/* ========================================================================= */}
      {/* MODAL 8: PAYMENT SUCCESS MODAL (Choose 80mm POS or A4 Voucher)            */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isPaymentSuccessModalOpen && paymentReceiptData && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative border border-gray-200"
            >
              <div className="bg-emerald-600 p-6 text-white text-center">
                <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle size={30} className="text-white" />
                </div>
                <h2 className="text-xl font-black text-white tracking-tight mb-1">پارەدان سەرکەوتووانە تۆمارکرا</h2>
                <div className="text-emerald-100 font-bold font-mono">بڕی دراو: {Math.round(paymentReceiptData.paidAmount).toLocaleString()} IQD</div>
              </div>
              
              <div className="p-6 space-y-3">
                <p className="text-xs font-bold text-gray-500 text-center mb-2">دەتوانیت پسوڵەی واسڵکردنی پارە بە قەبارەی خوازراو چاپ بکەیت:</p>
                <button onClick={handlePrintSmall} className="w-full py-3 bg-emerald-50 text-emerald-800 rounded-xl font-black text-sm hover:bg-emerald-100 transition-colors border border-emerald-200 shadow-2xs flex items-center justify-center gap-2">
                  <Printer size={18} />
                  چاپکردنی وەسڵی خێرا (80mm POS)
                </button>
                <button onClick={handlePrintA4} className="w-full py-3 bg-indigo-50 text-indigo-800 rounded-xl font-black text-sm hover:bg-indigo-100 transition-colors border border-indigo-200 shadow-2xs flex items-center justify-center gap-2">
                  <Printer size={18} />
                  چاپکردنی وەسڵی فەرمی (A4 Voucher)
                </button>
                <button
                  onClick={closePaymentSuccessModal}
                  className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-bold hover:bg-gray-200 transition-colors text-xs mt-2"
                >
                  داخستن
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <ConfirmationModal
        isOpen={!!debtToDelete}
        onClose={() => setDebtToDelete(null)}
        onConfirm={confirmDelete}
        title="سڕینەوەی هەژماری قەرز"
        message={`دڵنیایت لە سڕینەوەی تەواوی قەرزەکانی "${debtToDelete?.customerName}"؟ ئەم کردارە پاشگەزبوونەوەی نییە و هەموو مێژووی مامەڵەکانی ئەم کڕیارە دەسڕێتەوە.`}
      />

      {/* Hidden Print Components for Payment Receipts */}
      <div className="hidden">
        {paymentReceiptData && (
          <div ref={smallReceiptRef} className="p-4 w-80 text-center font-sans mx-auto bg-white text-black" dir="rtl">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Shop Logo"
                className="w-12 h-12 mx-auto mb-1.5 object-contain rounded-full border border-gray-300"
              />
            ) : (
              <div className="w-10 h-10 mx-auto mb-1 rounded-2xl bg-gray-950 text-white flex items-center justify-center font-black text-lg shadow-sm">
                {(settings.shopName || 'M')[0]?.toUpperCase()}
              </div>
            )}
            <h1 className="text-2xl font-black mb-1">{settings.shopName || 'فرۆشگا'}</h1>
            {settings.address && <p className="text-xs text-gray-600 mb-1">{settings.address}</p>}
            {settings.phone && <p className="text-xs text-gray-800 font-mono font-bold mb-2" dir="ltr">{settings.phone}</p>}
            <p className="text-xs text-gray-500 mb-3">{new Date(paymentReceiptData.date).toLocaleString('ku-IQ')}</p>
            
            <div className="border border-gray-300 rounded-xl p-2.5 mb-3 text-xs text-right bg-gray-50">
              <p className="font-black text-gray-950 mb-0.5">کڕیار: {paymentReceiptData.customerName}</p>
              {paymentReceiptData.phone && (
                <p className="text-gray-600 font-mono" dir="ltr">{paymentReceiptData.phone}</p>
              )}
            </div>

            <div className="border-t border-b border-gray-300 py-2.5 mb-3 text-xs text-right">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-gray-600 font-bold">بڕی پارەی دراو:</span>
                <span className="font-black font-mono text-sm text-emerald-800">{Math.round(paymentReceiptData.paidAmount).toLocaleString()} IQD</span>
              </div>
              <div className="flex justify-between items-center text-sm font-black pt-1.5 border-t border-gray-200">
                <span className="text-gray-800">قەرزی ماوە:</span>
                <span className="text-rose-800 font-mono">{Math.round(paymentReceiptData.remainingAmount).toLocaleString()} IQD</span>
              </div>
            </div>

            {paymentReceiptData.note && (
              <p className="text-xs border border-gray-200 p-2 rounded-lg bg-gray-50 mb-3 text-right">تێبینی: {paymentReceiptData.note}</p>
            )}

            <div className="mt-4 mb-1">
              <p className="text-xs text-gray-600 font-bold mb-0.5">سوپاس بۆ پارەدانەکەتان</p>
              <p className="text-[10px] text-gray-400">{settings.receiptFooter || 'سیستەمی ماس مێنو'}</p>
            </div>
          </div>
        )}

        {paymentReceiptData && (
          <div ref={a4ReceiptRef} className="p-10 w-[794px] h-[1123px] font-sans mx-auto bg-white text-black flex flex-col justify-between" dir="rtl">
            <div>
              <div className="flex justify-between items-start border-b-2 border-slate-900 pb-5 mb-6">
                <div className="flex items-center gap-4">
                  {settings.logoUrl ? (
                    <img
                      src={settings.logoUrl}
                      alt="Shop Logo"
                      className="w-20 h-20 object-contain rounded-2xl border border-gray-300 p-1 shadow-xs"
                    />
                  ) : (
                    <div className="w-18 h-18 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-2xl shadow-sm border border-slate-800">
                      {(settings.shopName || 'M')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h1 className="text-3xl font-black text-slate-950 mb-1">{settings.shopName || 'فرۆشگای نموونەیی'}</h1>
                    <p className="text-sm text-gray-600">{settings.address}</p>
                    <p className="text-sm text-gray-800 font-mono font-bold mt-1" dir="ltr">{settings.phone}</p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="px-3 py-1 bg-slate-950 text-white rounded-lg text-lg font-black block mb-2">وەسڵی واسڵکردنی قەرز</span>
                  <p className="text-xs text-gray-600">بەروار: <strong className="font-mono text-gray-900">{new Date(paymentReceiptData.date).toLocaleDateString('ku-IQ')}</strong></p>
                  <p className="text-xs text-gray-600">کات: <strong className="font-mono text-gray-900">{new Date(paymentReceiptData.date).toLocaleTimeString('ku-IQ')}</strong></p>
                </div>
              </div>
              
              <div className="bg-gray-50 border border-gray-300 rounded-2xl p-5 mb-6">
                <h3 className="text-sm font-black text-gray-900 border-b border-gray-200 pb-2 mb-3">زانیاری کڕیار</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 font-bold mb-0.5">ناوی کڕیار</p>
                    <p className="font-black text-gray-950">{paymentReceiptData.customerName}</p>
                  </div>
                  {paymentReceiptData.phone && (
                    <div>
                      <p className="text-xs text-gray-500 font-bold mb-0.5">ژمارەی مۆبایل</p>
                      <p className="font-mono font-bold text-gray-800" dir="ltr">{paymentReceiptData.phone}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-white border border-gray-300 rounded-2xl overflow-hidden mb-6 shadow-2xs">
                <div className="flex justify-between px-6 py-4 border-b border-gray-200">
                  <span className="text-base font-bold text-gray-700">بڕی پارەی دراو (واسلکراو)</span>
                  <span className="text-2xl font-black text-emerald-800 font-mono">{Math.round(paymentReceiptData.paidAmount).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between px-6 py-4 bg-gray-50">
                  <span className="text-base font-bold text-gray-700">بڕی قەرزی ماوە لای کڕیار</span>
                  <span className="text-2xl font-black text-rose-900 font-mono">{Math.round(paymentReceiptData.remainingAmount).toLocaleString()} IQD</span>
                </div>
              </div>

              {paymentReceiptData.note && (
                <div className="mb-6">
                  <p className="text-xs font-bold text-gray-600 mb-1">تێبینی:</p>
                  <div className="bg-gray-50 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-800">
                    {paymentReceiptData.note}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t-2 border-slate-900 text-center text-xs text-gray-600">
              <div className="grid grid-cols-2 gap-8 mb-6">
                <div>
                  <p className="font-black mb-4">واژۆی ژمێریار</p>
                  <div className="border-b border-dashed border-gray-400 w-32 mx-auto"></div>
                </div>
                <div>
                  <p className="font-black mb-4">واژۆی کڕیار</p>
                  <div className="border-b border-dashed border-gray-400 w-32 mx-auto"></div>
                </div>
              </div>
              <p className="font-bold">{settings.receiptFooter || 'سوپاس بۆ مامەڵەکەتان لەگەڵ سیستەمی ماس مێنو'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
