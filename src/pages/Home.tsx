import React from 'react';
import { Link } from 'react-router-dom';
import { 
  LayoutDashboard, ShoppingCart, Package, Box, Building2, BookOpen, 
  Receipt, Wallet, BarChart2, Undo2, RefreshCcw, Users, Settings as SettingsIcon, Vault as SafeIcon, Scale, Clock
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Home() {
  const { userData } = useAuth();
  const userRole = userData?.role || 'cashier';

  const menuItems = [
    { title: 'داشبۆرد', icon: LayoutDashboard, path: '/dashboard', color: 'text-rose-600', bg: 'bg-rose-50 hover:bg-rose-100', roles: ['admin', 'manager'] },
    { title: 'کاشێر POS', icon: ShoppingCart, path: '/pos', color: 'text-indigo-600', bg: 'bg-indigo-50 hover:bg-indigo-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'شەفتەکان', icon: Clock, path: '/shifts', color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'قاسە', icon: Wallet, path: '/safe', color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', roles: ['admin', 'manager'] },
    { title: 'کاڵاکان', icon: Package, path: '/products', color: 'text-blue-600', bg: 'bg-blue-50 hover:bg-blue-100', roles: ['admin', 'manager'] },
    { title: 'کۆگا', icon: Box, path: '/inventory', color: 'text-emerald-600', bg: 'bg-emerald-50 hover:bg-emerald-100', roles: ['admin', 'manager'] },
    { title: 'گرتنەوە خەلتە', icon: Scale, path: '/weighed-items', color: 'text-amber-500', bg: 'bg-amber-50 hover:bg-amber-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'شەریکەکان', icon: Building2, path: '/companies', color: 'text-amber-600', bg: 'bg-amber-50 hover:bg-amber-100', roles: ['admin', 'manager'] },
    { title: 'دەفتەری قەرز', icon: BookOpen, path: '/debts', color: 'text-red-600', bg: 'bg-red-50 hover:bg-red-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'وەسڵەکان', icon: Receipt, path: '/receipts', color: 'text-teal-600', bg: 'bg-teal-50 hover:bg-teal-100', roles: ['admin', 'manager'] },
    { title: 'خەرجییەکان', icon: Wallet, path: '/expenses', color: 'text-orange-600', bg: 'bg-orange-50 hover:bg-orange-100', roles: ['admin', 'manager'] },
    { title: 'ڕاپۆرتەکان', icon: BarChart2, path: '/reports', color: 'text-purple-600', bg: 'bg-purple-50 hover:bg-purple-100', roles: ['admin', 'manager'] },
    { title: 'گەڕانەوە', icon: Undo2, path: '/returns', color: 'text-pink-600', bg: 'bg-pink-50 hover:bg-pink-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'گۆڕینەوە', icon: RefreshCcw, path: '/exchanges', color: 'text-cyan-600', bg: 'bg-cyan-50 hover:bg-cyan-100', roles: ['admin', 'manager', 'cashier'] },
    { title: 'بەکارهێنەران', icon: Users, path: '/users', color: 'text-slate-600', bg: 'bg-slate-50 hover:bg-slate-100', roles: ['admin'] },
    { title: 'ڕێکخستن', icon: SettingsIcon, path: '/settings', color: 'text-gray-600', bg: 'bg-gray-50 hover:bg-gray-100', roles: ['admin'] },
  ];

  const allowedMenuItems = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="max-w-7xl mx-auto py-8">
      <div className="flex flex-col items-center justify-center mb-10">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">بەخێربێیت بۆ سیستەم</h1>
        <p className="text-gray-500">تکایە بەشێک هەڵبژێرە بۆ دەستپێکردن</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {allowedMenuItems.map((item, idx) => (
          <Link 
            key={idx} 
            to={item.path}
            className="bg-white rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 p-8 flex flex-col items-center justify-center gap-5 group border border-gray-100"
          >
            <div className={`p-5 rounded-2xl transition-colors duration-300 ${item.bg} ${item.color}`}>
              <item.icon size={40} className="group-hover:scale-110 transition-transform duration-300" />
            </div>
            <span className="font-bold text-gray-700 text-lg text-center whitespace-nowrap">{item.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
