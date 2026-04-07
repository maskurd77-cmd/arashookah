import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { LockScreen } from './LockScreen';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Boxes,
  BookOpen,
  BarChart3,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Lock,
  Wallet,
  RotateCcw,
  Building2,
  FileText
} from 'lucide-react';

const SidebarItem: React.FC<{ to: string, icon: any, label: string, active: boolean, isCollapsed: boolean, onClick?: () => void }> = ({ to, icon: Icon, label, active, isCollapsed, onClick }) => (
  <Link
    to={to}
    onClick={onClick}
    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
      active ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
    } ${isCollapsed ? 'justify-center px-0' : ''}`}
    title={isCollapsed ? label : undefined}
  >
    <Icon size={20} className={isCollapsed ? 'min-w-[20px]' : ''} />
    {!isCollapsed && <span className="font-medium whitespace-nowrap">{label}</span>}
  </Link>
);

export const Layout = () => {
  const { signOut, userData, setShowFirebaseSetup } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isLocked, setIsLocked] = useState(() => {
    return localStorage.getItem('isLocked') === 'true';
  });
  const [pinCode, setPinCode] = useState<string | null>(null);

  useEffect(() => {
    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPinCode(data.pinCode || null);
      }
    }, (error: any) => {
      console.error("Error fetching settings in layout:", error);
      // Don't show overlay for settings in layout to avoid blocking the whole app
      // if (error.code === 'permission-denied') {
      //   setShowFirebaseSetup(true);
      // }
    });
    return () => unsubscribe();
  }, [setShowFirebaseSetup]);

  const handleLock = () => {
    if (pinCode) {
      setIsLocked(true);
      localStorage.setItem('isLocked', 'true');
      closeMobileMenu();
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    localStorage.removeItem('isLocked');
  };

  const navItems = [
    { to: '/', icon: LayoutDashboard, label: 'داشبۆرد', roles: ['admin', 'manager'] },
    { to: '/pos', icon: ShoppingCart, label: 'کاشێر (POS)', roles: ['admin', 'manager', 'cashier'] },
    { to: '/products', icon: Package, label: 'کالا', roles: ['admin', 'manager'] },
    { to: '/inventory', icon: Boxes, label: 'گۆگا', roles: ['admin', 'manager'] },
    { to: '/companies', icon: Building2, label: 'شەریکەکان', roles: ['admin', 'manager'] },
    { to: '/debts', icon: BookOpen, label: 'دەفتەری قەرز', roles: ['admin', 'manager', 'cashier'] },
    { to: '/receipts', icon: FileText, label: 'وەسڵەکان', roles: ['admin', 'manager', 'cashier'] },
    { to: '/expenses', icon: Wallet, label: 'خەرجییەکان', roles: ['admin', 'manager'] },
    { to: '/reports', icon: BarChart3, label: 'راپۆرتەکان', roles: ['admin', 'manager'] },
    { to: '/returns', icon: RotateCcw, label: 'گەڕانەوە', roles: ['admin', 'manager', 'cashier'] },
    { to: '/exchanges', icon: RotateCcw, label: 'گۆڕینەوە', roles: ['admin', 'manager', 'cashier'] },
    { to: '/users', icon: Users, label: 'بەکارهێنەران', roles: ['admin'] },
    { to: '/settings', icon: Settings, label: 'ڕێکخستن', roles: ['admin'] },
  ];

  const filteredNavItems = navItems.filter(item => userData?.role && item.roles.includes(userData.role));

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden print:hidden" onClick={closeMobileMenu} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 right-0 z-50 bg-white border-l border-gray-200 transform transition-all duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 print:hidden flex flex-col ${
          isMobileMenuOpen ? 'translate-x-0 w-64' : 'translate-x-full lg:translate-x-0'
        } ${isSidebarCollapsed ? 'lg:w-20' : 'lg:w-64'}`}
      >
        <div className={`flex items-center h-16 px-4 border-b border-gray-200 ${isSidebarCollapsed ? 'justify-center' : 'justify-between'}`}>
          {!isSidebarCollapsed && <h1 className="text-xl font-bold text-[#1c44cb] truncate">Aras hookah Shop</h1>}
          <button 
            className="hidden lg:flex p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? "گەورەکردنی لیستی لاوەکی" : "بچووککردنەوەی لیستی لاوەکی"}
          >
            <Menu size={24} />
          </button>
          <button className="lg:hidden text-gray-500 hover:text-gray-700" onClick={closeMobileMenu}>
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden">
          <div className={`flex-1 py-6 space-y-1 overflow-y-auto ${isSidebarCollapsed ? 'px-2' : 'px-4'}`}>
            {filteredNavItems.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.to}
                isCollapsed={isSidebarCollapsed}
                onClick={closeMobileMenu}
              />
            ))}
          </div>

          <div className={`p-4 border-t border-gray-200 space-y-2 ${isSidebarCollapsed ? 'px-2' : ''}`}>
            <div className={`flex items-center gap-3 py-3 rounded-xl bg-gray-50 ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}`} title={isSidebarCollapsed ? userData?.name : undefined}>
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
                {userData?.name?.charAt(0) || 'U'}
              </div>
              {!isSidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{userData?.name}</p>
                  <p className="text-xs text-gray-500 truncate">{userData?.role}</p>
                </div>
              )}
            </div>
            
            {pinCode && (
              <button
                onClick={handleLock}
                className={`flex items-center gap-3 w-full py-3 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}`}
                title={isSidebarCollapsed ? "قفڵکردنی شاشە" : undefined}
              >
                <Lock size={20} className={isSidebarCollapsed ? 'min-w-[20px]' : ''} />
                {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">قفڵکردنی شاشە</span>}
              </button>
            )}

            <button
              onClick={signOut}
              className={`flex items-center gap-3 w-full py-3 text-red-600 rounded-xl hover:bg-red-50 transition-colors ${isSidebarCollapsed ? 'justify-center px-0' : 'px-4'}`}
              title={isSidebarCollapsed ? "چوونە دەرەوە" : undefined}
            >
              <LogOut size={20} className={isSidebarCollapsed ? 'min-w-[20px]' : ''} />
              {!isSidebarCollapsed && <span className="font-medium whitespace-nowrap">چوونە دەرەوە</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible relative">
        {/* Lock Screen Overlay */}
        {isLocked && pinCode && (
          <LockScreen correctPin={pinCode} onUnlock={handleUnlock} />
        )}

        {/* Mobile Header */}
        <header className="lg:hidden flex items-center justify-between h-16 px-4 bg-white border-b border-gray-200 print:hidden">
          <button className="text-gray-500 hover:text-gray-700" onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <h1 className="text-lg font-bold text-indigo-600">Aras hookah Shop</h1>
          <div className="w-6" /> {/* Spacer for centering */}
        </header>

        <div className="flex-1 overflow-auto p-4 lg:p-8 print:p-0 print:overflow-visible relative">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
