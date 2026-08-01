import React, { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useShift } from '../context/ShiftContext';
import { StartShiftModal } from './StartShiftModal';
import { CloseShiftModal } from './CloseShiftModal';
import { doc, onSnapshot, getDoc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { LockScreen } from './LockScreen';
import {
  LogOut,
  Lock,
  ArrowRight,
  Maximize,
  Minimize,
  Wifi,
  WifiOff,
  BatteryCharging,
  BatteryFull,
  BatteryMedium,
  BatteryLow,
  Clock,
  Play,
  Square
} from 'lucide-react';

export const Layout = () => {
  const { signOut, userData, setShowFirebaseSetup } = useAuth();
  const { activeShift, openStartModal, setOpenStartModal, openCloseModal, setOpenCloseModal } = useShift();
  const location = useLocation();
  const navigate = useNavigate();
  const [isLocked, setIsLocked] = useState(() => {
    return localStorage.getItem('isLocked') === 'true';
  });
  const [pinCode, setPinCode] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [batteryState, setBatteryState] = useState<{level: number, charging: boolean} | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((bat: any) => {
        setBatteryState({ level: bat.level, charging: bat.charging });
        bat.addEventListener('levelchange', () => setBatteryState({ level: bat.level, charging: bat.charging }));
        bat.addEventListener('chargingchange', () => setBatteryState({ level: bat.level, charging: bat.charging }));
      });
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const initPin = async () => {
      if (localStorage.getItem('pin_1234_init') !== 'true') {
        const docRef = doc(db, 'settings', 'general');
        try {
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            await updateDoc(docRef, { pinCode: '1234' });
          } else {
            await setDoc(docRef, { pinCode: '1234', shopName: 'aras hookah shop' });
          }
          localStorage.setItem('pin_1234_init', 'true');
        } catch (e) {
          console.error("Could not init pin", e);
        }
      }
    };
    initPin();

    const docRef = doc(db, 'settings', 'general');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setPinCode(data.pinCode || null);
      }
    }, (error: any) => {
      console.error("Error fetching settings in layout:", error);
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [setShowFirebaseSetup]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => console.error(err));
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  const handleLock = () => {
    if (pinCode) {
      setIsLocked(true);
      localStorage.setItem('isLocked', 'true');
    }
  };

  const handleUnlock = () => {
    setIsLocked(false);
    localStorage.removeItem('isLocked');
  };

  const isHome = location.pathname === '/';

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden print:h-auto print:overflow-visible print:bg-white">
      {/* Top Header */}
      <header className={`flex items-center justify-between h-20 px-6 bg-white border-b border-gray-200 shadow-sm shrink-0 print:hidden z-10 ${isFullscreen ? 'hidden' : ''}`}>
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-[#1c44cb] hidden md:block">Aras Hookah Shop</h1>
          
          {!isHome && (
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-all font-bold group border border-indigo-100"
            >
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
              <span>گەڕانەوە بۆ سەرەکی</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-4">
          {/* Shift Status Button */}
          {activeShift ? (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <div className="flex flex-col text-right">
                <span className="text-xs font-black text-emerald-800">شەفتی چالاک</span>
                <span className="text-[10px] text-emerald-600 font-bold">{activeShift.userName}</span>
              </div>
              <button
                onClick={() => setOpenCloseModal(true)}
                className="mr-1 px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm flex items-center gap-1"
                title="داخستنی شەفت و ناردنی ڕاپۆرت"
              >
                <Square size={12} className="fill-white" />
                <span>داخستن</span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setOpenStartModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl transition-all text-xs font-black shadow-sm"
            >
              <Play size={14} className="fill-amber-600 text-amber-600" />
              <span>دەستپێکردنی شەفت</span>
            </button>
          )}

          <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-xl border border-gray-100">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold shrink-0">
              {userData?.name?.charAt(0) || 'U'}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-gray-900">{userData?.name}</span>
              <span className="text-xs text-gray-500 font-medium">{userData?.role}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={toggleFullscreen}
              className="p-2.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors bg-gray-50 border border-gray-100"
              title={isFullscreen ? "چوونە دەرەوە لە شاشەی پڕ" : "شاشەی پڕ"}
            >
              {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
            </button>
            {pinCode && (
              <button
                onClick={handleLock}
                className="p-2.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors bg-gray-50 border border-gray-100"
                title="قفڵکردنی شاشە"
              >
                <Lock size={20} />
              </button>
            )}
            <button
              onClick={signOut}
              className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors bg-red-50/50 border border-red-100"
              title="چوونە دەرەوە"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      {isFullscreen && (
        <div className="bg-gray-900 text-gray-200 px-4 py-2 rounded-xl flex items-center justify-between text-sm font-medium shrink-0 shadow-lg fixed top-4 left-4 right-4 z-50">
          <div className="flex items-center gap-6">
            {!isHome && (
              <button
                onClick={() => navigate('/')}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all font-bold border border-gray-700"
              >
                <ArrowRight size={18} />
                <span>گەڕانەوە</span>
              </button>
            )}
            <span dir="ltr" className="font-bold text-lg text-white">{currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
            <span>{currentTime.toLocaleDateString('ku-IQ', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          </div>
          <div className="flex items-center gap-6">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 ${isOnline ? 'text-green-400' : 'text-rose-400'}`}>
              {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
              <span className="font-bold">{isOnline ? 'ئۆنلاین' : 'ئۆفلاین'}</span>
            </div>
            {batteryState && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-800 text-gray-300">
                {batteryState.charging ? <BatteryCharging size={18} className="text-green-400" /> : 
                  (batteryState.level > 0.8 ? <BatteryFull size={18} /> : 
                   batteryState.level > 0.3 ? <BatteryMedium size={18} /> : 
                   <BatteryLow size={18} className="text-rose-400" />)}
                <span dir="ltr" className="font-bold text-white">{Math.round(batteryState.level * 100)}%</span>
              </div>
            )}
            {pinCode && (
              <button
                onClick={handleLock}
                className="hover:bg-amber-900/50 hover:text-amber-400 text-gray-300 transition-colors p-2 bg-gray-800 rounded-lg shadow-sm border border-gray-700"
                title="قفڵکردنی شاشە"
              >
                <Lock size={18} />
              </button>
            )}
            <button onClick={toggleFullscreen} className="hover:bg-gray-700 hover:text-white transition-colors p-2 bg-gray-800 rounded-lg shadow-sm border border-gray-700">
              <Minimize size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden print:overflow-visible relative">
        {/* Modals */}
        <StartShiftModal isOpen={openStartModal} onClose={() => setOpenStartModal(false)} />
        <CloseShiftModal isOpen={openCloseModal} onClose={() => setOpenCloseModal(false)} />

        {/* Lock Screen Overlay */}
        {isLocked && pinCode && (
          <LockScreen correctPin={pinCode} onUnlock={handleUnlock} />
        )}

        <div className={`flex-1 overflow-auto p-4 lg:p-8 print:p-0 print:overflow-visible relative ${isFullscreen ? 'h-screen w-screen p-4 pt-20 m-0 fixed inset-0 z-40 bg-gray-50' : ''}`}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

