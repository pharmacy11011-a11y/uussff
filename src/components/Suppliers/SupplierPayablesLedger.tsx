import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity } from '../../db/db';
import { Printer, FileDown, Share2, Search, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, printTemplate, cn } from '../../utils/utils';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { useState, useMemo } from 'react';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const SupplierPayablesLedger = ({ hideHeader = false }: { hideHeader?: boolean }) => {
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);

  const filteredSuppliers = useMemo(() => {
    if (!suppliers) return [];
    if (!appliedSearch) return suppliers;
    const query = appliedSearch.toLowerCase();
    return suppliers.filter(s => 
      s.name.toLowerCase().includes(query) || 
      (s.code && s.code.toLowerCase().includes(query))
    );
  }, [suppliers, appliedSearch]);

  const totalPayables = filteredSuppliers?.reduce((sum, s) => sum + (s.currentBalance || 0), 0) || 0;

  const initiateDelete = async (id: number) => {
    const supplier = await db.suppliers.get(id);
    if (!supplier) return;

    // Check if supplier has any purchases or payments
    const purchaseCount = await db.purchases.where('supplierId').equals(id).count();
    const paymentCount = await db.supplierPayments.where('supplierId').equals(id).count();

    let message = `Are you sure you want to delete supplier: ${supplier.name}?`;
    if (purchaseCount > 0 || paymentCount > 0) {
      message = `This supplier has ${purchaseCount} purchases and ${paymentCount} payments. Deleting will remove them permanently. Are you sure?`;
    }

    setDeleteConfirm({ id, name: supplier.name, message });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsProcessing(true);
    try {
      await db.suppliers.delete(deleteConfirm.id);
      await logActivity('Supplier deleted', `Deleted supplier: ${deleteConfirm.name}`);
      setToast({ message: 'Supplier deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      setToast({ message: 'Error deleting supplier', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(null);
    }
  };

  const handlePrint = () => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) return;

    const formattedData = filteredSuppliers.map(s => ({
      code: s.code || '---',
      name: s.name,
      phone: s.phone || '---',
      address: s.address || '---',
      total: s.currentBalance || 0
    }));

    setPrintPreviewData({
      title: 'SUPPLIER PAYABLES LEDGER',
      type: 'SUPPLIER PAYABLES LEDGER',
      items: formattedData,
      total: totalPayables,
      columns: [
        { header: 'CODE', key: 'code' },
        { header: 'SUPPLIER NAME', key: 'name' },
        { header: 'MOBILE', key: 'phone' },
        { header: 'ADDRESS', key: 'address' },
        { header: 'TOTAL PAYABLE', key: 'total', align: 'right' }
      ]
    });
    setShowPrintPreview(true);
  };

  const handleExportPDF = async (share: boolean = false) => {
    if (!filteredSuppliers || filteredSuppliers.length === 0) return;

    const columns = ['Code', 'Supplier Name', 'Mobile Number', 'Address', 'Total Payable'];
    const data = filteredSuppliers.map(s => [
      s.code || '---',
      s.name,
      s.phone || '---',
      s.address || '---',
      formatCurrency(s.currentBalance || 0)
    ]);

    const options = {
      title: 'SUPPLIER PAYABLES LEDGER',
      filename: `supplier_payables_ledger_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Grand Total', value: formatCurrency(totalPayables) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  return (
    <div className="min-h-full bg-[#F0F2F5] pb-10 no-scrollbar">
      {/* Print Preview Modal */}
      <PrintPreviewModal 
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title={printPreviewData?.title || 'Print Preview'}
        type={printPreviewData?.type || 'Report'}
        items={printPreviewData?.items || []}
        columns={printPreviewData?.columns}
        total={printPreviewData?.total}
        settings={settings}
      />

      {/* Screen Header - Hidden on Print */}
      {!hideHeader && (
        <div className="bg-white border-b border-slate-200 px-4 py-4 sticky top-0 z-30 print:hidden">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">Supplier Payables Ledger</h1>
              <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">Full list of all supplier balances</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handlePrint}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-100"
              >
                <Printer size={16} />
                Print List
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 md:p-6">
        {/* Search Bar */}
        <div className="mb-6 flex items-center gap-2 no-print">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Search by supplier name or code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && setAppliedSearch(searchQuery)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm font-medium"
            />
          </div>
          <button
            onClick={() => setAppliedSearch(searchQuery)}
            className="px-6 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-xs shadow-lg shadow-slate-200 flex items-center gap-2"
          >
            <Search size={14} />
            Search
          </button>
          {appliedSearch && (
            <button
              onClick={() => {
                setSearchQuery('');
                setAppliedSearch('');
              }}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all font-bold text-xs"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table Container */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Code</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Supplier Name</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Mobile Number</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Address</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Total Payable</th>
                <th className="px-6 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSuppliers && filteredSuppliers.length > 0 ? (
                filteredSuppliers.map((supplier) => (
                  <tr key={supplier.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="text-sm font-mono text-slate-500">{supplier.code || '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-900 uppercase">{supplier.name}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600">{supplier.phone || '---'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-slate-600 uppercase">{supplier.address || '---'}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <p className="text-sm font-black text-rose-600">
                        {formatCurrency(supplier.currentBalance || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => supplier.id && initiateDelete(supplier.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Supplier"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">
                    {appliedSearch ? `No suppliers found matching "${appliedSearch}"` : "No suppliers found"}
                  </td>
                </tr>
              )}
            </tbody>
            {filteredSuppliers && filteredSuppliers.length > 0 && (
              <tfoot>
                <tr className="bg-slate-50/50 font-bold border-t-2 border-slate-200">
                  <td colSpan={4} className="px-6 py-4 text-right text-slate-500 uppercase tracking-widest text-[11px]">Grand Total</td>
                  <td className="px-6 py-4 text-right text-rose-600 text-lg font-black">
                    {formatCurrency(totalPayables)}
                  </td>
                  <td className="px-6 py-4"></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-rose-600 px-6 py-4 text-white flex items-center gap-2">
              <AlertCircle size={20} />
              <h3 className="font-bold text-lg">Confirm Deletion</h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6 leading-relaxed">
                {deleteConfirm.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg font-bold hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={isProcessing}
                  className="flex-1 px-4 py-2 bg-rose-600 text-white rounded-lg font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-100 disabled:bg-slate-300"
                >
                  {isProcessing ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-300 z-[200]",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="font-bold text-sm">{toast.message}</span>
        </div>
      )}
    </div>
  );
};
