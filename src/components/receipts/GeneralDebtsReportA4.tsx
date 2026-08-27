import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface DebtItem {
  id: string;
  customerName: string;
  phone?: string;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
  note?: string;
  createdAt?: any;
  updatedAt?: any;
  purchases?: any[];
  payments?: any[];
}

interface GeneralDebtsReportA4Props {
  settings: {
    shopName?: string;
    phone?: string;
    address?: string;
    receiptFooter?: string;
    logoUrl?: string;
  };
  debts: DebtItem[];
  filterStatus?: 'all' | 'unpaid' | 'paid';
  reportDate?: Date | string;
  preparedBy?: string;
}

export const GeneralDebtsReportA4 = React.forwardRef<HTMLDivElement, GeneralDebtsReportA4Props>(
  (
    {
      settings,
      debts = [],
      filterStatus = 'all',
      reportDate = new Date(),
      preparedBy = 'ئیدارە و ژمێریاری',
    },
    ref
  ) => {
    const formattedDate = typeof reportDate === 'string'
      ? new Date(reportDate).toLocaleDateString('ku-IQ')
      : reportDate.toLocaleDateString('ku-IQ');

    const formattedTime = typeof reportDate === 'string'
      ? new Date(reportDate).toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' })
      : reportDate.toLocaleTimeString('ku-IQ', { hour: '2-digit', minute: '2-digit' });

    // Financial totals
    const totalDebtAmount = debts.reduce((sum, d) => sum + (d.totalAmount || 0), 0);
    const totalPaidAmount = debts.reduce((sum, d) => sum + (d.paidAmount || 0), 0);
    const totalRemainingAmount = debts.reduce((sum, d) => sum + (d.remainingAmount || 0), 0);
    const activeDebtorsCount = debts.filter(d => (d.remainingAmount || 0) > 0).length;
    const settledDebtorsCount = debts.filter(d => (d.remainingAmount || 0) <= 0).length;

    const qrData = JSON.stringify({
      type: 'GENERAL_DEBTS_STATEMENT',
      shop: settings.shopName || 'MAS POS',
      date: formattedDate,
      totalRemaining: Math.round(totalRemainingAmount),
      debtorsCount: activeDebtorsCount,
      totalRecords: debts.length
    });

    return (
      <div
        ref={ref}
        className="w-[794px] max-w-full p-8 mx-auto bg-white text-gray-950 font-sans leading-normal select-none shadow-none print:w-full print:p-6 print:m-0 print:shadow-none min-h-[1080px] flex flex-col justify-between box-border overflow-hidden"
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
              margin: 8mm 8mm;
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
              .no-page-break {
                page-break-inside: avoid;
              }
              tr {
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
                <p className="text-xs font-bold text-indigo-900 mt-0.5">بەشی ژمێریاری و بەدواداچوونی قەرزەکان</p>
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
                <span>کەشفی حسابی گشتی قەرزەکان</span>
                <span className="text-xs text-slate-300 font-normal font-mono">GENERAL STATEMENT</span>
              </div>
              <div className="space-y-1 text-xs text-gray-700 text-left">
                <p>بەرواری ڕاپۆرت: <span className="font-bold text-gray-950 font-mono">{formattedDate}</span></p>
                <p>کاتی دەرچوون: <span className="font-bold text-gray-950 font-mono">{formattedTime}</span></p>
                <p>فلتەری تۆمارەکان: <span className="font-bold text-slate-900">
                  {filterStatus === 'unpaid' ? 'تەنیا قەرزارەکان' : filterStatus === 'paid' ? 'تەنیا پاکتاوکراوەکان' : 'سەرجەم کڕیاران'}
                </span></p>
              </div>
            </div>
          </div>

          {/* 4 Executive Financial Summary Metric Cards */}
          <div className="grid grid-cols-4 gap-3 my-5 no-page-break">
            <div className="bg-gray-50 border border-gray-300 rounded-2xl p-3 text-center shadow-2xs">
              <span className="text-[10px] font-black text-gray-600 block mb-1">کۆی گشتی قەرزەکان</span>
              <p className="text-lg font-black text-gray-950 font-mono">
                {Math.round(totalDebtAmount).toLocaleString()} <span className="text-[10px] font-bold text-gray-500">IQD</span>
              </p>
            </div>

            <div className="bg-emerald-50/70 border border-emerald-300 rounded-2xl p-3 text-center shadow-2xs">
              <span className="text-[10px] font-black text-emerald-800 block mb-1">کۆی پارەی وەرگیراو</span>
              <p className="text-lg font-black text-emerald-900 font-mono">
                {Math.round(totalPaidAmount).toLocaleString()} <span className="text-[10px] font-bold text-emerald-700">IQD</span>
              </p>
            </div>

            <div className="bg-rose-50 border border-rose-300 rounded-2xl p-3 text-center shadow-2xs">
              <span className="text-[10px] font-black text-rose-800 block mb-1">کۆی قەرزی ماوە لای کڕیاران</span>
              <p className="text-lg font-black text-rose-950 font-mono">
                {Math.round(totalRemainingAmount).toLocaleString()} <span className="text-[10px] font-bold text-rose-700">IQD</span>
              </p>
            </div>

            <div className="bg-slate-900 text-white rounded-2xl p-3 text-center shadow-2xs border border-slate-950">
              <span className="text-[10px] font-bold text-slate-300 block mb-1">کۆی قەرزارە چالاکەکان</span>
              <p className="text-lg font-black font-mono">
                {activeDebtorsCount} <span className="text-[10px] font-normal text-slate-400">کەس</span>
              </p>
            </div>
          </div>

          {/* Main Debtors Table */}
          <div className="rounded-2xl border border-gray-300 overflow-hidden mb-5 shadow-2xs">
            <table className="w-full text-right text-xs table-fixed">
              <thead className="bg-slate-950 text-white font-black text-[10.5px]">
                <tr>
                  <th className="py-2.5 px-2 text-center w-8">#</th>
                  <th className="py-2.5 px-3 w-[26%]">ناوی کڕیار</th>
                  <th className="py-2.5 px-2 w-[16%]">ژمارەی مۆبایل</th>
                  <th className="py-2.5 px-3 text-left w-[18%]">کۆی قەرز</th>
                  <th className="py-2.5 px-3 text-left w-[18%]">پارەی دراو</th>
                  <th className="py-2.5 px-3 text-left w-[18%]">قەرزی ماوە</th>
                  <th className="py-2.5 px-2 text-center w-[12%]">دۆخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {debts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-gray-400">هیچ تۆمارێکی قەرز نەدۆزرایەوە</td>
                  </tr>
                ) : (
                  debts.map((item, idx) => {
                    const isPaid = (item.remainingAmount || 0) <= 0;
                    return (
                      <tr key={item.id || idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/70'}>
                        <td className="py-2 px-2 text-center text-gray-500 font-mono text-[10px]">{idx + 1}</td>
                        <td className="py-2 px-3">
                          <div className="font-bold text-gray-950 truncate">{item.customerName}</div>
                          {item.note && <div className="text-[9.5px] text-gray-500 truncate">{item.note}</div>}
                        </td>
                        <td className="py-2 px-2 font-mono text-gray-700 text-[10px]" dir="ltr">
                          {item.phone || '-'}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-gray-800 text-[11px]">
                          {Math.round(item.totalAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-left font-mono font-bold text-emerald-800 text-[11px]">
                          {Math.round(item.paidAmount || 0).toLocaleString()}
                        </td>
                        <td className={`py-2 px-3 text-left font-mono font-black text-xs ${isPaid ? 'text-gray-400' : 'text-rose-900 bg-rose-50/50'}`}>
                          {Math.round(item.remainingAmount || 0).toLocaleString()}
                        </td>
                        <td className="py-2 px-2 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${
                            isPaid 
                              ? 'bg-emerald-100 text-emerald-950 border-emerald-300' 
                              : 'bg-rose-100 text-rose-950 border-rose-300'
                          }`}>
                            {isPaid ? 'پاکتاو' : 'قەرزار'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot className="bg-slate-100 font-black border-t-2 border-slate-900 text-xs">
                <tr>
                  <td colSpan={3} className="py-2.5 px-3 text-right text-slate-950">
                    کۆی گشتی هەموو هەژمارەکان ({debts.length} کڕیار):
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-slate-950">
                    {Math.round(totalDebtAmount).toLocaleString()} IQD
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-emerald-900">
                    {Math.round(totalPaidAmount).toLocaleString()} IQD
                  </td>
                  <td className="py-2.5 px-3 text-left font-mono text-rose-900">
                    {Math.round(totalRemainingAmount).toLocaleString()} IQD
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Footer, Verification, & Signature Block */}
        <div className="mt-4 pt-4 border-t-2 border-slate-900 no-page-break">
          <div className="flex justify-between items-center mb-5 px-2">
            <div className="flex items-center gap-3">
              <QRCodeSVG value={qrData} size={48} level="M" includeMargin={false} className="rounded" />
              <div className="text-[10px] text-gray-600 leading-tight">
                <p className="font-bold text-gray-950">کۆدی دڵنیایی ڕاپۆرتی گشتی</p>
                <p>بەڵگەی فەرمی وردبینی حسابی قەرزی فرۆشگا</p>
              </div>
            </div>

            <div className="text-left text-xs text-gray-600">
              <p>ئامادەکراوە لەلایەن: <strong className="text-gray-950">{preparedBy}</strong></p>
              <p>تۆماری فەرمی: <strong className="text-gray-950 font-mono">#{Date.now().toString().slice(-8)}</strong></p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6 text-center text-xs text-gray-800 mb-4">
            <div>
              <p className="font-black mb-6">ژمێریار / ئامادەکار</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
            <div>
              <p className="font-black mb-2">مۆری فەرمی کارگێڕی</p>
              <div className="w-16 h-16 mx-auto border-2 border-dashed border-slate-400 rounded-full flex items-center justify-center text-[9.5px] text-slate-500 font-black">
                مۆری فرۆشگا
              </div>
            </div>
            <div>
              <p className="font-black mb-6">بەڕێوەبەری گشتی / پەسەندکردن</p>
              <div className="border-b-2 border-dashed border-gray-400 w-32 mx-auto"></div>
            </div>
          </div>

          <div className="text-center text-xs text-gray-500 font-bold border-t border-gray-200 pt-2 flex justify-between items-center">
            <span>{settings.receiptFooter || 'سیستەمی ژمێریاری و فرۆشتنی ماس مێنو'}</span>
            <span className="font-mono text-[10px]">MAS MENU • GENERAL DEBTS LEDGER</span>
          </div>
        </div>
      </div>
    );
  }
);

GeneralDebtsReportA4.displayName = 'GeneralDebtsReportA4';
