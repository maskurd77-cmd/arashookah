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
              .thermal-return-container {
                width: 76mm !important;
                padding: 2mm 1mm !important;
                margin: 0 auto !important;
              }
            }
          `
        }} />

        <div className="thermal-return-container">
          {/* Header Branding */}
          <div className="text-center pb-2.5 border-b-2 border-dashed border-gray-800">
            {settings.logoUrl ? (
              <img
                src={settings.logoUrl}
                alt="Shop Logo"
                className="w-12 h-12 mx-auto mb-1.5 object-contain rounded-full border border-gray-300"
              />
            ) : (
              <div className="w-10 h-10 mx-auto mb-1 rounded-2xl bg-rose-700 text-white flex items-center justify-center font-black text-lg shadow-sm">
                {(settings.shopName || 'M')[0]?.toUpperCase()}
              </div>
            )}

            <h1 className="text-base font-black text-gray-950 tracking-tight leading-tight mb-0.5">
              {settings.shopName || 'فرۆشگای نموونەیی'}
            </h1>

            <div className="inline-block my-1 px-3 py-1 bg-rose-100 text-rose-950 rounded-lg text-xs font-black border border-rose-300">
              پسوڵەی فەرمی گەڕاندنەوە (RETURN VOUCHER)
            </div>

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
          </div>

          {/* Return Info & Meta */}
          <div className="py-2 border-b border-dashed border-gray-400 space-y-1 text-[10.5px]">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-bold">ژمارەی گەڕاندنەوە:</span>
              <span className="font-mono font-black text-gray-950 text-xs px-1.5 py-0.2 bg-rose-50 text-rose-900 rounded border border-rose-200">
                #{returnNumber}
              </span>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-gray-600 font-bold">وەسڵی بنەڕەتی:</span>
              <span className="font-mono font-black text-gray-950 text-xs px-1.5 py-0.2 bg-gray-100 rounded border border-gray-300">
                #{originalReceiptNumber}
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
                <span className="text-gray-600">کارمەند:</span>
                <span className="font-bold text-gray-950">{cashierName}</span>
              </div>
            )}

            {customerName && (
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-gray-600">کڕیار:</span>
                <span className="font-bold text-gray-950 truncate max-w-[160px]">{customerName}</span>
              </div>
            )}
          </div>

          {/* Returned Items Table */}
          <div className="py-2">
            <table className="w-full text-right text-[10.5px] border-collapse table-fixed">
              <thead>
                <tr className="border-b-2 border-gray-900 text-gray-950 font-black text-[10px]">
                  <th className="pb-1 text-right w-[44%]">کاڵای گەڕاوە</th>
                  <th className="pb-1 text-center w-[16%]">بڕ</th>
                  <th className="pb-1 text-center w-[20%]">نرخ</th>
                  <th className="pb-1 text-left w-[20%]">کۆ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => {
                  const unitPrice = item.isGift ? 0 : (item.isWholesale ? (item.wholesalePrice || item.price) : item.price);
                  const lineTotal = item.isGift ? 0 : unitPrice * item.returnQuantity;

                  return (
                    <tr key={idx} className="align-top">
                      <td className="py-1.5 pl-1">
                        <div className="font-bold text-gray-950 leading-tight break-words">
                          {item.name}
                        </div>
                        {item.isWholesale && <span className="text-[8.5px] bg-gray-200 text-gray-900 px-1 py-0.2 rounded font-black">جملە</span>}
                        {item.isGift && <span className="text-[8.5px] bg-gray-200 text-gray-900 px-1 py-0.2 rounded font-black">دیاری</span>}
                      </td>
                      <td className="py-1.5 text-center font-bold text-rose-700 font-mono whitespace-nowrap text-[10.5px]">
                        -{item.returnQuantity}
                      </td>
                      <td className="py-1.5 text-center text-gray-800 font-mono whitespace-nowrap text-[10px]">
                        {item.isGift ? 'دیاری' : Math.round(unitPrice).toLocaleString()}
                      </td>
                      <td className="py-1.5 text-left font-black text-rose-700 font-mono whitespace-nowrap text-[10.5px]">
                        {item.isGift ? '٠' : Math.round(lineTotal).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Refund Calculation Summary */}
          <div className="pt-2 border-t-2 border-dashed border-gray-800 space-y-1.5 text-[11px]">
            <div className="flex justify-between items-center text-gray-700">
              <span className="font-medium">کۆی گشتی کاڵای گەڕاوە:</span>
              <span className="font-mono font-bold text-gray-950">{Math.round(subtotalAmount).toLocaleString()} IQD</span>
            </div>

            {discountAmount > 0 && (
              <div className="flex justify-between items-center text-gray-900 font-bold">
                <span>داشکاندنی هاوتای گەڕاوە:</span>
                <span className="font-mono">-{Math.round(discountAmount).toLocaleString()} IQD</span>
              </div>
            )}

            {/* Total Refund Highlight Box */}
            <div className="my-1.5 p-2 bg-rose-700 text-white rounded-lg flex justify-between items-center font-black">
              <span className="text-xs">کۆی پارەی گەڕاوە بۆ کڕیار:</span>
              <span className="font-mono tracking-tight text-sm sm:text-base">
                {Math.round(totalRefundAmount).toLocaleString()} IQD
              </span>
            </div>

            {notes && (
              <div className="p-1.5 bg-gray-100 rounded text-[9.5px] text-gray-700">
                <span className="font-bold">تێبینی:</span> {notes}
              </div>
            )}
          </div>

          {/* Barcode & QR Code Section */}
          <div className="mt-3 pt-2.5 border-t-2 border-dashed border-gray-800 text-center space-y-2">
            <div className="flex items-center justify-between gap-2 py-1.5 px-2 bg-gray-50 rounded-xl border border-gray-200">
              <div className="flex flex-col items-center justify-center shrink-0">
                <QRCodeSVG
                  value={qrData}
                  size={50}
                  level="M"
                  includeMargin={false}
                  className="rounded"
                />
                <span className="text-[7.5px] font-bold text-gray-500 mt-0.5 font-mono">VERIFY</span>
              </div>

              <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
                <div className="max-w-full overflow-hidden flex justify-center py-0.5">
                  <Barcode
                    value={String(returnNumber || originalReceiptNumber || 'RET-001')}
                    format="CODE128"
                    width={1.2}
                    height={30}
                    fontSize={10}
                    margin={0}
                    displayValue={true}
                    background="transparent"
                    lineColor="#000000"
                  />
                </div>
                <span className="text-[7.5px] font-bold text-gray-500 mt-0.5">بارکۆدی سەلماندنی گەڕاندنەوە</span>
              </div>
            </div>

            <p className="text-[9.5px] text-gray-800 font-bold leading-relaxed px-1">
              ئەم پسوڵەیە بەڵگەی فەرمی گەڕاندنەوەی کاڵا و وەرگرتنەوەی پارەیە.
            </p>

            <div className="text-[8.5px] text-gray-500 font-mono font-bold tracking-wider pt-0.5 border-t border-dotted border-gray-300">
              MAS MENU POS • RETURN AUDIT
            </div>
          </div>
        </div>
      </div>
    );
  }
);

ReturnReceipt.displayName = 'ReturnReceipt';
