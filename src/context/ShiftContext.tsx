import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, addDoc, updateDoc, doc, serverTimestamp, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';
import { sendTelegramMessage, escapeTelegramHtml } from '../services/telegram';
import { calculateShiftStats } from '../services/shiftStats';

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  startTime: any;
  endTime: any | null;
  status: 'open' | 'closed';
  startingCash: number;
  endingCash?: number;
  totalSalesCount?: number;
  totalSalesAmount?: number;
  cashSalesAmount?: number;
  debtSalesAmount?: number;
  fibSalesAmount?: number;
  totalExpensesAmount?: number;
  notes?: string;
  endingNotes?: string;
  telegramStartSent?: boolean;
  telegramEndSent?: boolean;
}

interface ShiftContextType {
  activeShift: Shift | null;
  loadingShift: boolean;
  startShift: (startingCash: number, notes?: string) => Promise<{ success: boolean; error?: string }>;
  closeShift: (endingNotes?: string) => Promise<{ success: boolean; error?: string }>;
  sendShiftReportToTelegram: (shiftToReport?: Shift) => Promise<{ success: boolean; error?: string }>;
  openStartModal: boolean;
  setOpenStartModal: (open: boolean) => void;
  openCloseModal: boolean;
  setOpenCloseModal: (open: boolean) => void;
}

const ShiftContext = createContext<ShiftContextType>({
  activeShift: null,
  loadingShift: true,
  startShift: async () => ({ success: false }),
  closeShift: async () => ({ success: false }),
  sendShiftReportToTelegram: async () => ({ success: false }),
  openStartModal: false,
  setOpenStartModal: () => {},
  openCloseModal: false,
  setOpenCloseModal: () => {},
});

export const useShift = () => useContext(ShiftContext);

