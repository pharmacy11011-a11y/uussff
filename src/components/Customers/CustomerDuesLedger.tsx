import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { Printer } from 'lucide-react';
import { formatCurrency, printTemplate } from '@/src/utils/utils';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { useState } from 'react';

export const CustomerDuesLedger = ({ hideHeader = false }: { hideHeader?: boolean }) => {
  const customers = useLiveQuery(() => db.customers.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);

  const totalDues = customers?.reduce((sum, c) => sum + (c.balance || 0), 0) || 0;

  const handlePrint = () => {
    if (!customers || customers.length === 0) return;

    const formattedData = customers.map(c => ({
      name: c.name,
      phone: c.phone || 'N/A',
      address: c.address || 'N/A',
      total: c.balance || 0
    }));

    setPrintPreviewData({
      title: 'CUSTOMER DUES LEDGER',
      type: 'CUSTOMER DUES LEDGER',
      items: formattedData,
      total: totalDues,
      columns: [
        { header: 'CUSTOMER NAME', key: 'name' },
        { header: 'MOBILE', key: 'phone' },
        { header: 'ADDRESS', key: 'address' },
        { header: 'TOTAL DUES', key: 'total', align: 'right' }
      ]
    });
    setShowPrintPreview(true);
  };

  // Handle loading state to prevent white screen
  if (customers === undefined) {
    return (
      <div className="h-full flex items-center justify-center bg-[#F0F2F5]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-full flex flex-col gap-4 bg-[#F0F2F5] p-4 no-scrollbar">
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

      {/* Header (Hidden on Print) */}
      {!hideHeader && (
        <div className="flex items-center justify-between shrink-0 print:hidden bg-white p-4 rounded-xl shadow-sm border border-slate-200">
          <div>
            <h1 className="text-xl font-black text-slate-900">Customer Dues Ledger</h1>
            <p className="text-slate-500 text-xs">Comprehensive list of all customers and their current balances.</p>
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
      )}

      {/* Ledger Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4 border-b border-slate-100">Customer Name</th>
              <th className="px-6 py-4 border-b border-slate-100">Mobile Number</th>
              <th className="px-6 py-4 border-b border-slate-100">Address</th>
              <th className="px-6 py-4 border-b border-slate-100 text-right">Total Dues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {customers.map((customer) => (
              <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 uppercase">{customer.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{customer.phone || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 uppercase">{customer.address || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm font-black text-slate-900 text-right">
                      {formatCurrency(customer.balance)}
                    </td>
              </tr>
            ))}
            {customers.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                   No customers found in the database.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot className="bg-slate-900 text-white">
            <tr>
              <td colSpan={3} className="px-6 py-4 font-bold text-sm text-right">Grand Total:</td>
              <td className="px-6 py-4 font-black text-lg text-right">{formatCurrency(totalDues)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
};
