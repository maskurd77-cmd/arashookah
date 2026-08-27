import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Barcode from 'react-barcode';

interface ReturnedItem {
  id?: string;
  name: string;
  returnQuantity: number;
  price: number;
  wholesalePrice?: number;
  isWholesale?: boolean;
  isGift?: boolean;
  packSize?: number;
}

interface ReturnReceiptProps {
  settings: {
    shopName?: string;
    phone?: string;
    address?: string;
    receiptFooter?: string;
    logoUrl?: string;
  };
  returnNumber: string | number;
  originalReceiptNumber: string | number;
  returnDate?: Date | string;
  customerName?: string;
  customerPhone?: string;
  items: ReturnedItem[];
  subtotalAmount: number;
  discountAmount?: number;
  totalRefundAmount: number;
  paymentMethod?: string;
  cashierName?: string;
  notes?: string;
}

export const ReturnReceipt = React.forwardRef<HTMLDivElement, ReturnReceiptProps>(
  (
    {
      settings,
      returnNumber,
      originalReceiptNumber,
      returnDate = new Date(),
      customerName,
      customerPhone,
      items = [],
      subtotalAmount = 0,
      discountAmount = 0,
      totalRefundAmount = 0,
      paymentMethod = 'cash',
      cashierName,
      notes,
    },
    ref
  ) => {
    const formattedDate = typeof returnDate === 'string'
      ? new Date(returnDate).toLocaleDateString('ku-IQ')
      : returnDate instanceof Date
        ? returnDate.toLocaleDateString('ku-IQ')
        : new Date().toLocaleDateString('ku-IQ');

    const formattedTime = typeof returnDate === 'string'
      ? new Date(returnDate).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
      : returnDate instanceof Date
        ? returnDate.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' });

    const qrData = JSON.stringify({
      type: 'RETURN',
      shop: settings.shopName || 'MAS POS',
      retNo: returnNumber,
      origRcpt: originalReceiptNumber,
      date: formattedDate,
      refundIQD: Math.round(totalRefundAmount),
      itemsCount: items.length
    });

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
              .thermal-return-root {
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

        <div className="thermal-return-root w-[70mm] max-w-[72mm] mx-auto px-2 py-2 bg-white text-black font-sans leading-tight select-none text-[11px] box-border">
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

            <div className="inline-block my-1 px-3 py-0.5 bg-white text-black rounded border-2 border-black text-xs font-black">
              پسوڵەی گەڕاندنەوە (RETURN VOUCHER)
            </div>

            {settings.address && (
              <p className="text-[11px] text-black font-bold leading-snug mb-0.5 px-1">
                📍 {settings.address}
              </p>
            )}

            {settings.phone && (
              <p className="text-[12px] text-black font-black font-mono tracking-wider mt-0.5" dir="ltr">
                ☎ {settings.phone}
              </p>
            )}
          </div>

          {/* Return Info & Meta */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-black font-bold">ژمارەی گەڕاندنەوە:</span>
              <span className="font-mono font-black text-black text-[12px] px-2 py-0.5 bg-white rounded border-2 border-black">
                #{returnNumber}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-black font-bold">وەسڵی بنەڕەتی:</span>
              <span className="font-mono font-black text-black text-[12px] px-2 py-0.5 bg-white rounded border border-black">
                #{originalReceiptNumber}
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
                <span className="text-black font-bold">کارمەند:</span>
                <span className="font-black text-black">{cashierName}</span>
              </div>
            )}

            {customerName && (
              <div className="flex justify-between items-center pt-1 border-t border-dashed border-black">
                <span className="text-black font-extrabold">کڕیار:</span>
                <span className="font-black text-black truncate max-w-[155px]">{customerName}</span>
              </div>
            )}
          </div>

          {/* Returned Items Table */}
          <div className="py-2">
            <table className="w-full text-right text-[11px] border-collapse table-fixed">
              <thead>
                <tr className="border-y-2 border-black text-black font-black text-[11px]">
                  <th className="py-1 text-right w-[46%] pr-1">کاڵای گەڕاوە</th>
                  <th className="py-1 text-center w-[15%]">بڕ</th>
                  <th className="py-1 text-center w-[19%]">نرخ</th>
                  <th className="py-1 text-left w-[20%] pl-1">کۆ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/20">
                {items.map((item, idx) => {
                  const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                  const lineTotal = item.isGift ? 0 : unitPrice * item.returnQuantity;

                  return (
                    <tr key={idx} className="align-middle">
                      <td className="py-1.5 pr-1 pl-0.5">
                        <div className="font-black text-black leading-snug break-words text-[11px]">
                          {item.name}
                        </div>
                        {item.isWholesale && <span className="text-[9px] border border-black px-1 rounded font-black">جملە</span>}
                        {item.isGift && <span className="text-[9px] border border-black px-1 rounded font-black">دیاری</span>}
                      </td>
                      <td className="py-1.5 text-center font-black text-black font-mono whitespace-nowrap text-[11px]">
                        -{item.returnQuantity}
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

          {/* Refund Calculation Summary */}
          <div className="pt-2 border-t-2 border-black space-y-1.5 text-[11.5px]">
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">کۆی گشتی کاڵای گەڕاوە:</span>
              <span className="font-mono font-black text-black">{Math.round(subtotalAmount).toLocaleString()} IQD</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-black font-black">
                <span>داشکاندنی هاوتای گەڕاوە:</span>
                <span className="font-mono">-{Math.round(discountAmount).toLocaleString()} IQD</span>
              </div>
            )}

            {/* Total Refund Highlight Box */}
            <div className="my-2 p-2.5 bg-white border-2 border-black rounded-lg flex justify-between items-center text-black">
              <span className="text-[13px] font-black">کۆی پارەی گەڕاوە:</span>
              <span className="font-mono font-black tracking-tight text-[15px]">
                {Math.round(totalRefundAmount).toLocaleString()} IQD
              </span>
            </div>

            {notes && (
              <div className="p-2 bg-white rounded border border-black text-[10.5px] text-black font-bold">
                <span className="font-black">تێبینی:</span> {notes}
              </div>
            )}
          </div>

          {/* Barcode & QR Code Section */}
          <div className="mt-3 pt-2.5 border-t-2 border-black text-center space-y-2">
            <div className="flex items-center justify-between gap-2 py-2 px-2 bg-white rounded-lg border-2 border-black">
              <div className="flex flex-col items-center justify-center shrink-0">
                <QRCodeSVG
                  value={qrData}
                  size={54}
                  level="M"
                  includeMargin={false}
                />
                <span className="text-[8.5px] font-black text-black mt-1 font-mono">VERIFY</span>
              </div>

              <div className="flex flex-col items-center justify-center flex-1 overflow-hidden px-1">
                <div className="max-w-full overflow-hidden flex justify-center py-0.5">
                  <Barcode
                    value={String(returnNumber || originalReceiptNumber || 'RET-001')}
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
                <span className="text-[8px] font-extrabold text-black mt-0.5">بارکۆدی وەسڵی گەڕاوە</span>
              </div>
            </div>

            <p className="text-[10px] text-black font-black leading-relaxed px-1">
              ئەم پسوڵەیە بەڵگەی فەرمی گەڕاندنەوەی کاڵا و وەرگرتنەوەی پارەیە.
            </p>

            <div className="text-[9px] text-black font-mono font-black tracking-widest pt-1 border-t border-dashed border-black">
              MAS MENU POS • RETURN AUDIT
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReturnReceipt.displayName = 'ReturnReceipt';
