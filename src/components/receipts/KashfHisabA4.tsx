import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface LedgerItem {
  type: 'purchase' | 'payment';
  date: string;
  amount: number;
  note?: string;
  receiptNumber?: string | number;
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    isWholesale?: boolean;
    isWeighed?: boolean;
  }>;
}

interface KashfHisabProps {
  settings: {
    shopName?: string;
    phone?: string;
    address?: string;
    receiptFooter?: string;
    logoUrl?: string;
  };
  customerName: string;
  customerPhone?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  history: LedgerItem[];
  statementDate?: Date | string;
}

export const KashfHisabA4 = React.forwardRef<HTMLDivElement, KashfHisabProps>(
  (
    {
      settings,
      customerName,
      customerPhone,
      totalAmount = 0,
      paidAmount = 0,
      remainingAmount = 0,
      history = [],
      statementDate = new Date(),
    },
    ref
  ) => {
    const formattedDate = typeof statementDate === 'string'
      ? new Date(statementDate).toLocaleDateString('ku-IQ')
      : statementDate.toLocaleDateString('ku-IQ');

    const formattedTime = typeof statementDate === 'string'
      ? new Date(statementDate).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
      : statementDate.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' });

    // Calculate chronological running balance
    let currentBalance = 0;
    const sortedHistory = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const ledgerWithBalance = sortedHistory.map(item => {
      if (item.type === 'purchase') {
        currentBalance += item.amount;
      } else {
        currentBalance -= item.amount;
      }
      return {
        ...item,
        balanceAfter: currentBalance
      };
    });

    const qrData = JSON.stringify({
      type: 'ACCOUNT_STATEMENT',
      shop: settings.shopName || 'MAS POS',
      customer: customerName,
      phone: customerPhone || 'N/A',
      date: formattedDate,
      remainingDebt: Math.round(remainingAmount)
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
              .kashf-card {
                page-break-inside: avoid;
              }
            }
          `
        }} />

        <div>
          {/* Header Brand */}
          <div className="flex justify-between items-start pb-5 border-b-2 border-slate-900">
            <div className="flex items-center gap-4">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Shop Logo"
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
                <p className="text-xs font-bold text-indigo-900 mt-0.5">بەشی دارایی، ژمێریاری و بەدواداچوونی قەرز</p>
                {settings.address && <p className="text-xs text-gray-700 font-medium mt-1">📍 {settings.address}</p>}
                {settings.phone && (
                  <p className="text-xs text-gray-950 font-black font-mono tracking-wider mt-0.5" dir="ltr">
                    ☎ {settings.phone}
                  </p>
                )}
              </div>
            </div>

            <div className="text-left flex flex-col items-end">
              <div className="px-4 py-1.5 bg-slate-950 text-white rounded-xl font-black text-lg shadow-xs flex items-center gap-2 mb-2">
                <span>کەشفی حسابی کڕیار</span>
                <span className="text-xs text-slate-300 font-normal font-mono">STATEMENT</span>
              </div>
              <div className="space-y-1 text-xs text-gray-700 text-left">
                <p>بەرواری دەرچوون: <span className="font-bold text-gray-950 font-mono">{formattedDate}</span></p>
                <p>کاتی دەرچوون: <span className="font-bold text-gray-950 font-mono">{formattedTime}</span></p>
                <p>دۆخی هەژمار: <span className={`font-black ${remainingAmount <= 0 ? 'text-emerald-800' : 'text-rose-900'}`}>
                  {remainingAmount <= 0 ? 'پاکتاوکراو (بێ قەرز)' : 'قەرزار'}
                </span></p>
              </div>
            </div>
          </div>

          {/* Customer Profile & Statement Meta Card */}
          <div className="bg-gray-50 border border-gray-300 rounded-2xl p-4 my-5 kashf-card shadow-2xs">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] font-black text-gray-500 uppercase tracking-wider block mb-0.5">
                  زانیاری کڕیار / خاوەن ئەژمێر
                </span>
                <h2 className="text-xl font-black text-gray-950">{customerName}</h2>
                {customerPhone ? (
                  <p className="text-xs font-mono text-gray-800 mt-1 font-bold" dir="ltr">📱 {customerPhone}</p>
                ) : (
                  <p className="text-[11px] text-gray-400 mt-1">ژمارەی مۆبایل تۆمار نەکراوە</p>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="text-left bg-white px-3.5 py-2 rounded-xl border border-gray-300">
                  <span className="text-[10px] text-gray-500 font-bold block">کۆی جوڵەکان</span>
                  <span className="text-base font-black text-slate-950 font-mono">{history.length} جوڵە</span>
                </div>
                <QRCodeSVG value={qrData} size={48} level="M" includeMargin={false} className="rounded" />
              </div>
            </div>
          </div>

          {/* 3 Executive Financial Metric Cards */}
          <div className="grid grid-cols-3 gap-4 mb-5 kashf-card">
            <div className="bg-gray-50 border border-gray-300 rounded-2xl p-3.5 text-center shadow-2xs">
              <span className="text-[11px] font-black text-gray-600 block mb-1">کۆی گشتی کڕینەکان (قەرز)</span>
              <p className="text-xl font-black text-gray-950 font-mono">
                {Math.round(totalAmount).toLocaleString()} <span className="text-xs font-bold text-gray-500">IQD</span>
              </p>
            </div>

            <div className="bg-gray-50 border border-gray-300 rounded-2xl p-3.5 text-center shadow-2xs">
              <span className="text-[11px] font-black text-emerald-800 block mb-1">کۆی گشتی واسڵکراو (دراو)</span>
              <p className="text-xl font-black text-emerald-900 font-mono">
                {Math.round(paidAmount).toLocaleString()} <span className="text-xs font-bold text-emerald-700">IQD</span>
              </p>
            </div>

            <div className={`rounded-2xl p-3.5 text-center border shadow-2xs ${remainingAmount > 0 ? 'bg-rose-50 border-rose-300 text-rose-950' : 'bg-emerald-50 border-emerald-300 text-emerald-950'}`}>
              <span className="text-[11px] font-black block mb-1">
                {remainingAmount > 0 ? 'قەرزی ماوە (باڵانسی کۆتایی)' : 'باڵانسی ماوە'}
              </span>
              <p className="text-xl font-black font-mono">
                {Math.round(remainingAmount).toLocaleString()} <span className="text-xs font-bold opacity-75">IQD</span>
              </p>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="rounded-2xl border border-gray-300 overflow-hidden mb-5 kashf-card shadow-2xs">
            <table className="w-full text-right text-xs table-fixed">
              <thead className="bg-slate-950 text-white font-black text-[11px]">
                <tr>
                  <th className="py-3 px-3 text-center w-10">#</th>
                  <th className="py-3 px-3 w-[22%]">بەروار و کات</th>
                  <th className="py-3 px-3 text-center w-[16%]">جۆری جوڵە</th>
                  <th className="py-3 px-4 w-[28%]">ڕوونکردنەوە و کاڵاکان</th>
                  <th className="py-3 px-3 text-left w-[17%]">بڕ (IQD)</th>
                  <th className="py-3 px-3 text-left w-[17%]">باڵانس (IQD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {ledgerWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400">هیچ جوڵەیەک تۆمار نەکراوە</td>
                  </tr>
                ) : (
                  ledgerWithBalance.map((item, idx) => {
                    const isPurchase = item.type === 'purchase';
                    const itemDate = new Date(item.date).toLocaleString('ku-IQ', { dateStyle: 'short', timeStyle: 'short' });

                    return (
                      <React.Fragment key={idx}>
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'}>
                          <td className="py-2.5 px-3 text-center text-gray-500 font-mono text-[10.5px]">{idx + 1}</td>
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-800 text-[10px]" dir="ltr">{itemDate}</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-black text-[9.5px] border ${
                              isPurchase ? 'bg-rose-100 text-rose-950 border-rose-200' : 'bg-emerald-100 text-emerald-950 border-emerald-200'
                            }`}>
                              {isPurchase ? 'کڕین (قەرز)' : 'واسلکردنی پارە'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4">
                            <div className="font-bold text-gray-950 leading-snug">
                              {item.note || (isPurchase ? 'کڕینی کاڵا بە قەرز' : 'پێدانی بەشێک لە قەرز')}
                              {item.receiptNumber && (
                                <span className="mr-1.5 text-[9.5px] bg-slate-100 text-slate-900 px-1.5 py-0.2 rounded font-mono font-bold border border-gray-300">
                                  #{item.receiptNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-2.5 px-3 text-left font-black font-mono text-xs ${isPurchase ? 'text-rose-900' : 'text-emerald-900'}`}>
                            {isPurchase ? '+' : '-'}{Math.round(item.amount).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3 text-left font-black font-mono text-gray-950 text-xs">
                            {Math.round(item.balanceAfter).toLocaleString()}
                          </td>
                        </tr>

                        {/* Breakdown of items inside purchase if available */}
                        {isPurchase && item.items && item.items.length > 0 && (
                          <tr className="bg-gray-50/90">
                            <td colSpan={6} className="py-2 px-6 pb-2.5 border-b border-gray-200">
                              <div className="text-[10px] text-slate-900 font-black mb-1">کاڵاکانی ناو ئەم پسوڵەیە:</div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-gray-700">
                                {item.items.map((prod, pIdx) => (
                                  <div key={pIdx} className="flex justify-between border-b border-dashed border-gray-200 pb-0.5">
                                    <span>• {prod.name} ({prod.quantity} {prod.isWholesale ? 'کارتۆن' : 'دانە'})</span>
                                    <span className="font-mono font-bold text-gray-950">{(prod.price * prod.quantity).toLocaleString()} IQD</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Official Accounting Signatures & Stamp */}
        <div className="mt-auto pt-6 border-t-2 border-slate-900 kashf-card">
          <p className="text-[11px] text-gray-600 mb-4 text-center font-bold">
            ئەم کەشفی حسابە فەرمییە و سەرجەم وردەکاری دارایی کڕیاری ناوبراو تا بەرواری سەرەوە دەسەلمێنێت.
          </p>

          <div className="grid grid-cols-3 gap-6 text-center text-xs text-gray-800 mb-4">
            <div>
              <p className="font-black mb-6">ئامادەکاری و ژمێریاری</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
            <div>
              <p className="font-black mb-2">مۆری فەرمی فرۆشگا</p>
              <div className="w-16 h-16 mx-auto border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center text-[10px] text-slate-500 font-black">
                مۆری فرۆشگا
              </div>
            </div>
            <div>
              <p className="font-black mb-6">واژۆ و پەسەندی کڕیار</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 font-bold border-t border-gray-200 pt-2 flex justify-between items-center">
            <span>{settings.receiptFooter || 'بەردەوام لە خزمەتی ئێوەداین.'}</span>
            <span className="font-mono text-[10px]">MAS MENU • ACCOUNTING LEDGER SYSTEM</span>
          </div>
        </div>
      </div>
    );
  }
);

KashfHisabA4.displayName = 'KashfHisabA4';
