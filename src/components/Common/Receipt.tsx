import React from 'react';
import { formatNumber, cn } from '../../utils/utils';

interface ReceiptProps {
  type: string; // Dynamic Title: 'Sale Invoice', 'Purchase Invoice', 'Low Stock', 'Sale Report', etc.
  invoiceNumber?: string;
  date?: string;
  time?: string;
  partyName?: string;
  partyContact?: string;
  partyAddress?: string;
  partyCode?: string;
  items?: any[];
  columns?: Array<{ header: string; key: string; align?: 'left' | 'center' | 'right' }>;
  subtotal?: number;
  discount?: number;
  tax?: number;
  total?: number;
  paid?: number;
  remaining?: number;
  previousRemaining?: number;
  paymentMethod?: string;
  summary?: Array<{ label: string; value: string | number; isBold?: boolean; isSolid?: boolean; isRed?: boolean }>;
  settings: any;
  id?: string;
}

const DashedLine = () => <div className="border-t border-dashed border-black my-1 w-full"></div>;
const SolidLine = () => <div className="border-t border-black my-1 w-full"></div>;

export const Receipt = ({ 
  type, 
  invoiceNumber,
  date,
  time,
  partyName,
  partyContact,
  partyAddress,
  partyCode,
  items = [], 
  columns,
  subtotal,
  discount,
  tax,
  total, 
  paid, 
  remaining, 
  previousRemaining,
  paymentMethod,
  summary,
  settings,
  id = "print-container"
}: ReceiptProps) => {
  
  const pharmacyName = settings?.pharmacyName || 'PHARMACY NAME';
  const address = settings?.address || 'Address Line 1';
  const phone = settings?.phone || '0300-1234567';
  const printType = settings?.defaultPrintType || 'Thermal';

  const currentDate = date || new Date().toLocaleDateString('en-GB').replace(/\//g, '-');
  const currentTime = time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });

  const formatVal = (val: any) => {
    if (val === undefined || val === null) return '0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const typeUpper = type.toUpperCase();
  const isInvoice = typeUpper.includes('INVOICE');
  const isPurchase = typeUpper.includes('PURCHASE');
  const isReport = !isInvoice;

  const renderThermal = () => (
    <div className="w-full bg-white text-black p-0 font-bold leading-tight" style={{ width: '80mm' }}>
      <SolidLine />
      <div className="text-center my-1 px-1">
        <h1 className="text-[22px] font-black uppercase tracking-tighter leading-none mb-1">
          {pharmacyName}
        </h1>
        <p className="text-[12px] font-bold leading-tight">{address}</p>
        <p className="text-[12px] font-bold leading-tight">Phone: {phone}</p>
      </div>
      <SolidLine />
      
      {/* Invoice Title Box */}
      <div className="flex justify-center my-1">
        <div className="border-2 border-black px-6 py-0.5">
          <h2 className="text-[16px] font-black uppercase tracking-widest">
            {typeUpper}
          </h2>
        </div>
      </div>

      <SolidLine />

      {/* Invoice Info */}
      <div className="flex justify-between text-[12px] font-bold px-1 mb-1">
        <div className="flex flex-col">
          <span>Date: {currentDate}</span>
          <span>Time: {currentTime}</span>
        </div>
        {isInvoice && (
          <div className="text-right">
            <span>Inv #: {invoiceNumber || '---'}</span>
          </div>
        )}
      </div>

      <DashedLine />

      {/* Party Details */}
      {isInvoice && (
        <div className="space-y-0.5 mb-1 text-[12px] font-bold px-1">
          <div className="flex">
            <span className="w-[70px]">{isPurchase ? 'Supplier' : 'Customer'}</span>
            <span>: {partyName || '---'}</span>
          </div>
          <div className="flex">
            <span className="w-[70px]">Phone</span>
            <span>: {partyContact || '---'}</span>
          </div>
          <div className="flex">
            <span className="w-[70px]">Address</span>
            <span>: {partyAddress || '---'}</span>
          </div>
        </div>
      )}

      {isInvoice && <DashedLine />}

      {/* Table */}
      <table className="w-full border-collapse mb-1">
        <thead>
          <tr className="bg-black text-white text-[11px] font-bold">
            {columns ? (
              columns.map((col, idx) => (
                <th key={col.key || idx} className={cn("py-0.5 px-1", col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left')}>
                  {col.header}
                </th>
              ))
            ) : (
              <>
                <th className="text-left py-0.5 px-1 w-6">Sr</th>
                <th className="text-left py-0.5 px-1">Item Name</th>
                <th className="text-right py-0.5 px-1 w-10">Qty</th>
                <th className="text-right py-0.5 px-1 w-14">Rate</th>
                <th className="text-right py-0.5 px-1 w-20">Amount</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="text-[11px] font-bold">
          {items.map((item, index) => (
            <tr key={item.id || item.medicineId || index} className="border-b border-black">
              {columns ? (
                columns.map((col, idx) => (
                  <td key={col.key || idx} className={cn("py-1 px-1 align-top", col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left')}>
                    {col.key === 'sr' ? index + 1 : (typeof item[col.key] === 'number' ? formatVal(item[col.key]) : item[col.key])}
                  </td>
                ))
              ) : (
                <>
                  <td className="py-1 px-1 align-top">{index + 1}</td>
                  <td className="py-1 px-1 align-top">
                    <div>{item.medicineName || item.name}</div>
                    {item.batchNumber && <div className="text-[9px] font-normal">Batch: {item.batchNumber}</div>}
                  </td>
                  <td className="py-1 px-1 text-right align-top">{item.qty || item.quantity}</td>
                  <td className="py-1 px-1 text-right align-top">{formatVal(item.price || item.salePrice || item.purchasePrice)}</td>
                  <td className="py-1 px-1 text-right align-top">{formatVal(item.total)}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      <DashedLine />

      {/* Summary */}
      {isInvoice && (
        <div className="mt-1 space-y-0.5 px-1">
          <div className="flex justify-between text-[12px]">
            <span>Subtotal:</span>
            <span>{formatVal(subtotal || total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-[12px]">
              <span>Discount:</span>
              <span>-{formatVal(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-[12px]">
              <span>Tax:</span>
              <span>{formatVal(tax)}</span>
            </div>
          )}
          <SolidLine />
          <div className="flex justify-between text-[14px] font-black">
            <span>Total Amount:</span>
            <span>{formatVal(total)}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span>Paid Amount:</span>
            <span>{formatVal(paid)}</span>
          </div>
          <div className="flex justify-between text-[12px] font-black">
            <span>Remaining:</span>
            <span>{formatVal(remaining)}</span>
          </div>
          {previousRemaining > 0 && (
            <div className="flex justify-between text-[12px] italic">
              <span>Previous Balance:</span>
              <span>{formatVal(previousRemaining)}</span>
            </div>
          )}
          <SolidLine />
          <div className="flex justify-between text-[14px] font-black bg-black text-white px-1">
            <span>Net Payable:</span>
            <span>{formatVal(total + previousRemaining)}</span>
          </div>
        </div>
      )}

      {isReport && summary && (
        <div className="mt-2 space-y-1 px-1">
          {summary.map((s, i) => (
            <div key={`${s.label}-${i}`} className={cn("flex justify-between text-[12px]", s.isBold && "font-black", s.isSolid && "border-t border-black pt-1")}>
              <span>{s.label}</span>
              <span>{typeof s.value === 'number' ? formatVal(s.value) : s.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8 flex justify-between px-4 text-[10px] font-black uppercase">
        <div className="text-center">
          <div className="border-t border-black w-24 mb-1"></div>
          <span>Customer Sign</span>
        </div>
        <div className="text-center">
          <div className="border-t border-black w-24 mb-1"></div>
          <span>Authorized Sign</span>
        </div>
      </div>

      <div className="mt-6 text-center text-[10px] font-black uppercase italic">
        <p>Thank you for your visit!</p>
        <p>Software by: AIS Pharmacy System</p>
      </div>
    </div>
  );

  const renderA4 = () => (
    <div className="print-layout a4 bg-white min-h-[297mm]">
      <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4 mb-6">
        <div>
          <h1 className="text-4xl font-black text-slate-900 uppercase">{pharmacyName}</h1>
          <p className="text-sm text-slate-600 mt-1">{address}</p>
          <p className="text-sm text-slate-600">Phone: {phone}</p>
        </div>
        <div className="text-right">
          <h2 className="text-2xl font-bold text-slate-900 uppercase">{type}</h2>
          <p className="text-sm text-slate-600">Invoice #: {invoiceNumber || '---'}</p>
          <p className="text-sm text-slate-600">Date: {currentDate} {currentTime}</p>
        </div>
      </div>

      {isInvoice && (
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Bill To:</h3>
            <p className="text-lg font-bold text-slate-900">{partyName || 'Walk-in Customer'}</p>
            <p className="text-sm text-slate-600">{partyAddress || '---'}</p>
            <p className="text-sm text-slate-600">Contact: {partyContact || '---'}</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-lg">
            <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">Payment Info:</h3>
            <p className="text-sm text-slate-600">Method: {paymentMethod || 'Cash'}</p>
            <p className="text-sm text-slate-600">Status: {remaining > 0 ? 'Partial' : 'Paid'}</p>
          </div>
        </div>
      )}

      <table className="w-full mb-8">
        <thead>
          <tr className="bg-slate-900 text-white">
            <th className="py-3 px-4 text-left rounded-l">Sr</th>
            <th className="py-3 px-4 text-left">Item Description</th>
            <th className="py-3 px-4 text-right">Qty</th>
            <th className="py-3 px-4 text-right">Price</th>
            <th className="py-3 px-4 text-right rounded-r">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200">
          {items.map((item, idx) => (
            <tr key={`a4-item-${item.id || item.medicineId || idx}`}>
              <td className="py-3 px-4">{idx + 1}</td>
              <td className="py-3 px-4">
                <p className="font-bold text-slate-900 uppercase">{item.name || item.medicineName || item.itemName}</p>
                {item.batchNumber && <p className="text-[10px] text-slate-500">Batch: {item.batchNumber}</p>}
              </td>
              <td className="py-3 px-4 text-right">{item.qty || item.quantity}</td>
              <td className="py-3 px-4 text-right">{formatVal(item.price || item.salePrice || item.purchasePrice)}</td>
              <td className="py-3 px-4 text-right font-bold">{formatVal(item.total || ((item.qty || item.quantity) * (item.price || item.salePrice || item.purchasePrice)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex justify-end">
        <div className="w-80 space-y-2">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatVal(subtotal || total)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-emerald-600">
              <span>Discount</span>
              <span>- {formatVal(discount)}</span>
            </div>
          )}
          {tax > 0 && (
            <div className="flex justify-between text-slate-600">
              <span>Tax</span>
              <span>+ {formatVal(tax)}</span>
            </div>
          )}
          <div className="border-t-2 border-slate-900 pt-2 flex justify-between text-xl font-black text-slate-900">
            <span>GRAND TOTAL</span>
            <span>{formatVal(total)}</span>
          </div>
          <div className="flex justify-between text-slate-600 pt-4">
            <span>Paid Amount</span>
            <span>{formatVal(paid)}</span>
          </div>
          <div className="flex justify-between text-red-600 font-bold">
            <span>Balance Due</span>
            <span>{formatVal(remaining)}</span>
          </div>
        </div>
      </div>

      <div className="mt-20 pt-8 border-t border-slate-200 text-center text-slate-400 text-xs">
        <p>This is a computer generated invoice. No signature required.</p>
        <p className="mt-1">Pharmacy Management System by AIS</p>
      </div>
    </div>
  );

  const renderCompact = () => (
    <div className="print-layout compact p-0 max-w-[58mm] mx-auto bg-white leading-tight">
      <div className="text-center mb-2">
        <h1 className="text-xl font-black uppercase">{pharmacyName}</h1>
        <p className="text-[9px]">{phone}</p>
      </div>
      <div className="border-y border-black py-1 text-center font-bold uppercase text-[10px] mb-2">
        {type}
      </div>
      <div className="text-[9px] mb-2">
        <p>Inv: {invoiceNumber}</p>
        <p>Date: {currentDate}</p>
      </div>
      <table className="w-full text-[9px] mb-2">
        <thead className="border-b border-black">
          <tr>
            <th className="text-left py-1">Item</th>
            <th className="text-right py-1">Qty</th>
            <th className="text-right py-1">Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={`compact-item-${item.id || item.medicineId || idx}`}>
              <td className="py-1 uppercase">{item.name || item.medicineName || item.itemName}</td>
              <td className="text-right">{item.qty || item.quantity}</td>
              <td className="text-right">{formatVal(item.total || ((item.qty || item.quantity) * (item.price || item.salePrice || item.purchasePrice)))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t border-black pt-1 text-[10px] font-bold">
        <div className="flex justify-between">
          <span>TOTAL</span>
          <span>{formatVal(total)}</span>
        </div>
        <div className="flex justify-between">
          <span>PAID</span>
          <span>{formatVal(paid)}</span>
        </div>
      </div>
    </div>
  );

  const renderDetailed = () => (
    <div className="print-layout detailed bg-white min-h-[297mm]">
      <div className="text-center mb-10">
        <h1 className="text-5xl font-black text-slate-900">{pharmacyName}</h1>
        <p className="text-lg text-slate-500 tracking-widest uppercase mt-2">{address}</p>
        <div className="flex justify-center gap-10 mt-4 text-slate-600 font-bold">
          <span>PH: {phone}</span>
          {settings?.easyPaisa && <span>EASYPAISA: {settings.easyPaisa}</span>}
        </div>
      </div>

      <div className="flex justify-between items-end mb-10 bg-slate-900 text-white p-6 rounded-xl">
        <div>
          <h2 className="text-4xl font-black uppercase tracking-tighter">{type}</h2>
          <p className="opacity-70 mt-1">Reference: {invoiceNumber || '---'}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{currentDate}</p>
          <p className="opacity-70">{currentTime}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-10">
        <div className="border-l-4 border-slate-900 pl-4">
          <h3 className="text-xs font-black text-slate-400 uppercase mb-1">Billing To</h3>
          <p className="text-xl font-bold text-slate-900">{partyName || 'Walk-in'}</p>
          <p className="text-sm text-slate-500">{partyContact}</p>
        </div>
        <div className="border-l-4 border-slate-900 pl-4">
          <h3 className="text-xs font-black text-slate-400 uppercase mb-1">Location</h3>
          <p className="text-sm text-slate-500">{partyAddress || '---'}</p>
        </div>
        <div className="border-l-4 border-slate-900 pl-4">
          <h3 className="text-xs font-black text-slate-400 uppercase mb-1">Payment</h3>
          <p className="text-xl font-bold text-slate-900">{paymentMethod}</p>
          <p className="text-sm text-slate-500">{remaining > 0 ? 'Balance Outstanding' : 'Fully Settled'}</p>
        </div>
      </div>

      <table className="w-full mb-10">
        <thead>
          <tr className="border-b-2 border-slate-900 text-slate-400 text-xs font-black uppercase">
            <th className="py-4 text-left">#</th>
            <th className="py-4 text-left">Item & Details</th>
            <th className="py-4 text-center">Batch</th>
            <th className="py-4 text-center">Expiry</th>
            <th className="py-4 text-right">Qty</th>
            <th className="py-4 text-right">Price</th>
            <th className="py-4 text-right">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <tr key={item.id || item.medicineId || idx} className="text-slate-700">
              <td className="py-4 font-bold">{idx + 1}</td>
              <td className="py-4">
                <p className="font-black text-slate-900 uppercase">{item.name || item.medicineName || item.itemName}</p>
                <p className="text-[10px] text-slate-400">{item.medicineCode}</p>
              </td>
              <td className="py-4 text-center text-sm">{item.batchNumber || '---'}</td>
              <td className="py-4 text-center text-sm">{item.expiryDate || '---'}</td>
              <td className="py-4 text-right font-bold">{item.qty || item.quantity}</td>
              <td className="py-4 text-right">{formatVal(item.price || item.salePrice || item.purchasePrice)}</td>
              <td className="py-4 text-right font-black text-slate-900">{formatVal(item.total || ((item.qty || item.quantity) * (item.price || item.salePrice || item.purchasePrice)))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid grid-cols-2 gap-20">
        <div className="bg-slate-50 p-6 rounded-2xl">
          <h3 className="text-xs font-black text-slate-400 uppercase mb-4">Important Notice</h3>
          <ul className="text-[10px] text-slate-500 space-y-2 list-disc pl-4">
            <li>Medicines once sold will not be returned or exchanged.</li>
            <li>Please check the expiry date before leaving the counter.</li>
            <li>Keep medicines out of reach of children.</li>
            <li>Store in a cool and dry place.</li>
          </ul>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between text-slate-500 font-bold">
            <span>Subtotal</span>
            <span>{formatVal(subtotal || total)}</span>
          </div>
          <div className="flex justify-between text-emerald-600 font-bold">
            <span>Discount Applied</span>
            <span>- {formatVal(discount)}</span>
          </div>
          <div className="flex justify-between text-slate-500 font-bold">
            <span>Tax (GST)</span>
            <span>+ {formatVal(tax)}</span>
          </div>
          <div className="bg-slate-900 text-white p-4 rounded-xl flex justify-between items-center mt-6">
            <span className="text-xs font-black uppercase opacity-60">Amount Payable</span>
            <span className="text-3xl font-black">{formatVal(total)}</span>
          </div>
          <div className="pt-4 space-y-1">
            <div className="flex justify-between text-sm text-slate-500">
              <span>Amount Received</span>
              <span>{formatVal(paid)}</span>
            </div>
            <div className="flex justify-between text-sm font-black text-red-600">
              <span>Balance Remaining</span>
              <span>{formatVal(remaining)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (printType) {
      case 'A4': return renderA4();
      case 'Compact': return renderCompact();
      case 'Detailed': return renderDetailed();
      default: return renderThermal();
    }
  };

  return (
    <div id={id} className={cn(
      "print-layout",
      printType === 'Thermal' && "print-thermal thermal",
      printType === 'A4' && "print-a4 a4",
      printType === 'Compact' && "print-compact compact",
      printType === 'Detailed' && "print-detailed detailed"
    )}>
      {renderContent()}
    </div>
  );
};


