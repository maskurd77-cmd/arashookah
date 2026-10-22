import { collection, query, where, getDocs, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface ShiftStats {
  totalSalesCount: number;
  totalSalesAmount: number;
  /** Cash taken in at the counter for sales (cash sales + the paid part of debt sales) */
  cashSalesAmount: number;
  /** Unpaid part of debt sales */
  debtSalesAmount: number;
  fibSalesAmount: number;
  /** Debt repayments received from customers during the shift */
  debtPaymentsAmount: number;
  /** Cash refunded during the shift for sales made before the shift started */
  refundsAmount: number;
  totalExpensesAmount: number;
  expectedCashInSafe: number;
}

const toDate = (value: any): Date => {
  if (!value) return new Date();
  if (value.toDate) return value.toDate();
  return new Date(value);
};

/**
 * Computes the money summary of a shift. Throws when data cannot be loaded,
 * so a shift is never closed with an incomplete (zero) report.
 */
export async function calculateShiftStats(shift: { startTime: any; startingCash?: number }): Promise<ShiftStats> {
  const start = toDate(shift.startTime);
  const startTs = Timestamp.fromDate(start);

  const [salesSnap, expensesSnap, returnsSnap, debtsSnap] = await Promise.all([
    getDocs(query(collection(db, 'sales'), where('createdAt', '>=', startTs))),
    getDocs(query(collection(db, 'expenses'), where('createdAt', '>=', startTs))),
    getDocs(query(collection(db, 'returns'), where('createdAt', '>=', startTs))),
    getDocs(collection(db, 'debts')),
  ]);

  let totalSalesAmount = 0;
  let cashSalesAmount = 0;
  let debtSalesAmount = 0;
  let fibSalesAmount = 0;
  const shiftSaleIds = new Set<string>();

  salesSnap.docs.forEach(d => {
    shiftSaleIds.add(d.id);
    const s: any = d.data();
    const saleTotal = s.total || 0;
    totalSalesAmount += saleTotal;
    if (s.paymentMethod === 'debt') {
      const paidNow = Math.min(saleTotal, Math.max(0, s.amountPaid || 0));
      cashSalesAmount += paidNow;
      debtSalesAmount += saleTotal - paidNow;
    } else if (s.paymentMethod === 'fib') {
      fibSalesAmount += saleTotal;
    } else {
      cashSalesAmount += saleTotal;
    }
  });

  // Returns of sales made in THIS shift are already reflected in those sales' totals.
  // Only cash refunds for older sales still have to come out of this shift's drawer.
  let refundsAmount = 0;
  returnsSnap.docs.forEach(d => {
    const r: any = d.data();
    if (r.paymentMethod === 'cash' && r.saleId && !shiftSaleIds.has(r.saleId)) {
      refundsAmount += r.totalAmount || 0;
    }
  });

  let debtPaymentsAmount = 0;
  debtsSnap.docs.forEach(d => {
    const debt: any = d.data();
    (debt.payments || []).forEach((p: any) => {
      if (p?.date && new Date(p.date) >= start) debtPaymentsAmount += p.amount || 0;
    });
  });

  const totalExpensesAmount = expensesSnap.docs.reduce((acc, d) => acc + ((d.data() as any).amount || 0), 0);

  const expectedCashInSafe = (shift.startingCash || 0) + cashSalesAmount + debtPaymentsAmount - refundsAmount - totalExpensesAmount;

  return {
    totalSalesCount: salesSnap.docs.length,
    totalSalesAmount,
    cashSalesAmount,
    debtSalesAmount,
    fibSalesAmount,
    debtPaymentsAmount,
    refundsAmount,
    totalExpensesAmount,
    expectedCashInSafe,
  };
}
