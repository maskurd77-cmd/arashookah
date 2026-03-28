import React, { useEffect, useState } from 'react';
import { collection, query, where, Timestamp, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, Package, Users, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { startOfDay, endOfDay, subDays, format, isBefore, addDays, isAfter } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

export default function Dashboard() {
  const { setShowFirebaseSetup } = useAuth();
  const [stats, setStats] = useState({
    dailySales: 0,
    totalProducts: 0,
    totalDebts: 0,
    dailyOrders: 0,
    dailyExpenses: 0,
  });
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [expiringProducts, setExpiringProducts] = useState<any[]>([]);
  const [monthlyStats, setMonthlyStats] = useState<{
    bestMonth: { name: string, sales: number } | null,
    worstMonth: { name: string, sales: number } | null,
    currentMonth: { name: string, sales: number } | null,
    lastMonth: { name: string, sales: number } | null,
  }>({ bestMonth: null, worstMonth: null, currentMonth: null, lastMonth: null });

  useEffect(() => {
    let unsubSales: () => void;
    let unsubProducts: () => void;
    let unsubDebts: () => void;
    let unsubWeeklySales: () => void;
    let unsubExpenses: () => void;
    let unsubMonthlySales: () => void;

    const today = new Date();
    const start = Timestamp.fromDate(startOfDay(today));
    const end = Timestamp.fromDate(endOfDay(today));
    const weekAgo = Timestamp.fromDate(startOfDay(subDays(today, 6)));
    const yearAgo = Timestamp.fromDate(startOfDay(subDays(today, 365)));

    try {
      // Monthly Sales for comparison
      const monthlySalesQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', yearAgo),
        orderBy('createdAt', 'asc')
      );

      unsubMonthlySales = onSnapshot(monthlySalesQuery, (snapshot) => {
        const monthlyTotals: Record<string, number> = {};
        
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.createdAt) {
            const dateStr = format(data.createdAt.toDate(), 'yyyy-MM');
            if (monthlyTotals[dateStr] === undefined) {
              monthlyTotals[dateStr] = 0;
            }
            monthlyTotals[dateStr] += data.total;
          }
        });

        let best = { name: '', sales: -1 };
        let worst = { name: '', sales: Infinity };
        const currentMonthKey = format(today, 'yyyy-MM');
        const lastMonthKey = format(subDays(today, 30), 'yyyy-MM'); // Approximate last month

        Object.entries(monthlyTotals).forEach(([month, sales]) => {
          if (sales > best.sales) best = { name: month, sales };
          if (sales < worst.sales && sales > 0) worst = { name: month, sales };
        });

        setMonthlyStats({
          bestMonth: best.sales !== -1 ? best : null,
          worstMonth: worst.sales !== Infinity ? worst : null,
          currentMonth: monthlyTotals[currentMonthKey] !== undefined ? { name: currentMonthKey, sales: monthlyTotals[currentMonthKey] } : null,
          lastMonth: monthlyTotals[lastMonthKey] !== undefined ? { name: lastMonthKey, sales: monthlyTotals[lastMonthKey] } : null,
        });
      }, (error: any) => {
        console.error("Error fetching monthly sales:", error);
      });

      const salesQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end)
      );
      
      unsubSales = onSnapshot(salesQuery, (salesSnapshot) => {
        let dailySales = 0;
        salesSnapshot.forEach((doc) => {
          dailySales += doc.data().total;
        });
        setStats(prev => ({ ...prev, dailySales: Math.round(dailySales), dailyOrders: salesSnapshot.size }));
      }, (e: any) => {
        console.warn("Could not load sales stats:", e);
        if (e.code === 'permission-denied') setShowFirebaseSetup(true);
      });

      // Today's Expenses
      const expensesQuery = query(
        collection(db, 'expenses'),
        where('createdAt', '>=', start),
        where('createdAt', '<=', end)
      );

      unsubExpenses = onSnapshot(expensesQuery, (expensesSnapshot) => {
        let dailyExpenses = 0;
        expensesSnapshot.forEach((doc) => {
          dailyExpenses += Number(doc.data().amount) || 0;
        });
        setStats(prev => ({ ...prev, dailyExpenses: Math.round(dailyExpenses) }));
      }, (e: any) => {
        console.warn("Could not load expenses stats:", e);
      });

      // Weekly Sales for Chart
      const weeklySalesQuery = query(
        collection(db, 'sales'),
        where('createdAt', '>=', weekAgo),
        orderBy('createdAt', 'asc')
      );

      unsubWeeklySales = onSnapshot(weeklySalesQuery, (snapshot) => {
        const dailyTotals: Record<string, number> = {};
        
        // Initialize last 7 days with 0
        for (let i = 6; i >= 0; i--) {
          const d = subDays(today, i);
          dailyTotals[format(d, 'yyyy-MM-dd')] = 0;
        }

        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.createdAt) {
            const dateStr = format(data.createdAt.toDate(), 'yyyy-MM-dd');
            if (dailyTotals[dateStr] !== undefined) {
              dailyTotals[dateStr] += data.total;
            }
          }
        });

        const formattedData = Object.keys(dailyTotals).map(date => ({
          name: format(new Date(date), 'MM/dd'),
          total: Math.round(dailyTotals[date])
        }));

        setChartData(formattedData);
      }, (error: any) => {
        console.error("Error fetching weekly sales:", error);
      });

      unsubProducts = onSnapshot(collection(db, 'products'), (productsSnapshot) => {
        setStats(prev => ({ ...prev, totalProducts: productsSnapshot.size }));
        
        // Check for expiring products (within 30 days or already expired)
        const expiring: any[] = [];
        const thirtyDaysFromNow = addDays(today, 30);
        
        productsSnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.expiryDate) {
            const expDate = new Date(data.expiryDate);
            if (isBefore(expDate, thirtyDaysFromNow)) {
              expiring.push({
                id: doc.id,
                ...data,
                isExpired: isBefore(expDate, today)
              });
            }
          }
        });
        
        // Sort by expiry date (closest first)
        expiring.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());
        setExpiringProducts(expiring);
      }, (e: any) => console.warn("Could not load products stats:", e));

      unsubDebts = onSnapshot(collection(db, 'debts'), (debtsSnapshot) => {
        let totalDebts = 0;
        debtsSnapshot.forEach((doc) => {
          totalDebts += doc.data().remainingAmount;
        });
        setStats(prev => ({ ...prev, totalDebts: Math.round(totalDebts) }));
        setLoading(false);
      }, (e: any) => {
        console.warn("Could not load debts stats:", e);
        setLoading(false);
      });

    } catch (error: any) {
      console.error("Error setting up dashboard listeners:", error);
      setLoading(false);
    }

    return () => {
      if (unsubSales) unsubSales();
      if (unsubProducts) unsubProducts();
      if (unsubDebts) unsubDebts();
      if (unsubWeeklySales) unsubWeeklySales();
      if (unsubExpenses) unsubExpenses();
    };
  }, [setShowFirebaseSetup]);

  const statCards = [
    { title: 'فرۆشتنی ئەمڕۆ', value: `${stats.dailySales.toLocaleString()} IQD`, icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-100' },
    { title: 'خەرجی ئەمڕۆ', value: `${stats.dailyExpenses.toLocaleString()} IQD`, icon: AlertTriangle, color: 'text-orange-600', bg: 'bg-orange-100' },
    { title: 'ژمارەی پسوڵەکان', value: stats.dailyOrders, icon: DollarSign, color: 'text-blue-600', bg: 'bg-blue-100' },
    { title: 'کۆی کالا', value: stats.totalProducts, icon: Package, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    { title: 'کۆی قەرزەکان', value: `${stats.totalDebts.toLocaleString()} IQD`, icon: Users, color: 'text-red-600', bg: 'bg-red-100' },
  ];

  if (loading) return <div className="flex justify-center items-center h-full">بارکردن...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">داشبۆرد</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
              <div className={`p-4 rounded-xl ${stat.bg} ${stat.color}`}>
                <Icon size={24} />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Stats Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="text-indigo-500" size={24} />
            <h2 className="text-lg font-bold text-gray-900">وەزعی بزنسەکە (مانگانە)</h2>
          </div>
          
          <div className="space-y-4">
            {monthlyStats.currentMonth && (
              <div className="p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <p className="text-sm text-indigo-600 font-medium mb-1">فرۆشی ئەم مانگە ({monthlyStats.currentMonth.name})</p>
                <p className="text-xl font-bold text-indigo-900">{Math.round(monthlyStats.currentMonth.sales).toLocaleString()} IQD</p>
              </div>
            )}
            
            {monthlyStats.lastMonth && (
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                <p className="text-sm text-gray-500 font-medium mb-1">فرۆشی مانگی پێشوو ({monthlyStats.lastMonth.name})</p>
                <p className="text-xl font-bold text-gray-900">{Math.round(monthlyStats.lastMonth.sales).toLocaleString()} IQD</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              {monthlyStats.bestMonth && (
                <div className="p-3 rounded-xl bg-green-50 border border-green-100">
                  <p className="text-xs text-green-600 font-medium mb-1">باشترین مانگ</p>
                  <p className="text-sm font-bold text-green-900">{monthlyStats.bestMonth.name}</p>
                  <p className="text-xs text-green-700 mt-1">{Math.round(monthlyStats.bestMonth.sales).toLocaleString()} IQD</p>
                </div>
              )}
              
              {monthlyStats.worstMonth && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-xs text-red-600 font-medium mb-1">خراپترین مانگ</p>
                  <p className="text-sm font-bold text-red-900">{monthlyStats.worstMonth.name}</p>
                  <p className="text-xs text-red-700 mt-1">{Math.round(monthlyStats.worstMonth.sales).toLocaleString()} IQD</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Chart Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6">فرۆشتنی ٧ ڕۆژی ڕابردوو</h2>
          <div className="h-[300px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 12 }} tickFormatter={(value) => `${value / 1000}k`} />
                <Tooltip 
                  cursor={{ fill: '#f3f4f6' }}
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  formatter={(value: number) => [`${value.toLocaleString()} IQD`, 'فرۆشتن']}
                />
                <Bar dataKey="total" fill="#4f46e5" radius={[4, 4, 0, 0]} maxBarSize={50} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expiry Alerts Section */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex items-center gap-2 mb-6">
            <AlertTriangle className="text-orange-500" size={24} />
            <h2 className="text-lg font-bold text-gray-900">ئاگادارکەرەوەی بەسەرچوون</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 max-h-[300px]">
            {expiringProducts.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-2">
                <Clock size={32} className="opacity-50" />
                <p>هیچ کاڵایەک نزیک نییە لە بەسەرچوون</p>
              </div>
            ) : (
              expiringProducts.map(product => (
                <div 
                  key={product.id} 
                  className={`p-3 rounded-xl border ${
                    product.isExpired 
                      ? 'bg-red-50 border-red-100' 
                      : 'bg-orange-50 border-orange-100'
                  }`}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-gray-900">{product.name}</span>
                    <span className={`text-xs font-bold px-2 py-1 rounded-md ${
                      product.isExpired ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                    }`}>
                      {product.isExpired ? 'بەسەرچووە' : 'نزیکە'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-500">بەروار: {product.expiryDate}</span>
                    <span className="font-medium text-gray-700">ستۆک: {product.stock}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
