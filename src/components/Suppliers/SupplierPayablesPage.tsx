import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { SupplierPayablesTab } from './SupplierPayablesTab';
import { SupplierPayablesLedger } from './SupplierPayablesLedger';
import { cn, formatCurrency } from '@/src/utils/utils';
import { FileDown, Share2 } from 'lucide-react';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

interface SupplierPayablesPageProps {
  onEditInvoice: (id: number, type: 'Sales' | 'Purchase') => void;
}

export const SupplierPayablesPage = ({ onEditInvoice }: SupplierPayablesPageProps) => {
  const [activeTab, setActiveTab] = useState<'payables' | 'ledger'>('payables');
  const suppliers = useLiveQuery(() => db.suppliers.toArray());

  const handleExportPDF = async (share: boolean = false) => {
    if (!suppliers || suppliers.length === 0) return;

    let filteredSuppliers = suppliers;
    if (activeTab === 'payables') {
      filteredSuppliers = suppliers.filter(s => (s.currentBalance || 0) > 0);
    }

    const title = activeTab === 'payables' ? 'SUPPLIER PAYABLES REPORT' : 'SUPPLIER PAYABLES LEDGER';
    const filename = activeTab === 'payables' ? 'supplier_payables' : 'supplier_payables_ledger';

    const columns = ['Code', 'Supplier Name', 'Mobile Number', 'Address', 'Total Payable'];
    const data = filteredSuppliers.map(s => [
      s.code || '---',
      s.name,
      s.phone || 'N/A',
      s.address || 'N/A',
      formatCurrency(s.currentBalance || 0)
    ]);

    const totalPayable = filteredSuppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);

    const options = {
      title,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Total Outstanding', value: formatCurrency(totalPayable) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  return (
    <div className="min-h-full flex flex-col bg-[#F0F2F5]">
      {/* Tab Header */}
      <div className="bg-white px-4 pt-2 border-b border-slate-200 flex items-center justify-between shrink-0 no-print">
        <div className="flex items-center gap-6">
          <button
            onClick={() => setActiveTab('payables')}
            className={cn(
              "px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-[1px]",
              activeTab === 'payables' 
                ? "text-blue-600 border-blue-600" 
                : "text-slate-500 border-transparent hover:text-slate-700"
            )}
          >
            Credits & Payments
          </button>
          <button
            onClick={() => setActiveTab('ledger')}
            className={cn(
              "px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-[1px]",
              activeTab === 'ledger' 
                ? "text-blue-600 border-blue-600" 
                : "text-slate-500 border-transparent hover:text-slate-700"
            )}
          >
            Payables Ledger
          </button>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <button 
            onClick={() => handleExportPDF(false)}
            className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all font-bold text-xs flex items-center gap-2 shadow-sm"
          >
            <FileDown size={14} />
            PDF
          </button>
          <button 
            onClick={() => handleExportPDF(true)}
            className="px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all font-bold text-xs flex items-center gap-2 shadow-sm"
          >
            <Share2 size={14} />
            WhatsApp
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'payables' ? (
          <SupplierPayablesTab />
        ) : (
          <SupplierPayablesLedger hideHeader={true} />
        )}
      </div>
    </div>
  );
};
