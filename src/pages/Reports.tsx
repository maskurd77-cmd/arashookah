import React, { useState, useEffect } from 'react';
import { collection, query, orderBy, where, Timestamp, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, FileText, FileSpreadsheet, Calendar, Printer, TrendingUp, DollarSign, ShoppingBag, Receipt, Tag, Package, BarChart3, Award, Wallet } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';

export default function Reports() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportType, setReportType] = useState('daily'); // daily, monthly, all
  const [activeCategory, setActiveCategory] = useState<string>('گشتی');
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [settings, setSettings] = useState({ shopName: 'aras hookah shop', phone: '', address: '', receiptFooter: 'Powered By Mas Menu' });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }
      } catch (e: any) {
        console.warn("Could not load settings (might be offline):", e);
      }
    };
    loadSettings();
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    let qExp = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'));

    const now = new Date();
    if (reportType === 'daily') {
      q = query(collection(db, 'sales'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfDay(now))),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay(now))),
        orderBy('createdAt', 'desc')
      );
      qExp = query(collection(db, 'expenses'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfDay(now))),
        where('createdAt', '<=', Timestamp.fromDate(endOfDay(now))),
        orderBy('createdAt', 'desc')
      );
    } else if (reportType === 'monthly') {
      q = query(collection(db, 'sales'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth(now))),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth(now))),
        orderBy('createdAt', 'desc')
      );
      qExp = query(collection(db, 'expenses'), 
        where('createdAt', '>=', Timestamp.fromDate(startOfMonth(now))),
        where('createdAt', '<=', Timestamp.fromDate(endOfMonth(now))),
        orderBy('createdAt', 'desc')
      );
    }

    const unsubscribeSales = onSnapshot(q, (querySnapshot) => {
      setSales(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error: any) => {
      console.error("Error fetching reports:", error);
      if (error.code === 'permission-denied') {
        setShowFirebaseSetup(true);
      }
      setLoading(false);
    });

    const unsubscribeExpenses = onSnapshot(qExp, (querySnapshot) => {
      setExpenses(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error: any) => {
      console.error("Error fetching expenses:", error);
    });

    return () => {
      unsubscribeSales();
      unsubscribeExpenses();
    };
  }, [reportType, setShowFirebaseSetup]);

  const getCategory = (item: any, isExpense: boolean = false) => {
    if (isExpense) {
      if (item.category && item.category !== 'کرێ' && item.category !== 'کارەبا' && item.category !== 'ئاو' && item.category !== 'مووچە' && item.category !== 'خواردن' && item.category !== 'هەمەجۆر' && item.category !== 'قەرزی دۆکان') {
        return item.category;
      }
      if (item.section === 'shisha') return 'شیشە';
      return 'گشتی';
    }
    if (item.section === 'shisha') return 'شیشە';
    if (item.category) return item.category;
    return 'گشتی';
  };

  const uniqueCategories = Array.from(new Set([
    'گشتی', 'دەرمان', 'نێرگلە', 'شیشە', 'یاریەکان', 'فەحم', 'هیتەر',
    ...sales.map(s => getCategory(s, false)),
    ...expenses.map(e => getCategory(e, true))
  ]));

  const filteredSales = sales.filter(sale => getCategory(sale, false) === activeCategory);
  const filteredExpenses = expenses.filter(exp => getCategory(exp, true) === activeCategory);

  const totalSales = Math.round(filteredSales.reduce((acc, sale) => acc + sale.total, 0));
  const totalDiscount = Math.round(filteredSales.reduce((acc, sale) => acc + sale.discount, 0));
  const totalReceived = Math.round(filteredSales.reduce((acc, sale) => acc + (sale.amountPaid || sale.total), 0));
  const totalRemaining = Math.round(filteredSales.reduce((acc, sale) => {
    if (sale.paymentMethod === 'debt') {
      return acc + (sale.total - (sale.amountPaid || 0));
    }
    return acc;
  }, 0));

  // New Metrics
  const totalCost = Math.round(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      let itemCost = 0;
      const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQuantity <= 0) return itemAcc;
      if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
        const packs = Math.floor(effectiveQuantity / item.packSize);
        const remainder = effectiveQuantity % item.packSize;
        itemCost = (packs * (item.wholesaleCost || (item.costPrice * item.packSize))) + (remainder * (item.costPrice || 0));
      } else {
        itemCost = (item.costPrice || 0) * effectiveQuantity;
      }
      return itemAcc + itemCost;
    }, 0) || 0);
  }, 0));
  
  const totalWholesaleSales = Math.round(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      let itemTotal = 0;
      const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQuantity <= 0 || item.isGift) return itemAcc;
      if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
        const packs = Math.floor(effectiveQuantity / item.packSize);
        itemTotal = packs * item.wholesalePrice;
      }
      return itemAcc + itemTotal;
    }, 0) || 0);
  }, 0));

  const totalRetailSales = totalSales - totalWholesaleSales;
  
  const totalExpensesAmount = Math.round(filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0));
  
  const netProfit = Math.round(totalSales - totalCost - totalExpensesAmount);
  
  const totalItemsSold = Number(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => itemAcc + Math.max(0, item.quantity - (item.returnedQuantity || 0)), 0) || 0);
  }, 0).toFixed(3));
  
  const averageReceiptValue = filteredSales.length > 0 ? Math.round(totalSales / filteredSales.length) : 0;
  
  const itemQuantities: Record<string, number> = {};
  filteredSales.forEach(sale => {
    sale.items?.forEach((item: any) => {
      if (!itemQuantities[item.name]) {
        itemQuantities[item.name] = 0;
      }
      itemQuantities[item.name] += Math.max(0, item.quantity - (item.returnedQuantity || 0));
    });
  });
  
  let mostSoldItem = '-';
  let maxQuantity = 0;
  for (const [name, qty] of Object.entries(itemQuantities)) {
    if (qty > maxQuantity) {
      maxQuantity = qty as number;
      mostSoldItem = name;
    }
  }

  const exportToExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings.shopName || 'System';
    workbook.created = new Date();
    
    const worksheet = workbook.addWorksheet('راپۆرتی فرۆشتن', { 
      views: [{ rightToLeft: true, showGridLines: false, state: 'frozen', ySplit: 11 }] 
    });

    // Set default row height
    worksheet.properties.defaultRowHeight = 28;

    // --- 1. Header Section ---
    worksheet.mergeCells('A1:G2');
    const titleCell = worksheet.getCell('A1');
    titleCell.value = `${settings.shopName || 'سیستەمی فرۆشتن'} - ${reportType === 'daily' ? 'راپۆرتی رۆژانە' : reportType === 'monthly' ? 'راپۆرتی مانگانە' : 'راپۆرتی گشتی'}`;
    titleCell.font = { name: 'Tahoma', size: 24, bold: true, color: { argb: 'FFFFFFFF' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF312E81' } }; // Indigo-900

    worksheet.mergeCells('A3:G3');
    const dateCell = worksheet.getCell('A3');
    dateCell.value = `بەرواری دەرکردن: ${format(new Date(), 'yyyy-MM-dd HH:mm')}  |  کۆی پسوڵەکان: ${filteredSales.length}`;
    dateCell.font = { name: 'Tahoma', size: 12, color: { argb: 'FF312E81' }, bold: true };
    dateCell.alignment = { vertical: 'middle', horizontal: 'center' };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo-100

    worksheet.addRow([]); // Row 4 empty

    // --- 2. Summary Section (Cards style) ---
    // Row 5
    worksheet.getCell('B5').value = 'کۆی فرۆشتن';
    worksheet.getCell('C5').value = Math.round(totalSales);
    worksheet.getCell('E5').value = 'تێچووی گشتی';
    worksheet.getCell('F5').value = Math.round(totalCost);

    // Row 6
    worksheet.getCell('B6').value = 'خەرجییەکان';
    worksheet.getCell('C6').value = Math.round(totalExpensesAmount);
    worksheet.getCell('E6').value = 'قازانجی سافی';
    worksheet.getCell('F6').value = Math.round(netProfit);

    // Row 7
    worksheet.getCell('B7').value = 'کۆی داشکاندن';
    worksheet.getCell('C7').value = Math.round(totalDiscount);
    worksheet.getCell('E7').value = 'ژمارەی پسوڵەکان';
    worksheet.getCell('F7').value = filteredSales.length;

    // Row 8
    worksheet.getCell('B8').value = 'پڕفرۆشترین کاڵا';
    worksheet.getCell('C8').value = mostSoldItem;
    worksheet.getCell('E8').value = 'کاڵا فرۆشراوەکان';
    worksheet.getCell('F8').value = Math.round(totalItemsSold);

    // Style Summary Cards
    const summaryLabels = ['B5', 'E5', 'B6', 'E6', 'B7', 'E7', 'B8', 'E8'];
    const summaryValues = ['C5', 'F5', 'C6', 'F6', 'C7', 'F7', 'C8', 'F8'];

    summaryLabels.forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.font = { name: 'Tahoma', size: 12, bold: true, color: { argb: 'FF4B5563' } }; // Gray-600
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } }; // Gray-100
      cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
    });

    summaryValues.forEach(cellRef => {
      const cell = worksheet.getCell(cellRef);
      cell.font = { name: 'Tahoma', size: 13, bold: true, color: { argb: 'FF111827' } }; // Gray-900
      cell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
        right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
      };
      
      // Format numbers and colors
      if (cellRef !== 'C8' && cellRef !== 'F7' && cellRef !== 'F8') {
        cell.numFmt = '#,##0';
      }
      if (cellRef === 'F6') { // Net Profit
        cell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: netProfit >= 0 ? 'FF059669' : 'FFDC2626' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netProfit >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' } };
      }
    });

    worksheet.addRow([]); // Row 9 empty
    worksheet.addRow([]); // Row 10 empty

    // --- 3. Table Section ---
    const tableStartRow = 11;
    
    // Define columns
    worksheet.columns = [
      { header: 'ژمارەی پسوڵە', key: 'receiptNumber', width: 22 },
      { header: 'بەروار', key: 'date', width: 28 },
      { header: 'شێوازی پارەدان', key: 'paymentMethod', width: 22 },
      { header: 'کۆی گشتی', key: 'subtotal', width: 25 },
      { header: 'داشکاندن', key: 'discount', width: 20 },
      { header: 'کۆی کۆتایی', key: 'total', width: 28 },
      { header: 'پارەی وەرگیراو', key: 'received', width: 25 },
      { header: 'باقی (قەرز)', key: 'remaining', width: 25 },
      { header: 'قازانج', key: 'profit', width: 25 },
    ];

    // Style the header row
    const headerRow = worksheet.getRow(tableStartRow);
    headerRow.height = 40;
    headerRow.font = { name: 'Tahoma', size: 13, bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    
    headerRow.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo-600
      cell.border = {
        top: { style: 'medium', color: { argb: 'FF312E81' } },
        left: { style: 'thin', color: { argb: 'FF818CF8' } },
        bottom: { style: 'medium', color: { argb: 'FF312E81' } },
        right: { style: 'thin', color: { argb: 'FF818CF8' } }
      };
    });

    // Add AutoFilter
    worksheet.autoFilter = {
      from: { row: tableStartRow, column: 1 },
      to: { row: tableStartRow, column: 9 }
    };

    // Add Data
    filteredSales.forEach((sale) => {
      const saleCost = sale.items?.reduce((itemAcc: number, item: any) => {
        let itemCost = 0;
        const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
        if (effectiveQuantity <= 0) return itemAcc;
        if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
          const packs = Math.floor(effectiveQuantity / item.packSize);
          const remainder = effectiveQuantity % item.packSize;
          itemCost = (packs * (item.wholesaleCost || (item.costPrice * item.packSize))) + (remainder * (item.costPrice || 0));
        } else {
          itemCost = (item.costPrice || 0) * effectiveQuantity;
        }
        return itemAcc + itemCost;
      }, 0) || 0;
      const saleProfit = sale.total - saleCost;

      const row = worksheet.addRow({
        receiptNumber: sale.receiptNumber,
        date: sale.createdAt?.toDate().toLocaleString('ku-IQ'),
        paymentMethod: sale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز',
        subtotal: Math.round(sale.subtotal),
        discount: Math.round(sale.discount),
        total: Math.round(sale.total),
        received: Math.round(sale.amountPaid || sale.total),
        remaining: Math.round(sale.paymentMethod === 'debt' ? (sale.total - (sale.amountPaid || 0)) : 0),
        profit: Math.round(saleProfit)
      });

      row.height = 30;

      // Style data rows
      row.eachCell((cell, colNumber) => {
        cell.font = { name: 'Tahoma', size: 12, color: { argb: 'FF374151' } };
        cell.alignment = { vertical: 'middle', horizontal: colNumber === 2 ? 'center' : 'left', indent: 1 };
        
        // Alternating row colors
        if (row.number % 2 === 0) {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } }; // Slate-50
        } else {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } };
        }

        cell.border = {
          top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
        };

        // Format numbers
        if ([4, 5, 6, 7, 8, 9].includes(colNumber)) {
          cell.numFmt = '#,##0';
          if (colNumber === 6) {
            cell.font = { name: 'Tahoma', size: 12, bold: true, color: { argb: 'FF111827' } }; // Total bold
          }
          if (colNumber === 9) {
            // Profit color coding
            cell.font = { name: 'Tahoma', size: 12, bold: true, color: { argb: saleProfit >= 0 ? 'FF059669' : 'FFDC2626' } };
          }
        }
      });
    });

    // Add Totals Row at the bottom
    const totalRow = worksheet.addRow({
      receiptNumber: 'کۆی گشتی',
      date: '',
      paymentMethod: '',
      subtotal: Math.round(filteredSales.reduce((acc, sale) => acc + sale.subtotal, 0)),
      discount: Math.round(totalDiscount),
      total: Math.round(totalSales),
      received: Math.round(totalReceived),
      remaining: Math.round(totalRemaining),
      profit: Math.round(filteredSales.reduce((acc, sale) => {
        const saleCost = sale.items?.reduce((itemAcc: number, item: any) => {
          let itemCost = 0;
          if (!item.isWeighed && item.packSize > 1 && item.wholesalePrice) {
            const packs = Math.floor(item.quantity / item.packSize);
            const remainder = item.quantity % item.packSize;
            itemCost = (packs * (item.wholesaleCost || (item.costPrice * item.packSize))) + (remainder * (item.costPrice || 0));
          } else {
            itemCost = (item.costPrice || 0) * item.quantity;
          }
          return itemAcc + itemCost;
        }, 0) || 0;
        return acc + (sale.total - saleCost);
      }, 0))
    });

    totalRow.height = 40;
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: 'FF111827' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E7FF' } }; // Indigo-100
      cell.alignment = { vertical: 'middle', horizontal: colNumber === 1 ? 'center' : 'left', indent: 1 };
      cell.border = {
        top: { style: 'double', color: { argb: 'FF4F46E5' } },
        left: { style: 'thin', color: { argb: 'FFC7D2FE' } },
        bottom: { style: 'medium', color: { argb: 'FF4F46E5' } },
        right: { style: 'thin', color: { argb: 'FFC7D2FE' } }
      };
      
      if ([4, 5, 6, 7, 8, 9].includes(colNumber)) {
        cell.numFmt = '#,##0';
        if (colNumber === 9) {
          const totalProfit = totalRow.getCell(9).value as number;
          cell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: totalProfit >= 0 ? 'FF059669' : 'FFDC2626' } };
        }
      }
    });

    // Generate Excel File
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `راپۆرتی_فرۆشتن_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    // Simple PDF generation (without custom fonts for now, as it requires base64 font loading)
    // For a real production app, you'd load a Kurdish font into jsPDF.
    doc.text("Sales Report", 14, 15);
    doc.text(`Date: ${format(new Date(), 'yyyy-MM-dd')}`, 14, 25);
    doc.text(`Total Sales: ${totalSales} IQD`, 14, 35);

    const tableColumn = ["Receipt No", "Date", "Method", "Total"];
    const tableRows = filteredSales.map(sale => [
      sale.receiptNumber,
      sale.createdAt?.toDate().toLocaleDateString(),
      sale.paymentMethod,
      sale.total.toString()
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 45,
    });

    doc.save(`Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleReprint = (sale: any) => {
    setSelectedReceipt(sale);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  return (
    <div className="space-y-6 print:h-auto print:block">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
        <h1 className="text-2xl font-bold text-gray-900">راپۆرتەکان</h1>
        
        <div className="flex flex-wrap gap-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex overflow-x-auto max-w-full">
            {uniqueCategories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-1 flex">
            <button
              onClick={() => setReportType('daily')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === 'daily' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              رۆژانە
            </button>
            <button
              onClick={() => setReportType('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === 'monthly' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              مانگانە
            </button>
            <button
              onClick={() => setReportType('all')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${reportType === 'all' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              هەمووی
            </button>
          </div>

          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <FileSpreadsheet size={18} />
            Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors text-sm font-medium"
          >
            <FileText size={18} />
            PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 print:hidden">
        {/* Total Sales */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کۆی فرۆشتن</p>
            <p className="text-2xl font-bold text-gray-900">{totalSales.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Total Received */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">پارەی وەرگیراو</p>
            <p className="text-2xl font-bold text-gray-900">{totalReceived.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Total Remaining (Debt) */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">باقی (قەرز)</p>
            <p className="text-2xl font-bold text-gray-900">{totalRemaining.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Wholesale Sales */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">فرۆشتنی جوملە</p>
            <p className="text-2xl font-bold text-gray-900">{totalWholesaleSales.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Retail Sales */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">فرۆشتنی دانە (تاک)</p>
            <p className="text-2xl font-bold text-gray-900">{totalRetailSales.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center text-orange-600 shrink-0">
            <ShoppingBag size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">تێچووی گشتی</p>
            <p className="text-2xl font-bold text-gray-900">{totalCost.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Total Expenses */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">خەرجییەکان</p>
            <p className="text-2xl font-bold text-gray-900">{totalExpensesAmount.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">قازانجی سافی</p>
            <p className="text-2xl font-bold text-emerald-600">{netProfit.toLocaleString()} <span className="text-sm font-normal text-emerald-600/70">IQD</span></p>
          </div>
        </div>

        {/* Total Discount */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600 shrink-0">
            <Tag size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کۆی داشکاندن</p>
            <p className="text-2xl font-bold text-gray-900">{totalDiscount.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Number of Receipts */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
            <Receipt size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">ژمارەی پسوڵەکان</p>
            <p className="text-2xl font-bold text-gray-900">{filteredSales.length}</p>
          </div>
        </div>

        {/* Average Receipt Value */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-cyan-50 flex items-center justify-center text-cyan-600 shrink-0">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">تێکڕای بەهای پسوڵە</p>
            <p className="text-2xl font-bold text-gray-900">{averageReceiptValue.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Total Items Sold */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center text-purple-600 shrink-0">
            <Package size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">کاڵا فرۆشراوەکان</p>
            <p className="text-2xl font-bold text-gray-900">{totalItemsSold}</p>
          </div>
        </div>

        {/* Most Sold Item */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center text-amber-600 shrink-0">
            <Award size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-gray-500 mb-1">پڕفرۆشترین کاڵا</p>
            <p className="text-lg font-bold text-gray-900 truncate" title={mostSoldItem}>{mostSoldItem}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">ژمارەی پسوڵە</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">بەروار</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">شێوازی پارەدان</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">داشکاندن</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">کۆی گشتی</th>
                <th className="px-6 py-3 text-sm font-medium text-gray-500">کردارەکان</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">بارکردن...</td></tr>
              ) : filteredSales.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-8 text-gray-500">هیچ داتایەک نییە</td></tr>
              ) : (
                filteredSales.map(sale => (
                  <tr key={sale.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 font-mono text-sm text-gray-500">{sale.receiptNumber}</td>
                    <td className="px-6 py-4 text-sm text-gray-900">{sale.createdAt?.toDate().toLocaleString('ku-IQ')}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                        {sale.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-orange-600">{Math.round(sale.discount).toLocaleString()} IQD</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">{Math.round(sale.total).toLocaleString()} IQD</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleReprint(sale)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="دووبارە چاپکردنەوەی پسوولە"
                      >
                        <Printer size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Hidden Receipt for Printing */}
      {selectedReceipt && (
        <div className="hidden print:block print:absolute print:inset-0 print:bg-white print:z-[9999] print:p-0">
          <div className="p-4 w-80 text-center font-sans mx-auto" dir="rtl">
            <h1 className="text-2xl font-bold mb-1">{settings.shopName}</h1>
            {settings.address && <p className="text-sm text-gray-600 mb-1">{settings.address}</p>}
            {settings.phone && <p className="text-sm text-gray-600 mb-2" dir="ltr">{settings.phone}</p>}
            
            <div className="border-t border-b border-dashed border-gray-300 py-2 mb-4">
              <p className="text-sm font-bold mb-1">ژمارەی پسوڵە: {selectedReceipt.receiptNumber}</p>
              <p className="text-xs text-gray-500">{selectedReceipt.createdAt?.toDate().toLocaleString('ku-IQ')}</p>
              <p className="text-xs font-bold mt-1 text-indigo-600">
                {selectedReceipt.paymentMethod === 'cash' ? 'نەقد' : 'قەرز'}
              </p>
              <p className="text-xs text-gray-500 mt-1">** کۆپی دووبارە چاپکراو **</p>
            </div>

            <table className="w-full text-sm mb-4">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-right pb-2">کالا</th>
                  <th className="text-center pb-2">بڕ</th>
                  <th className="text-left pb-2">نرخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {selectedReceipt.items?.map((item: any, index: number) => (
                  <tr key={index}>
                    <td className="text-right py-2 pr-1">{item.name}</td>
                    <td className="text-center py-2">{Number(item.quantity.toFixed(3))} {item.isWeighed ? 'کگم' : ''}</td>
                    <td className="text-left py-2 pl-1">{Math.round(item.price * item.quantity).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="border-t border-gray-300 pt-2 mb-4 space-y-1">
              <div className="flex justify-between text-sm">
                <span>کۆی گشتی:</span>
                <span>{Math.round(selectedReceipt.subtotal || 0).toLocaleString()} IQD</span>
              </div>
              {selectedReceipt.discount > 0 && (
                <div className="flex justify-between text-sm text-gray-600">
                  <span>داشکاندن:</span>
                  <span>{Math.round(selectedReceipt.discount || 0).toLocaleString()} IQD</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-lg pt-1 border-t border-dashed border-gray-300">
                <span>کۆی کۆتایی:</span>
                <span>{Math.round(selectedReceipt.total || 0).toLocaleString()} IQD</span>
              </div>
            </div>

            <p className="text-xs text-gray-500 mt-6">{settings.receiptFooter}</p>
          </div>
        </div>
      )}
    </div>
  );
}
