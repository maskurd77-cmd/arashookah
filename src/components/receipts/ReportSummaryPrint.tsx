import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

export interface ReportSummarySettings {
  shopName?: string;
  phone?: string;
  address?: string;
  receiptFooter?: string;
  receiptHeaderNote?: string;
  logoUrl?: string;
  currency?: string;
  usdRate?: number;
}

interface ReportSummaryPrintProps {
  settings?: ReportSummarySettings;
  reportType: 'daily' | 'monthly' | 'all' | string;
  selectedDate: Date;
  activeCategory: string;
  totalSales: number;
  totalWholesaleSales: number;
  totalRetailSales: number;
  totalCost: number;
  netProfit: number;
  totalExpenses: number;
  totalDirectCash: number;
  totalDirectDebt: number;
  totalDirectFib: number;
  totalDirectUsd: number;
  totalItemsSold: string | number;
  receiptsCount: number;
  averageReceiptValue: number;
  topItems?: Array<{ name: string; quantity: number; revenue?: number }>;
  expenses?: Array<{ title: string; amount: number; category?: string }>;
  isA4?: boolean;
}

export const ReportSummaryPrint = React.forwardRef<HTMLDivElement, ReportSummaryPrintProps>(
  (
    {
      settings = {} as ReportSummarySettings,
      reportType,
      selectedDate,
      activeCategory,
      totalSales = 0,
      totalWholesaleSales = 0,
      totalRetailSales = 0,
      totalCost = 0,
      netProfit = 0,
      totalExpenses = 0,
      totalDirectCash = 0,
      totalDirectDebt = 0,
      totalDirectFib = 0,
      totalDirectUsd = 0,
      totalItemsSold = 0,
      receiptsCount = 0,
      averageReceiptValue = 0,
      topItems = [],
      expenses = [],
      isA4 = false,
    },
    ref
  ) => {
    const formattedDate = selectedDate instanceof Date
      ? selectedDate.toLocaleDateString('ku-IQ')
      : new Date().toLocaleDateString('ku-IQ');

    const printTimestamp = new Date().toLocaleString('ku-IQ');

    const reportPeriodTitle =
      reportType === 'daily' ? `ڕاپۆرتی ڕۆژانە (${formattedDate})` :
      reportType === 'monthly' ? `ڕاپۆرتی مانگانە (${selectedDate instanceof Date ? `${selectedDate.getFullYear()}/${selectedDate.getMonth() + 1}` : ''})` :
      'ڕاپۆرتی گشتی تەواوی کاتەکان';

    const qrData = JSON.stringify({
      type: 'FINANCIAL_REPORT',
      shop: settings.shopName || 'MAS POS',
      period: reportPeriodTitle,
      sales: Math.round(totalSales),
      cost: Math.round(totalCost),
      expenses: Math.round(totalExpenses),
      profit: Math.round(netProfit),
      date: formattedDate
    });

    // -------------------------------------------------------------
    // 1. Executive A4 Financial Report (کەشفی تەواوی راپۆرت بە A4)
    // -------------------------------------------------------------
    if (isA4) {
      return (
        <div
          ref={ref}
          className="w-[794px] max-w-full p-8 mx-auto bg-white text-slate-950 font-sans leading-normal select-none shadow-none print:w-full print:p-6 print:m-0 print:shadow-none min-h-[1050px] flex flex-col box-border overflow-hidden"
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
                  margin: 0 !important;
                  padding: 0 !important;
                  background: #ffffff !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                .report-card {
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
                    alt="Logo"
                    className="w-20 h-20 object-contain rounded-2xl border border-gray-300 p-1 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-950 text-white flex items-center justify-center font-black text-2xl shadow-sm border border-slate-800">
                    {(settings.shopName || 'M')[0]?.toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black text-slate-950 tracking-tight leading-tight">
                    {settings.shopName || 'فرۆشگای نموونەیی'}
                  </h1>
                  <p className="text-xs font-bold text-indigo-900 mt-0.5">سیستەمی ژمێریاری و شیکاری دارایی فرۆشگا</p>
                  {settings.address && <p className="text-xs text-gray-700 font-medium mt-1">📍 {settings.address}</p>}
                  {settings.phone && (
                    <p className="text-xs text-gray-950 font-black font-mono tracking-wider mt-0.5" dir="ltr">
                      ☎ {settings.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="text-left flex flex-col items-end">
                <div className="px-4 py-1.5 bg-slate-950 text-white rounded-xl font-black text-base shadow-xs flex items-center gap-2 mb-2">
                  <span>پوختەی دارایی</span>
                  <span className="text-xs text-slate-300 font-normal font-mono">FINANCIAL REPORT</span>
                </div>
                <div className="space-y-1 text-xs text-gray-700 text-left">
                  <p className="font-black text-slate-950">{reportPeriodTitle}</p>
                  <p>پۆل / بەش: <span className="font-bold text-indigo-950">{activeCategory === 'all' ? 'هەموو بەشەکان' : activeCategory}</span></p>
                  <p>کاتی دەرچوون: <span className="font-bold text-gray-950 font-mono">{printTimestamp}</span></p>
                </div>
              </div>
            </div>

            {/* 4 Core Financial Metrics Banner */}
            <div className="grid grid-cols-4 gap-3 my-5 report-card">
              <div className="bg-slate-50 border border-slate-300 rounded-2xl p-4 text-center">
                <span className="text-[11px] font-bold text-slate-600 block mb-1">کۆی گشتی فرۆش (Sales)</span>
                <p className="text-2xl font-black text-slate-950 font-mono">
                  {Math.round(totalSales).toLocaleString()} <span className="text-xs font-bold text-slate-500">IQD</span>
                </p>
              </div>

              <div className="bg-amber-50/70 border border-amber-300 rounded-2xl p-4 text-center">
                <span className="text-[11px] font-bold text-amber-800 block mb-1">تێچووی کاڵاکان (Cost)</span>
                <p className="text-2xl font-black text-amber-950 font-mono">
                  {Math.round(totalCost).toLocaleString()} <span className="text-xs font-bold text-amber-700">IQD</span>
                </p>
              </div>

              <div className="bg-rose-50/70 border border-rose-300 rounded-2xl p-4 text-center">
                <span className="text-[11px] font-bold text-rose-800 block mb-1">کۆی خەرجیەکان (Expenses)</span>
                <p className="text-2xl font-black text-rose-950 font-mono">
                  {Math.round(totalExpenses).toLocaleString()} <span className="text-xs font-bold text-rose-700">IQD</span>
                </p>
              </div>

              <div className={`rounded-2xl p-4 text-center border ${netProfit >= 0 ? 'bg-emerald-50 border-emerald-300 text-emerald-950' : 'bg-rose-50 border-rose-300 text-rose-950'}`}>
                <span className="text-[11px] font-bold block mb-1">قازانجی سافی (Net Profit)</span>
                <p className="text-2xl font-black font-mono">
                  {Math.round(netProfit).toLocaleString()} <span className="text-xs font-bold opacity-75">IQD</span>
                </p>
              </div>
            </div>

            {/* Income Streams & POS Analytics Overview */}
            <div className="grid grid-cols-2 gap-4 mb-5 report-card">
              {/* Payment Methods Card */}
              <div className="bg-gray-50 border border-gray-300 rounded-2xl p-4 space-y-2.5 text-xs">
                <h3 className="font-black text-slate-950 border-b border-gray-300 pb-2 text-sm">
                  شێوازەکانی پارەدان و داهاتی ڕاستەوخۆ
                </h3>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">نەقد (کاش لە دەست):</span>
                  <span className="font-mono font-black text-emerald-800 text-sm">{Math.round(totalDirectCash).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">قەرز (لە ئەستۆی کڕیار):</span>
                  <span className="font-mono font-black text-rose-800 text-sm">{Math.round(totalDirectDebt).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">ئۆنلاین (FIB & Card):</span>
                  <span className="font-mono font-black text-blue-800 text-sm">{Math.round(totalDirectFib).toLocaleString()} IQD</span>
                </div>
                {totalDirectUsd > 0 && (
                  <div className="flex justify-between items-center text-emerald-900 pt-1.5 border-t border-gray-300 font-bold">
                    <span>کۆی نەقدی دۆلاری:</span>
                    <span className="font-mono font-black text-sm">${totalDirectUsd.toLocaleString()}</span>
                  </div>
                )}
              </div>

              {/* Volume & Breakdown Card */}
              <div className="bg-gray-50 border border-gray-300 rounded-2xl p-4 space-y-2.5 text-xs">
                <h3 className="font-black text-slate-950 border-b border-gray-300 pb-2 text-sm">
                  ئامارەکانی فرۆشتن و وەسڵ
                </h3>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">ژمارەی گشتی پسوڵەکان:</span>
                  <span className="font-mono font-black text-slate-950 text-sm">{receiptsCount} پسوڵە</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">تێکڕای بڕی هەر پسوڵەیەک:</span>
                  <span className="font-mono font-black text-indigo-900 text-sm">{Math.round(averageReceiptValue).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">کۆی فرۆشی تاک (Retail):</span>
                  <span className="font-mono font-black text-slate-950">{Math.round(totalRetailSales).toLocaleString()} IQD</span>
                </div>
                <div className="flex justify-between items-center text-gray-800">
                  <span className="font-bold">کۆی فرۆشی جملە (Wholesale):</span>
                  <span className="font-mono font-black text-purple-900">{Math.round(totalWholesaleSales).toLocaleString()} IQD</span>
                </div>
              </div>
            </div>

            {/* Top Sold Products Table */}
            {topItems.length > 0 && (
              <div className="rounded-2xl border border-gray-300 overflow-hidden mb-5 report-card">
                <div className="bg-slate-950 text-white px-4 py-2 font-black text-xs flex justify-between items-center">
                  <span>پڕفرۆشترین کاڵاکانی ئەم ماوەیە (TOP BEST SELLERS)</span>
                  <span className="text-[10px] text-slate-400 font-mono">COUNT: {topItems.length}</span>
                </div>
                <table className="w-full text-right text-xs table-fixed">
                  <thead className="bg-gray-100 border-b border-gray-300 font-bold text-gray-700 text-[11px]">
                    <tr>
                      <th className="py-2 px-3 text-center w-12">#</th>
                      <th className="py-2 px-4 w-[50%]">ناوی کاڵا</th>
                      <th className="py-2 px-4 text-center w-[25%]">بڕی فرۆشراو</th>
                      <th className="py-2 px-4 text-left w-[25%]">کۆی داهات (IQD)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {topItems.slice(0, 8).map((item, idx) => (
                      <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                        <td className="py-1.5 px-3 text-center font-mono font-bold text-gray-500 text-[11px]">{idx + 1}</td>
                        <td className="py-1.5 px-4 font-black text-gray-950">{item.name}</td>
                        <td className="py-1.5 px-4 text-center font-mono font-black text-indigo-900">{item.quantity}</td>
                        <td className="py-1.5 px-4 text-left font-mono font-bold text-slate-950">
                          {item.revenue ? Math.round(item.revenue).toLocaleString() : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Expenses Breakdown if available */}
            {expenses.length > 0 && (
              <div className="rounded-2xl border border-gray-300 overflow-hidden mb-5 report-card">
                <div className="bg-rose-950 text-white px-4 py-2 font-black text-xs flex justify-between items-center">
                  <span>وردەکاری خەرجییەکان (EXPENSES BREAKDOWN)</span>
                  <span className="text-[10px] text-rose-200 font-mono">TOTAL: {Math.round(totalExpenses).toLocaleString()} IQD</span>
                </div>
                <table className="w-full text-right text-xs table-fixed">
                  <tbody className="divide-y divide-gray-200">
                    {expenses.slice(0, 5).map((exp, idx) => (
                      <tr key={idx} className="bg-white">
                        <td className="py-1.5 px-4 font-bold text-gray-900">{exp.title}</td>
                        <td className="py-1.5 px-4 text-center text-gray-500">{exp.category || 'خەرجی گشتی'}</td>
                        <td className="py-1.5 px-4 text-left font-mono font-black text-rose-900">-{Math.round(exp.amount).toLocaleString()} IQD</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Verification, QR Code & Stamp Footer */}
          <div className="mt-auto pt-8 border-t-2 border-slate-900 report-card">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <QRCodeSVG value={qrData} size={48} level="M" includeMargin={false} className="rounded" />
                <div>
                  <span className="text-xs font-black text-slate-950 block">ڕاپۆرتی سیستەمی بڕواپێکراو</span>
                  <span className="text-[10px] text-gray-500 font-mono">System Generated Accounting Audit</span>
                </div>
              </div>

              <div className="flex gap-12 text-center text-xs text-gray-800">
                <div>
                  <p className="font-black mb-6">ئامادەکردنی ڕاپۆرت</p>
                  <div className="border-b-2 border-dashed border-gray-400 w-28 mx-auto"></div>
                </div>
                <div>
                  <p className="font-black mb-6">پەسەندی بەڕێوەبەر</p>
                  <div className="border-b-2 border-dashed border-gray-400 w-28 mx-auto"></div>
                </div>
              </div>
            </div>

            <div className="text-center text-xs text-gray-500 font-bold border-t border-gray-200 pt-2 flex justify-between items-center">
              <span>{settings.receiptFooter || 'سیستەمی پێشکەوتووی ماس مێنو بۆ بەڕێوەبردنی فرۆشگا'}</span>
              <span className="font-mono text-[10px]">POWERED BY MAS MENU • POS AUDIT</span>
            </div>
          </div>
        </div>
      );
    }

    // -------------------------------------------------------------
    // 2. Ultra-Refined 80mm Thermal Slip for Reports (وەسڵی گەرمی 80mm بۆ ڕاپۆرت)
    // -------------------------------------------------------------
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
              .thermal-report-root {
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

        <div className="thermal-report-root w-[70mm] max-w-[72mm] mx-auto px-2 py-2 bg-white text-black font-sans leading-tight select-none text-[11px] box-border">
          {/* Header */}
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
            <div className="inline-block px-3 py-0.5 bg-white text-black rounded border-2 border-black font-black text-xs mt-0.5">
              {reportPeriodTitle}
            </div>
            <p className="text-[11px] text-black font-mono font-bold mt-1" dir="ltr">
              {printTimestamp}
            </p>
          </div>

          {/* High-level KPIs */}
          <div className="py-2 border-b-2 border-black space-y-1.5 text-[11.5px]">
            <div className="flex justify-between items-center text-black">
              <span className="font-extrabold">کۆی گشتی فرۆش:</span>
              <span className="font-mono font-black text-xs">{Math.round(totalSales).toLocaleString()} IQD</span>
            </div>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">تێچووی کاڵاکان:</span>
              <span className="font-mono font-black">-{Math.round(totalCost).toLocaleString()} IQD</span>
            </div>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">کۆی خەرجیەکان:</span>
              <span className="font-mono font-black">-{Math.round(totalExpenses).toLocaleString()} IQD</span>
            </div>

            <div className="p-2 rounded border-2 border-black my-1.5 flex justify-between items-center font-black bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
              <span className="text-xs">قازانجی سافی:</span>
              <span className="font-mono text-sm tracking-tighter">{Math.round(netProfit).toLocaleString()} IQD</span>
            </div>
          </div>

          {/* Payment breakdown */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1.5 text-[11px]">
            <p className="font-black text-black text-[11px] mb-1">شێوازەکانی وەرگرتنی پارە:</p>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">نەقد (کاش):</span>
              <span className="font-mono font-black">{Math.round(totalDirectCash).toLocaleString()} IQD</span>
            </div>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">قەرز:</span>
              <span className="font-mono font-black">{Math.round(totalDirectDebt).toLocaleString()} IQD</span>
            </div>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">FIB:</span>
              <span className="font-mono font-black">{Math.round(totalDirectFib).toLocaleString()} IQD</span>
            </div>
            {totalDirectUsd > 0 && (
              <div className="flex justify-between items-center text-black font-black pt-1 border-t border-black">
                <span>نەقدی دۆلار ($):</span>
                <span className="font-mono">${totalDirectUsd.toLocaleString()}</span>
              </div>
            )}
          </div>

          {/* Receipts volume */}
          <div className="py-2 border-b-2 border-dashed border-black space-y-1 text-[11px]">
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">ژمارەی وەسڵەکان:</span>
              <span className="font-mono font-black">{receiptsCount}</span>
            </div>
            <div className="flex justify-between items-center text-black">
              <span className="font-bold">تێکڕای وەسڵ:</span>
              <span className="font-mono font-black">{Math.round(averageReceiptValue).toLocaleString()} IQD</span>
            </div>
          </div>

          {/* Top products */}
          {topItems.length > 0 && (
            <div className="py-2 border-b-2 border-black">
              <p className="font-black text-black text-[11px] mb-1">پڕفرۆشترین کاڵاکان:</p>
              <div className="space-y-1 text-[11px]">
                {topItems.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center text-black">
                    <span className="truncate max-w-[160px] font-black">{idx + 1}. {item.name}</span>
                    <span className="font-mono font-black">{item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* QR Code Audit */}
          <div className="py-2 flex flex-col items-center justify-center border-b-2 border-dashed border-black">
            <QRCodeSVG value={qrData} size={48} level="M" includeMargin={false} />
            <span className="text-[8.5px] font-mono text-black font-black mt-1">SCAN FOR AUDIT VERIFICATION</span>
          </div>

          {/* Footer */}
          <div className="mt-2 text-center text-[9px] text-black font-mono font-black border-t border-dashed border-black pt-1">
            {settings.receiptFooter || 'MAS MENU POS • FINANCIAL AUDIT'}
          </div>
        </div>
      </div>
    );
  }
);

ReportSummaryPrint.displayName = 'ReportSummaryPrint';
