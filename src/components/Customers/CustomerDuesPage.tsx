import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { CustomerDuesTab } from './CustomerDuesTab';
import { CustomerDuesLedger } from './CustomerDuesLedger';
import { cn, formatCurrency } from '@/src/utils/utils';
import { FileDown, Share2 } from 'lucide-react';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

interface CustomerDuesPageProps {
  onEditInvoice: (id: number, type: 'Sales' | 'Purchase') => void;
}

export const CustomerDuesPage = ({ onEditInvoice }: CustomerDuesPageProps) => {
  const [activeTab, setActiveTab] = useState<'dues' | 'ledger'>('dues');
  const customers = useLiveQuery(() => db.customers.toArray());

  const handleExportPDF = async (share: boolean = false) => {
    if (!customers || customers.length === 0) return;

    let filteredCustomers = customers;
    if (activeTab === 'dues') {
      filteredCustomers = customers.filter(c => (c.balance || 0) > 0);
    }

    const title = activeTab === 'dues' ? 'CUSTOMER DUES REPORT' : 'CUSTOMER DUES LEDGER';
    const filename = activeTab === 'dues' ? 'customer_dues' : 'customer_dues_ledger';

    const columns = ['Customer Name', 'Mobile Number', 'Address', 'Total Dues'];
    const data = filteredCustomers.map(c => [
      c.name,
      c.phone || 'N/A',
      c.address || 'N/A',
      formatCurrency(c.balance || 0)
    ]);

    const totalDues = filteredCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);

    const options = {
      title,
      filename: `${filename}_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Total Outstanding', value: formatCurrency(totalDues) }
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
            onClick={() => setActiveTab('dues')}
            className={cn(
              "px-4 py-3 text-sm font-bold transition-all border-b-2 -mb-[1px]",
              activeTab === 'dues' 
                ? "text-blue-600 border-blue-600" 
                : "text-slate-500 border-transparent hover:text-slate-700"
            )}
          >
            Customer Dues
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
            Customer Dues Ledger
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
        {activeTab === 'dues' ? (
          <CustomerDuesTab />
        ) : (
          <CustomerDuesLedger hideHeader={true} />
        )}
      </div>
    </div>
  );
};
