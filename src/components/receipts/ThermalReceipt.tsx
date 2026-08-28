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
        return isWeighed ? `${num}k` : `${num}`;
      }
      const rounded = parseFloat(num.toFixed(3));
      return isWeighed ? `${rounded}k` : `${rounded}`;
    };

    return (
      <div
        ref={ref}
        className="w-full max-w-[80mm] mx-auto p-2 sm:p-3 bg-white text-gray-950 font-sans leading-tight select-none text-[11.5px] box-border overflow-visible print:w-[76mm] print:p-1 print:m-0"
        dir="rtl"
        style={{
          WebkitPrintColorAdjust: 'exact',
          printColorAdjust: 'exact',
          fontFamily: "'Rabar', 'Noto Sans Arabic', 'Segoe UI', system-ui, -apple-system, sans-serif",
          wordBreak: 'break-word'
        }}
      >
        {/* Print Styles for Flawless Thermal Printer Output */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: 80mm auto;
              margin: 0mm !important;
            }
            @media print {
              html, body {
                width: 80mm !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                -webkit-font-smoothing: antialiased !important;
                text-rendering: geometricPrecision !important;
              }
              .thermal-receipt-root {
                width: 72mm !important;
                max-width: 72mm !important;
                margin: 0 auto !important;
                padding: 2mm 1.5mm !important;
                box-sizing: border-box !important;
              }
              * {
                color: #000000 !important;
                box-sizing: border-box !important;
              }
            }
          `
        }} />

        <div className="thermal-receipt-root w-full max-w-[72mm] mx-auto px-1 py-1 bg-white text-black font-sans leading-tight select-none text-[11px] box-border">
          
          {/* Header Branding & Shop Info - Sleek & Compact */}
          <div className="text-center pb-2 border-b border-black">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Shop Logo"
                className="w-12 h-12 mx-auto mb-1 object-contain rounded-xl border border-black p-0.5"
              />
            ) : (
              <div className="w-9 h-9 mx-auto mb-1 rounded-xl bg-black text-white flex items-center justify-center font-black text-base">
                {(settings.shopName || 'M')[0]?.toUpperCase()}
              </div>
            )}

            <h1 className="text-[17px] font-black text-black tracking-tight leading-tight">
              {settings.shopName || 'فرۆشگای نموونەیی'}
            </h1>

            {settings.receiptHeaderNote && (
              <p className="text-[10px] font-bold text-black mt-0.5 px-1 leading-snug">
                {settings.receiptHeaderNote}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-center gap-x-2 text-[10px] font-bold text-black mt-1">
              {settings.address && <span>📍 {settings.address}</span>}
              {settings.phone && <span className="font-mono" dir="ltr">☎ {settings.phone}</span>}
            </div>

            {isReprint && (
              <div className="inline-block mt-1 px-2 py-0.5 bg-black text-white rounded text-[9.5px] font-black">
                کۆپی دووبارە (REPRINT)
              </div>
            )}
          </div>

          {/* Receipt Info & Customer Meta - Compact Grid */}
          <div className="py-1.5 border-b border-black text-[10.5px] space-y-1">
            <div className="flex justify-between items-center">
              <span className="font-black text-black">
                وەسڵ: <span className="font-mono text-[12px] bg-black text-white px-1.5 py-0.2 rounded font-black">#{receiptNumber}</span>
              </span>
              <span className="font-bold text-black font-mono text-[10px]" dir="ltr">
                {formattedDate} {formattedTime}
              </span>
            </div>

            <div className="flex justify-between items-center text-[10.5px]">
              <span className="text-black font-bold">
                شێواز: <span className="font-black underline">{paymentMethodLabel}</span>
              </span>
              {cashierName && (
                <span className="text-black font-bold text-[10px]">
                  کاشێر: <span className="font-black">{cashierName}</span>
                </span>
              )}
            </div>

            {customerName && (
              <div className="flex justify-between items-center pt-0.5 border-t border-dashed border-black/40 text-[10.5px]">
                <span className="font-black text-black truncate max-w-[170px]">
                  کڕیار: <span className="font-bold">{customerName}</span>
                </span>
                {customerPhone && (
                  <span className="font-mono font-bold text-black text-[10px]" dir="ltr">{customerPhone}</span>
                )}
              </div>
            )}
          </div>

          {/* Standalone Debt Payment Note if applicable */}
          {isDebtPaymentOnly && (
            <div className="my-1.5 p-1.5 bg-black/5 rounded border border-black text-center">
              <p className="font-black text-black text-xs">پسوڵەی واسڵکردنی قەرز</p>
              {debtNote && <p className="text-[10px] text-black font-bold mt-0.5">{debtNote}</p>}
            </div>
          )}

          {/* Items Table - Clean, Compact, Perfectly Proportioned with Column Dividers */}
          {!isDebtPaymentOnly && items.length > 0 && (
            <div className="py-1.5 border-b border-black">
              <table className="w-full text-right text-[11px] border-collapse table-fixed">
                <thead>
                  <tr className="border-y border-black font-black text-black text-[10.5px]">
                    <th className="py-1 px-1 text-right w-[42%]">کاڵا</th>
                    <th className="py-1 px-0.5 text-center w-[16%] border-r border-black/40">بڕ</th>
                    <th className="py-1 px-0.5 text-center w-[21%] border-r border-black/40">نرخ</th>
                    <th className="py-1 px-1 text-left w-[21%] border-r border-black/40">کۆ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                  {items.map((item, idx) => {
                    const effectiveQty = item.quantity - (item.returnedQuantity || 0);
                    const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                    const lineTotal = item.isGift ? 0 : unitPrice * effectiveQty;

                    return (
                      <tr key={idx} className="align-middle">
                        <td className="py-1 px-1">
                          <div className="font-bold text-black leading-tight break-words text-[11px]">
                            {item.name}
                          </div>
                          {(item.isWholesale || item.isGift || (item.returnedQuantity && item.returnedQuantity > 0)) && (
                            <div className="flex flex-wrap items-center gap-1 text-[8.5px] text-black font-black mt-0.5">
                              {item.isWholesale && <span className="bg-black text-white px-1 rounded">جملە</span>}
                              {item.isGift && <span className="bg-black text-white px-1 rounded">دیاری</span>}
                              {item.returnedQuantity && item.returnedQuantity > 0 && (
                                <span className="font-black text-black underline">(گەڕاوە: {formatQuantity(item.returnedQuantity, item.isWeighed)})</span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="py-1 px-0.5 text-center font-black text-black font-mono whitespace-nowrap text-[11px] border-r border-black/20" dir="ltr">
                          {formatQuantity(effectiveQty, item.isWeighed)}
                        </td>
                        <td className="py-1 px-0.5 text-center font-bold text-black font-mono whitespace-nowrap text-[10.5px] border-r border-black/20">
                          {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                        </td>
                        <td className="py-1 px-1 text-left font-black text-black font-mono whitespace-nowrap text-[11px] border-r border-black/20">
                          {item.isGift ? '٠' : Math.round(lineTotal).toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Financial Calculation Summary - Compact & High-Impact */}
          <div className="py-1.5 border-b border-black text-[11px] space-y-1">
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">کۆی کاڵاکان:</span>
              <span className="font-mono font-bold text-black">{Math.round(calculatedSubtotal).toLocaleString()} IQD</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between items-center text-black font-bold text-[10.5px]">
                <span>داشکاندن:</span>
                <span className="font-mono">-{Math.round(discount).toLocaleString()} IQD</span>
              </div>
            )}

            {additionalCharge > 0 && (
              <div className="flex justify-between items-center text-black font-bold text-[10.5px]">
                <span>گەیاندن / زیادە:</span>
                <span className="font-mono">+{Math.round(additionalCharge).toLocaleString()} IQD</span>
              </div>
            )}

            {/* Total Grand Highlight Box - Crisp, Clean, Eye-catching */}
            <div className="my-1 py-1.5 px-2 bg-black text-white rounded flex justify-between items-center">
              <span className="text-[13px] font-black">کۆی گشتی:</span>
              <span className="font-mono font-black text-[16px] tracking-tight">
                {Math.round(total).toLocaleString()} IQD
              </span>
            </div>

            {/* USD Currency Equivalent if applicable */}
            {(paymentCurrency === 'USD' || amountPaidUsd > 0 || (usdExchangeRate && usdExchangeRate > 0)) && (
              <div className="flex justify-between items-center text-[10px] text-black font-bold px-1">
                <span>بە دۆلار ($):</span>
                <span className="font-black font-mono">
                  ${(total / (usdExchangeRate || 1500)).toFixed(2)}
                </span>
              </div>
            )}

            {/* Debt / Credit Information */}
            {paymentMethod === 'debt' && (
              <div className="mt-1 pt-1 border-t border-dashed border-black/40 space-y-0.5 text-[10.5px]">
                <div className="flex justify-between items-center text-black">
                  <span className="font-bold">پارەی دراو:</span>
                  <span className="font-bold font-mono">{Math.round(amountPaid || 0).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-black font-black">
                  <span>قەرزی ئەم وەسڵە:</span>
                  <span className="font-mono">{Math.round(remainingDebtOnReceipt).toLocaleString()} IQD</span>
                </div>
                {totalRemainingCustomerDebt > remainingDebtOnReceipt && (
                  <div className="flex justify-between items-center text-black font-black pt-0.5 border-t border-black/30">
                    <span>کۆی گشتی هەموو قەرز:</span>
                    <span className="font-mono">{Math.round(totalRemainingCustomerDebt).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
            )}

            {/* Cash Return / Change Calculation */}
            {paymentMethod === 'cash' && amountPaid > total && (
              <div className="mt-1 pt-1 border-t border-dashed border-black/40 space-y-0.5 text-[10.5px]">
                <div className="flex justify-between items-center text-black">
                  <span className="font-bold">بڕی وەرگیراو:</span>
                  <span className="font-mono font-bold">{Math.round(amountPaid).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-black font-black">
                  <span>باقیە:</span>
                  <span className="font-mono font-black">{Math.round(amountPaid - total).toLocaleString()} IQD</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Barcode Section for Returns & Exchanges - Sleek & Prominent */}
          <div className="pt-2 text-center space-y-1">
            <div className="flex flex-col items-center justify-center p-1.5 bg-black/3 rounded-lg border border-black/20">
              <Barcode
                value={String(receiptNumber || '100001')}
                format="CODE128"
                width={1.2}
                height={30}
                fontSize={10}
                margin={0}
                displayValue={true}
                background="transparent"
                lineColor="#000000"
              />
              <span className="text-[9px] font-black text-black mt-1">
                بارکۆدی تایبەت بە گەڕاندنەوە و گۆڕینەوە
              </span>
            </div>

            {/* Concise Terms / Policy */}
            <p className="text-[9.5px] text-black font-bold leading-tight px-1 pt-0.5">
              {settings.receiptFooter || 'کاڵای فرۆشراو لە ماوەی ٢٤ کاتژمێردا دەگۆڕدرێتەوە بە بوونی ئەم وەسڵە.'}
            </p>

            <div className="text-[8px] text-black/60 font-mono font-bold tracking-widest pt-0.5">
              MAS MENU POS
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';

