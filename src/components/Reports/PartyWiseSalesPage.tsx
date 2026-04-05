import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { Search, User, Calendar, ArrowLeft, TrendingUp, DollarSign, Activity, FileDown, Share2 } from 'lucide-react';
import { cn, formatCurrency, formatNumber, handlePrint } from '@/src/utils/utils';
import { Printer } from 'lucide-react';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const PartyWiseSalesPage = ({ onBack }: { onBack: () => void }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<'Daily' | 'Weekly' | 'Monthly' | 'Yearly'>('Monthly');

  const invoices = useLiveQuery(() => db.invoices.toArray());
  const now = new Date();

  const partySales = useMemo(() => {
    if (!invoices) return [];

    const partyMap = new Map<string, { name: string, phone: string, count: number, total: number, profit: number }>();

    invoices.forEach(inv => {
      const invDate = new Date(inv.date);
      const isMatch = filter === 'Daily' ? invDate.toDateString() === now.toDateString() :
                     filter === 'Weekly' ? invDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
                     filter === 'Monthly' ? invDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
                     invDate.getFullYear() === now.getFullYear();

      if (isMatch) {
        const name = inv.customerName || 'Walk-in';
        const existing = partyMap.get(name) || { name, phone: inv.customerPhone || '-', count: 0, total: 0, profit: 0 };
        existing.count += 1;
        existing.total += inv.total;
        existing.profit += inv.items.reduce((sum, item) => sum + ((item.salePrice - item.purchasePrice) * item.quantity), 0);
        partyMap.set(name, existing);
      }
    });

    return Array.from(partyMap.values()).filter(party => 
      party.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [invoices, filter, searchQuery]);

  const totalSalesAmount = partySales.reduce((sum, item) => sum + item.total, 0);
  const totalInvoices = partySales.reduce((sum, item) => sum + item.count, 0);
  const totalProfit = partySales.reduce((sum, item) => sum + item.profit, 0);

  const handleExportPDF = async (share: boolean = false) => {
    if (!partySales || partySales.length === 0) return;

    const columns = ['Customer Name', 'Invoices', 'Total Sales', 'Gross Profit'];
    const data = partySales.map(item => [
      item.name,
      formatNumber(item.count),
      formatCurrency(item.total),
      formatCurrency(item.profit)
    ]);

    const options = {
      title: `PARTY-WISE SALES REPORT (${filter.toUpperCase()})`,
      filename: `party_wise_sales_${filter.toLowerCase()}_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Total Sales Amount', value: formatCurrency(totalSalesAmount) },
        { label: 'Total Invoices', value: formatNumber(totalInvoices) },
        { label: 'Total Gross Profit', value: formatCurrency(totalProfit) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        handlePrint('print-party-sales', 'Party-wise Sales Report');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden bg-[#F0F2F5] p-4">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-xl text-slate-600 transition-all shadow-sm border border-transparent hover:border-slate-200"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900">Party-wise Sales Analytics</h1>
            <p className="text-slate-500 text-sm">Detailed performance breakdown by customer.</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button 
            onClick={() => handleExportPDF(false)}
            className="px-3 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 hover:bg-slate-200"
          >
            <FileDown size={14} />
            PDF
          </button>
          <button 
            onClick={() => handleExportPDF(true)}
            className="px-3 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 hover:bg-emerald-100"
          >
            <Share2 size={14} />
            Share
          </button>
          <button
            onClick={() => handlePrint('print-party-sales', 'Party-wise Sales Report')}
            className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-100 flex items-center gap-2 hover:bg-emerald-700"
          >
            <Printer size={14} /> Print
          </button>
          {['Daily', 'Weekly', 'Monthly', 'Yearly'].map((f: any) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                filter === f ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
            <DollarSign size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Sales Amount</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalSalesAmount || 0)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
            <Activity size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Invoices</p>
            <p className="text-2xl font-black text-slate-900">{formatNumber(totalInvoices || 0)}</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-50 text-purple-600">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimated Gross Profit</p>
            <p className="text-2xl font-black text-slate-900">{formatCurrency(totalProfit || 0)}</p>
          </div>
        </div>
      </div>

      <div id="print-party-sales" className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <User size={18} className="text-blue-600" />
            Customer Sales Records
          </h3>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Search by customer name..."
              className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest z-10">
              <tr>
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4 text-center">Invoices</th>
                <th className="px-6 py-4 text-right">Total Sales</th>
                <th className="px-6 py-4 text-right">Gross Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {partySales.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 text-center">{formatNumber(item.count)}</td>
                  <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">{formatCurrency(item.total || 0)}</td>
                  <td className="px-6 py-4 text-sm font-black text-blue-600 text-right">{formatCurrency(item.profit || 0)}</td>
                </tr>
              ))}
              {partySales.length === 0 && (
                <tr><td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">No sales records found for this period</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
