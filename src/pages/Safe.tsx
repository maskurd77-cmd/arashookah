import React, { useState, useEffect } from 'react';
import { collection, query, onSnapshot, orderBy, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { 
  Wallet, BarChart2, Coins, Smartphone, CreditCard, 
  ArrowRight, Calendar, UserCheck
} from 'lucide-react';
import { startOfDay, endOfDay, format } from 'date-fns';
import { Link } from 'react-router-dom';

export default function Safe() {
  const [sales, setSales] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [debts, setDebts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  useEffect(() => {
    const dayStart = Timestamp.fromDate(startOfDay(selectedDate));
    const dayEnd = Timestamp.fromDate(endOfDay(selectedDate));

    const salesQuery = query(
      collection(db, 'sales'),
      where('createdAt', '>=', dayStart),
      where('createdAt', '<=', dayEnd),
      orderBy('createdAt', 'desc')
    );

    const expensesQuery = query(
      collection(db, 'expenses'),
      where('createdAt', '>=', dayStart),
      where('createdAt', '<=', dayEnd),
      orderBy('createdAt', 'desc')
    );

    const unsubscribeSales = onSnapshot(salesQuery, (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Safe sales query error:", err));

    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.warn("Safe expenses query error:", err));

    const unsubscribeDebts = onSnapshot(collection(db, 'debts'), (snapshot) => {
      setDebts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.warn("Safe debts query error:", err);
      setLoading(false);
    });

    return () => {
      unsubscribeSales();
      unsubscribeExpenses();
      unsubscribeDebts();
    };
  }, [selectedDate]);

  const dayStart = startOfDay(selectedDate);
  const dayEnd = endOfDay(selectedDate);

  const dailySales = sales.filter(s => {
    if (!s.createdAt) return false;
    const date = s.createdAt.toDate();
    return date >= dayStart && date <= dayEnd;
  });

  const dailyExpenses = expenses.filter(e => {
    if (!e.date) return false;
    const date = new Date(e.date);
    return date >= dayStart && date <= dayEnd;
  });

  const dailyDebtPayments = debts.reduce((acc, debt) => {
    const payments = debt.payments || [];
    const todayPayments = payments.filter((p: any) => {
      const pDate = new Date(p.date);
      return pDate >= dayStart && pDate <= dayEnd;
    });
    return acc + todayPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
  }, 0);

  const cashSales = dailySales.filter(s => s.paymentMethod === 'cash').reduce((acc, s) => acc + (s.amountPaid || s.total), 0);
  const fibSales = dailySales.filter(s => s.paymentMethod === 'fib').reduce((acc, s) => acc + (s.amountPaid || s.total), 0);
  const debtSalesMadeToday = dailySales.filter(s => s.paymentMethod === 'debt').reduce((acc, s) => acc + s.total, 0);
  const upfrontDebtCash = dailySales.filter(s => s.paymentMethod === 'debt').reduce((acc, s) => acc + (s.amountPaid || 0), 0);

  const totalSalesValue = cashSales + fibSales + debtSalesMadeToday;

  const totalExpenses = dailyExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

  const totalCashInSafe = cashSales + upfrontDebtCash + dailyDebtPayments - totalExpenses;

  // Active debts with remaining balance
  const activeDebts = debts.filter(debt => {
    const totalPurchases = (debt.purchases || []).reduce((acc: number, p: any) => acc + p.amount, 0);
    const totalPayments = (debt.payments || []).reduce((acc: number, p: any) => acc + p.amount, 0);
    return (totalPurchases - totalPayments) > 0;
  });

  const totalOutstandingDebt = activeDebts.reduce((acc, debt) => {
    const totalPurchases = (debt.purchases || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    const totalPayments = (debt.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
    return acc + (totalPurchases - totalPayments);
  }, 0);

  if (loading) {
    return <div className="flex justify-center items-center h-64">بارکردن...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Wallet size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">قاسە و قەرزەکان</h1>
            <p className="text-gray-500">پوختەی دارایی و حسابات</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-gray-50 px-4 py-2 rounded-xl border border-gray-200">
            <Calendar size={20} className="text-gray-500" />
            <input 
              type="date" 
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(new Date(e.target.value))}
              className="bg-transparent border-none outline-none font-bold text-gray-700"
            />
          </div>
          
          <Link
            to="/"
            className="flex items-center gap-2 px-5 py-2.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-xl transition-all font-bold group border border-gray-200"
          >
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            <span>گەڕانەوە</span>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
          <Wallet className="text-indigo-600" />
          <span>قاسەی دیاریکراو ({format(selectedDate, 'yyyy/MM/dd')})</span>
        </h2>
        
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-indigo-50 rounded-xl p-5 border border-indigo-100 md:col-span-1">
              <div className="flex items-center gap-2 text-indigo-700 mb-2">
                <BarChart2 size={20} />
                <span className="font-bold">کۆی فرۆشراوی ئەمڕۆ</span>
              </div>
              <p className="text-2xl font-bold text-indigo-900">{totalSalesValue.toLocaleString()} IQD</p>
              <p className="text-xs text-indigo-600 mt-1">نرخی هەموو فرۆشراوەکان (نەقد + FIB + قەرز)</p>
            </div>

            <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
              <div className="flex items-center gap-2 text-emerald-700 mb-2">
                <Coins size={20} />
                <span className="font-bold">فرۆشی نەخت</span>
              </div>
              <p className="text-2xl font-bold text-emerald-900">{cashSales.toLocaleString()} IQD</p>
              <p className="text-xs text-emerald-600 mt-1">فرۆشی تەواو نەخت</p>
            </div>

            <div className="bg-orange-50 rounded-xl p-5 border border-orange-100">
              <div className="flex items-center gap-2 text-orange-700 mb-2">
                <CreditCard size={20} />
                <span className="font-bold">فرۆشی بە قەرز</span>
              </div>
              <p className="text-2xl font-bold text-orange-900">{debtSalesMadeToday.toLocaleString()} IQD</p>
              {upfrontDebtCash > 0 && (
                <p className="text-xs text-orange-600 mt-1">
                  پێشەکی وەرگیراو: {upfrontDebtCash.toLocaleString()}
                </p>
              )}
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
              <div className="flex items-center gap-2 text-blue-700 mb-2">
                <Smartphone size={20} />
                <span className="font-bold">فرۆشی FIB</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{fibSales.toLocaleString()} IQD</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-emerald-100 rounded-xl p-5 border border-emerald-200">
              <div className="flex items-center gap-2 text-emerald-800 mb-2">
                <Wallet size={20} />
                <span className="font-bold text-lg">نەختی ناو قاسە</span>
              </div>
              <p className="text-3xl font-bold text-emerald-900">{totalCashInSafe.toLocaleString()} IQD</p>
              <p className="text-sm text-emerald-700 mt-2 font-medium">کۆی نەختی وەرگیراو (فرۆش و قەرز) - خەرجی</p>
            </div>

            <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <CreditCard size={20} />
                <span className="font-bold">قەرزی وەرگیراو</span>
              </div>
              <p className="text-2xl font-bold text-amber-900">{dailyDebtPayments.toLocaleString()} IQD</p>
              <p className="text-xs text-amber-600 mt-1">ئەو قەرزانەی ئەمڕۆ دراونەتەوە</p>
            </div>

            <div className="bg-rose-50 rounded-xl p-5 border border-rose-100">
              <div className="flex items-center gap-2 text-rose-700 mb-2">
                <Wallet size={20} />
                <span className="font-bold">خەرجی</span>
              </div>
              <p className="text-2xl font-bold text-rose-900">{totalExpenses.toLocaleString()} IQD</p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <CreditCard className="text-orange-600" />
            <span>پوختەی قەرزەکان</span>
          </h2>
          <div className="bg-orange-50 text-orange-700 px-4 py-2 rounded-xl font-bold flex items-center gap-2 border border-orange-100">
            <span>کۆی قەرزە دەرەکییەکان:</span>
            <span className="text-xl">{totalOutstandingDebt.toLocaleString()} IQD</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="py-3 px-4 font-bold text-gray-600">ناوی کڕیار</th>
                <th className="py-3 px-4 font-bold text-gray-600">ژمارە تەلەفۆن</th>
                <th className="py-3 px-4 font-bold text-gray-600">کۆی قەرزی براو</th>
                <th className="py-3 px-4 font-bold text-gray-600">پارەی دراو</th>
                <th className="py-3 px-4 font-bold text-gray-600">قەرزی ماوە</th>
                <th className="py-3 px-4 font-bold text-gray-600 text-center">کردارەکان</th>
              </tr>
            </thead>
            <tbody>
              {activeDebts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-500">
                    هیچ قەرزێکی ماوە بوونی نییە
                  </td>
                </tr>
              ) : (
                activeDebts.map(debt => {
                  const totalPurchases = (debt.purchases || []).reduce((sum: number, p: any) => sum + p.amount, 0);
                  const totalPayments = (debt.payments || []).reduce((sum: number, p: any) => sum + p.amount, 0);
                  const remaining = totalPurchases - totalPayments;
                  
                  return (
                    <tr key={debt.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 font-bold text-gray-900 flex items-center gap-2">
                        <UserCheck size={16} className="text-gray-400" />
                        {debt.customerName}
                      </td>
                      <td className="py-3 px-4 text-gray-600" dir="ltr">{debt.phone || '-'}</td>
                      <td className="py-3 px-4 text-rose-600 font-bold">{totalPurchases.toLocaleString()}</td>
                      <td className="py-3 px-4 text-emerald-600 font-bold">{totalPayments.toLocaleString()}</td>
                      <td className="py-3 px-4 text-orange-600 font-bold text-lg">{remaining.toLocaleString()} IQD</td>
                      <td className="py-3 px-4 text-center">
                        <Link 
                          to="/debts"
                          className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 px-3 py-1.5 rounded-lg text-sm font-bold transition-colors inline-block"
                        >
                          بینینی دەفتەر
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
