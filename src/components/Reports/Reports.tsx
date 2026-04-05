import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { 
  BarChart3, 
  Download, 
  Printer, 
  FileText, 
  Calendar, 
  TrendingUp, 
  AlertCircle, 
  Package,
  ArrowUpRight,
  ArrowDownRight,
  X,
  Edit2,
  FileDown,
  Share2
} from 'lucide-react';
import { formatCurrency, cn, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';
import * as XLSX from 'xlsx';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { useRef } from 'react';

export const Reports = ({ onEditInvoice }: { onEditInvoice?: (id: number, type: 'Sales' | 'Purchase') => void }) => {
  const [reportType, setReportType] = useState<'sales' | 'purchases' | 'stock' | 'profit' | 'expired'>('sales');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const invoices = useLiveQuery(() => db.invoices.toArray());
  const purchases = useLiveQuery(() => db.purchases.toArray());
  const returns = useLiveQuery(() => db.returns.toArray());
  const medicines = useLiveQuery(() => db.medicines.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const filteredData = () => {
    if (!invoices || !purchases || !returns) return [];
    
    const start = startDate ? new Date(startDate) : new Date(0);
    const end = endDate ? new Date(endDate) : new Date();
    // Normalize end date to end of day
    end.setHours(23, 59, 59, 999);

    const isWithinRange = (dateStr: string) => {
      const date = new Date(dateStr);
      return date >= start && date <= end;
    };

    switch (reportType) {
      case 'sales': {
        const filteredInvoices = invoices.filter(i => isWithinRange(i.date));
        const filteredReturns = returns.filter(r => r.type === 'Sales' && isWithinRange(r.date));
        
        const invoiceRows = filteredInvoices.map(inv => {
          const invReturns = filteredReturns.filter(r => r.referenceNumber === inv.invoiceNumber);
          const returnAmount = invReturns.reduce((sum, r) => sum + r.totalAmount, 0);
          const total = inv.subtotal !== undefined ? 
            ((inv.subtotal || 0) - (inv.discount || 0) + (inv.tax || 0)) : 
            (inv.total || 0);
          return { 
            ...inv, 
            total, 
            returnAmount, 
            netAmount: total - returnAmount,
            isReturn: false
          };
        });

        const standaloneReturns = filteredReturns.filter(r => 
          !filteredInvoices.some(inv => inv.invoiceNumber === r.referenceNumber)
        ).map(r => ({
          id: `return-${r.id}`,
          date: r.date,
          invoiceNumber: r.referenceNumber,
          customerName: r.customerName || 'N/A',
          total: 0,
          returnAmount: r.totalAmount,
          netAmount: -r.totalAmount,
          isReturn: true
        }));

        return [...invoiceRows, ...standaloneReturns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      case 'purchases': {
        const filteredPurchases = purchases.filter(p => isWithinRange(p.date));
        const filteredReturns = returns.filter(r => r.type === 'Purchase' && isWithinRange(r.date));
        
        const purchaseRows = filteredPurchases.map(p => {
          const pReturns = filteredReturns.filter(r => r.referenceNumber === p.invoiceNumber);
          const returnAmount = pReturns.reduce((sum, r) => sum + r.totalAmount, 0);
          const total = p.subtotal !== undefined ? 
            ((p.subtotal || 0) - (p.discount || 0) + (p.tax || 0)) : 
            (p.total || 0);
          return { 
            ...p, 
            total, 
            returnAmount, 
            netAmount: total - returnAmount,
            isReturn: false
          };
        });

        const standaloneReturns = filteredReturns.filter(r => 
          !filteredPurchases.some(p => p.invoiceNumber === r.referenceNumber)
        ).map(r => ({
          id: `return-${r.id}`,
          date: r.date,
          invoiceNumber: r.referenceNumber,
          supplierName: r.supplierName || 'N/A',
          total: 0,
          returnAmount: r.totalAmount,
          netAmount: -r.totalAmount,
          isReturn: true
        }));

        return [...purchaseRows, ...standaloneReturns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      case 'stock':
        return medicines;
      case 'expired':
        return medicines?.filter(m => new Date(m.expiryDate) < new Date());
      case 'profit': {
        const filteredInvoices = invoices.filter(i => isWithinRange(i.date));
        const filteredReturns = returns.filter(r => r.type === 'Sales' && isWithinRange(r.date));
        
        const invoiceRows = filteredInvoices.map(inv => {
          const invReturns = filteredReturns.filter(r => r.referenceNumber === inv.invoiceNumber);
          let profit = inv.items.reduce((sum, item) => 
            sum + ((item.salePrice || 0) - (item.purchasePrice || 0)) * item.quantity, 0
          );
          
          invReturns.forEach(ret => {
            ret.items.forEach(retItem => {
              const originalItem = inv.items.find(i => i.medicineId === retItem.medicineId);
              if (originalItem) {
                profit -= ((originalItem.salePrice || 0) - (originalItem.purchasePrice || 0)) * retItem.quantity;
              }
            });
          });
          
          return { ...inv, profit };
        });

        const standaloneReturns = filteredReturns.filter(r => 
          !filteredInvoices.some(inv => inv.invoiceNumber === r.referenceNumber)
        ).map(r => {
          const originalInvoice = invoices.find(inv => inv.invoiceNumber === r.referenceNumber);
          let lostProfit = 0;
          if (originalInvoice) {
            r.items.forEach(retItem => {
              const originalItem = originalInvoice.items.find(i => i.medicineId === retItem.medicineId);
              if (originalItem) {
                lostProfit += ((originalItem.salePrice || 0) - (originalItem.purchasePrice || 0)) * retItem.quantity;
              }
            });
          }
          return {
            id: `return-profit-${r.id}`,
            date: r.date,
            invoiceNumber: r.referenceNumber,
            customerName: r.customerName || 'N/A',
            profit: -lostProfit,
            isReturn: true
          };
        });

        return [...invoiceRows, ...standaloneReturns].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      }
      default:
        return [];
    }
  };

  const data = filteredData() || [];
  
  const summaryStats = React.useMemo(() => {
    if (!data || data.length === 0) return { total: 0, returns: 0, net: 0 };
    
    if (reportType === 'sales' || reportType === 'purchases') {
      const total = data.reduce((sum: number, item: any) => sum + (item.total || 0), 0);
      const returns = data.reduce((sum: number, item: any) => sum + (item.returnAmount || 0), 0);
      return { total, returns, net: total - returns };
    }
    
    if (reportType === 'profit') {
      return { total: 0, returns: 0, net: data.reduce((sum: number, item: any) => sum + (item.profit || 0), 0) };
    }
    
    return { total: 0, returns: 0, net: 0 };
  }, [data, reportType]);

  const totalAmount = summaryStats.net;

  const handlePrint = (autoPrint: boolean = false) => {
    const items = data.map((item: any, index: number) => {
      if (reportType === 'sales') {
        return {
          sr: index + 1,
          code: item.invoiceNumber,
          name: item.customerName + (item.isReturn ? ' (RET)' : ''),
          qty: item.date,
          price: item.netAmount,
          total: item.netAmount
        };
      }
      if (reportType === 'purchases') {
        return {
          sr: index + 1,
          code: item.invoiceNumber,
          name: item.supplierName + (item.isReturn ? ' (RET)' : ''),
          qty: item.date,
          price: item.netAmount,
          total: item.netAmount
        };
      }
      if (reportType === 'stock' || reportType === 'expired') {
        return {
          sr: index + 1,
          code: item.code,
          name: `${item.name} (${item.genericName})`,
          qty: item.stockQuantity,
          price: item.salePrice,
          total: (item.stockQuantity || 0) * (item.salePrice || 0)
        };
      }
      // Profit or other
      return {
        sr: index + 1,
        code: item.invoiceNumber,
        name: item.customerName || item.supplierName || 'N/A',
        qty: item.date,
        price: item.profit || item.total,
        total: item.profit || item.total
      };
    });

    setPrintPreviewData({
      title: `${reportType.toUpperCase()} REPORT`,
      type: `${reportType.toUpperCase()} REPORT`,
      items,
      total: totalAmount,
      columns: reportType === 'stock' || reportType === 'expired' ? [
        { header: 'SR', key: 'sr', align: 'left' },
        { header: 'CODE', key: 'code' },
        { header: 'NAME', key: 'name' },
        { header: 'QTY', key: 'qty', align: 'center' },
        { header: 'PRICE', key: 'price', align: 'right' },
        { header: 'TOTAL', key: 'total', align: 'right' }
      ] : [
        { header: 'SR', key: 'sr', align: 'left' },
        { header: 'INV #', key: 'code' },
        { header: 'PARTY', key: 'name' },
        { header: 'DATE', key: 'qty' },
        { header: 'AMOUNT', key: 'price', align: 'right' }
      ],
      summary: [
        { label: 'TOTAL COUNT', value: items.length },
        { label: 'TOTAL AMOUNT', value: totalAmount, isBold: true, isSolid: true }
      ]
    });
    setShowPrintPreview(true);

    if (autoPrint) {
      setTimeout(() => {
        printTemplate('print-container');
      }, 500);
    }
  };

  const handlePrintInvoice = (autoPrint: boolean = false) => {
    if (!selectedInvoice) return;
    setPrintPreviewData({
      title: selectedInvoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice',
      type: selectedInvoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice',
      invoiceNumber: selectedInvoice.invoiceNumber,
      date: selectedInvoice.date,
      time: selectedInvoice.time || '',
      partyName: selectedInvoice.customerName || selectedInvoice.supplierName,
      partyContact: selectedInvoice.customerPhone || selectedInvoice.supplierPhone || '',
      partyAddress: selectedInvoice.supplierAddress,
      items: selectedInvoice.items,
      subtotal: selectedInvoice.subtotal || selectedInvoice.totalCost,
      discount: selectedInvoice.discount,
      tax: selectedInvoice.tax,
      total: selectedInvoice.total || selectedInvoice.totalCost || 0,
      paid: selectedInvoice.paidAmount || 0,
      remaining: selectedInvoice.remainingAmount || selectedInvoice.remaining || 0,
      previousRemaining: selectedInvoice.previousRemaining || 0,
      paymentMethod: selectedInvoice.paymentMethod
    });
    setShowPrintPreview(true);

    if (autoPrint) {
      setTimeout(() => {
        printTemplate('print-container');
      }, 500);
    }
  };

  const handleExportPDF = async (share: boolean = false) => {
    if (!data || data.length === 0) return;

    let title = `${reportType.toUpperCase()} REPORT`;
    let columns: string[] = [];
    let pdfData: any[][] = [];
    let totals: { label: string; value: string }[] = [];

    if (reportType === 'stock' || reportType === 'expired') {
      columns = ['Code', 'Name', 'Generic', 'Expiry', 'Stock', 'Price', 'Total'];
      pdfData = data.map((m: any) => [
        m.code || '-',
        m.name,
        m.genericName || '-',
        m.expiryDate || '-',
        m.stockQuantity,
        formatCurrency(m.salePrice),
        formatCurrency((m.stockQuantity || 0) * (m.salePrice || 0))
      ]);
      const totalValue = data.reduce((acc: number, m: any) => acc + (m.stockQuantity * (m.salePrice || 0)), 0);
      totals = [{ label: 'Total Inventory Value', value: formatCurrency(totalValue) }];
    } else if (reportType === 'sales' || reportType === 'purchases') {
      columns = ['Date', 'Invoice #', 'Party', 'Status', 'Amount'];
      pdfData = data.map((inv: any) => [
        inv.date,
        inv.invoiceNumber,
        inv.customerName || inv.supplierName || 'N/A',
        inv.status || 'Unpaid',
        formatCurrency(inv.netAmount)
      ]);
      totals = [
        { label: 'Total Count', value: data.length.toString() },
        { label: 'Total Amount', value: formatCurrency(summaryStats.total) },
        { label: 'Total Returns', value: formatCurrency(summaryStats.returns) },
        { label: 'Net Amount', value: formatCurrency(summaryStats.net) }
      ];
    } else if (reportType === 'profit') {
      columns = ['Date', 'Invoice #', 'Party', 'Profit'];
      pdfData = data.map((inv: any) => [
        inv.date,
        inv.invoiceNumber,
        inv.customerName || 'N/A',
        formatCurrency(inv.profit)
      ]);
      totals = [
        { label: 'Total Count', value: data.length.toString() },
        { label: 'Total Profit', value: formatCurrency(summaryStats.net) }
      ];
    }

    const options = {
      title,
      filename: `${reportType}_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data: pdfData,
      totals
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (selectedInvoice) {
          handlePrintInvoice();
        } else {
          handlePrint();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedInvoice, handlePrint, handlePrintInvoice]);

  return (
    <div className="min-h-full flex flex-col gap-2 bg-[#F0F2F5] p-2 no-scrollbar">
      {/* Print Preview Modal */}
      <PrintPreviewModal 
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title={printPreviewData?.title || 'Print Preview'}
        type={printPreviewData?.type || 'Report'}
        items={printPreviewData?.items || []}
        columns={printPreviewData?.columns}
        total={printPreviewData?.total}
        subtotal={printPreviewData?.subtotal}
        discount={printPreviewData?.discount}
        tax={printPreviewData?.tax}
        paid={printPreviewData?.paid}
        remaining={printPreviewData?.remaining}
        previousRemaining={printPreviewData?.previousRemaining}
        paymentMethod={printPreviewData?.paymentMethod}
        invoiceNumber={printPreviewData?.invoiceNumber}
        date={printPreviewData?.date}
        time={printPreviewData?.time}
        partyName={printPreviewData?.partyName}
        partyContact={printPreviewData?.partyContact}
        partyAddress={printPreviewData?.partyAddress}
        summary={printPreviewData?.summary}
        settings={settings}
      />

      {/* Main UI */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden print:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Reports & Analytics</h1>
          <p className="text-slate-500 text-[9px]">Generate and export detailed business performance reports.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => handleExportPDF(false)}
            className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <FileDown size={12} />
            PDF
          </button>
          <button 
            onClick={() => handleExportPDF(true)}
            className="px-3 py-1 bg-emerald-50 text-emerald-600 rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Share2 size={12} />
            Share
          </button>
          <button 
            onClick={() => handlePrint(true)}
            className="px-3 py-1 bg-[#167D45] hover:bg-[#116135] text-white rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Printer size={12} />
            Print Report
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex overflow-x-auto no-scrollbar gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
        {[
          { id: 'sales', label: 'Sales', icon: TrendingUp },
          { id: 'purchases', label: 'Purchases', icon: Package },
          { id: 'stock', label: 'Stock', icon: FileText },
          { id: 'profit', label: 'Profit', icon: BarChart3 },
          { id: 'expired', label: 'Expired', icon: AlertCircle },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setReportType(tab.id as any)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold transition-all whitespace-nowrap",
              reportType === tab.id 
                ? "bg-white text-emerald-600 shadow-sm" 
                : "text-slate-500 hover:text-slate-700"
            )}
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <form onKeyDown={handleFormKeyDown} className="bg-white p-1.5 border-x border-slate-200 flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">From:</label>
          <input 
            type="date" 
            className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">To:</label>
          <input 
            type="date" 
            className="px-1.5 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
        <button 
          type="button"
          onClick={() => { setStartDate(''); setEndDate(''); }}
          className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-200 transition-all"
        >
          Reset
        </button>
      </form>

      {/* Report Content */}
      <div className="flex-1 bg-white rounded-b-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="px-3 py-1.5 border-b border-slate-50 flex items-center justify-between shrink-0 bg-slate-50/30">
          <h2 className="text-[10px] font-bold text-slate-900 capitalize">{reportType} Report</h2>
          <div className="flex items-center gap-3 text-[10px]">
            {(reportType === 'sales' || reportType === 'purchases') ? (
              <>
                <div className="flex items-center gap-1 text-slate-600 font-bold">
                  Total: {formatCurrency(summaryStats.total)}
                </div>
                <div className="flex items-center gap-1 text-rose-600 font-bold">
                  Returns: {formatCurrency(summaryStats.returns)}
                </div>
                <div className="flex items-center gap-1 text-emerald-600 font-bold">
                  Net: {formatCurrency(summaryStats.net)}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-1 text-emerald-600 font-bold">
                <ArrowUpRight size={12} />
                Total: {formatCurrency(totalAmount)}
              </div>
            )}
          </div>
        </div>
        <div ref={tableContainerRef} className="flex-1 overflow-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50 text-slate-500 text-[8px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="px-3 py-1.5">
                  {reportType === 'stock' || reportType === 'expired' ? 'Name' : 'Date'}
                </th>
                <th className="px-3 py-1.5">
                  {reportType === 'stock' || reportType === 'expired' ? 'Generic' : 'Ref'}
                </th>
                <th className="px-3 py-1.5">
                  {reportType === 'stock' || reportType === 'expired' ? 'Expiry' : 'Details'}
                </th>
                <th className="px-3 py-1.5 text-right">
                  {reportType === 'profit' ? 'Profit' : 
                   (reportType === 'stock' || reportType === 'expired' ? 'Stock' : 
                    (reportType === 'sales' || reportType === 'purchases' ? 'Net Amount' : 'Amount'))}
                </th>
                {(reportType === 'sales' || reportType === 'purchases') && <th className="px-3 py-1.5 text-center">Status</th>}
                {(reportType === 'sales' || reportType === 'purchases') && <th className="px-3 py-1.5 text-center">Action</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportType === 'sales' && data.map((inv: any, rowIndex) => (
                <tr 
                  key={inv.id} 
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors cursor-pointer",
                    inv.isReturn && "bg-rose-50/30"
                  )}
                  onClick={() => !inv.isReturn && setSelectedInvoice({ ...inv, type: 'sale' })}
                >
                  <td className="px-3 py-1 text-[10px] text-slate-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{inv.date}</td>
                  <td className="px-3 py-1 text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{inv.invoiceNumber}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {inv.customerName}
                    {inv.isReturn && <span className="ml-2 text-[8px] text-rose-500 font-bold">(RETURN)</span>}
                  </td>
                  <td className="px-3 py-1 text-right text-[10px] font-bold text-emerald-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {formatCurrency(inv.netAmount)}
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                      inv.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : 
                      inv.status === 'Partially Paid' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {inv.status || 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-center">
                    {!inv.isReturn && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInvoice?.(inv.id, 'Sales');
                        }}
                        className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reportType === 'purchases' && data.map((p: any, rowIndex) => (
                <tr 
                  key={p.id} 
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors cursor-pointer",
                    p.isReturn && "bg-rose-50/30"
                  )}
                  onClick={() => !p.isReturn && setSelectedInvoice({ ...p, type: 'purchase' })}
                >
                  <td className="px-3 py-1 text-[10px] text-slate-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{p.date}</td>
                  <td className="px-3 py-1 text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{p.invoiceNumber}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {p.supplierName}
                    {p.isReturn && <span className="ml-2 text-[8px] text-rose-500 font-bold">(RETURN)</span>}
                  </td>
                  <td className="px-3 py-1 text-right text-[10px] font-bold text-red-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {formatCurrency(p.netAmount)}
                  </td>
                  <td className="px-3 py-1 text-center">
                    <span className={cn(
                      "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                      p.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : 
                      p.status === 'Partially Paid' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {p.status || 'Unpaid'}
                    </span>
                  </td>
                  <td className="px-3 py-1 text-center">
                    {!p.isReturn && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditInvoice?.(p.id, 'Purchase');
                        }}
                        className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                      >
                        <Edit2 size={10} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {reportType === 'profit' && data.map((inv: any, rowIndex) => (
                <tr 
                  key={inv.id} 
                  className={cn(
                    "hover:bg-slate-50/50 transition-colors cursor-pointer",
                    inv.isReturn && "bg-rose-50/30"
                  )}
                  onClick={() => !inv.isReturn && setSelectedInvoice({ ...inv, type: 'sale' })}
                >
                  <td className="px-3 py-1 text-[10px] text-slate-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{inv.date}</td>
                  <td className="px-3 py-1 text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{inv.invoiceNumber}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {inv.customerName}
                    {inv.isReturn && <span className="ml-2 text-[8px] text-rose-500 font-bold">(RETURN)</span>}
                  </td>
                  <td className="px-3 py-1 text-right text-[10px] font-bold text-emerald-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{formatCurrency(inv.profit)}</td>
                </tr>
              ))}
              {(reportType === 'stock' || reportType === 'expired') && data.map((m: any, rowIndex) => (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-1 text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{m.name}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{m.genericName}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{m.expiryDate}</td>
                  <td className="px-3 py-1 text-right text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{m.stockQuantity}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs italic">No data found for the selected period.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invoice Details Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div>
                <h3 className="text-lg font-bold">
                  {selectedInvoice.type === 'sale' ? 'Sales Invoice' : 'Purchase Invoice'}
                </h3>
                <p className="text-[10px] text-white/60 uppercase tracking-widest">
                  #{selectedInvoice.invoiceNumber} • {selectedInvoice.date} {selectedInvoice.time}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => {
                    const type = selectedInvoice.type === 'sale' ? 'Sales' : 'Purchase';
                    onEditInvoice?.(selectedInvoice.id, type as any);
                    setSelectedInvoice(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80"
                  title="Edit Invoice"
                >
                  <Edit2 size={18} />
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedInvoice(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/80"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              {/* Party Details Header */}
              <div className="grid grid-cols-2 gap-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <div className="space-y-1">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    {selectedInvoice.type === 'sale' ? 'Customer' : 'Supplier'} Details
                  </h4>
                  <p className="text-xs font-bold text-slate-900">{selectedInvoice.customerName || selectedInvoice.supplierName}</p>
                  <p className="text-[10px] text-slate-500">{selectedInvoice.customerPhone || selectedInvoice.supplierPhone}</p>
                  <p className="text-[10px] text-slate-500 truncate">{selectedInvoice.customerAddress || selectedInvoice.supplierAddress}</p>
                </div>
                <div className="text-right space-y-1">
                  <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Invoice Summary</h4>
                  <p className="text-[10px] text-slate-600"><span className="font-bold">Date:</span> {selectedInvoice.date}</p>
                  <p className="text-[10px] text-slate-600"><span className="font-bold">Method:</span> {selectedInvoice.paymentMethod || 'Cash'}</p>
                  <div className="mt-1 inline-block px-2 py-0.5 bg-emerald-50 rounded-md border border-emerald-100">
                    <p className="text-[10px] font-black text-emerald-700">{formatCurrency(selectedInvoice.total || selectedInvoice.totalCost)}</p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[200px] shrink-0">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice Items</h4>
                  <span className="text-[9px] font-bold text-slate-500">{selectedInvoice.items.length} Items</span>
                </div>
                <div className="flex-1 overflow-auto no-scrollbar">
                  <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                      <tr className="text-[8px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                        <th className="px-3 py-1.5">Item Name</th>
                        <th className="px-3 py-1.5 text-center">Qty</th>
                        <th className="px-3 py-1.5 text-right">Price</th>
                        <th className="px-3 py-1.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedInvoice.items.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-1.5">
                            <p className="text-[10px] font-bold text-slate-900">{item.medicineName}</p>
                            <p className="text-[8px] text-slate-400">{item.medicineCode || 'N/A'} • {item.batchNumber || 'N/A'}</p>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="text-[10px] font-bold text-slate-700">{item.quantity}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-[10px] font-bold text-slate-700">{formatCurrency(item.salePrice || item.purchasePrice || item.price || 0)}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-[10px] font-black text-slate-900">{formatCurrency(item.total)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals Section */}
              <div className="flex justify-end pt-2">
                <div className="w-full max-w-[240px] space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Previous Balance</span>
                    <span className="font-black text-slate-900">{formatCurrency(selectedInvoice.previousRemaining || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px]">
                    <span className="font-bold text-slate-500 uppercase tracking-wider">Invoice Total</span>
                    <span className="font-black text-slate-900">
                      {formatCurrency(
                        (selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)
                      )}
                    </span>
                  </div>
                  <div className="pt-1.5 border-t border-slate-200">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[11px] font-black text-blue-600 uppercase tracking-tighter">Grand Total</span>
                      <span className="text-sm font-black text-blue-700">
                        {formatCurrency(
                          (selectedInvoice.previousRemaining || 0) + 
                          ((selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0))
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] mb-1">
                      <span className="font-bold text-emerald-600 uppercase tracking-wider">Paid Amount</span>
                      <span className="font-black text-emerald-700">{formatCurrency(selectedInvoice.paidAmount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] pt-1 border-t border-slate-200/60 bg-rose-50/50 -mx-3 px-3 py-1">
                      <span className="font-black text-rose-600 uppercase tracking-wider">Remaining Balance</span>
                      <span className="font-black text-rose-700">
                        {formatCurrency(
                          ((selectedInvoice.previousRemaining || 0) + 
                          ((selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0))) - 
                          (selectedInvoice.paidAmount || 0)
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
              <button 
                onClick={() => handlePrintInvoice(true)}
                className="px-6 py-1.5 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-600/20 flex items-center gap-1.5"
              >
                <Printer size={12} />
                Print Invoice
              </button>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="px-6 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      </div>
    </div>
  );
};
