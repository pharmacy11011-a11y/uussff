import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine, type Category, logActivity } from '@/src/db/db';
import { Search, Package, LayoutGrid, List, Filter, ChevronDown, ChevronRight, Printer, Trash2, Save, AlertCircle, X, AlertTriangle, FileDown, Share2 } from 'lucide-react';
import { cn, formatCurrency, formatNumber, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const InventoryManagement = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Record<number, boolean>>({});
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [printData, setPrintData] = useState<any[]>([]);
  const [printTitle, setPrintTitle] = useState('');

  const medicines = useLiveQuery(() => db.medicines.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const handlePrint = (type: 'full' | 'low-stock' = 'full') => {
    if (!medicines) return;
    
    let dataToPrint = medicines;
    let title = 'FULL INVENTORY';
    
    if (type === 'low-stock') {
      dataToPrint = medicines.filter(m => m.stockQuantity <= m.minStockLimit);
      title = 'LOW STOCK ITEMS';
    }

    const formattedData = dataToPrint.map(m => ({
      code: m.code || '-',
      name: m.name,
      qty: m.stockQuantity,
      price: m.purchasePrice || m.salePrice || 0,
      total: (m.stockQuantity || 0) * (m.purchasePrice || m.salePrice || 0)
    }));

    setPrintPreviewData({
      title: title,
      type: title,
      items: formattedData,
      total: formattedData.reduce((acc, item) => acc + (item.total || 0), 0),
      columns: [
        { header: 'CODE', key: 'code' },
        { header: 'ITEM NAME', key: 'name' },
        { header: 'QTY', key: 'qty', align: 'center' },
        { header: 'PRICE', key: 'price', align: 'right' },
        { header: 'TOTAL', key: 'total', align: 'right' }
      ]
    });
    setShowPrintPreview(true);
  };

  const handleExportPDF = async (share: boolean = false, type: 'full' | 'low-stock' = 'full') => {
    if (!medicines) return;

    let dataToPrint = medicines;
    let title = 'FULL INVENTORY REPORT';
    
    if (type === 'low-stock') {
      dataToPrint = medicines.filter(m => m.stockQuantity <= m.minStockLimit);
      title = 'LOW STOCK ITEMS REPORT';
    }

    const columns = ['Code', 'Item Name', 'Qty', 'Price', 'Total'];
    const data = dataToPrint.map(m => [
      m.code || '-',
      m.name,
      m.stockQuantity,
      formatCurrency(m.purchasePrice || m.salePrice || 0),
      formatCurrency((m.stockQuantity || 0) * (m.purchasePrice || m.salePrice || 0))
    ]);

    const totalValue = dataToPrint.reduce((acc, m) => acc + (m.stockQuantity * (m.purchasePrice || m.salePrice || 0)), 0);

    const options = {
      title,
      filename: `${type}_inventory_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Total Inventory Value', value: formatCurrency(totalValue) }
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
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const initiateDelete = async (id: number, name: string) => {
    // Check if medicine is used in any invoices or purchases
    const usedInInvoices = await db.invoices.filter(inv => inv.items.some(item => item.medicineId === id)).count();
    const usedInPurchases = await db.purchases.filter(p => p.items.some(item => item.medicineId === id)).count();

    let message = `Are you sure you want to delete "${name}" from inventory?`;
    if (usedInInvoices > 0 || usedInPurchases > 0) {
      message = `This medicine is used in ${usedInInvoices} invoices and ${usedInPurchases} purchases. Deleting it from inventory will remove it permanently. Are you sure?`;
    }

    setDeleteConfirm({ id, name, message });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.medicines.delete(deleteConfirm.id);
      await logActivity('Medicine deleted', `Deleted medicine: ${deleteConfirm.name} from inventory`);
      setToast({ message: 'Item removed from inventory successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete from inventory:", error);
      setToast({ message: 'Error deleting item', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  // Keyboard support for delete confirmation
  React.useEffect(() => {
    const handleModalKeyDown = (e: KeyboardEvent) => {
      if (!deleteConfirm) return;
      
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmDelete();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setDeleteConfirm(null);
      }
    };

    if (deleteConfirm) {
      window.addEventListener('keydown', handleModalKeyDown);
    }
    return () => window.removeEventListener('keydown', handleModalKeyDown);
  }, [deleteConfirm]);

  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Initialize expanded state for all categories on first load
  React.useEffect(() => {
    if (categories && categories.length > 0) {
      const initialExpanded: Record<number, boolean> = {};
      categories.forEach(c => {
        initialExpanded[c.id!] = true;
      });
      initialExpanded[0] = true; // Other category
      setExpandedCategories(initialExpanded);
    }
  }, [categories?.length]);

  const filteredMedicines = medicines?.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.genericName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group medicines by category
  const groupedMedicines = categories?.reduce((acc, category) => {
    const categoryMeds = filteredMedicines?.filter(m => m.categoryId === category.id) || [];
    if (categoryMeds.length > 0 || searchQuery === '') {
      acc.push({
        category,
        medicines: categoryMeds
      });
    }
    return acc;
  }, [] as { category: Category; medicines: Medicine[] }[]) || [];

  // Add "Other" category for medicines without a valid categoryId
  const otherMedicines = filteredMedicines?.filter(m => !categories?.find(c => c.id === m.categoryId)) || [];
  if (otherMedicines.length > 0) {
    groupedMedicines.push({
      category: { id: 0, name: 'Other / Uncategorized', description: '' },
      medicines: otherMedicines
    });
  }

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto bg-[#F0F2F5] p-2 no-scrollbar">
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Inventory Overview</h1>
          <p className="text-slate-500 text-[9px]">Real-time stock levels grouped by category.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Value</p>
            <p className="text-sm font-black text-blue-600">
              {formatCurrency(medicines?.reduce((sum, m) => sum + (m.stockQuantity * m.purchasePrice), 0) || 0)}
            </p>
          </div>
          <div className="flex items-center gap-1.5 no-print">
            <button 
              onClick={() => handleExportPDF(false)}
              className="p-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
              title="Download PDF"
            >
              <FileDown size={14} />
              PDF
            </button>
            <button 
              onClick={() => handleExportPDF(true)}
              className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
              title="Share on WhatsApp"
            >
              <Share2 size={14} />
              Share
            </button>
            <button 
              onClick={() => handlePrint()}
              className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm flex items-center gap-1 text-[10px] font-bold"
              title="Print Inventory"
            >
              <Printer size={14} />
              Print
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm flex gap-2 shrink-0">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
          <input
            type="text"
            placeholder="Search inventory..."
            className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="flex-1 space-y-2">
        {groupedMedicines.map(({ category, medicines: categoryMeds }) => (
          <div key={category.id || 'other'} className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <button 
              onClick={() => toggleCategory(category.id || 0)}
              className="w-full px-3 py-1.5 flex items-center justify-between bg-slate-50/50 hover:bg-slate-50 transition-colors border-b border-slate-100"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-blue-100 text-blue-600 rounded flex items-center justify-center">
                  <LayoutGrid size={14} />
                </div>
                <div className="text-left">
                  <h2 className="text-[11px] font-bold text-slate-900">{category.name}</h2>
                  <p className="text-[8px] text-slate-500 uppercase tracking-wider font-bold">{categoryMeds.length} Items</p>
                </div>
              </div>
              {expandedCategories[category.id || 0] ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
            </button>
            
            {expandedCategories[category.id || 0] && (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 text-slate-500 text-[9px] uppercase tracking-wider font-bold border-b border-slate-100">
                      <th className="px-3 py-1.5">Name</th>
                      <th className="px-3 py-1.5 text-right">Stock</th>
                      <th className="px-3 py-1.5 text-center no-print">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {categoryMeds.map(med => (
                      <tr key={med.id} className="hover:bg-slate-50/30 transition-colors group">
                        <td className="px-3 py-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-900 leading-tight">{med.name}</p>
                              <p className="text-[8px] text-slate-400">{med.genericName}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <span className={cn(
                            "text-[10px] font-bold",
                            med.stockQuantity <= med.minStockLimit ? "text-red-600" : "text-slate-900"
                          )}>
                            {formatNumber(med.stockQuantity)}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-center no-print">
                          <button 
                            onClick={() => med.id && initiateDelete(med.id, med.name)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    {categoryMeds.length === 0 && (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-400 text-[10px] italic">
                          No medicines in this category.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        {groupedMedicines.length === 0 && (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <Package size={48} className="mx-auto text-slate-200 mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No Inventory Found</h3>
            <p className="text-slate-500">Add medicines or record purchases to see inventory levels.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 px-4 py-3 text-white flex items-center gap-2">
              <Trash2 size={18} />
              <h3 className="font-bold text-base">Confirm Delete</h3>
            </div>
            <div className="p-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                {deleteConfirm.message}
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setDeleteConfirm(null);
                }}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
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

      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <Save size={14} /> : <AlertCircle size={14} />}
          <p className="text-[11px] font-bold">{toast.message}</p>
        </div>
      )}
    </div>
  );
};
