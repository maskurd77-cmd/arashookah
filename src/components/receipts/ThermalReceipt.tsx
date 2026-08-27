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
                width: 70mm !important;
                max-width: 70mm !important;
                margin: 0 auto !important;
                padding: 2mm 2.5mm !important;
                box-sizing: border-box !important;
              }
              * {
                color: #000000 !important;
                box-sizing: border-box !important;
              }
            }
          `
        }} />

        <div className="thermal-receipt-root w-[70mm] max-w-[72mm] mx-auto px-2 py-2 bg-white text-black font-sans leading-tight select-none text-[11px] box-border">
          {/* Header Branding */}
          <div className="text-center pb-2.5 border-b-2 border-black">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Shop Logo"
                className="w-14 h-14 mx-auto mb-1.5 object-contain rounded-full border-2 border-black p-0.5"
              />
            ) : (
              <div className="w-11 h-11 mx-auto mb-1.5 rounded-2xl bg-black text-white flex items-center justify-center font-black text-xl shadow-xs">
                {(settings.shopName || 'M')[0]?.toUpperCase()}
              </div>
            )}

            <h1 className="text-[17px] font-black text-black tracking-normal leading-tight mb-1">
              {settings.shopName || 'فرۆشگای نموونەیی'}
            </h1>

            {settings.receiptHeaderNote && (
              <p className="text-[11px] font-extrabold text-black mb-1 px-1 leading-snug">
                {settings.receiptHeaderNote}
              </p>
            )}

            {settings.address && (
              <p className="text-[11px] text-black font-bold leading-snug mb-0.5 px-1">
                📍 {settings.address}
              </p>
            )}

            {settings.phone && (
              <p className="text-[12px] text-black font-black font-mono tracking-wider mt-1" dir="ltr">
                ☎ {settings.phone}
              </p>
            )}

            {isReprint && (
              <div className="inline-block mt-1.5 px-2.5 py-0.5 bg-black text-white rounded text-[10px] font-black">
                ⚠️ کۆپی دووبارە چاپکراو (REPRINT)
              </div>
            )}
          </div>

          {/* Receipt Meta & Customer Information */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-black font-extrabold">وەسڵی فرۆشتن:</span>
              <span className="font-mono font-black text-black text-[12px] px-2 py-0.5 bg-white rounded border-2 border-black">
                #{receiptNumber}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-black font-bold">بەروار و کات:</span>
              <span className="font-black text-black font-mono text-[11px]" dir="ltr">
                {formattedDate} • {formattedTime}
              </span>
            </div>

            {cashierName && (
              <div className="flex justify-between items-center">
                <span className="text-black font-bold">کاشێر / فرۆشیار:</span>
                <span className="font-black text-black">{cashierName}</span>
              </div>
            )}

            <div className="flex justify-between items-center">
              <span className="text-black font-bold">شێوازی پارەدان:</span>
              <span className="font-black text-black px-1.5 py-0.2 border border-black rounded text-[10.5px]">
                {paymentMethodLabel}
              </span>
            </div>

            {customerName && (
              <div className="mt-1.5 pt-1.5 border-t border-dashed border-black space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-black font-extrabold">ناوی کڕیار:</span>
                  <span className="font-black text-black text-[11.5px] truncate max-w-[155px]">{customerName}</span>
                </div>
                {customerPhone && (
                  <div className="flex justify-between items-center">
                    <span className="text-black font-bold">ژمارەی مۆبایل:</span>
                    <span className="font-mono font-black text-black text-[11px]" dir="ltr">{customerPhone}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Standalone Debt Payment Note if applicable */}
          {isDebtPaymentOnly && (
            <div className="my-2 p-2 bg-white rounded-lg border-2 border-black text-center">
              <p className="font-black text-black text-xs mb-0.5">پسوڵەی واسڵکردنی قەرز</p>
              {debtNote && <p className="text-[11px] text-black font-bold">{debtNote}</p>}
            </div>
          )}

          {/* Items Table - High Contrast, Strict RTL/LTR Column Alignment without cut-off */}
          {!isDebtPaymentOnly && items.length > 0 && (
            <div className="py-2">
              <table className="w-full text-right text-[11px] border-collapse table-fixed">
                <thead>
                  <tr className="border-y-2 border-black text-black font-black text-[11px]">
                    <th className="py-1 text-right w-[46%] pr-1">کاڵا</th>
                    <th className="py-1 text-center w-[15%]">بڕ</th>
                    <th className="py-1 text-center w-[19%]">نرخ</th>
                    <th className="py-1 text-left w-[20%] pl-1">کۆ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/20">
                  {items.map((item, idx) => {
                    const effectiveQty = item.quantity - (item.returnedQuantity || 0);
                    const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                    const lineTotal = item.isGift ? 0 : unitPrice * effectiveQty;

                    return (
                      <tr key={idx} className="align-middle">
                        <td className="py-1.5 pr-1 pl-0.5">
                          <div className="font-black text-black leading-snug break-words text-[11px]">
                            {item.name}
                          </div>
                          <div className="flex flex-wrap items-center gap-1 text-[9px] text-black font-black mt-0.5">
                            {item.isWholesale && <span className="border border-black px-1 rounded">جملە</span>}
                            {item.isGift && <span className="border border-black px-1 rounded">دیاری</span>}
                            {item.returnedQuantity && item.returnedQuantity > 0 && (
                              <span className="underline font-black">(گەڕاوە: {item.returnedQuantity})</span>
                            )}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-black text-black font-mono whitespace-nowrap text-[11px]">
                          {item.isWeighed ? `${Number(effectiveQty.toFixed(3))}kg` : effectiveQty}
                        </td>
                        <td className="py-1.5 text-center font-bold text-black font-mono whitespace-nowrap text-[10.5px]">
                          {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                        </td>
                        <td className="py-1.5 text-left font-black text-black font-mono whitespace-nowrap text-[11px] pl-1">
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
          <div className="pt-2 border-t-2 border-black space-y-1.5 text-[11.5px]">
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">کۆی نرخی کاڵاکان:</span>
              <span className="font-mono font-black text-black">{Math.round(calculatedSubtotal).toLocaleString()} IQD</span>
            </div>

            {discount > 0 && (
              <div className="flex justify-between items-center text-black font-black">
                <span>داشکاندن (تخفیض):</span>
                <span className="font-mono">-{Math.round(discount).toLocaleString()} IQD</span>
              </div>
            )}

            {additionalCharge > 0 && (
              <div className="flex justify-between items-center text-black font-black">
                <span>کرێی گەیاندن / زیادە:</span>
                <span className="font-mono">+{Math.round(additionalCharge).toLocaleString()} IQD</span>
              </div>
            )}

            {/* Total Grand Highlight Box - Crisp, Ultra High Contrast Double Border */}
            <div className="my-2 p-2.5 bg-white border-2 border-black rounded-lg flex justify-between items-center text-black">
              <span className="text-[13px] font-black">کۆی گشتی:</span>
              <span className="font-mono font-black tracking-tight text-[15px]">
                {Math.round(total).toLocaleString()} IQD
              </span>
            </div>

            {/* USD Currency Equivalent */}
            {(paymentCurrency === 'USD' || amountPaidUsd > 0 || (usdExchangeRate && usdExchangeRate > 0)) && (
              <div className="flex justify-between items-center text-[10.5px] text-black bg-white px-2 py-1 rounded border border-black font-bold">
                <span>بڕی بە دۆلار ($):</span>
                <span className="font-black font-mono">
                  ${(total / (usdExchangeRate || 1500)).toFixed(2)}
                  <span className="text-[9.5px] font-bold mr-1">(@{(usdExchangeRate || 1500).toLocaleString()})</span>
                </span>
              </div>
            )}

            {/* Debt / Credit Information */}
            {paymentMethod === 'debt' && (
              <div className="mt-1.5 pt-1.5 border-t-2 border-dashed border-black space-y-1 bg-white p-2 rounded border border-black text-[11px]">
                <div className="flex justify-between items-center text-black">
                  <span className="font-bold">پارەی دراو (واسلکراو):</span>
                  <span className="font-black font-mono">{Math.round(amountPaid || 0).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-black font-black">
                  <span>قەرزی ئەم وەسڵە:</span>
                  <span className="font-mono text-xs">{Math.round(remainingDebtOnReceipt).toLocaleString()} IQD</span>
                </div>
                {totalRemainingCustomerDebt > remainingDebtOnReceipt && (
                  <div className="flex justify-between items-center text-black font-black pt-1 border-t border-black">
                    <span>کۆی گشتی هەموو قەرز:</span>
                    <span className="font-mono text-xs">{Math.round(totalRemainingCustomerDebt).toLocaleString()} IQD</span>
                  </div>
                )}
              </div>
            )}

            {/* Cash Return / Change Calculation */}
            {paymentMethod === 'cash' && amountPaid > total && (
              <div className="mt-1 pt-1.5 border-t-2 border-dashed border-black space-y-1 text-[11px]">
                <div className="flex justify-between items-center text-black">
                  <span className="font-bold">بڕی وەرگیراو:</span>
                  <span className="font-mono font-black">{Math.round(amountPaid).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-black font-black text-xs">
                  <span>باقیە (گەڕاوە):</span>
                  <span className="font-mono font-black">{Math.round(amountPaid - total).toLocaleString()} IQD</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Barcode & QR Code Section */}
          <div className="mt-3 pt-2.5 border-t-2 border-black text-center space-y-2">
            {/* Real QR Code + 1D Barcode Section with Crisp Center Alignment */}
            <div className="flex items-center justify-between gap-2 py-2 px-2 bg-white rounded-lg border-2 border-black">
              <div className="flex flex-col items-center justify-center shrink-0">
                <QRCodeSVG
                  value={qrData}
                  size={54}
                  level="M"
                  includeMargin={false}
                />
                <span className="text-[8.5px] font-black text-black mt-1 font-mono">QR SCAN</span>
              </div>

              <div className="flex flex-col items-center justify-center flex-1 overflow-hidden px-1">
                <div className="max-w-full overflow-hidden flex justify-center py-0.5">
                  <Barcode
                    value={String(receiptNumber || '100001')}
                    format="CODE128"
                    width={1.1}
                    height={30}
                    fontSize={10}
                    margin={0}
                    displayValue={true}
                    background="transparent"
                    lineColor="#000000"
                  />
                </div>
                <span className="text-[8px] font-extrabold text-black mt-0.5">بارکۆدی تایبەتی وەسڵ بۆ گەڕاندنەوە</span>
              </div>
            </div>

            {/* Custom Footer Notice */}
            <p className="text-[10px] text-black font-black leading-relaxed px-1 mt-1">
              {settings.receiptFooter || 'سوپاس بۆ سەردانەکەتان! کاڵای فرۆشراو بە وەسڵ دەگۆڕدرێتەوە.'}
            </p>

            <div className="text-[9px] text-black font-mono font-black tracking-widest pt-1 border-t border-dashed border-black">
              MAS MENU POS • SMART INVOICING
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ThermalReceipt.displayName = 'ThermalReceipt';
