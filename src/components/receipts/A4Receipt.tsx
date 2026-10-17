import React from 'react';
import Barcode from 'react-barcode';

interface ReceiptItem {
  id?: string;
  name: string;
  quantity: number;
  price: number;
  costPrice?: number;
  wholesalePrice?: number;
  wholesaleCost?: number;
  packSize?: number;
  isWeighed?: boolean;
  isWholesale?: boolean;
  isGift?: boolean;
  returnedQuantity?: number;
  category?: string;
}

interface A4ReceiptProps {
  settings: {
    shopName?: string;
    phone?: string;
    address?: string;
    receiptFooter?: string;
    receiptHeaderNote?: string;
    logoUrl?: string;
    currency?: string;
    usdRate?: number;
  };
  receiptNumber?: string | number;
  date?: Date | string;
  paymentMethod?: 'cash' | 'debt' | 'fib' | string;
  paymentCurrency?: 'IQD' | 'USD' | string;
  customerName?: string;
  customerPhone?: string;
  items: ReceiptItem[];
  subtotal: number;
  discount?: number;
  additionalCharge?: number;
  total: number;
  amountPaid?: number;
  amountPaidUsd?: number;
  usdExchangeRate?: number;
  previousDebt?: number;
  cashierName?: string;
  isReprint?: boolean;
  notes?: string;
}

