import React, { useState, useEffect, useRef } from 'react';
import { collection, query, orderBy, where, Timestamp, onSnapshot, doc, getDoc, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Download, FileText, FileSpreadsheet, Calendar, Printer, TrendingUp, DollarSign, ShoppingBag, Receipt, Tag, Package, BarChart3, Award, Wallet, RotateCcw, Send, X, Eye } from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { startOfDay, endOfDay, startOfMonth, endOfMonth, format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { sendTelegramMessage } from '../services/telegram';
import { cacheManager } from '../lib/cache';
import { useReactToPrint } from 'react-to-print';
import { ThermalReceipt } from '../components/receipts/ThermalReceipt';
import { A4Receipt } from '../components/receipts/A4Receipt';
import { ReportSummaryPrint } from '../components/receipts/ReportSummaryPrint';

export default function Reports() {
  const { setShowFirebaseSetup } = useAuth();
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const [reportType, setReportType] = useState('daily'); // daily, monthly, all
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [activeCategory, setActiveCategory] = useState<string>('گشتی');
  const [selectedProductCategory, setSelectedProductCategory] = useState<string>('all');
  const [productCategories, setProductCategories] = useState<string[]>([]);
  const [productCategoryMap, setProductCategoryMap] = useState<Record<string, string>>({});
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null);
  const [settings, setSettings] = useState({ shopName: 'aras hookah shop', phone: '', address: '', receiptFooter: 'Powered By Mas Menu', logoUrl: '' });

  useEffect(() => {
    const loadSettingsAndData = async () => {
      try {
        const cachedCats = cacheManager.getCategories();
        if (cachedCats) {
          setProductCategories(cachedCats);
        } else {
          const catRef = doc(db, 'settings', 'categories');
          const catSnap = await getDoc(catRef);
          if (catSnap.exists()) {
            const data = catSnap.data();
            const list = data.list || data.categories || [];
            if (Array.isArray(list) && list.length > 0) {
              cacheManager.setCategories(list);
              setProductCategories(list);
            }
          }
        }

        const docRef = doc(db, 'settings', 'general');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data() as any);
        }

        // Fetch products to map older items to categories
        const prodSnap = await getDocs(collection(db, 'products'));
        const pMap: Record<string, string> = {};
        prodSnap.docs.forEach(d => {
          const p = d.data();
          if (p.category) {
            pMap[d.id] = p.category;
            if (p.originalId) {
              pMap[p.originalId] = p.category;
            }
          }
        });
        setProductCategoryMap(pMap);
      } catch (e: any) {
        console.warn("Could not load settings/products:", e);
      }
    };
    loadSettingsAndData();
  }, []);

  useEffect(() => {
    setLoading(true);
    let q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(300));
    let qExp = query(collection(db, 'expenses'), orderBy('createdAt', 'desc'), limit(300));

    const now = selectedDate;
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

    const unsubscribeDebts = onSnapshot(collection(db, 'debts'), (querySnapshot) => {
      setDebts(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error: any) => {
      console.error("Error fetching debts:", error);
    });

    return () => {
      unsubscribeSales();
      unsubscribeExpenses();
      unsubscribeDebts();
    };
  }, [reportType, selectedDate, setShowFirebaseSetup]);

  const getProductCat = (item: any) => {
    return item.category || productCategoryMap[item.id] || productCategoryMap[item.originalId] || '';
  };

  const getCategory = (item: any, isExpense: boolean = false) => {
    if (isExpense) {
      if (item.section === 'shisha') return 'شیشە';
      return 'گشتی';
    }
    if (item.section === 'shisha') return 'شیشە';
    return 'گشتی';
  };

  const uniqueCategories = ['گشتی', 'شیشە'];

  let filteredSales = sales.filter(sale => getCategory(sale, false) === activeCategory);
  
  const effectiveProductCategory = activeCategory === 'گشتی' ? selectedProductCategory : 'all';

  if (effectiveProductCategory !== 'all') {
    filteredSales = filteredSales.filter(sale => 
      sale.items?.some((item: any) => getProductCat(item) === effectiveProductCategory)
    );
  }

  const filteredExpenses = expenses.filter(exp => getCategory(exp, true) === activeCategory);

  const getSaleFilteredTotal = (sale: any) => {
    if (effectiveProductCategory === 'all') return sale.total;
    return sale.items?.reduce((itemAcc: number, item: any) => {
      if (getProductCat(item) !== effectiveProductCategory) return itemAcc;
      const effectiveQty = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQty <= 0 || item.isGift) return itemAcc;
      return itemAcc + (item.price * effectiveQty);
    }, 0) || 0;
  };

  const totalSales = Math.round(filteredSales.reduce((acc, sale) => {
    return acc + getSaleFilteredTotal(sale);
  }, 0));

  const totalDiscount = Math.round(filteredSales.reduce((acc, sale) => {
    if (effectiveProductCategory === 'all') return acc + sale.discount;
    // Calculate proportional discount or ignore? Ignoring is safer for item-level filtering.
    return acc; 
  }, 0));
  
  const totalDebtPayments = Math.round(debts.reduce((acc, debt) => {
    const payments = debt.payments || [];
    const filteredPayments = payments.filter((p: any) => {
      const pDate = new Date(p.date);
      if (reportType === 'daily') {
        return pDate >= startOfDay(selectedDate) && pDate <= endOfDay(selectedDate);
      } else if (reportType === 'monthly') {
        return pDate >= startOfMonth(selectedDate) && pDate <= endOfMonth(selectedDate);
      }
      return true;
    });
    return acc + filteredPayments.reduce((pAcc: number, p: any) => pAcc + p.amount, 0);
  }, 0));

  const totalReceived = Math.round(filteredSales.reduce((acc, sale) => {
    if (effectiveProductCategory === 'all') return acc + (sale.amountPaid || sale.total);
    // If filtering by product category, "Received" is not directly proportional. Just use totalSales as an approximation of what's generated.
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      if (getProductCat(item) !== effectiveProductCategory) return itemAcc;
      const effectiveQty = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQty <= 0 || item.isGift) return itemAcc;
      return itemAcc + (item.price * effectiveQty);
    }, 0) || 0);
  }, 0)) + (effectiveProductCategory === 'all' ? totalDebtPayments : 0);

  const totalRemaining = Math.round(filteredSales.reduce((acc, sale) => {
    if (effectiveProductCategory === 'all') {
      if (sale.paymentMethod === 'debt') {
        return acc + (sale.total - (sale.amountPaid || 0));
      }
      return acc;
    }
    return acc; // Debt tracking is per receipt, not per item category.
  }, 0));

  // Direct Payment Metrics
  const totalDirectCash = Math.round(
    filteredSales.reduce((acc, sale) => {
      if (sale.paymentMethod === 'cash') {
        return acc + (sale.amountPaid !== undefined ? Number(sale.amountPaid) : sale.total);
      } else if (sale.paymentMethod === 'debt' && sale.amountPaid) {
        return acc + Number(sale.amountPaid);
      }
      return acc;
    }, 0)
  ) + (effectiveProductCategory === 'all' ? totalDebtPayments : 0);

  const totalDirectDebt = totalRemaining;

  const totalDirectFib = Math.round(
    filteredSales.reduce((acc, sale) => {
      if (sale.paymentMethod === 'fib') {
        return acc + (sale.amountPaid !== undefined ? Number(sale.amountPaid) : sale.total);
      }
      return acc;
    }, 0)
  );

  // USD Metrics
  const totalDirectUsd = Math.round(
    filteredSales.reduce((acc, sale) => {
      if (effectiveProductCategory !== 'all') return acc; // USD per-receipt, ignore for item-category filter
      if (sale.paymentCurrency === 'USD' && sale.amountPaidUsd) {
        return acc + Number(sale.amountPaidUsd);
      }
      return acc;
    }, 0) * 100
  ) / 100;

  // New Metrics
  const totalCost = Math.round(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      if (effectiveProductCategory !== 'all' && getProductCat(item) !== effectiveProductCategory) return itemAcc;
      let itemCost = 0;
      const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQuantity <= 0) return itemAcc;
      
      if (item.isWholesale) {
        itemCost = (item.wholesaleCost || (item.costPrice * (item.packSize || 1))) * effectiveQuantity;
      } else {
        itemCost = (item.costPrice || 0) * effectiveQuantity;
      }
      return itemAcc + itemCost;
    }, 0) || 0);
  }, 0));
  
  const totalWholesaleSales = Math.round(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      if (effectiveProductCategory !== 'all' && getProductCat(item) !== effectiveProductCategory) return itemAcc;
      let itemTotal = 0;
      const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
      if (effectiveQuantity <= 0 || item.isGift) return itemAcc;
      
      if (item.isWholesale) {
        itemTotal = item.price * effectiveQuantity;
      }
      return itemAcc + itemTotal;
    }, 0) || 0);
  }, 0));

  const totalRetailSales = totalSales - totalWholesaleSales;
  
  const totalExpensesAmount = effectiveProductCategory === 'all' 
    ? Math.round(filteredExpenses.reduce((acc, exp) => acc + Number(exp.amount || 0), 0))
    : 0;
  
  const netProfit = Math.round(totalSales - totalCost - totalExpensesAmount);
  
  const totalItemsSold = Number(filteredSales.reduce((acc, sale) => {
    return acc + (sale.items?.reduce((itemAcc: number, item: any) => {
      if (effectiveProductCategory !== 'all' && getProductCat(item) !== effectiveProductCategory) return itemAcc;
      return itemAcc + Math.max(0, item.quantity - (item.returnedQuantity || 0));
    }, 0) || 0);
  }, 0).toFixed(3));
  
  const averageReceiptValue = filteredSales.length > 0 ? Math.round(totalSales / filteredSales.length) : 0;
  
  const itemQuantities: Record<string, number> = {};
  filteredSales.forEach(sale => {
    sale.items?.forEach((item: any) => {
      if (effectiveProductCategory !== 'all' && getProductCat(item) !== effectiveProductCategory) return;
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
    worksheet.getCell('E8').value = 'قەرزی گەڕاوە';
    worksheet.getCell('F8').value = Math.round(totalDebtPayments);

    // Row 9
    worksheet.getCell('B9').value = 'کاڵا فرۆشراوەکان';
    worksheet.getCell('C9').value = Math.round(totalItemsSold);

    // Style Summary Cards
    const summaryLabels = ['B5', 'E5', 'B6', 'E6', 'B7', 'E7', 'B8', 'E8', 'B9'];
    const summaryValues = ['C5', 'F5', 'C6', 'F6', 'C7', 'F7', 'C8', 'F8', 'C9'];

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
      if (cellRef !== 'C8' && cellRef !== 'F7' && cellRef !== 'C9') {
        cell.numFmt = '#,##0';
      }
      if (cellRef === 'F6') { // Net Profit
        cell.font = { name: 'Tahoma', size: 14, bold: true, color: { argb: netProfit >= 0 ? 'FF059669' : 'FFDC2626' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: netProfit >= 0 ? 'FFD1FAE5' : 'FFFEE2E2' } };
      }
    });

    worksheet.addRow([]); // Row 10 empty
    worksheet.addRow([]); // Row 11 empty

    // --- 3. Table Section ---
    const tableStartRow = 12;
    
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
        if (item.isWholesale) {
          itemCost = (item.wholesaleCost || (item.costPrice * (item.packSize || 1))) * effectiveQuantity;
        } else {
          itemCost = (item.costPrice || 0) * effectiveQuantity;
        }
        return itemAcc + itemCost;
      }, 0) || 0;
      const saleProfit = sale.total - saleCost;

      const row = worksheet.addRow({
        receiptNumber: sale.receiptNumber,
        date: sale.createdAt?.toDate().toLocaleString('ku-IQ'),
        paymentMethod: sale.paymentMethod === 'cash' ? 'نەقد' : (sale.paymentMethod === 'fib' ? 'FIB' : 'قەرز'),
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
          const effectiveQuantity = item.quantity - (item.returnedQuantity || 0);
          if (effectiveQuantity <= 0) return itemAcc;
          if (item.isWholesale) {
            itemCost = (item.wholesaleCost || (item.costPrice * (item.packSize || 1))) * effectiveQuantity;
          } else {
            itemCost = (item.costPrice || 0) * effectiveQuantity;
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

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 45,
    });

    doc.save(`Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportModalFormat, setReportModalFormat] = useState<'80mm' | 'a4'>('80mm');
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [receiptModalFormat, setReceiptModalFormat] = useState<'80mm' | 'a4'>('80mm');

  const thermalReportRef = useRef<HTMLDivElement>(null);
  const a4ReportRef = useRef<HTMLDivElement>(null);
  const thermalReceiptRef = useRef<HTMLDivElement>(null);
  const a4ReceiptRef = useRef<HTMLDivElement>(null);

  const handlePrintReportThermal = useReactToPrint({
    contentRef: thermalReportRef,
    documentTitle: `Report-Thermal-${format(new Date(), 'yyyy-MM-dd')}`,
  });

  const handlePrintReportA4 = useReactToPrint({
    contentRef: a4ReportRef,
    documentTitle: `Report-A4-${format(new Date(), 'yyyy-MM-dd')}`,
  });

  const handlePrintReceiptThermal = useReactToPrint({
    contentRef: thermalReceiptRef,
    documentTitle: `Receipt-${selectedReceipt?.receiptNumber || 'print'}`,
  });

  const handlePrintReceiptA4 = useReactToPrint({
    contentRef: a4ReceiptRef,
    documentTitle: `Invoice-${selectedReceipt?.receiptNumber || 'print'}`,
  });

  const handleReprintThermal = (sale: any) => {
    setSelectedReceipt(sale);
    setReceiptModalFormat('80mm');
    setIsReceiptModalOpen(true);
  };

  const handleReprintA4 = (sale: any) => {
    setSelectedReceipt(sale);
    setReceiptModalFormat('a4');
    setIsReceiptModalOpen(true);
  };

  const handleDirectPrintThermal = (sale?: any) => {
    if (sale) setSelectedReceipt(sale);
    setTimeout(() => {
      handlePrintReceiptThermal();
    }, 50);
  };

  const handleDirectPrintA4 = (sale?: any) => {
    if (sale) setSelectedReceipt(sale);
    setTimeout(() => {
      handlePrintReceiptA4();
    }, 50);
  };

  const handleSendToTelegram = async () => {
    setIsSendingTelegram(true);
    try {
      let reportPeriod = 'ڕۆژانە';
      if (reportType === 'monthly') {
        reportPeriod = `مانگانە (${format(selectedDate, 'yyyy-MM')})`;
      } else if (reportType === 'all') {
        reportPeriod = 'گشتی';
      }

      const message = `
📊 <b>ڕاپۆرتی کۆگا - ${reportPeriod}</b>
📅 <b>بەروار:</b> ${format(new Date(), 'yyyy/MM/dd HH:mm')}

💰 <b>کۆی گشتی فرۆش:</b> ${totalSales.toLocaleString()} دینار
💸 <b>قازانجی سافی:</b> ${netProfit.toLocaleString()} دینار
📉 <b>خەرجییەکان:</b> ${totalExpensesAmount.toLocaleString()} دینار

📦 <b>کاڵا فرۆشراوەکان:</b> ${totalItemsSold}
🏆 <b>پڕفرۆشترین کاڵا:</b> ${mostSoldItem || 'نییە'}
💳 <b>ژمارەی پسوڵەکان:</b> ${filteredSales.length}

<i>${settings.shopName || ''}</i>
`.trim();

      const res = await sendTelegramMessage(message);
      if (res.success) {
        alert("✅ ڕاپۆرت بە سەرکەوتوویی نێردرا بۆ تێلیگرام.");
      } else {
        alert(`❌ هەڵەیەک ڕوویدا: ${res.error || 'دڵنیابە لە ڕێکخستنەکانی تێلیگرام'}`);
      }
    } catch (error) {
      console.error(error);
      alert("❌ هەڵەیەک ڕوویدا لە ناردنی ڕاپۆرتەکە.");
    } finally {
      setIsSendingTelegram(false);
    }
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

          {activeCategory === 'گشتی' && productCategories.length > 0 && (
            <select
              value={selectedProductCategory}
              onChange={(e) => setSelectedProductCategory(e.target.value)}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-700"
            >
              <option value="all">هەموو جۆرەکان (Category)</option>
              {productCategories.map((cat, i) => (
                <option key={i} value={cat}>{cat}</option>
              ))}
            </select>
          )}

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

          {reportType === 'daily' && (
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : new Date())}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-700"
            />
          )}

          {reportType === 'monthly' && (
            <input
              type="month"
              value={format(selectedDate, 'yyyy-MM')}
              onChange={(e) => setSelectedDate(e.target.value ? new Date(e.target.value) : new Date())}
              className="px-4 py-2 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm text-gray-700"
            />
          )}

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                setReportModalFormat('80mm');
                setIsReportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors text-sm font-bold shadow-xs active:scale-95"
              title="پێشبینین و چاپی وەسڵی 80mm"
            >
              <Printer size={17} />
              <span>ڕاپۆرت (80mm)</span>
            </button>
            <button
              onClick={() => {
                setReportModalFormat('a4');
                setIsReportModalOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl transition-colors text-sm font-bold shadow-xs active:scale-95"
              title="پێشبینین و چاپی ڕاپۆرتی A4"
            >
              <FileText size={17} />
              <span>ڕاپۆرت (A4)</span>
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
          <button
            onClick={handleSendToTelegram}
            disabled={isSendingTelegram}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <Send size={18} />
            {isSendingTelegram ? 'دەنێردرێت...' : 'تێلیگرام'}
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

        {/* Direct USD Received */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-emerald-200 bg-emerald-50/30 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white shrink-0 font-black text-xl">
            $
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800 mb-1">پارەی وەرگیراوی دۆلار ($)</p>
            <p className="text-2xl font-black text-emerald-700">${totalDirectUsd.toLocaleString()} <span className="text-sm font-bold text-emerald-600">USD</span></p>
          </div>
        </div>

        {/* Total Received */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
            <Wallet size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">پارەی وەرگیراو (IQD)</p>
            <p className="text-2xl font-bold text-gray-900">{totalReceived.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
          </div>
        </div>

        {/* Returned Debt */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 shrink-0">
            <RotateCcw size={24} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500 mb-1">قەرزی گەڕاوە</p>
            <p className="text-2xl font-bold text-gray-900">{totalDebtPayments.toLocaleString()} <span className="text-sm font-normal text-gray-500">IQD</span></p>
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
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium w-fit ${sale.paymentMethod === 'cash' ? 'bg-green-100 text-green-700' : (sale.paymentMethod === 'fib' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700')}`}>
                            {sale.paymentMethod === 'cash' ? 'نەقد' : (sale.paymentMethod === 'fib' ? 'FIB' : 'قەرز')}
                          </span>
                          {(sale.paymentCurrency === 'USD' || sale.amountPaidUsd > 0) && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-black bg-emerald-600 text-white shadow-xs">
                              ${sale.amountPaidUsd || 0} USD
                            </span>
                          )}
                        </div>
                        {sale.paymentMethod === 'debt' && sale.customerId && (
                          <span className="text-xs text-gray-600 font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400"></span>
                            {debts.find(d => d.id === sale.customerId)?.customerName || 'کڕیار نەناسراوە'}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-orange-600">{Math.round(effectiveProductCategory === 'all' ? sale.discount : 0).toLocaleString()} IQD</td>
                    <td className="px-6 py-4 font-bold text-indigo-600">
                      {Math.round(getSaleFilteredTotal(sale)).toLocaleString()} IQD
                      {effectiveProductCategory !== 'all' && <span className="block text-xs font-normal text-gray-400">تەنیا {effectiveProductCategory}</span>}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleReprintThermal(sale)}
                          className="px-2.5 py-1.5 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 border border-indigo-200"
                          title="چاپکردن بە 80mm گەرمی"
                        >
                          <Printer size={14} />
                          80mm
                        </button>
                        <button
                          onClick={() => handleReprintA4(sale)}
                          className="px-2.5 py-1.5 bg-slate-100 text-slate-800 hover:bg-slate-200 rounded-lg transition-colors text-xs font-bold flex items-center gap-1 border border-slate-300"
                          title="چاپکردن بە فۆرماتی فەرمی A4"
                        >
                          <FileText size={14} />
                          A4
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

      {/* ========================================================================= */}
      {/* 1. Interactive Report Print & Preview Modal (مۆداڵی پێشبینین و چاپی ڕاپۆرت) */}
      {/* ========================================================================= */}
      {isReportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50/80">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Printer size={22} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">پێشبینین و چاپکردنی ڕاپۆرت</h3>
                  <p className="text-xs text-gray-500">فۆرماتی گونجاو دیاریبکە و ڕاستەوخۆ دەری بکە بۆ پرینتەر</p>
                </div>
              </div>

              {/* Format Switcher */}
              <div className="flex items-center gap-2">
                <div className="bg-gray-200/80 p-1 rounded-xl flex">
                  <button
                    onClick={() => setReportModalFormat('80mm')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportModalFormat === '80mm'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🧾 وەسڵی گەرمی (80mm)
                  </button>
                  <button
                    onClick={() => setReportModalFormat('a4')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      reportModalFormat === 'a4'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📄 فۆرماتی فەرمی (A4)
                  </button>
                </div>

                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Visual Live Preview */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100/70 flex justify-center">
              <div className="bg-white shadow-xl rounded-xl border border-gray-300 p-2 transform origin-top transition-all">
                <ReportSummaryPrint
                  settings={settings}
                  reportType={reportType}
                  selectedDate={selectedDate}
                  activeCategory={activeCategory}
                  totalSales={totalSales}
                  totalWholesaleSales={totalWholesaleSales}
                  totalRetailSales={totalRetailSales}
                  totalCost={totalCost}
                  netProfit={netProfit}
                  totalExpenses={totalExpensesAmount}
                  totalDirectCash={totalDirectCash}
                  totalDirectDebt={totalDirectDebt}
                  totalDirectFib={totalDirectFib}
                  totalDirectUsd={totalDirectUsd}
                  totalItemsSold={totalItemsSold}
                  receiptsCount={filteredSales.length}
                  averageReceiptValue={averageReceiptValue}
                  topItems={Object.entries(itemQuantities)
                    .map(([name, qty]) => ({ name, quantity: qty as number }))
                    .sort((a, b) => b.quantity - a.quantity)
                    .slice(0, 8)}
                  expenses={filteredExpenses.map(e => ({ title: e.title || e.note || 'خەرجی', amount: Number(e.amount || 0), category: e.category }))}
                  isA4={reportModalFormat === 'a4'}
                />
              </div>
            </div>

            {/* Modal Footer with Direct Print Trigger */}
            <div className="px-6 py-4 border-t border-gray-200 bg-white flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">
                {reportModalFormat === '80mm'
                  ? 'گونجاوە بۆ پرینتەری پسوولەی گەرمی 80mm'
                  : 'گونجاوە بۆ پرینتەری لاپەڕەی ئاسایی A4'}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsReportModalOpen(false)}
                  className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  داخستن
                </button>
                <button
                  onClick={() => {
                    if (reportModalFormat === '80mm') {
                      handlePrintReportThermal();
                    } else {
                      handlePrintReportA4();
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition-all active:scale-95"
                >
                  <Printer size={18} />
                  <span>چاپکردن بە پرینتەر</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. Interactive Receipt Reprint Modal (مۆداڵی پیشاندان و چاپی پسوولەی فرۆش) */}
      {/* ========================================================================= */}
      {isReceiptModalOpen && selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200">
          <div className={`bg-white rounded-2xl shadow-2xl w-full ${receiptModalFormat === 'a4' ? 'max-w-4xl' : 'max-w-md'} max-h-[95vh] flex flex-col overflow-hidden border border-gray-200 transition-all duration-200`}>
            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-200 bg-gray-50/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Printer size={20} />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">پێشبینین و چاپی وەسڵ #{selectedReceipt.receiptNumber}</h3>
                  <p className="text-xs text-gray-500">شێوازی چاپ دیاریبکە و وەسڵەکە ڕاستەوخۆ ببینە</p>
                </div>
              </div>

              {/* Format Switcher */}
              <div className="flex items-center gap-2">
                <div className="bg-gray-200/80 p-1 rounded-xl flex gap-1">
                  <button
                    onClick={() => setReceiptModalFormat('80mm')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      receiptModalFormat === '80mm'
                        ? 'bg-white text-indigo-600 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🧾 80mm
                  </button>
                  <button
                    onClick={() => setReceiptModalFormat('a4')}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                      receiptModalFormat === 'a4'
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📄 A4
                  </button>
                </div>

                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Body - Visual Live Preview with Full Scrolling */}
            <div className="flex-1 overflow-y-auto overflow-x-auto p-4 sm:p-6 bg-slate-200/70 flex justify-center items-start min-h-0">
              <div className={`bg-white shadow-2xl rounded-2xl border border-gray-300 ${receiptModalFormat === '80mm' ? 'w-full max-w-[340px]' : 'w-full max-w-[794px]'} my-auto`}>
                {receiptModalFormat === '80mm' ? (
                  <ThermalReceipt
                    settings={settings}
                    receiptNumber={selectedReceipt.receiptNumber}
                    date={selectedReceipt.createdAt ? selectedReceipt.createdAt.toDate() : new Date()}
                    paymentMethod={selectedReceipt.paymentMethod}
                    paymentCurrency={selectedReceipt.paymentCurrency || 'IQD'}
                    customerName={selectedReceipt.customerName}
                    customerPhone={selectedReceipt.customerPhone}
                    items={selectedReceipt.items || []}
                    subtotal={selectedReceipt.subtotal || selectedReceipt.total}
                    discount={selectedReceipt.discount || 0}
                    additionalCharge={selectedReceipt.additionalCharge || 0}
                    total={selectedReceipt.total}
                    amountPaid={selectedReceipt.amountPaid || 0}
                    amountPaidUsd={selectedReceipt.amountPaidUsd || 0}
                    usdExchangeRate={selectedReceipt.usdExchangeRate || (settings as any).usdRate || 1500}
                    previousDebt={selectedReceipt.previousDebt || 0}
                    cashierName={selectedReceipt.cashierName}
                    isReprint={true}
                  />
                ) : (
                  <A4Receipt
                    settings={settings}
                    receiptNumber={selectedReceipt.receiptNumber}
                    date={selectedReceipt.createdAt ? selectedReceipt.createdAt.toDate() : new Date()}
                    paymentMethod={selectedReceipt.paymentMethod}
                    paymentCurrency={selectedReceipt.paymentCurrency || 'IQD'}
                    customerName={selectedReceipt.customerName}
                    customerPhone={selectedReceipt.customerPhone}
                    items={selectedReceipt.items || []}
                    subtotal={selectedReceipt.subtotal || selectedReceipt.total}
                    discount={selectedReceipt.discount || 0}
                    additionalCharge={selectedReceipt.additionalCharge || 0}
                    total={selectedReceipt.total}
                    amountPaid={selectedReceipt.amountPaid || 0}
                    amountPaidUsd={selectedReceipt.amountPaidUsd || 0}
                    usdExchangeRate={selectedReceipt.usdExchangeRate || (settings as any).usdRate || 1500}
                    previousDebt={selectedReceipt.previousDebt || 0}
                    cashierName={selectedReceipt.cashierName}
                    isReprint={true}
                    notes={selectedReceipt.notes}
                  />
                )}
              </div>
            </div>

            {/* Modal Footer with Direct Print Trigger */}
            <div className="px-5 py-3.5 border-t border-gray-200 bg-white flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500 font-bold">
                پسوولەی ژمارە #{selectedReceipt.receiptNumber}
              </span>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="px-4 py-2 text-xs sm:text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition-colors"
                >
                  داخستن
                </button>
                <button
                  onClick={() => {
                    if (receiptModalFormat === '80mm') {
                      handlePrintReceiptThermal();
                    } else {
                      handlePrintReceiptA4();
                    }
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs sm:text-sm shadow-md transition-all active:scale-95"
                >
                  <Printer size={18} />
                  <span>چاپکردن بە پرینتەر</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. Off-Screen Fully Mounted Print Components for react-to-print Engine     */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'fixed',
          top: '-99999px',
          left: '-99999px',
          width: '850px',
          opacity: 0,
          pointerEvents: 'none',
          zIndex: -9999
        }}
        aria-hidden="true"
      >
        {/* A. Report Print Components (Thermal & A4) */}
        <ReportSummaryPrint
          ref={thermalReportRef}
          settings={settings}
          reportType={reportType}
          selectedDate={selectedDate}
          activeCategory={activeCategory}
          totalSales={totalSales}
          totalWholesaleSales={totalWholesaleSales}
          totalRetailSales={totalRetailSales}
          totalCost={totalCost}
          netProfit={netProfit}
          totalExpenses={totalExpensesAmount}
          totalDirectCash={totalDirectCash}
          totalDirectDebt={totalDirectDebt}
          totalDirectFib={totalDirectFib}
          totalDirectUsd={totalDirectUsd}
          totalItemsSold={totalItemsSold}
          receiptsCount={filteredSales.length}
          averageReceiptValue={averageReceiptValue}
          topItems={Object.entries(itemQuantities)
            .map(([name, qty]) => ({ name, quantity: qty as number }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8)}
          expenses={filteredExpenses.map(e => ({ title: e.title || e.note || 'خەرجی', amount: Number(e.amount || 0), category: e.category }))}
          isA4={false}
        />

        <ReportSummaryPrint
          ref={a4ReportRef}
          settings={settings}
          reportType={reportType}
          selectedDate={selectedDate}
          activeCategory={activeCategory}
          totalSales={totalSales}
          totalWholesaleSales={totalWholesaleSales}
          totalRetailSales={totalRetailSales}
          totalCost={totalCost}
          netProfit={netProfit}
          totalExpenses={totalExpensesAmount}
          totalDirectCash={totalDirectCash}
          totalDirectDebt={totalDirectDebt}
          totalDirectFib={totalDirectFib}
          totalDirectUsd={totalDirectUsd}
          totalItemsSold={totalItemsSold}
          receiptsCount={filteredSales.length}
          averageReceiptValue={averageReceiptValue}
          topItems={Object.entries(itemQuantities)
            .map(([name, qty]) => ({ name, quantity: qty as number }))
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 8)}
          expenses={filteredExpenses.map(e => ({ title: e.title || e.note || 'خەرجی', amount: Number(e.amount || 0), category: e.category }))}
          isA4={true}
        />

        {/* B. Sale Receipt Reprints (Thermal & A4) */}
        {selectedReceipt && (
          <>
            <ThermalReceipt
              ref={thermalReceiptRef}
              settings={settings}
              receiptNumber={selectedReceipt.receiptNumber}
              date={selectedReceipt.createdAt ? selectedReceipt.createdAt.toDate() : new Date()}
              paymentMethod={selectedReceipt.paymentMethod}
              paymentCurrency={selectedReceipt.paymentCurrency || 'IQD'}
              customerName={selectedReceipt.customerName}
              customerPhone={selectedReceipt.customerPhone}
              items={selectedReceipt.items || []}
              subtotal={selectedReceipt.subtotal || selectedReceipt.total}
              discount={selectedReceipt.discount || 0}
              additionalCharge={selectedReceipt.additionalCharge || 0}
              total={selectedReceipt.total}
              amountPaid={selectedReceipt.amountPaid || 0}
              amountPaidUsd={selectedReceipt.amountPaidUsd || 0}
              usdExchangeRate={selectedReceipt.usdExchangeRate || (settings as any).usdRate || 1500}
              previousDebt={selectedReceipt.previousDebt || 0}
              cashierName={selectedReceipt.cashierName}
              isReprint={true}
            />

            <A4Receipt
              ref={a4ReceiptRef}
              settings={settings}
              receiptNumber={selectedReceipt.receiptNumber}
              date={selectedReceipt.createdAt ? selectedReceipt.createdAt.toDate() : new Date()}
              paymentMethod={selectedReceipt.paymentMethod}
              paymentCurrency={selectedReceipt.paymentCurrency || 'IQD'}
              customerName={selectedReceipt.customerName}
              customerPhone={selectedReceipt.customerPhone}
              items={selectedReceipt.items || []}
              subtotal={selectedReceipt.subtotal || selectedReceipt.total}
              discount={selectedReceipt.discount || 0}
              additionalCharge={selectedReceipt.additionalCharge || 0}
              total={selectedReceipt.total}
              amountPaid={selectedReceipt.amountPaid || 0}
              amountPaidUsd={selectedReceipt.amountPaidUsd || 0}
              usdExchangeRate={selectedReceipt.usdExchangeRate || (settings as any).usdRate || 1500}
              previousDebt={selectedReceipt.previousDebt || 0}
              cashierName={selectedReceipt.cashierName}
              isReprint={true}
              notes={selectedReceipt.notes}
            />
          </>
        )}
      </div>
    </div>
  );
}
