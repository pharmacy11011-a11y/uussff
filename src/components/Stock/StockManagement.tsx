import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine } from '@/src/db/db';
import { Search, Package, AlertTriangle, Filter, ArrowUpRight, ArrowDownLeft, Edit3, Trash2, CheckCircle2, AlertCircle, FileDown, Share2 } from 'lucide-react';
import { formatCurrency, cn } from '@/src/utils/utils';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const StockManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'expired'>('all');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedMed, setSelectedMed] = useState<Medicine | null>(null);
  const [adjustmentQty, setAdjustmentQty] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const medicines = useLiveQuery(() => db.medicines.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const filteredStock = medicines?.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || m.barcode.includes(searchQuery);
    const today = new Date();
    const expiry = new Date(m.expiryDate);
    
    if (stockFilter === 'low') return matchesSearch && m.stockQuantity <= m.minStockLimit && m.stockQuantity > 0;
    if (stockFilter === 'out') return matchesSearch && m.stockQuantity === 0;
    if (stockFilter === 'expired') return matchesSearch && expiry < today;
    return matchesSearch;
  });

  const handleAdjustment = async () => {
    if (!selectedMed?.id) return;
    const newQty = selectedMed.stockQuantity + adjustmentQty;
    if (newQty < 0) {
      showToast('Stock cannot be negative', 'error');
      return;
    }
    await db.medicines.update(selectedMed.id, { stockQuantity: newQty });
    showToast('Stock adjusted successfully!');
    setIsAdjustModalOpen(false);
    setSelectedMed(null);
    setAdjustmentQty(0);
  };

  const handleExportPDF = async (share: boolean = false) => {
    if (!filteredStock || filteredStock.length === 0) return;

    const columns = ['Name', 'Batch #', 'Current Stock', 'Min Limit', 'Expiry Date'];
    const data = filteredStock.map(m => [
      m.name,
      m.batchNumber,
      `${m.stockQuantity} units`,
      m.minStockLimit,
      m.expiryDate
    ]);

    const titleMap = {
      all: 'Full Inventory Report',
      low: 'Low Stock Inventory Report',
      out: 'Out of Stock Inventory Report',
      expired: 'Expired Medicines Report'
    };

    const options = {
      title: titleMap[stockFilter],
      filename: `${stockFilter}_stock_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Stock & Inventory</h1>
          <p className="text-slate-500 text-sm">Monitor stock levels, adjust quantities, and track expiry dates.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 mr-2 border-r border-slate-200 pr-2">
            <button 
              onClick={() => handleExportPDF(false)}
              className="p-2 bg-white text-slate-600 rounded-lg border border-slate-200 hover:bg-slate-50 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
              title="Download PDF"
            >
              <FileDown size={16} />
              PDF
            </button>
            <button 
              onClick={() => handleExportPDF(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
              title="Share on WhatsApp"
            >
              <Share2 size={16} />
              Share
            </button>
          </div>
          <div className="bg-white p-1 rounded-lg border border-slate-200 flex gap-1">
            <button 
              onClick={() => setStockFilter('all')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", stockFilter === 'all' ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              All Stock
            </button>
            <button 
              onClick={() => setStockFilter('low')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", stockFilter === 'low' ? "bg-amber-500 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              Low Stock
            </button>
            <button 
              onClick={() => setStockFilter('out')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", stockFilter === 'out' ? "bg-red-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              Out of Stock
            </button>
            <button 
              onClick={() => setStockFilter('expired')}
              className={cn("px-3 py-1.5 text-xs font-bold rounded-md transition-all", stockFilter === 'expired' ? "bg-purple-600 text-white" : "text-slate-500 hover:bg-slate-50")}
            >
              Expired
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex gap-4 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by medicine name or barcode..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold border-b border-slate-100">
                <th className="px-6 py-4">Name</th>
                <th className="px-6 py-4">Batch #</th>
                <th className="px-6 py-4">Current Stock</th>
                <th className="px-6 py-4">Min Limit</th>
                <th className="px-6 py-4">Expiry Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStock?.map(med => {
                const isExpired = new Date(med.expiryDate) < new Date();
                const isLow = med.stockQuantity <= med.minStockLimit;
                
                return (
                  <tr key={med.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-8 h-8 rounded-lg flex items-center justify-center",
                          isExpired ? "bg-purple-100 text-purple-600" : isLow ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                        )}>
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{med.name}</p>
                          <p className="text-[10px] text-slate-400">{med.genericName}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-mono">{med.batchNumber}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-sm font-bold",
                          med.stockQuantity === 0 ? "text-red-600" : isLow ? "text-amber-600" : "text-emerald-600"
                        )}>
                          {med.stockQuantity} units
                        </span>
                        {isLow && <AlertTriangle size={14} className="text-amber-500" />}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">{med.minStockLimit}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "text-sm font-medium",
                        isExpired ? "text-red-600 font-bold" : "text-slate-600"
                      )}>
                        {med.expiryDate}
                        {isExpired && <span className="ml-2 text-[10px] uppercase bg-red-100 px-1.5 py-0.5 rounded">Expired</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => { setSelectedMed(med); setIsAdjustModalOpen(true); }}
                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Adjust Stock"
                      >
                        <Edit3 size={18} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjustment Modal */}
      {isAdjustModalOpen && selectedMed && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="text-xl font-bold text-slate-900">Stock Adjustment</h2>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAdjustModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <Trash2 size={20} className="rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-6">
              <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-600">
                  <Package size={24} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{selectedMed.name}</p>
                  <p className="text-xs text-slate-500">Current Stock: <span className="font-bold text-slate-900">{selectedMed.stockQuantity}</span></p>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Adjustment Quantity</label>
                <div className="flex items-center gap-4">
                  <div className="flex-1 relative">
                    <input 
                      type="number"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-center focus:ring-2 focus:ring-emerald-500 outline-none"
                      value={adjustmentQty}
                      onChange={(e) => setAdjustmentQty(Number(e.target.value))}
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                      {adjustmentQty > 0 ? <ArrowUpRight className="text-emerald-500" /> : adjustmentQty < 0 ? <ArrowDownLeft className="text-red-500" /> : <Edit3 />}
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 text-center">Use positive numbers to add, negative to subtract.</p>
              </div>

              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-emerald-800">New Total Stock</span>
                  <span className="text-xl font-black text-emerald-900">{selectedMed.stockQuantity + adjustmentQty}</span>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsAdjustModalOpen(false);
                  }}
                  className="flex-1 py-3 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAdjustment}
                  className="flex-1 py-3 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-lg shadow-emerald-100"
                >
                  Apply Adjustment
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1000] animate-in slide-in-from-bottom-5 duration-300">
          <div className={cn(
            "px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white font-bold text-xs",
            toast.type === 'success' ? "bg-emerald-600" : "bg-red-600"
          )}>
            {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};