export const ShiftProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, userData } = useAuth();
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [loadingShift, setLoadingShift] = useState(true);
  const [openStartModal, setOpenStartModal] = useState(false);
  const [openCloseModal, setOpenCloseModal] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setActiveShift(null);
      setLoadingShift(false);
      return;
    }

    setLoadingShift(true);
    // Subscribe to any active open shift
    const q = query(
      collection(db, 'shifts'),
      where('status', '==', 'open')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Shift));
        docs.sort((a, b) => {
          const tA = a.startTime?.toMillis ? a.startTime.toMillis() : (a.startTime ? new Date(a.startTime).getTime() : 0);
          const tB = b.startTime?.toMillis ? b.startTime.toMillis() : (b.startTime ? new Date(b.startTime).getTime() : 0);
          return tB - tA;
        });
        setActiveShift(docs[0]);
      } else {
        setActiveShift(null);
      }
      setLoadingShift(false);
    }, (error) => {
      console.warn("Shift subscription error:", error);
      setLoadingShift(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const startShift = async (startingCash: number, notes?: string) => {
    if (!currentUser || !userData) {
      return { success: false, error: "بەکارهێنەر نەدۆزرایەوە" };
    }
    if (activeShift) {
      return { success: false, error: `شەفتێک پێشتر کراوەیە (${activeShift.userName}). سەرەتا ئەوە دابخە.` };
    }

    try {
      const userName = userData.name || currentUser.displayName || currentUser.email || 'کارمەند';
      const userRole = userData.role || 'cashier';
      const formattedDate = new Date().toLocaleString('ku-IQ', {
        dateStyle: 'short',
        timeStyle: 'short'
      });

      // Prepare Telegram message
      const telegramMsg = `
<b>🟢 دەستپێکردنی شەفتی نوێ</b>

👤 <b>کارمەند:</b> ${escapeTelegramHtml(userName)}
💼 <b>ڕۆڵ:</b> ${userRole}
⏰ <b>کاتی دەستپێکردن:</b> ${formattedDate}
💵 <b>پارەی سەرەتایی قاسە:</b> ${(Number(startingCash) || 0).toLocaleString()} IQD
📌 <b>تێبینی:</b> ${escapeTelegramHtml(notes || 'نییە')}
      `.trim();

      // Send telegram notification for starting shift
      const telegramRes = await sendTelegramMessage(telegramMsg);

      // Create shift document
      await addDoc(collection(db, 'shifts'), {
        userId: currentUser.uid,
        userName,
        userRole,
        startTime: serverTimestamp(),
        endTime: null,
        status: 'open',
        startingCash: Number(startingCash) || 0,
        notes: notes || '',
        telegramStartSent: telegramRes.success,
        createdAt: serverTimestamp(),
      });

      setOpenStartModal(false);
      return { success: true };
    } catch (err: any) {
      console.error("Error starting shift:", err);
      return { success: false, error: err.message || "کێشەیەک ڕوویدا لە دەستپێکردنی شەفت" };
    }
  };

  const sendShiftReportToTelegram = async (shiftToReport?: Shift) => {
    const shift = shiftToReport || activeShift;
    if (!shift) return { success: false, error: "هیچ شەفتێک چالاک نییە" };

    let stats;
    try {
      stats = await calculateShiftStats(shift);
    } catch (err: any) {
      console.error("Error calculating shift stats:", err);
      return { success: false, error: "نەتوانرا داتای شەفتەکە بخوێنرێتەوە. تکایە ئینتەرنێت بپشکنە و دووبارە هەوڵ بدە." };
    }
    const startTimeStr = shift.startTime ? (shift.startTime.toDate ? shift.startTime.toDate().toLocaleString('ku-IQ', { dateStyle: 'short', timeStyle: 'short' }) : new Date().toLocaleString()) : 'نادیار';
    const endTimeStr = new Date().toLocaleString('ku-IQ', { dateStyle: 'short', timeStyle: 'short' });

    const message = `
<b>🔴 داخستنی شەفت و ڕاپۆرتی کاری ڕۆژەکە</b>

👤 <b>کارمەند:</b> ${escapeTelegramHtml(shift.userName)}
💼 <b>ڕۆڵ:</b> ${shift.userRole}
⏰ <b>کاتی دەستپێکردن:</b> ${startTimeStr}
🏁 <b>کاتی کۆتایی:</b> ${endTimeStr}

💵 <b>پارەی سەرەتایی قاسە:</b> ${(shift.startingCash || 0).toLocaleString()} IQD
🛒 <b>ژمارەی وەسڵەکان:</b> ${stats.totalSalesCount}
💰 <b>کۆی گشتی فرۆش:</b> ${stats.totalSalesAmount.toLocaleString()} IQD
💵 <b>فرۆشی نەقد:</b> ${stats.cashSalesAmount.toLocaleString()} IQD
💳 <b>فرۆشی قەرز:</b> ${stats.debtSalesAmount.toLocaleString()} IQD
📱 <b>فرۆشی FIB:</b> ${stats.fibSalesAmount.toLocaleString()} IQD
💵 <b>وەرگرتنی قەرز:</b> ${stats.debtPaymentsAmount.toLocaleString()} IQD
↩️ <b>گەڕاندنەوەی پارە:</b> ${stats.refundsAmount.toLocaleString()} IQD
💸 <b>کۆی خەرجییەکان:</b> ${stats.totalExpensesAmount.toLocaleString()} IQD

🏦 <b>صافی پێشبینیکراوی قاسە:</b> ${stats.expectedCashInSafe.toLocaleString()} IQD
    `.trim();

    const res = await sendTelegramMessage(message);
    return res;
  };

  const closeShift = async (endingNotes?: string) => {
    if (!activeShift) {
      return { success: false, error: "هیچ شەفتێکی کاتی چالاک نەدۆزرایەوە" };
    }

    // MANDATORY: send report to Telegram first!
    const telegramResult = await sendShiftReportToTelegram(activeShift);

    if (!telegramResult.success) {
      return {
        success: false,
        error: `${telegramResult.error}\n\n⚠️ ناتوانیت شەفت دابخەیت تا ڕاپۆرتەکە بە سەرکەوتوویی نەنێردرێت بۆ تێلیگرام!`
      };
    }

    try {
      const stats = await calculateShiftStats(activeShift);
      const shiftRef = doc(db, 'shifts', activeShift.id);

      await updateDoc(shiftRef, {
        status: 'closed',
        endTime: serverTimestamp(),
        endingCash: stats.expectedCashInSafe,
        totalSalesCount: stats.totalSalesCount,
        totalSalesAmount: stats.totalSalesAmount,
        cashSalesAmount: stats.cashSalesAmount,
        debtSalesAmount: stats.debtSalesAmount,
        fibSalesAmount: stats.fibSalesAmount,
        totalExpensesAmount: stats.totalExpensesAmount,
        debtPaymentsAmount: stats.debtPaymentsAmount,
        refundsAmount: stats.refundsAmount,
        endingNotes: endingNotes || '',
        telegramEndSent: true,
      });

      setOpenCloseModal(false);
      return { success: true };
    } catch (err: any) {
      console.error("Error closing shift:", err);
      return { success: false, error: err.message || "کێشەیەک لە داخستنی شەفت ڕوویدا" };
    }
  };

  return (
    <ShiftContext.Provider value={{
      activeShift,
      loadingShift,
      startShift,
      closeShift,
      sendShiftReportToTelegram,
      openStartModal,
      setOpenStartModal,
      openCloseModal,
      setOpenCloseModal,
    }}>
      {children}
    </ShiftContext.Provider>
  );
};