export const A4Receipt = React.forwardRef<HTMLDivElement, A4ReceiptProps>(
  (
    {
      settings,
      receiptNumber = '100001',
      date = new Date(),
      paymentMethod = 'cash',
      paymentCurrency = 'IQD',
      customerName,
      customerPhone,
      items = [],
      subtotal = 0,
      discount = 0,
      additionalCharge = 0,
      total = 0,
      amountPaid = 0,
      amountPaidUsd = 0,
      usdExchangeRate = 1500,
      previousDebt = 0,
      cashierName,
      isReprint = false,
      notes,
    },
    ref
  ) => {
    const formattedDate = typeof date === 'string'
      ? new Date(date).toLocaleDateString('ku-IQ')
      : date instanceof Date
        ? date.toLocaleDateString('ku-IQ')
        : new Date().toLocaleDateString('ku-IQ');

    const formattedTime = typeof date === 'string'
      ? new Date(date).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
      : date instanceof Date
        ? date.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' });

    const remainingDebtOnReceipt = paymentMethod === 'debt' ? Math.max(0, total - (amountPaid || 0)) : 0;
    const totalCustomerDebt = previousDebt > 0
      ? previousDebt + (paymentMethod === 'debt' ? remainingDebtOnReceipt : 0)
      : remainingDebtOnReceipt;

    const paymentMethodLabel =
      paymentMethod === 'cash' ? 'نەقد (کاش)' :
      paymentMethod === 'fib' ? 'FIB (ئۆنلاین)' :
      paymentMethod === 'debt' ? 'قەرز (حساب)' : paymentMethod;

    const calculatedSubtotal = subtotal > 0 ? subtotal : items.reduce((sum, item) => {
      if (item.isGift) return sum;
      const unit = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
      const qty = item.quantity - (item.returnedQuantity || 0);
      return sum + (unit * qty);
    }, 0);

    const formatQuantity = (qty: number | string | undefined, isWeighed?: boolean) => {
      if (qty === undefined || qty === null || qty === '') return '0';
      const num = Number(qty);
      if (isNaN(num)) return '0';
      if (Number.isInteger(num)) {
        return isWeighed ? `${num} kg` : `${num}`;
      }
      const rounded = parseFloat(num.toFixed(3));
      return isWeighed ? `${rounded} kg` : `${rounded}`;
    };

    return (
      <div
        ref={ref}
        className="w-full max-w-[794px] p-6 sm:p-8 mx-auto bg-white text-gray-950 font-sans leading-normal select-none shadow-none print:w-full print:p-6 print:m-0 print:shadow-none min-h-[1050px] flex flex-col box-border overflow-visible"
        dir="rtl"
        style={{
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          fontFamily: "'Rabar', 'Noto Sans Arabic', 'Segoe UI', system-ui, -apple-system, sans-serif"
        }}
      >
        {/* Style Tag for Precision A4 Page Output */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4 portrait;
              margin: 6mm 8mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .a4-print-card {
                page-break-inside: avoid;
              }
            }
          `
        }} />

        <div className="flex-1">
          {/* Top Corporate Executive Header */}
          <div className="flex justify-between items-start pb-4 border-b-2 border-black">
            <div className="flex items-center gap-3.5">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Company Logo"
                  className="w-16 h-16 object-contain rounded-xl border border-black p-0.5"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-black text-white flex items-center justify-center font-black text-xl border border-black">
                  {(settings.shopName || 'M')[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-black tracking-tight leading-tight">
                  {settings.shopName || 'فرۆشگای نموونەیی'}
                </h1>
                {settings.receiptHeaderNote && (
                  <p className="text-xs font-bold text-gray-800 mt-0.5">{settings.receiptHeaderNote}</p>
                )}
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-800 font-bold mt-1">
                  {settings.address && <span>📍 {settings.address}</span>}
                  {settings.phone && (
                    <span className="font-mono font-black" dir="ltr">
                      ☎ {settings.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left flex flex-col items-end">
              <div className="px-4 py-1.5 bg-black text-white rounded-lg font-black text-sm flex items-center gap-2 mb-1.5">
                <span>وەسڵی فەرمی فرۆشتن</span>
                <span className="text-[10px] text-gray-300 font-mono">INVOICE</span>
              </div>
              {isReprint && (
                <div className="text-[10px] font-black text-black bg-gray-100 px-2 py-0.5 rounded border border-black mb-1">
                  کۆپی دووبارە (REPRINT)
                </div>
              )}
              <div className="space-y-0.5 text-xs text-gray-900 text-left">
                <p>ژمارەی وەسڵ: <span className="font-mono font-black text-white text-xs px-2 py-0.5 bg-black rounded">#{receiptNumber}</span></p>
                <p>بەروار و کات: <span className="font-bold font-mono" dir="ltr">{formattedDate} • {formattedTime}</span></p>
                {cashierName && <p>کاشێر: <span className="font-bold">{cashierName}</span></p>}
              </div>
            </div>
          </div>

          {/* Customer & Transaction Overview Cards - Compact */}
          <div className="grid grid-cols-12 gap-3 my-4 a4-print-card">
            {/* Customer Info */}
            <div className="col-span-7 bg-white border border-black rounded-xl p-3">
              <span className="text-[10px] font-black text-gray-500 block mb-0.5">
                زانیاری کڕیار / بەڕێز
              </span>
              <p className="text-lg font-black text-black">
                {customerName || 'کڕیاری گشتی (کاش)'}
              </p>
              {customerPhone && (
                <p className="text-xs text-gray-900 font-mono font-bold mt-1" dir="ltr">
                  📱 {customerPhone}
                </p>
              )}
            </div>

            {/* Payment & Currency Meta */}
            <div className="col-span-5 bg-white border border-black rounded-xl p-3">
              <span className="text-[10px] font-black text-gray-500 block mb-0.5">
                شێوازی پارەدان و دراو
              </span>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="inline-block px-2.5 py-0.5 rounded-lg text-xs font-black bg-black text-white">
                    {paymentMethodLabel}
                  </span>
                  <p className="text-[10px] text-gray-700 font-bold mt-1">
                    دراو: {paymentCurrency === 'USD' ? 'دۆلاری ئەمریکی ($)' : 'دیناری عێراقی (IQD)'}
                  </p>
                </div>
                {usdExchangeRate > 0 && (
                  <div className="text-left text-[11px] text-gray-900 bg-gray-50 px-2.5 py-1 rounded-lg border border-gray-300">
                    <span className="text-gray-500 text-[10px]">100$: </span>
                    <span className="font-black font-mono">{(usdExchangeRate * 100).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Luxury Items Table with Crisp Borders & Column Dividers */}
          <div className="rounded-xl border border-black overflow-hidden mb-4 a4-print-card">
            <table className="w-full text-right text-xs table-fixed">
              <thead className="bg-black text-white font-black text-[11px]">
                <tr>
                  <th className="py-2 px-2 text-center w-8">#</th>
                  <th className="py-2 px-3 w-[44%] text-right font-black border-r border-white/30">کاڵا</th>
                  <th className="py-2 px-2 text-center w-[14%] font-black border-r border-white/30">بڕ</th>
                  <th className="py-2 px-3 text-center w-[18%] font-black border-r border-white/30">نرخ (IQD)</th>
                  <th className="py-2 px-3 text-left w-[20%] font-black border-r border-white/30">کۆ (IQD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400 font-bold">هیچ کاڵایەک تۆمار نەکراوە</td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const effectiveQty = item.quantity - (item.returnedQuantity || 0);
                    const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                    const lineTotal = item.isGift ? 0 : unitPrice * effectiveQty;

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                        <td className="py-2 px-2 text-center text-[10px] text-gray-600 font-mono font-bold">{idx + 1}</td>
                        <td className="py-2 px-3 border-r border-gray-200">
                          <div className="font-bold text-black text-xs leading-snug">{item.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[9.5px] text-gray-600 mt-0.5 font-bold">
                            {item.isWholesale && <span className="bg-black text-white px-1.5 py-0.2 rounded font-black">جملە</span>}
                            {item.isGift && <span className="bg-black text-white px-1.5 py-0.2 rounded font-black">دیاری</span>}
                            {item.category && <span className="text-gray-500">({item.category})</span>}
                            {item.returnedQuantity && item.returnedQuantity > 0 && (
                              <span className="text-red-600 font-bold underline">(بڕی گەڕاوە: {formatQuantity(item.returnedQuantity, item.isWeighed)})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-2 text-center font-black font-mono text-black text-xs border-r border-gray-200" dir="ltr">
                          {formatQuantity(effectiveQty, item.isWeighed)}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-gray-800 text-xs border-r border-gray-200">
                          {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-left font-black font-mono text-black text-xs border-r border-gray-200">
                          {item.isGift ? '٠' : Math.round(lineTotal).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Financial Breakdown & Details Grid */}
          <div className="grid grid-cols-12 gap-3 items-start a4-print-card">
            {/* Left: Notes & Return/Exchange Barcode */}
            <div className="col-span-7 space-y-2.5">
              {notes && (
                <div className="p-2.5 bg-gray-50 rounded-xl border border-black text-xs text-black">
                  <span className="font-black block mb-0.5">تێبینی:</span>
                  {notes}
                </div>
              )}

              {/* Barcode Dedicated for Return & Exchange */}
              <div className="p-3 bg-white rounded-xl border border-black flex flex-col items-center justify-center text-center">
                <Barcode
                  value={String(receiptNumber || '100001')}
                  format="CODE128"
                  width={1.2}
                  height={32}
                  fontSize={10}
                  margin={0}
                  displayValue={true}
                  background="transparent"
                  lineColor="#000000"
                />
                <span className="text-[10px] font-black text-black mt-1">
                  بارکۆدی تایبەت بە گەڕاندنەوە و گۆڕینەوەی وەسڵ
                </span>
                <span className="text-[9px] text-gray-600 mt-0.5">
                  تکایە لە کاتی گەڕاندنەوە یان گۆڕینەوە ئەم وەسڵە پێشکەش بکەن
                </span>
              </div>
            </div>

            {/* Right: Calculations Summary */}
            <div className="col-span-5 bg-white rounded-xl border border-black p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center text-gray-700 font-bold">
                <span>کۆی کاڵاکان:</span>
                <span className="font-mono font-black text-black">{Math.round(calculatedSubtotal).toLocaleString()} IQD</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-black font-bold">
                  <span>داشکاندن:</span>
                  <span className="font-mono font-black">-{Math.round(discount).toLocaleString()} IQD</span>
                </div>
              )}

              {additionalCharge > 0 && (
                <div className="flex justify-between items-center text-black font-bold">
                  <span>کرێی گەیاندن / زیادە:</span>
                  <span className="font-mono font-black">+{Math.round(additionalCharge).toLocaleString()} IQD</span>
                </div>
              )}

              <div className="p-2.5 bg-black text-white rounded-lg flex justify-between items-center font-black">
                <span className="text-xs">کۆی کۆتایی:</span>
                <span className="font-mono text-xl tracking-tight">{Math.round(total).toLocaleString()} IQD</span>
              </div>

              {usdExchangeRate > 0 && (
                <div className="flex justify-between items-center text-[11px] text-gray-700 pt-0.5">
                  <span>بە دۆلار ($):</span>
                  <span className="font-black font-mono text-black">
                    ${(total / usdExchangeRate).toFixed(2)}
                  </span>
                </div>
              )}

              {paymentMethod === 'debt' && (
                <div className="pt-2 border-t border-dashed border-gray-400 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-gray-800">
                    <span>پارەی دراو:</span>
                    <span className="font-black font-mono">{Math.round(amountPaid || 0).toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between items-center text-black font-black">
                    <span>قەرزی ئەم وەسڵە:</span>
                    <span className="font-black font-mono text-xs">{Math.round(remainingDebtOnReceipt).toLocaleString()} IQD</span>
                  </div>
                  {totalCustomerDebt > remainingDebtOnReceipt && (
                    <div className="flex justify-between items-center text-black font-black pt-0.5 border-t border-gray-300">
                      <span>کۆی گشتی قەرز:</span>
                      <span className="font-black font-mono text-xs">{Math.round(totalCustomerDebt).toLocaleString()} IQD</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Verification Signatures & Stamp Footer */}
        <div className="mt-auto pt-8 border-t-2 border-slate-950 a4-print-card">
          <div className="mb-6 text-center text-gray-900 text-xs font-black bg-gray-100 p-2 rounded-xl border border-gray-300">
            کاڵای فرۆشراو وەرناگیرێتەوە، تەنها گۆڕینەوە هەیە بە مەرجی بوونی ئەم وەسڵە لە ماوەی ٢٤ کاتژمێردا.
          </div>
          <div className="grid grid-cols-3 gap-6 text-center text-xs text-gray-800 mb-5">
            <div>
              <p className="font-black mb-6">واژۆی کاشێر / فرۆشیار</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
            <div>
              <p className="font-black mb-2">مۆری فەرمی فرۆشگا</p>
              <div className="w-16 h-16 mx-auto border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center text-[10px] text-slate-500 font-black">
                مۆری فەرمی
              </div>
            </div>
            <div>
              <p className="font-black mb-6">واژۆی کڕیار / وەرگر</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 font-bold border-t border-gray-200 pt-2 flex justify-between items-center">
            <span>{settings.receiptFooter || 'سوپاس بۆ سەردانەکەتان! هەمیشە بەخێربێن.'}</span>
            <span className="font-mono text-[10px]">POWERED BY MAS MENU • POS SYSTEM</span>
          </div>
        </div>
      </div>
    );
  }
);

A4Receipt.displayName = 'A4Receipt';

