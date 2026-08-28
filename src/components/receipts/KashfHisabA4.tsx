import React from 'react';

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
    receiptHeaderNote?: string;
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
        className="kashf-print-container w-[794px] max-w-full p-6 mx-auto bg-white text-black font-sans leading-normal select-none shadow-none print:w-full print:p-0 print:m-0 print:shadow-none print:min-h-0 print:h-auto print:block print:overflow-visible min-h-[1050px] flex flex-col box-border overflow-visible"
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
              margin: 8mm 10mm;
            }
            @media print {
              html, body {
                width: 100% !important;
                height: auto !important;
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              .kashf-print-container {
                display: block !important;
                width: 100% !important;
                min-height: 0 !important;
                height: auto !important;
                padding: 0 !important;
                margin: 0 !important;
                overflow: visible !important;
              }
              .kashf-header, .kashf-customer-banner {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .kashf-table-container {
                overflow: visible !important;
              }
              table {
                border-collapse: collapse !important;
                width: 100% !important;
              }
              thead {
                display: table-header-group !important;
              }
              tr {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              .kashf-summary-cards, .kashf-footer {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
            }
          `
        }} />

        <div className="flex-1 print:block print:w-full">
          {/* Header Brand & Statement Meta */}
          <div className="kashf-header flex justify-between items-start pb-4 border-b-2 border-slate-900">
            <div className="flex items-center gap-3.5">
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt="Shop Logo"
                  className="w-16 h-16 object-contain rounded-xl border border-gray-300 p-0.5"
                />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-slate-900 text-white flex items-center justify-center font-black text-xl">
                  {(settings.shopName || 'M')[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                  {settings.shopName || 'فرۆشگای نموونەیی'}
                </h1>
                <p className="text-xs font-bold text-gray-600 mt-0.5">بەشی دارایی و بەدواداچوونی ئەژمێری قەرز</p>
                <div className="flex flex-wrap items-center gap-x-3 text-xs text-gray-700 font-medium mt-1">
                  {settings.address && <span>📍 {settings.address}</span>}
                  {settings.phone && (
                    <span className="font-mono font-bold text-slate-900" dir="ltr">
                      ☎ {settings.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="text-left flex flex-col items-end">
              <div className="px-3.5 py-1 bg-slate-900 text-white rounded-lg font-black text-sm flex items-center gap-2 mb-1.5 shadow-2xs">
                <span>کەشفی حسابی کڕیار</span>
                <span className="text-[10px] text-gray-300 font-mono tracking-wider">STATEMENT</span>
              </div>
              <div className="space-y-0.5 text-xs text-gray-800 text-left">
                <p>بەروار و کات: <span className="font-bold font-mono text-slate-900" dir="ltr">{formattedDate} • {formattedTime}</span></p>
                <p>دۆخی هەژمار: <span className={`font-black px-2 py-0.2 rounded text-[10.5px] ${
                  remainingAmount <= 0 
                    ? 'bg-emerald-100 text-emerald-950 border border-emerald-300' 
                    : 'bg-rose-100 text-rose-950 border border-rose-300'
                }`}>
                  {remainingAmount <= 0 ? 'پاکتاوکراو (بێ قەرز)' : 'قەرزار'}
                </span></p>
              </div>
            </div>
          </div>

          {/* Customer Profile Banner - Clean Single Container */}
          <div className="kashf-customer-banner my-3.5 bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center">
            <div>
              <span className="text-[10px] font-bold text-gray-500 block mb-0.5">
                زانیاری کڕیار / خاوەن ئەژمێر
              </span>
              <h2 className="text-xl font-black text-slate-950 tracking-tight">{customerName}</h2>
              {customerPhone ? (
                <p className="text-xs font-mono text-slate-700 font-bold mt-0.5" dir="ltr">📱 {customerPhone}</p>
              ) : (
                <p className="text-[11px] text-gray-400 mt-0.5">ژمارەی مۆبایل تۆمار نەکراوە</p>
              )}
            </div>

            <div className="flex items-center gap-2.5 text-left">
              <div className="bg-white px-3.5 py-2 rounded-lg border border-slate-200 text-center shadow-2xs">
                <span className="text-[10px] text-gray-500 font-bold block">کۆی تۆمارەکان</span>
                <span className="text-sm font-black text-slate-900 font-mono">{history.length} جوڵە</span>
              </div>
            </div>
          </div>

          {/* Ledger Table - Clean, High Contrast, Crisp Grid */}
          <div className="kashf-table-container rounded-xl border border-slate-300 overflow-hidden mb-3.5">
            <table className="w-full text-right text-xs table-fixed">
              <thead className="bg-slate-900 text-white font-black text-[11px]">
                <tr>
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-3 w-[20%] border-r border-slate-700">بەروار و کات</th>
                  <th className="py-2.5 px-2 text-center w-[16%] border-r border-slate-700">جۆری جوڵە</th>
                  <th className="py-2.5 px-3 w-[30%] border-r border-slate-700">ڕوونکردنەوە و وەسڵ</th>
                  <th className="py-2.5 px-3 text-left w-[17%] border-r border-slate-700">بڕی جوڵە (IQD)</th>
                  <th className="py-2.5 px-3 text-left w-[17%] border-r border-slate-700">باڵانسی ماوە (IQD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {ledgerWithBalance.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-400 font-bold">هیچ جوڵەیەک تۆمار نەکراوە</td>
                  </tr>
                ) : (
                  ledgerWithBalance.map((item, idx) => {
                    const isPurchase = item.type === 'purchase';
                    const itemDate = new Date(item.date).toLocaleString('ku-IQ', { dateStyle: 'short', timeStyle: 'short' });

                    return (
                      <React.Fragment key={idx}>
                        <tr className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                          <td className="py-2 px-2 text-center text-gray-500 font-mono text-[10px] font-bold">{idx + 1}</td>
                          <td className="py-2 px-3 font-mono font-bold text-slate-800 text-[10px] border-r border-slate-200" dir="ltr">
                            {itemDate}
                          </td>
                          <td className="py-2 px-2 text-center border-r border-slate-200">
                            <span className={`px-2 py-0.5 rounded font-black text-[9.5px] ${
                              isPurchase ? 'bg-rose-50 text-rose-900 border border-rose-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                            }`}>
                              {isPurchase ? 'کڕین (قەرز)' : 'واسلکردنی پارە'}
                            </span>
                          </td>
                          <td className="py-2 px-3 border-r border-slate-200">
                            <div className="font-bold text-slate-900 text-xs leading-snug">
                              {item.note || (isPurchase ? 'کڕینی کاڵا بە قەرز' : 'پێدانی بەشێک لە قەرز')}
                              {item.receiptNumber && (
                                <span className="mr-1.5 text-[9.5px] bg-slate-900 text-white px-1.5 py-0.2 rounded font-mono font-bold">
                                  #{item.receiptNumber}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className={`py-2 px-3 text-left font-black font-mono text-xs border-r border-slate-200 ${isPurchase ? 'text-rose-700 font-extrabold' : 'text-emerald-700'}`}>
                            {isPurchase ? '+' : '-'}{Math.round(item.amount).toLocaleString()}
                          </td>
                          <td className="py-2 px-3 text-left font-black font-mono text-slate-950 text-xs border-r border-slate-200">
                            {Math.round(item.balanceAfter).toLocaleString()}
                          </td>
                        </tr>

                        {/* Streamlined Clean Breakdown of Items */}
                        {isPurchase && item.items && item.items.length > 0 && (
                          <tr className="bg-slate-50/50 border-b border-slate-200">
                            <td colSpan={6} className="py-2 px-3 pr-8">
                              <div className="border-r-2 border-slate-400 pr-3 py-1">
                                <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-700 mb-1">
                                  <span className="font-mono text-xs text-slate-500">↳</span>
                                  <span>کاڵاکانی ئەم پسوڵەیە ({item.items.length} دانە):</span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10.5px]">
                                  {item.items.map((prod, pIdx) => {
                                    const lineTotal = prod.price * prod.quantity;
                                    return (
                                      <div key={pIdx} className="flex justify-between items-center py-0.5 px-2 bg-white rounded border border-slate-200/80">
                                        <div className="font-medium text-slate-900 truncate">
                                          • {prod.name}
                                          {prod.isWholesale && (
                                            <span className="mr-1 text-[8.5px] bg-slate-800 text-white px-1 rounded font-bold">جملە</span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-2 font-mono text-[10px] text-slate-700 shrink-0">
                                          <span>{formatQuantity(prod.quantity, prod.isWeighed)} {prod.isWholesale ? 'کارتۆن' : (prod.isWeighed ? '' : 'دانە')}</span>
                                          <span className="text-gray-400">×</span>
                                          <span>{Math.round(prod.price).toLocaleString()}</span>
                                          <span className="text-gray-400">=</span>
                                          <span className="font-bold text-slate-950">{Math.round(lineTotal).toLocaleString()} IQD</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
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

          {/* 3 Executive Financial Metric Summary Cards at the BOTTOM */}
          <div className="kashf-summary-cards grid grid-cols-3 gap-3 my-3">
            {/* Total Debt / Purchases */}
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3 text-center">
              <span className="text-[11px] font-bold text-slate-600 block mb-0.5">کۆی گشتی قەرز (کڕینەکان)</span>
              <p className="text-xl font-black text-slate-900 font-mono tracking-tight">
                {Math.round(totalAmount).toLocaleString()} <span className="text-xs font-bold text-slate-500">IQD</span>
              </p>
            </div>

            {/* Total Paid */}
            <div className="bg-emerald-50/70 border border-emerald-300 rounded-xl p-3 text-center">
              <span className="text-[11px] font-bold text-emerald-900 block mb-0.5">کۆی گشتی واسڵکراو (دراو)</span>
              <p className="text-xl font-black text-emerald-800 font-mono tracking-tight">
                {Math.round(paidAmount).toLocaleString()} <span className="text-xs font-bold text-emerald-600">IQD</span>
              </p>
            </div>

            {/* Remaining Balance in Bold RED */}
            <div className={`rounded-xl p-3 text-center border-2 ${
              remainingAmount > 0 
                ? 'bg-rose-600 text-white border-rose-700 shadow-2xs' 
                : 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
            }`}>
              <span className="text-[11px] font-black block mb-0.5 tracking-wide">
                {remainingAmount > 0 ? 'قەرزی ماوە (باڵانسی کۆتایی)' : 'باڵانسی ماوە (پاکتاوکراو)'}
              </span>
              <p className="text-2xl font-black font-mono tracking-tight leading-tight">
                {Math.round(remainingAmount).toLocaleString()} <span className="text-xs font-bold opacity-90">IQD</span>
              </p>
            </div>
          </div>
        </div>

        {/* Official Accounting Signatures & Stamp */}
        <div className="kashf-footer mt-auto pt-4 border-t-2 border-black">
          <p className="text-[10.5px] text-gray-700 mb-3 text-center font-bold">
            ئەم کەشفی حسابە فەرمییە و سەرجەم وردەکاری دارایی و قەرزەکانی کڕیاری ناوبراو دەسەلمێنێت.
          </p>

          <div className="grid grid-cols-3 gap-4 text-center text-xs text-gray-900 mb-3">
            <div>
              <p className="font-black mb-5">ئامادەکاری و ژمێریاری</p>
              <div className="border-b border-dashed border-black w-28 mx-auto"></div>
            </div>
            <div>
              <p className="font-black mb-1">مۆری فەرمی فرۆشگا</p>
              <div className="w-14 h-14 mx-auto border border-dashed border-black rounded-full flex items-center justify-center text-[9px] text-gray-700 font-black">
                مۆری فەرمی
              </div>
            </div>
            <div>
              <p className="font-black mb-5">واژۆ و پەسەندی کڕیار</p>
              <div className="border-b border-dashed border-black w-28 mx-auto"></div>
            </div>
          </div>

          <div className="text-center text-[10px] text-gray-600 font-bold border-t border-gray-200 pt-1.5 flex justify-between items-center">
            <span>{settings.receiptFooter || 'بەردەوام لە خزمەتی ئێوەداین.'}</span>
            <span className="font-mono text-[9.5px]">MAS MENU • ACCOUNTING LEDGER SYSTEM</span>
          </div>
        </div>
      </div>
    );
  }
);

KashfHisabA4.displayName = 'KashfHisabA4';

