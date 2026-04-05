import React from 'react';
import { Printer, X } from 'lucide-react';
import { Receipt } from './Receipt';
import { printTemplate } from '@/src/utils/utils';

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type: string;
  items: any[];
  columns?: Array<{ header: string; key: string; align?: 'left' | 'center' | 'right' }>;
  total?: number;
  subtotal?: number;
  discount?: number;
  tax?: number;
  paid?: number;
  remaining?: number;
  previousRemaining?: number;
  paymentMethod?: string;
  invoiceNumber?: string;
  date?: string;
  time?: string;
  partyName?: string;
  partyContact?: string;
  partyAddress?: string;
  summary?: Array<{ label: string; value: string | number; isBold?: boolean; isSolid?: boolean }>;
  settings: any;
}

export const PrintPreviewModal = ({
  isOpen,
  onClose,
  title,
  type,
  items,
  columns,
  total,
  subtotal,
  discount,
  tax,
  paid,
  remaining,
  previousRemaining,
  paymentMethod,
  invoiceNumber,
  date,
  time,
  partyName,
  partyContact,
  partyAddress,
  summary,
  settings
}: PrintPreviewModalProps) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm print:hidden">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
              <Printer size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Print Preview</h3>
              <p className="text-[10px] text-white/60 leading-none">{title}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
          >
            <X size={20} className="text-white/60" />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 flex justify-center no-scrollbar">
          <div className="bg-white shadow-lg p-0 w-[80mm] min-h-[100mm] h-fit">
            <Receipt 
              id="print-container"
              type={type}
              items={items}
              columns={columns}
              total={total}
              subtotal={subtotal}
              discount={discount}
              tax={tax}
              paid={paid}
              remaining={remaining}
              previousRemaining={previousRemaining}
              paymentMethod={paymentMethod}
              invoiceNumber={invoiceNumber}
              date={date}
              time={time}
              partyName={partyName}
              partyContact={partyContact}
              partyAddress={partyAddress}
              summary={summary}
              settings={settings}
            />
          </div>
        </div>

        <div className="px-4 py-3 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
          <button 
            onClick={onClose}
            className="px-6 py-2 text-sm font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-all border border-slate-200"
          >
            Cancel
          </button>
          <button 
            onClick={() => {
              printTemplate('print-container');
            }}
            className="px-8 py-2.5 bg-emerald-600 text-white text-sm font-black rounded-xl hover:bg-emerald-700 transition-all flex items-center gap-2 shadow-lg shadow-emerald-100"
          >
            <Printer size={18} /> PRINT
          </button>
        </div>
      </div>
    </div>
  );
};
