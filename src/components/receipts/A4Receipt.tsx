import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
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

    const qrData = JSON.stringify({
      shop: settings.shopName || 'MAS POS',
      invoice: receiptNumber,
      date: formattedDate,
      totalIQD: Math.round(total),
      customer: customerName || 'General',
    });

    return (
      <div
        ref={ref}
        className="w-[794px] max-w-full p-8 mx-auto bg-white text-gray-950 font-sans leading-normal select-none shadow-none print:w-full print:p-6 print:m-0 print:shadow-none min-h-[1080px] flex flex-col box-border overflow-hidden"
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

        <div>
          {/* Top Corporate Executive Header */}
          <div className="flex justify-between items-start pb-5 border-b-2 border-slate-900">
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Company Logo"
                  className="w-20 h-20 object-contain rounded-2xl border border-gray-300 p-1 shadow-xs"
                />
              ) : (
                <div className="w-18 h-18 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-2xl shadow-sm border border-slate-800">
                  {(settings.shopName || 'M')[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-3xl font-black text-slate-950 tracking-tight leading-tight">
                  {settings.shopName || 'فرۆشگای نموونەیی'}
                </h1>
                {settings.receiptHeaderNote && (
                  <p className="text-xs font-bold text-indigo-900 mt-0.5">{settings.receiptHeaderNote}</p>
                )}
                {settings.address && (
                  <p className="text-xs text-gray-700 font-medium mt-1">📍 {settings.address}</p>
                )}
                {settings.phone && (
                  <p className="text-xs text-gray-950 font-black font-mono tracking-wider mt-0.5" dir="ltr">
                    ☎ {settings.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left flex flex-col items-end">
              <div className="px-4 py-1.5 bg-slate-950 text-white rounded-xl font-black text-lg shadow-xs flex items-center gap-2 mb-2">
                <span>وەسڵی فرۆشتن</span>
                <span className="text-xs text-slate-300 font-normal font-mono">INVOICE</span>
              </div>
              {isReprint && (
                <div className="text-[11px] font-black text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded border border-amber-300 mb-1">
                  ⚠️ کۆپی دووبارە چاپکراو (REPRINT)
                </div>
              )}
              <div className="space-y-1 text-xs text-gray-700 text-left">
                <p>ژمارەی پسوڵە: <span className="font-mono font-black text-slate-950 text-sm px-2 py-0.5 bg-gray-100 rounded border border-gray-300">#{receiptNumber}</span></p>
                <p>بەروار: <span className="font-bold text-gray-950 font-mono">{formattedDate}</span></p>
                <p>کات: <span className="font-bold text-gray-950 font-mono">{formattedTime}</span></p>
                {cashierName && <p>کاشێر / فرۆشیار: <span className="font-bold text-gray-950">{cashierName}</span></p>}
              </div>
            </div>
          </div>

          {/* Customer & Transaction Overview Cards */}
          <div className="grid grid-cols-12 gap-4 my-5 a4-print-card">
            {/* Customer Info */}
            <div className="col-span-7 bg-gray-50 border border-gray-300 rounded-2xl p-4 shadow-2xs">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                زانیاری کڕیار / لایەنی دووەم
              </span>
              <p className="text-lg font-black text-gray-950">
                {customerName || 'کڕیاری گشتی (کاش)'}
              </p>
              {customerPhone ? (
                <p className="text-xs text-gray-800 font-mono font-bold mt-1" dir="ltr">
                  📱 {customerPhone}
                </p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-1">ژمارەی مۆبایل تۆمار نەکراوە</p>
              )}
            </div>

            {/* Payment & Currency Meta */}
            <div className="col-span-5 bg-gray-50 border border-gray-300 rounded-2xl p-4 shadow-2xs">
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-1">
                شێوازی پارەدان و دراو
              </span>
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className={`inline-block px-3 py-1 rounded-xl text-xs font-black border ${
                    paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-950 border-emerald-300' :
                    paymentMethod === 'fib' ? 'bg-blue-100 text-blue-950 border-blue-300' :
                    'bg-rose-100 text-rose-950 border-rose-300'
                  }`}>
                    {paymentMethodLabel}
                  </span>
                  <p className="text-[11px] text-gray-600 font-bold mt-1">
                    دراوی مامەڵە: {paymentCurrency === 'USD' ? 'دۆلاری ئەمریکی ($)' : 'دیناری عێراقی (IQD)'}
                  </p>
                </div>
                {usdExchangeRate > 0 && (
                  <div className="text-left text-[11px] text-gray-700 bg-white px-2.5 py-1 rounded-lg border border-gray-300">
                    <span>100$: </span>
                    <span className="font-black font-mono">{(usdExchangeRate * 100).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Luxury Items Table */}
          <div className="rounded-2xl border border-gray-300 overflow-hidden mb-5 a4-print-card shadow-2xs">
            <table className="w-full text-right text-xs table-fixed">
              <thead className="bg-slate-950 text-white font-black text-[11.5px]">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-4 w-[42%]">ناوی کاڵا / وەسف</th>
                  <th className="py-3 px-3 text-center w-[16%]">بڕ / کێش</th>
                  <th className="py-3 px-4 text-center w-[18%]">نرخی دانە</th>
                  <th className="py-3 px-4 text-left w-[20%]">کۆی نرخ (IQD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-gray-400">هیچ کاڵایەک تۆمار نەکراوە</td>
                  </tr>
                ) : (
                  items.map((item, idx) => {
                    const effectiveQty = item.quantity - (item.returnedQuantity || 0);
                    const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                    const lineTotal = item.isGift ? 0 : unitPrice * effectiveQty;

                    return (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                        <td className="py-2.5 px-3 text-center text-[10.5px] text-gray-500 font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-4">
                          <div className="font-bold text-gray-950 text-xs leading-snug">{item.name}</div>
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-gray-600 mt-0.5">
                            {item.isWholesale && <span className="bg-purple-100 text-purple-900 px-1.5 py-0.2 rounded font-black border border-purple-200">جملە (کارتۆن)</span>}
                            {item.isGift && <span className="bg-amber-100 text-amber-900 px-1.5 py-0.2 rounded font-black border border-amber-200">دیاری (بێ بەرامبەر)</span>}
                            {item.category && <span className="text-gray-500">پۆل: {item.category}</span>}
                            {item.returnedQuantity && item.returnedQuantity > 0 && (
                              <span className="text-rose-700 font-bold">(بڕی گەڕاوە: {item.returnedQuantity})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-black font-mono text-gray-900 text-xs">
                          {item.isWeighed ? `${Number(effectiveQty.toFixed(3))} kg` : effectiveQty}
                        </td>
                        <td className="py-2.5 px-4 text-center font-mono font-bold text-gray-800 text-xs">
                          {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                        </td>
                        <td className="py-2.5 px-4 text-left font-black font-mono text-gray-950 text-sm">
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
          <div className="grid grid-cols-12 gap-5 items-start a4-print-card">
            {/* Left: Notes, Return Policy, QR code */}
            <div className="col-span-7 space-y-3">
              {notes && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-300 text-xs text-amber-950">
                  <span className="font-black block mb-1">تێبینی تایبەت:</span>
                  {notes}
                </div>
              )}

              <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-300 text-[11px] text-gray-700 space-y-1">
                <p className="font-black text-gray-950">مەرجەکانی کڕین و گەڕاندنەوە:</p>
                <p>• کاڵای فرۆشراو لە ماوەی ٢٤ کاتژمێردا دەگۆڕدرێتەوە بە مەرجی هێنانەوەی ئەم وەسڵە و پاراستنی بەرگی کاڵاکە. پارە ناگەڕێندرێتەوە.</p>
                <p>• کاڵای کێشراو و داواکراوی تایبەت دوای وەرگرتن ناگەڕێندرێتەوە.</p>
              </div>

              {/* QR Code & Barcode Display */}
              <div className="p-3 bg-gray-50 rounded-2xl border border-gray-300 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <QRCodeSVG value={qrData} size={58} level="M" includeMargin={false} className="rounded" />
                  <div>
                    <span className="text-[11px] font-black text-gray-900 block">سکانی وەسڵی فەرمی</span>
                    <span className="text-[10px] text-gray-500 font-mono">E-Invoice QR Verification</span>
                  </div>
                </div>

                <div className="text-left flex flex-col items-center">
                  <Barcode
                    value={String(receiptNumber || '100001')}
                    format="CODE128"
                    width={1.3}
                    height={36}
                    fontSize={11}
                    margin={0}
                    displayValue={true}
                    background="transparent"
                    lineColor="#000000"
                  />
                  <span className="text-[9px] font-bold text-gray-500 mt-0.5">بارکۆدی دیجیتاڵی وەسڵ</span>
                </div>
              </div>
            </div>

            {/* Right: Calculations Summary */}
            <div className="col-span-5 bg-gray-50 rounded-2xl border border-gray-300 p-4 space-y-2.5 text-xs shadow-2xs">
              <div className="flex justify-between items-center text-gray-700 font-medium">
                <span>کۆی گشتی کاڵاکان:</span>
                <span className="font-mono font-black text-gray-950">{Math.round(calculatedSubtotal).toLocaleString()} IQD</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between items-center text-gray-950 font-bold">
                  <span>داشکاندن (تخفیض):</span>
                  <span className="font-mono font-black">-{Math.round(discount).toLocaleString()} IQD</span>
                </div>
              )}

              {additionalCharge > 0 && (
                <div className="flex justify-between items-center text-gray-950 font-bold">
                  <span>کرێی گەیاندن / زیادە:</span>
                  <span className="font-mono font-black">+{Math.round(additionalCharge).toLocaleString()} IQD</span>
                </div>
              )}

              <div className="pt-2.5 border-t-2 border-slate-900 flex justify-between items-center text-slate-950 font-black text-lg">
                <span>کۆی کۆتایی:</span>
                <span className="font-mono text-2xl tracking-tight">{Math.round(total).toLocaleString()} IQD</span>
              </div>

              {usdExchangeRate > 0 && (
                <div className="flex justify-between items-center text-xs text-gray-700 pt-1 border-t border-dotted border-gray-300">
                  <span>بڕی بە دۆلار ($):</span>
                  <span className="font-black font-mono text-slate-950">
                    ${(total / usdExchangeRate).toFixed(2)}
                    <span className="text-[10px] text-gray-500 font-normal mr-1">(@{usdExchangeRate.toLocaleString()})</span>
                  </span>
                </div>
              )}

              {paymentMethod === 'debt' && (
                <div className="pt-2.5 border-t border-dashed border-gray-400 space-y-1 text-xs">
                  <div className="flex justify-between items-center text-gray-800">
                    <span>پارەی دراو (واسلکراو):</span>
                    <span className="font-black font-mono text-emerald-800">{Math.round(amountPaid || 0).toLocaleString()} IQD</span>
                  </div>
                  <div className="flex justify-between items-center text-gray-950 font-black">
                    <span>قەرزی ئەم وەسڵە:</span>
                    <span className="font-black font-mono text-sm">{Math.round(remainingDebtOnReceipt).toLocaleString()} IQD</span>
                  </div>
                  {totalCustomerDebt > remainingDebtOnReceipt && (
                    <div className="flex justify-between items-center text-gray-950 font-black pt-1 border-t border-gray-300">
                      <span>کۆی گشتی قەرزی کڕیار:</span>
                      <span className="font-black font-mono text-sm">{Math.round(totalCustomerDebt).toLocaleString()} IQD</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Verification Signatures & Stamp Footer */}
        <div className="mt-auto pt-8 border-t-2 border-slate-900 a4-print-card">
          <div className="mb-6 text-center text-gray-900 text-sm font-black bg-gray-100 p-2 rounded-lg border border-gray-300">
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
