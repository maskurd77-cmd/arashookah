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

interface ThermalReceiptProps {
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
  isDebtPaymentOnly?: boolean;
  debtNote?: string;
}

export const ThermalReceipt = React.forwardRef<HTMLDivElement, ThermalReceiptProps>(
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
      isDebtPaymentOnly = false,
      debtNote,
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
    const totalRemainingCustomerDebt = previousDebt > 0
      ? previousDebt + (paymentMethod === 'debt' ? remainingDebtOnReceipt : 0)
      : remainingDebtOnReceipt;

    const paymentMethodLabel =
      paymentMethod === 'cash' ? 'نەقد (کاش)' :
      paymentMethod === 'fib' ? 'FIB (ئۆنلاین)' :
      paymentMethod === 'debt' ? 'قەرز' : paymentMethod;

    // QR Code data payload
    const qrData = JSON.stringify({
      shop: settings.shopName || 'MAS POS',
      rcpt: receiptNumber,
      date: formattedDate,
      total: Math.round(total),
      cur: paymentCurrency,
      items: items.length
    });

    const calculatedSubtotal = subtotal > 0 ? subtotal : items.reduce((sum, item) => {
      if (item.isGift) return sum;
      const unit = item.isWholesale ? (item.wholesalePrice || item.price) : item.price;
      const qty = item.quantity - (item.returnedQuantity || 0);
      return sum + (unit * qty);
    }, 0);

    return (
      <div
        ref={ref}
        className="w-[78mm] max-w-[80mm] mx-auto p-3 bg-white text-gray-950 font-sans leading-tight select-none text-[11px] box-border overflow-hidden print:w-[76mm] print:p-1.5 print:m-0"
        dir="rtl"
        style={{
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          fontFamily: "'Rabar', 'Noto Sans Arabic', 'Segoe UI', system-ui, -apple-system, sans-serif",
          wordBreak: 'break-word'
        }}
      >
        {/* Style tag to ensure crisp, no-cut thermal print output */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: 80mm auto;
              margin: 1.5mm 1.5mm;
            }
            @media print {
              html, body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .thermal-container {
                width: 76mm !important;
                padding: 2mm 1mm !important;
                margin: 0 auto !important;
              }
            }
          `
        }} />

        <div className="thermal-container">
          {/* Header Branding */}
          <div className="text-center pb-2.5 border-b-2 border-dashed border-gray-800">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Shop Logo"
                className="w-12 h-12 mx-auto mb-1.5 object-contain rounded-full border border-gray-300"
              />
            ) : (
              <div className="w-10 h-10 mx-auto mb-1 rounded-2xl bg-gray-950 text-white flex items-center justify-center font-black text-lg shadow-sm">
                {(settings.shopName || 'M')[0]?.toUpperCase()}
              </div>
            )}

            <h1 className="text-base font-black text-gray-950 tracking-tight leading-tight mb-0.5">
              {settings.shopName || 'فرۆشگای نموونەیی'}
            </h1>

            {settings.receiptHeaderNote && (
              <p className="text-[10px] font-bold text-gray-800 mb-0.5 px-2 leading-tight">
                {settings.receiptHeaderNote}
              </p>
            )}

            {settings.address && (
              <p className="text-[10px] text-gray-700 font-medium leading-tight mb-0.5 px-1">
                📍 {settings.address}
              </p>
            )}

            {settings.phone && (
              <p className="text-[11px] text-gray-900 font-black font-mono tracking-wider mt-0.5" dir="ltr">
                ☎ {settings.phone}
              </p>
            )}

            {isReprint && (
              <div className="inline-block mt-1 px-2 py-0.5 bg-gray-200 text-gray-950 rounded text-[9px] font-black border border-gray-400">
                ⚠️ کۆپی دووبارە چاپکراو (REPRINT)
              </div>
            )}
          </div>

          {/* Receipt Meta & Customer Information */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10.5px]">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-bold">پسوڵەی فرۆشتن:</span>
              <span className="font-mono font-black text-gray-950 text-xs px-1.5 py-0.2 bg-gray-100 rounded border border-gray-300">
                #{receiptNumber}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600">بەروار و کات:</span>
              <span className="font-bold text-gray-900 font-mono text-[10px]" dir="ltr">
                {formattedDate} - {formattedTime}
              </span>
            </div>

            {cashierName && (
              <div className="flex justify-between items-center">
                <span className="text-gray-600">کاشێر / فرۆشیار:</span>
                <span className="font-bold text-gray-950">{cashierName}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-gray-600">شێوازی پارەدان:</span>
              <span className="font-black text-gray-950">
                {paymentMethodLabel}
              </span>
            </div>

            {customerName && (
              <div className="mt-1 pt-1 border-t border-dotted border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 font-bold">کڕیار:</span>
                  <span className="font-black text-gray-950 text-[11px] truncate max-w-[170px]">{customerName}</span>
                </div>
                {customerPhone && (
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-gray-600">مۆبایل:</span>
                    <span className="font-mono font-bold text-gray-900 text-[10px]" dir="ltr">{customerPhone}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Standalone Debt Payment Note if applicable */}
          {isDebtPaymentOnly && (
            <div className="my-2 p-2 bg-gray-100 rounded-lg border border-gray-300 text-center">
              <p className="font-black text-gray-950 text-xs mb-0.5">پسوڵەی واسڵکردنی قەرز</p>
              {debtNote && <p className="text-[10px] text-gray-800 font-medium">{debtNote}</p>}
            </div>
          )}

          {/* Items Table - Highly Optimized Table to Prevent Clipping */}
          {!isDebtPaymentOnly && items.length > 0 && (
            <div className="py-2">
              <table className="w-full text-right text-[10.5px] border-collapse table-fixed">
                <thead>
                  <tr className="border-b-2 border-gray-900 text-gray-950 font-black text-[10px]">
                    <th className="pb-1 text-right w-[44%]">کاڵا</th>
                    <th className="pb-1 text-center w-[16%]">بڕ</th>
                    <th className="pb-1 text-center w-[20%]">نرخ</th>
                    <th className="pb-1 text-left w-[20%]">کۆ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => {
                    const effectiveQty = item.quantity - (item.returnedQuantity || 0);
                    const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                    const lineTotal = item.isGift ? 0 : unitPrice * effectiveQty;

                    return (
                      <tr key={idx} className="align-top">
                        <td className="py-1.5 pl-1">
                          <div className="font-bold text-gray-950 leading-tight break-words">
                            {item.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[8.5px] text-gray-600 mt-0.5">
                            {item.isWholesale && <span className="bg-gray-200 text-gray-900 px-1 py-0.2 rounded font-black">جملە</span>}
                            {item.isGift && <span className="bg-gray-200 text-gray-900 px-1 py-0.2 rounded font-black">دیاری</span>}
                            {item.returnedQuantity && item.returnedQuantity > 0 && (
                              <span className="text-gray-900 font-bold underline">(گەڕاوە: {item.returnedQuantity})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-bold text-gray-900 font-mono whitespace-nowrap text-[10px]">
                          {item.isWeighed ? `${Number(effectiveQty.toFixed(3))}kg` : effectiveQty}
                        </td>
                        <td className="py-1.5 text-center text-gray-800 font-mono whitespace-nowrap text-[10px]">
                          {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-left font-black text-gray-950 font-mono whitespace-nowrap text-[10.5px]">
                          {item.isGift ? '٠' : Math.round(lineTotal).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial Calculation Summary */}
          <div className="pt-2 border-t-2 border-dashed border-gray-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-gray-700">
              <span className="font-medium">کۆی نرخی کاڵاکان:</span>
              <span className="font-mono font-bold text-gray-950">{Math.round(calculatedSubtotal).toLocaleString()} IQD</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between items-center text-gray-900 font-bold">
                <span>داشکاندن (تخفیض):</span>
                <span className="font-mono">-{Math.round(discount).toLocaleString()} IQD</span>
              </div>
            )}

            {additionalCharge > 0 && (
              <div className="flex justify-between items-center text-gray-900 font-bold">
                <span>کرێی گەیاندن / زیادە:</span>
                <span className="font-mono">+{Math.round(additionalCharge).toLocaleString()} IQD</span>
              </div>
            )}

            {/* Total Grand Highlight Box */}
            <div className="my-1.5 p-2 bg-gray-950 text-white rounded-lg flex justify-between items-center font-black">
              <span className="text-xs">کۆی کۆتایی:</span>
              <span className="font-mono tracking-tight text-sm sm:text-base">
                {Math.round(total).toLocaleString()} IQD
              </span>
            </div>

            {/* USD Currency Equivalent */}
            {(paymentCurrency === 'USD' || amountPaidUsd > 0 || (usdExchangeRate && usdExchangeRate > 0)) && (
              <div className="flex justify-between items-center text-[10px] text-gray-800 bg-gray-100 px-2 py-1 rounded border border-gray-300">
                <span>بڕی بە دۆلار ($):</span>
                <span className="font-black font-mono">
                  ${(total / (usdExchangeRate || 1500)).toFixed(2)}
                  <span className="text-[9px] text-gray-600 font-normal mr-1">(@{(usdExchangeRate || 1500).toLocaleString()})</span>
                </span>
              </div>
            )}

            {/* Debt / Credit Information */}
            {paymentMethod === 'debt' && (
              <div className="mt-1 pt-1.5 border-t border-dashed border-gray-400 space-y-1 bg-gray-50 p-2 rounded border border-gray-300 text-[10.5px]">
                <div className="flex justify-between items-center text-gray-800">
                  <span>پارەی دراو (واسلکراو):</span>
                  <span className="font-bold font-mono text-gray-950">{Math.round(amountPaid || 0).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-950 font-black">
                  <span>قەرزی ئەم وەسڵە:</span>
                  <span className="font-mono text-xs">{Math.round(remainingDebtOnReceipt).toLocaleString()} IQD</span>
                </div>
                {totalRemainingCustomerDebt > remainingDebtOnReceipt && (
                  <div className="flex justify-between items-center text-gray-950 font-black pt-1 border-t border-gray-300">
                    <span>کۆی گشتی هەموو قەرز:</span>
                    <span className="font-mono text-xs">{Math.round(totalRemainingCustomerDebt).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
            )}

            {/* Cash Return / Change Calculation */}
            {paymentMethod === 'cash' && amountPaid > total && (
              <div className="mt-1 pt-1 border-t border-dotted border-gray-300 space-y-0.5 text-[10.5px]">
                <div className="flex justify-between items-center text-gray-700">
                  <span>بڕی وەرگیراو:</span>
                  <span className="font-mono font-bold">{Math.round(amountPaid).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-950 font-black text-xs">
                  <span>باقیە (گەڕاوە):</span>
                  <span className="font-mono">{Math.round(amountPaid - total).toLocaleString()} IQD</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Barcode & QR Code Section */}
          <div className="mt-3 pt-2.5 border-t-2 border-dashed border-gray-800 text-center space-y-2">
            {/* Real QR Code + 1D Barcode Section */}
            <div className="flex items-center justify-between gap-2 py-1.5 px-2 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex flex-col items-center justify-center shrink-0">
                <QRCodeSVG
                  value={qrData}
                  size={52}
                  level="M"
                  includeMargin={false}
                  className="rounded"
                />
                <span className="text-[8px] font-bold text-gray-500 mt-0.5 font-mono">QR SCAN</span>
              </div>

              <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
                <div className="max-w-full overflow-hidden flex justify-center py-0.5">
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
                </div>
                <span className="text-[7.5px] font-bold text-gray-500 mt-0.5">بارکۆدی تایبەتی وەسڵ بۆ گەڕاندنەوە</span>
              </div>
            </div>

            {/* Custom Footer Notice */}
            <p className="text-[9.5px] text-gray-800 font-bold leading-relaxed px-1">
              {settings.receiptFooter || 'سوپاس بۆ سەردانەکەتان! کاڵای فرۆشراو بە وەسڵ دەگۆڕدرێتەوە.'}
            </p>

            <div className="text-[8.5px] text-gray-500 font-mono font-bold tracking-wider pt-0.5 border-t border-dotted border-gray-300">
              MAS MENU POS • SMART INVOICING
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';
