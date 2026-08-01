import React, { useEffect, useState } from 'react';
import { collection, query, where, Timestamp, onSnapshot, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '../firebase';
import { TrendingUp, Package, Users, DollarSign, AlertTriangle, Clock } from 'lucide-react';
import { startOfDay, endOfDay, subDays, format, isBefore, addDays } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';

// In-memory cache for historical and aggregate metrics to prevent repeated reads on page navigation
interface DashboardCache {
  timestamp: number;
  totalProducts: number;
  expiringProducts: any[];
  totalDebts: number;
  chartData: any[];
  monthlyStats: {
    bestMonth: { name: string; sales: number } | null;
    worstMonth: { name: string; sales: number } | null;
    currentMonth: { name: string; sales: number } | null;
    lastMonth: { name: string; sales: number } | null;
  };
}

let dashboardCache: DashboardCache | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5-minute cache TTL

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
    bestMonth: { name: string; sales: number } | null;
    worstMonth: { name: string; sales: number } | null;
    currentMonth: { name: string; sales: number } | null;
    lastMonth: { name: string; sales: number } | null;
  }>({ bestMonth: null, worstMonth: null, currentMonth: null, lastMonth: null });

  useEffect(() => {
    let isMounted = true;
    let unsubSales: (() => void) | undefined;
    let unsubExpenses: (() => void) | undefined;

    const today = new Date();
    const start = Timestamp.fromDate(startOfDay(today));
    const end = Timestamp.fromDate(endOfDay(today));
    const weekAgo = subDays(today, 6);
    const twoMonthsAgo = Timestamp.fromDate(startOfDay(subDays(today, 60)));

    // -------------------------------------------------------------
    // OPTIMIZATION 1: REAL-TIME LISTENERS (Bounded to TODAY only)
    // -------------------------------------------------------------
    // 1. Today's Sales (Real-time live updates for cashier activity)
    const salesQuery = query(
      collection(db, 'sales'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end)
    );

    unsubSales = onSnapshot(
      salesQuery,
      (salesSnapshot) => {
        if (!isMounted) return;
        let dailySales = 0;
        salesSnapshot.forEach((doc) => {
          dailySales += doc.data().total || 0;
        });
        setStats((prev) => ({
          ...prev,
          dailySales: Math.round(dailySales),
          dailyOrders: salesSnapshot.size,
        }));
      },
      (e: any) => {
        console.warn("Could not load sales stats:", e);
        if (e.code === 'permission-denied') setShowFirebaseSetup(true);
      }
    );

    // 2. Today's Expenses (Real-time live updates)
    const expensesQuery = query(
      collection(db, 'expenses'),
      where('createdAt', '>=', start),
      where('createdAt', '<=', end)
    );

    unsubExpenses = onSnapshot(
      expensesQuery,
      (expensesSnapshot) => {
        if (!isMounted) return;
        let dailyExpenses = 0;
        expensesSnapshot.forEach((doc) => {
          dailyExpenses += Number(doc.data().amount) || 0;
        });
        setStats((prev) => ({ ...prev, dailyExpenses: Math.round(dailyExpenses) }));
      },
      (e: any) => {
        console.warn("Could not load expenses stats:", e);
      }
    );

    // -------------------------------------------------------------
    // OPTIMIZATION 2: HISTORICAL & AGGREGATE METRICS WITH CACHING
    // Replace heavy onSnapshot streams for entire collections/months
    // with getCountFromServer & one-shot getDocs + 5-minute cache.
    // -------------------------------------------------------------
    const loadHistoricalData = async () => {
      // Return cached data if valid to avoid refetching on every tab navigation
      if (dashboardCache && (Date.now() - dashboardCache.timestamp < CACHE_TTL_MS)) {
        if (isMounted) {
          setStats((prev) => ({
            ...prev,
            totalProducts: dashboardCache!.totalProducts,
            totalDebts: dashboardCache!.totalDebts,
          }));
          setExpiringProducts(dashboardCache.expiringProducts);
          setChartData(dashboardCache.chartData);
          setMonthlyStats(dashboardCache.monthlyStats);
          setLoading(false);
        }
        return;
      }

      try {
        // A. Optimized Product Count via getCountFromServer (1 read unit instead of N)
        const productCountPromise = getCountFromServer(collection(db, 'products'))
          .then((snap) => snap.data().count)
          .catch(() => 0);

        // B. One-shot products fetch for expiry alerts
        const productsDocPromise = getDocs(collection(db, 'products'))
          .then((snapshot) => {
            const expiring: any[] = [];
            const thirtyDaysFromNow = addDays(today, 30);

            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.expiryDate) {
                const expDate = new Date(data.expiryDate);
                if (isBefore(expDate, thirtyDaysFromNow)) {
                  expiring.push({
                    id: doc.id,
                    ...data,
                    isExpired: isBefore(expDate, today),
                  });
                }
              }
            });

            expiring.sort(
              (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
            );
            return expiring;
          })
          .catch(() => []);

        // C. One-shot debts fetch for total debts sum
        const debtsPromise = getDocs(collection(db, 'debts'))
          .then((snapshot) => {
            let totalDebts = 0;
            snapshot.forEach((doc) => {
              totalDebts += doc.data().remainingAmount || 0;
            });
            return Math.round(totalDebts);
          })
          .catch(() => 0);

        // D. Single historical sales query (last 60 days) to derive BOTH weekly chart & monthly stats
        const sales60DaysQuery = query(
          collection(db, 'sales'),
          where('createdAt', '>=', twoMonthsAgo)
        );

        const sales60DaysPromise = getDocs(sales60DaysQuery)
          .then((snapshot) => {
            const monthlyTotals: Record<string, number> = {};
            const weeklyTotals: Record<string, number> = {};

            // Initialize last 7 days chart array
            for (let i = 6; i >= 0; i--) {
              const d = subDays(today, i);
              weeklyTotals[format(d, 'yyyy-MM-dd')] = 0;
            }

            snapshot.forEach((doc) => {
              const data = doc.data();
              if (data.createdAt) {
                const docDate = data.createdAt.toDate();
                const monthKey = format(docDate, 'yyyy-MM');
                monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + (data.total || 0);

                if (docDate >= startOfDay(weekAgo)) {
                  const dayKey = format(docDate, 'yyyy-MM-dd');
                  if (weeklyTotals[dayKey] !== undefined) {
                    weeklyTotals[dayKey] += data.total || 0;
                  }
                }
              }
            });

            // Format Chart Data
            const chartDataFormatted = Object.keys(weeklyTotals).map((date) => ({
              name: format(new Date(date), 'MM/dd'),
              total: Math.round(weeklyTotals[date]),
            }));

            // Format Monthly Stats
            let best = { name: '', sales: -1 };
            let worst = { name: '', sales: Infinity };
            const currentMonthKey = format(today, 'yyyy-MM');
            const lastMonthKey = format(subDays(today, 30), 'yyyy-MM');

            Object.entries(monthlyTotals).forEach(([month, sales]) => {
              if (sales > best.sales) best = { name: month, sales };
              if (sales < worst.sales && sales > 0) worst = { name: month, sales };
            });

            const computedMonthlyStats = {
              bestMonth: best.sales !== -1 ? best : null,
              worstMonth: worst.sales !== Infinity ? worst : null,
              currentMonth:
                monthlyTotals[currentMonthKey] !== undefined
                  ? { name: currentMonthKey, sales: monthlyTotals[currentMonthKey] }
                  : null,
              lastMonth:
                monthlyTotals[lastMonthKey] !== undefined
                  ? { name: lastMonthKey, sales: monthlyTotals[lastMonthKey] }
                  : null,
            };

            return { chartDataFormatted, computedMonthlyStats };
          })
          .catch(() => ({
            chartDataFormatted: [],
            computedMonthlyStats: { bestMonth: null, worstMonth: null, currentMonth: null, lastMonth: null },
          }));

        // Execute queries in parallel
        const [totalProductsCount, expiringList, totalDebtsSum, salesAnalysis] = await Promise.all([
          productCountPromise,
          productsDocPromise,
          debtsPromise,
          sales60DaysPromise,
        ]);

        if (!isMounted) return;

        // Store in cache
        dashboardCache = {
          timestamp: Date.now(),
          totalProducts: totalProductsCount,
          expiringProducts: expiringList,
          totalDebts: totalDebtsSum,
          chartData: salesAnalysis.chartDataFormatted,
          monthlyStats: salesAnalysis.computedMonthlyStats,
        };

        setStats((prev) => ({
          ...prev,
          totalProducts: totalProductsCount,
          totalDebts: totalDebtsSum,
        }));
        setExpiringProducts(expiringList);
        setChartData(salesAnalysis.chartDataFormatted);
        setMonthlyStats(salesAnalysis.computedMonthlyStats);
      } catch (error) {
        console.error("Error loading historical dashboard metrics:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadHistoricalData();

    // Cleanup active snapshot listeners on unmount
    return () => {
      isMounted = false;
      if (unsubSales) unsubSales();
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
