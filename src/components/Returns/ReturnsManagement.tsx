import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity } from '@/src/db/db';
import { RefreshCcw, Search, ShoppingCart, Package, Plus, Trash2, Printer, Save, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatCurrency, cn, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useRef } from 'react';

export const ReturnsManagement = () => {
  const [activeTab, setActiveTab] = useState<'Sales' | 'Purchase'>('Sales');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);
  
  const [searchType, setSearchType] = useState<'Reference' | 'Supplier' | 'Patient'>('Reference');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const [returnItem, setReturnItem] = useState({
    referenceNumber: '',
    items: [] as any[],
    reason: '',
    subtotal: 0,
    discount: 0,
    tax: 0,
    totalAmount: 0,
    paidAmount: 0,
    remainingAmount: 0,
    netTotal: 0,
    isManualNetTotal: false,
    customerName: '',
    customerPhone: '',
    customerAddress: '',
    customerCode: '',
    supplierName: '',
    supplierPhone: '',
    supplierAddress: '',
    supplierCode: '',
    date: ''
  });

  const [invoiceSearch, setInvoiceSearch] = useState('');
  const [foundInvoice, setFoundInvoice] = useState<any>(null);
  const [selectedReturn, setSelectedReturn] = useState<any>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const salesReturns = useLiveQuery(() => db.returns?.where('type').equals('Sales').reverse().toArray());
  const purchaseReturns = useLiveQuery(() => db.returns?.where('type').equals('Purchase').reverse().toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const handleSearchInvoice = async () => {
    if (!invoiceSearch) return;
    
    let results: any[] = [];
    if (activeTab === 'Sales') {
      if (searchType === 'Reference') {
        results = await db.invoices.where('invoiceNumber').equals(invoiceSearch).toArray();
      } else if (searchType === 'Patient') {
        results = await db.invoices.where('customerName').startsWithIgnoreCase(invoiceSearch).toArray();
      }
    } else {
      if (searchType === 'Reference') {
        results = await db.purchases.where('invoiceNumber').equals(invoiceSearch).toArray();
      } else if (searchType === 'Supplier') {
        // Search by name
        const byName = await db.purchases.where('supplierName').startsWithIgnoreCase(invoiceSearch).toArray();
        // Search by code (need to find supplier first)
        const suppliers = await db.suppliers.where('code').startsWithIgnoreCase(invoiceSearch).toArray();
        const supplierIds = suppliers.map(s => s.id).filter(id => id !== undefined) as number[];
        const byCode = await db.purchases.where('supplierId').anyOf(supplierIds).toArray();
        
        // Merge and unique
        const merged = [...byName, ...byCode];
        results = Array.from(new Map(merged.map(item => [item.id, item])).values());
      }
    }

    if (results.length === 1) {
      selectInvoice(results[0]);
    } else if (results.length > 1) {
      setSearchResults(results);
      setShowSearchResults(true);
    } else {
      showToast('No matching invoice found', 'error');
    }
  };

  const selectInvoice = async (inv: any) => {
    let code = '';
    if (activeTab === 'Sales' && inv.customerId) {
      const customer = await db.customers.get(inv.customerId);
      code = customer?.code || '';
    } else if (activeTab === 'Purchase' && inv.supplierId) {
      const supplier = await db.suppliers.get(inv.supplierId);
      code = supplier?.code || '';
    }

    setFoundInvoice(inv);
    setShowSearchResults(false);
    const subtotal = inv.total || inv.totalCost || 0;
    
    const itemsWithPrices = await Promise.all(inv.items.map(async (item: any) => {
      let purchasePrice = item.purchasePrice;
      if (!purchasePrice && item.medicineId) {
        const med = await db.medicines.get(item.medicineId);
        purchasePrice = med?.purchasePrice || 0;
      }
      return {
        ...item,
        purchasePrice: purchasePrice || 0,
        originalQuantity: item.quantity,
        returnQuantity: 0,
        returnPrice: activeTab === 'Sales' ? (item.price || item.salePrice) : item.purchasePrice,
        returnTotal: 0
      };
    }));

    setReturnItem({
      referenceNumber: inv.invoiceNumber,
      items: itemsWithPrices,
      reason: '',
      subtotal: subtotal,
      discount: inv.discount || 0,
      tax: inv.tax || 0,
      totalAmount: 0,
      netTotal: subtotal,
      isManualNetTotal: false,
      paidAmount: inv.paidAmount || 0,
      remainingAmount: inv.remainingAmount || 0,
      customerName: inv.customerName || '',
      customerPhone: inv.customerPhone || '',
      customerAddress: inv.customerAddress || '',
      customerCode: activeTab === 'Sales' ? code : '',
      supplierName: inv.supplierName || '',
      supplierPhone: inv.supplierPhone || '',
      supplierAddress: inv.supplierAddress || '',
      supplierCode: activeTab === 'Purchase' ? code : '',
      date: inv.date
    });
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...returnItem.items];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'returnQuantity') {
      if (value > newItems[index].originalQuantity) {
        newItems[index].returnQuantity = newItems[index].originalQuantity;
      }
    }

    if (field === 'returnQuantity' || field === 'returnPrice') {
      newItems[index].returnTotal = (newItems[index].returnQuantity || 0) * (newItems[index].returnPrice || 0);
    }
    
    const total = newItems.reduce((sum, item) => sum + (item.returnTotal || 0), 0);
    setReturnItem({ 
      ...returnItem, 
      items: newItems, 
      totalAmount: total,
      netTotal: (returnItem.subtotal || 0) - total,
      isManualNetTotal: false
    });
  };

  const returnAllItem = (index: number) => {
    const newItems = [...returnItem.items];
    newItems[index] = { 
      ...newItems[index], 
      returnQuantity: newItems[index].originalQuantity,
      returnTotal: newItems[index].originalQuantity * newItems[index].returnPrice 
    };
    
    const total = newItems.reduce((sum, item) => sum + (item.returnTotal || 0), 0);
    setReturnItem({ 
      ...returnItem, 
      items: newItems, 
      totalAmount: total,
      netTotal: (returnItem.subtotal || 0) - total,
      isManualNetTotal: false
    });
  };

  const handleNetTotalChange = (value: number) => {
    if (value < 0) return;
    setReturnItem({
      ...returnItem,
      netTotal: value,
      totalAmount: (returnItem.subtotal || 0) - value,
      isManualNetTotal: true
    });
  };

  const resetNetTotal = () => {
    const total = returnItem.items.reduce((sum, item) => sum + (item.returnTotal || 0), 0);
    setReturnItem({
      ...returnItem,
      totalAmount: total,
      netTotal: (returnItem.subtotal || 0) - total,
      isManualNetTotal: false
    });
  };

  const deleteReturnItem = (index: number) => {
    // In the context of "edit or delete individual items", 
    // deleting an item from the invoice means returning the full quantity.
    returnAllItem(index);
  };

  const handleSubmit = React.useCallback(async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isProcessing) return;
    
    const validItems = returnItem.items.filter(item => item.returnQuantity > 0);
    
    if (validItems.length === 0) {
      showToast('Please enter return quantity for at least one item', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', ['returns', 'medicines', 'activityLogs', 'invoices', 'purchases', 'dues', 'suppliers'], async () => {
        const returnId = await db.returns.add({
          type: activeTab,
          referenceNumber: returnItem.referenceNumber,
          date: new Date().toISOString().split('T')[0],
          items: validItems.map(item => ({
            medicineId: item.medicineId,
            medicineCode: item.medicineCode,
            medicineName: item.medicineName,
            quantity: item.returnQuantity,
            price: item.returnPrice,
            salePrice: item.salePrice || item.price,
            purchasePrice: item.purchasePrice || 0,
            total: item.returnTotal
          })),
          totalAmount: returnItem.totalAmount,
          netTotal: returnItem.netTotal,
          isManualNetTotal: returnItem.isManualNetTotal,
          reason: returnItem.reason,
          customerName: returnItem.customerName,
          supplierName: returnItem.supplierName
        });

        // Update stock
        for (const item of validItems) {
          if (item.medicineId) {
            const med = await db.medicines.get(item.medicineId);
            if (med) {
              const newStock = activeTab === 'Sales' 
                ? med.stockQuantity + item.returnQuantity 
                : med.stockQuantity - item.returnQuantity;
              await db.medicines.update(item.medicineId, { stockQuantity: newStock });
            }
          }
        }

        // Update Invoice/Purchase and Dues
        if (activeTab === 'Sales') {
          const inv = await db.invoices.where('invoiceNumber').equals(returnItem.referenceNumber).first();
          if (inv) {
            // Update original invoice items and total
            const updatedItems = inv.items.map(item => {
              const returned = validItems.find(v => v.medicineId === item.medicineId);
              if (returned) {
                const remainingQty = item.quantity - returned.returnQuantity;
                return { 
                  ...item, 
                  quantity: remainingQty, 
                  total: remainingQty * (item.price || item.salePrice || 0) 
                };
              }
              return item;
            }).filter(item => item.quantity > 0);

            const newTotal = returnItem.isManualNetTotal 
              ? returnItem.netTotal 
              : updatedItems.reduce((sum, item) => sum + (item.total || 0), 0) - (inv.discount || 0) + (inv.tax || 0);
            
            // Logic: if paid > newTotal, refund the difference. Otherwise, reduce remaining.
            const refundAmount = Math.max(0, inv.paidAmount - newTotal);
            const newPaidAmount = inv.paidAmount - refundAmount;
            const newRemaining = Math.max(0, newTotal - newPaidAmount);
            
            await db.invoices.update(inv.id!, { 
              items: updatedItems, 
              total: newTotal,
              paidAmount: newPaidAmount,
              remainingAmount: newRemaining
            });

            // Update dues
            const due = await db.dues.where({ referenceNumber: inv.invoiceNumber, personType: 'Customer' }).first();
            if (due) {
              if (newRemaining <= 0) {
                await db.dues.delete(due.id!);
              } else {
                await db.dues.update(due.id!, { 
                  remaining: newRemaining,
                  amount: newRemaining,
                  invoiceTotal: newTotal,
                  paidAmount: newPaidAmount,
                  status: 'Pending'
                });
              }
            }
            // Update customer balance
            if (inv.customerId) {
              const customer = await db.customers.get(inv.customerId);
              if (customer) {
                const newBalance = Math.max(0, (customer.balance || 0) - returnItem.totalAmount);
                await db.customers.update(inv.customerId, { balance: newBalance });
              }
            }
          }
        } else {
          const pur = await db.purchases.where('invoiceNumber').equals(returnItem.referenceNumber).first();
          if (pur) {
            // Update original purchase items and total
            const updatedItems = pur.items.map(item => {
              const returned = validItems.find(v => v.medicineId === item.medicineId);
              if (returned) {
                const remainingQty = item.quantity - returned.returnQuantity;
                return { 
                  ...item, 
                  quantity: remainingQty, 
                  total: remainingQty * (item.purchasePrice || 0) 
                };
              }
              return item;
            }).filter(item => item.quantity > 0);

            const newTotal = returnItem.isManualNetTotal 
              ? returnItem.netTotal 
              : updatedItems.reduce((sum, item) => sum + (item.total || 0), 0) - (pur.discount || 0) + (pur.tax || 0);
            
            const refundAmount = Math.max(0, pur.paidAmount - newTotal);
            const newPaidAmount = pur.paidAmount - refundAmount;
            const newRemaining = Math.max(0, newTotal - newPaidAmount);

            await db.purchases.update(pur.id!, { 
              items: updatedItems, 
              totalCost: newTotal,
              paidAmount: newPaidAmount,
              remainingAmount: newRemaining
            });

            // Update supplier amount payable and dues
            let supplierToUpdate = null;
            if (pur.supplierId) {
              supplierToUpdate = await db.suppliers.get(pur.supplierId);
            } else if (pur.supplierName) {
              supplierToUpdate = await db.suppliers.where('name').equals(pur.supplierName).first();
            }

            if (supplierToUpdate) {
              const newBalance = Math.max(0, (supplierToUpdate.currentBalance || 0) - returnItem.totalAmount);
              await db.suppliers.update(supplierToUpdate.id!, {
                currentBalance: newBalance
              });

              // Update or delete the specific due record for this purchase invoice
              const existingDue = await db.dues
                .where({ referenceNumber: pur.invoiceNumber, personType: 'Supplier' })
                .first();

              if (existingDue) {
                if (newRemaining <= 0) {
                  await db.dues.delete(existingDue.id!);
                } else {
                  await db.dues.update(existingDue.id!, {
                    amount: newRemaining,
                    remaining: newRemaining,
                    invoiceTotal: newTotal,
                    paidAmount: newPaidAmount,
                    status: 'Pending'
                  });
                }
              }
            }
          }
        }

        await logActivity(
          `${activeTab} Return`, 
          `Recorded return for Invoice ${returnItem.referenceNumber} (Total: ${formatCurrency(returnItem.totalAmount)})`
        );
      });

      showToast('Return recorded successfully!');
      setIsModalOpen(false);
      setReturnItem({ 
        referenceNumber: '', 
        items: [], 
        reason: '', 
        subtotal: 0,
        discount: 0,
        tax: 0,
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        netTotal: 0,
        isManualNetTotal: false,
        customerName: '',
        customerPhone: '',
        customerAddress: '',
        customerCode: '',
        supplierName: '',
        supplierPhone: '',
        supplierAddress: '',
        supplierCode: '',
        date: ''
      });
      setFoundInvoice(null);
      setInvoiceSearch('');
    } catch (error) {
      console.error(error);
      showToast('Error recording return', 'error');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, returnItem, activeTab]);

  const handlePrint = React.useCallback(() => {
    if (!foundInvoice) return;
    setTimeout(() => {
      printTemplate();
    }, 150);
  }, [foundInvoice]);

  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;

      if (e.key === 'F7') {
        e.preventDefault();
        if (isModalOpen && foundInvoice) {
          handleSubmit();
        }
      } else if (e.key === 'F8') {
        e.preventDefault();
        if (foundInvoice) {
          handlePrint();
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isModalOpen, foundInvoice, isProcessing, handleSubmit, handlePrint]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA') {
        e.preventDefault();
        const form = target.closest('form');
        if (form) {
          const inputs = Array.from(form.querySelectorAll('input, select, textarea, button[type="submit"]')) as HTMLElement[];
          const index = inputs.indexOf(target);
          if (index > -1 && index < inputs.length - 1) {
            inputs[index + 1].focus();
          } else if (index === inputs.length - 1) {
            form.requestSubmit();
          }
        }
      }
    }
  };

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);

  const handleViewReturn = async (ret: any) => {
    setSelectedReturn(ret);
    setIsViewModalOpen(true);
  };

  const handleEditReturn = async (ret: any) => {
    setIsViewModalOpen(false);
    setInvoiceSearch(ret.referenceNumber);
    
    // Find the invoice first
    let inv: any = null;
    if (ret.type === 'Sales') {
      inv = await db.invoices.where('invoiceNumber').equals(ret.referenceNumber).first();
    } else {
      inv = await db.purchases.where('invoiceNumber').equals(ret.referenceNumber).first();
    }

    if (inv) {
      // Select the invoice to populate the form
      await selectInvoice(inv);
      
      // Now override the return quantities from the existing return
      setReturnItem(prev => {
        const updatedItems = prev.items.map(item => {
          const returnedItem = ret.items.find((ri: any) => ri.medicineId === item.medicineId);
          if (returnedItem) {
            return {
              ...item,
              returnQuantity: returnedItem.quantity,
              returnPrice: returnedItem.price,
              returnTotal: returnedItem.total
            };
          }
          return item;
        });

        const totalReturnAmount = updatedItems.reduce((sum, item) => sum + (item.returnTotal || 0), 0);
        
        return {
          ...prev,
          items: updatedItems,
          totalAmount: totalReturnAmount,
          netTotal: (prev.subtotal || 0) - totalReturnAmount,
          isManualNetTotal: false,
          reason: ret.reason || ''
        };
      });
      
      setIsModalOpen(true);
      showToast('Return loaded for editing', 'success');
    } else {
      showToast('Original invoice not found', 'error');
    }
  };

  const returns = activeTab === 'Sales' ? salesReturns : purchaseReturns;

  return (
    <div className="min-h-full flex flex-col gap-2 bg-[#F0F2F5] p-2 no-scrollbar">
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Returns Management</h1>
          <p className="text-slate-500 text-[9px]">Handle sales returns from customers and purchase returns to suppliers.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded-md flex items-center gap-1.5 transition-colors shadow-sm text-[10px] font-bold"
        >
          <Plus size={14} />
          New Return
        </button>
      </div>

        <div className="flex gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 w-fit shrink-0">
          <button
            onClick={() => setActiveTab('Sales')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1 rounded-md text-[10px] font-bold transition-all",
              activeTab === 'Sales' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <ShoppingCart size={12} />
            Sales Return
          </button>
          <button
            onClick={() => setActiveTab('Purchase')}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1 rounded-md text-[10px] font-bold transition-all",
              activeTab === 'Purchase' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
            )}
          >
            <Package size={12} />
            Purchase Return
          </button>
        </div>

      <div className="flex-1 bg-white rounded-b-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
        <div className="px-3 py-1.5 border-b border-slate-50 flex items-center justify-between shrink-0">
          <h2 className="text-[10px] font-bold text-slate-900 capitalize">{activeTab} Return Records</h2>
          <div className="relative w-48">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <input 
              placeholder="Search returns..."
              className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <div ref={tableContainerRef} className="flex-1 overflow-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50 text-slate-500 text-[8px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="px-3 py-1.5">Date</th>
                <th className="px-3 py-1.5">Ref #</th>
                <th className="px-3 py-1.5">Name</th>
                <th className="px-3 py-1.5">Qty</th>
                <th className="px-3 py-1.5">Reason</th>
                <th className="px-3 py-1.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {returns?.map((r, rowIndex) => (
                <tr 
                  key={r.id} 
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => handleViewReturn(r)}
                >
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{r.date}</td>
                  <td className="px-3 py-1 text-[10px] font-bold text-slate-900 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{r.referenceNumber}</td>
                  <td className="px-3 py-1 text-[10px] text-slate-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {r.items.map(i => i.medicineName).join(', ')}
                  </td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    {r.items.reduce((sum, i) => sum + i.quantity, 0)}
                  </td>
                  <td className="px-3 py-1 text-[10px] text-slate-500 italic outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{r.reason}</td>
                  <td className="px-3 py-1 text-right text-[10px] font-bold text-emerald-600 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>{formatCurrency(r.totalAmount)}</td>
                </tr>
              ))}
              {(!returns || returns.length === 0) && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm italic">No return records found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl flex flex-col max-h-[95vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-600 text-white rounded-lg shadow-sm">
                  <RefreshCcw size={14} />
                </div>
                <div>
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">Return Management</h2>
                  <p className="text-[8px] text-white/60 font-medium uppercase tracking-widest">Process {activeTab} Returns & Inventory Adjustment</p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsModalOpen(false);
                }} 
                className="p-1.5 hover:bg-white/10 rounded-full transition-all text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-3 scroll-smooth no-scrollbar">
              <div className="flex flex-col gap-2.5 min-h-full">
                {/* Search Section */}
                <div className="shrink-0 bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm space-y-2.5">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold text-slate-700">Search By:</span>
                    <div className="flex bg-slate-100 p-0.5 rounded-md border border-slate-200">
                      <button 
                        type="button"
                        onClick={() => setSearchType('Reference')}
                        className={cn("px-2 py-0.5 rounded text-[8px] font-bold transition-all", searchType === 'Reference' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
                      >Ref #</button>
                      {activeTab === 'Sales' ? (
                        <button 
                          type="button"
                          onClick={() => setSearchType('Patient')}
                          className={cn("px-2 py-0.5 rounded text-[8px] font-bold transition-all", searchType === 'Patient' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
                        >Patient</button>
                      ) : (
                        <button 
                          type="button"
                          onClick={() => setSearchType('Supplier')}
                          className={cn("px-2 py-0.5 rounded text-[8px] font-bold transition-all", searchType === 'Supplier' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500")}
                        >Supplier</button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 flex gap-2 max-w-md">
                    <div className="relative flex-1">
                      <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                      <input 
                        className="w-full pl-7 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                        value={invoiceSearch}
                        onChange={(e) => setInvoiceSearch(e.target.value)}
                        placeholder={`Enter ${searchType === 'Reference' ? 'Invoice #' : searchType === 'Patient' ? 'Patient Name' : 'Supplier Name'}...`}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearchInvoice()}
                      />
                    </div>
                    <button 
                      type="button"
                      onClick={handleSearchInvoice}
                      className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded text-[10px] font-bold transition-colors shadow-sm"
                    >
                      Search Invoice
                    </button>
                  </div>
                </div>

                {showSearchResults && searchResults.length > 0 && (
                  <div className="border border-slate-200 rounded-lg overflow-hidden max-h-24 overflow-y-auto no-scrollbar">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr className="text-[7px] font-bold text-slate-500 uppercase border-b border-slate-200">
                          <th className="px-2 py-0.5">Date</th>
                          <th className="px-2 py-0.5">Ref #</th>
                          <th className="px-2 py-0.5">{activeTab === 'Sales' ? 'Patient' : 'Supplier'}</th>
                          <th className="px-2 py-0.5 text-right">Total</th>
                          <th className="px-2 py-0.5 text-center">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {searchResults.map((res) => (
                          <tr key={res.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-2 py-0.5 text-[9px] text-slate-500">{res.date}</td>
                            <td className="px-2 py-0.5 text-[9px] font-bold text-slate-900">{res.invoiceNumber}</td>
                            <td className="px-2 py-0.5 text-[9px] text-slate-600">{activeTab === 'Sales' ? res.customerName : res.supplierName}</td>
                            <td className="px-2 py-0.5 text-right text-[9px] font-bold text-slate-900">{formatCurrency(res.total)}</td>
                            <td className="px-2 py-0.5 text-center">
                              <button 
                                onClick={() => selectInvoice(res)}
                                className="text-emerald-600 hover:text-emerald-700 font-bold text-[8px] underline"
                              >Select</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {foundInvoice ? (
                <div className="flex flex-col gap-2.5">
                  {/* Party Details Section */}
                  <div className="shrink-0 bg-white p-2 rounded-lg border border-slate-200 shadow-sm bg-gradient-to-r from-white to-slate-50/50">
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-black uppercase tracking-tight">Reference Invoice:</span>
                        <span className="text-[13px] font-bold text-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-sm">
                          #{foundInvoice.invoiceNumber}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 uppercase">
                        Processing Return
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                      <div className="space-y-0.5 col-span-2">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">{activeTab === 'Sales' ? 'Patient Details' : 'Supplier Details'}</p>
                        <div className="flex items-center gap-1">
                          <p className="text-[9px] font-bold text-slate-900">
                            {activeTab === 'Sales' ? foundInvoice.customerName : foundInvoice.supplierName}
                          </p>
                          <span className="text-[8px] px-1 py-0.25 bg-slate-200 text-slate-600 rounded font-bold">
                            {activeTab === 'Sales' ? returnItem.customerCode : returnItem.supplierCode}
                          </span>
                        </div>
                        <p className="text-[8px] text-slate-500 truncate">
                          {activeTab === 'Sales' ? returnItem.customerPhone : returnItem.supplierPhone} | {activeTab === 'Sales' ? returnItem.customerAddress : returnItem.supplierAddress}
                        </p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Date</p>
                        <p className="text-[9px] font-bold text-slate-900">{new Date(foundInvoice.date).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Original Total</p>
                        <p className="text-[9px] font-bold text-slate-900">{formatCurrency(foundInvoice.total || foundInvoice.totalCost)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Paid</p>
                        <p className="text-[9px] font-bold text-blue-600">{formatCurrency(foundInvoice.paidAmount || 0)}</p>
                      </div>
                      <div className="space-y-0.5">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-wider">Remaining</p>
                        <p className="text-[9px] font-bold text-rose-600">{formatCurrency(foundInvoice.remainingAmount || 0)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table Section */}
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[240px] shrink-0">
                    <div className="bg-slate-50 px-3 py-1 border-b border-slate-200 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-2">
                        <ShoppingCart size={12} className="text-slate-400" />
                        <h3 className="text-[9px] font-bold text-slate-700 uppercase tracking-wider">Return Items Selection</h3>
                      </div>
                      <p className="text-[8px] text-slate-500 font-medium italic">Adjust quantities to calculate return value</p>
                    </div>
                    <div className="flex-1 overflow-auto scroll-smooth no-scrollbar">
                      <table className="w-full text-left border-collapse table-fixed">
                        <thead className="sticky top-0 bg-white z-10 shadow-sm">
                          <tr className="text-[8px] font-bold text-slate-500 uppercase border-b border-slate-200">
                            <th className="px-2 py-1.5 border-r border-slate-100 w-[35%]">Name</th>
                            <th className="px-2 py-1.5 border-r border-slate-100 text-center w-[12%]">Orig Qty</th>
                            <th className="px-2 py-1.5 border-r border-slate-100 text-center w-[15%]">Return Qty</th>
                            <th className="px-2 py-1.5 border-r border-slate-100 text-right w-[15%]">Price</th>
                            <th className="px-2 py-1.5 border-r border-slate-100 text-right w-[15%]">Total</th>
                            <th className="px-2 py-1.5 text-center w-[8%]">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {returnItem.items.map((item, idx) => (
                            <tr key={idx} className={cn(
                              "hover:bg-slate-50/80 transition-colors group",
                              item.returnQuantity > 0 ? "bg-emerald-50/40" : ""
                            )}>
                              <td className="px-2 py-1 text-[9px] font-medium text-slate-700 border-r border-slate-100 truncate" title={item.medicineName}>
                                {item.medicineName}
                              </td>
                              <td className="px-2 py-1 text-[9px] text-center text-slate-500 border-r border-slate-100 font-bold">
                                {item.originalQuantity}
                              </td>
                              <td className="px-2 py-1 border-r border-slate-100">
                                <input 
                                  type="number"
                                  className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-center font-bold focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                  value={item.returnQuantity || ''}
                                  onChange={(e) => handleItemChange(idx, 'returnQuantity', Number(e.target.value))}
                                  max={item.originalQuantity}
                                  min={0}
                                  placeholder="0"
                                />
                              </td>
                              <td className="px-2 py-1 border-r border-slate-100">
                                <input 
                                  type="number"
                                  className="w-full px-1 py-0.5 bg-white border border-slate-200 rounded text-[9px] text-right focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
                                  value={item.returnPrice || ''}
                                  onChange={(e) => handleItemChange(idx, 'returnPrice', Number(e.target.value))}
                                  min={0}
                                />
                              </td>
                              <td className="px-2 py-1 text-right text-[9px] font-bold text-slate-900 border-r border-slate-100">
                                {formatCurrency(item.returnTotal || 0)}
                              </td>
                              <td className="px-2 py-1 text-center">
                                <button 
                                  type="button"
                                  onClick={() => deleteReturnItem(idx)}
                                  className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all opacity-0 group-hover:opacity-100"
                                  title="Reset Item"
                                >
                                  <RefreshCcw size={10} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Footer Section - Sticky at bottom of scrollable area */}
                  <div className="sticky bottom-0 mt-auto pt-2 bg-white border-t border-slate-100 flex flex-col md:flex-row gap-3 pb-1 z-20">
                    <div className="flex-1 hidden md:block">
                      {/* Left side spacer */}
                    </div>
                    
                    {/* Reason Section */}
                    <div className="w-full md:w-64 space-y-1">
                      <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                        <Plus size={10} />
                        Reason for Return
                      </label>
                      <textarea 
                        rows={2}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-[9px] focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none resize-none shadow-inner transition-all"
                        value={returnItem.reason}
                        onChange={(e) => setReturnItem({...returnItem, reason: e.target.value})}
                        placeholder="Enter return reason here..."
                      />
                    </div>

                    {/* Action Buttons Section */}
                    <div className="flex flex-row md:flex-col gap-1.5 justify-end md:justify-center">
                      <button 
                        type="button"
                        onClick={() => showToast('Edit mode activated', 'success')}
                        className="flex-1 md:w-28 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200 shadow-sm"
                      >
                        <Plus size={12} />
                        Edit
                      </button>
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setIsModalOpen(false);
                        }}
                        className="flex-1 md:w-28 py-1.5 bg-white hover:bg-slate-50 text-slate-500 rounded-lg text-[9px] font-bold transition-all flex items-center justify-center gap-1.5 border border-slate-200"
                      >
                        <X size={12} />
                        Cancel
                      </button>
                    </div>

                    {/* Total Summary Section */}
                    <div className="w-full md:w-64 bg-slate-900 rounded-xl p-3 text-white flex flex-col gap-1.5 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                      
                      <div className="flex justify-between items-center text-[9px] text-white/50 uppercase tracking-tighter">
                        <span>Return Summary</span>
                        <span className="font-mono text-[8px]">REF: {returnItem.referenceNumber}</span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between items-center text-[10px]">
                          <span className="text-white/60">Return Amount:</span>
                          <span className="font-bold text-emerald-400">{formatCurrency(returnItem.totalAmount || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px]">
                          <div className="flex items-center gap-1.5">
                            <span className="text-white/60">Net Total:</span>
                            {returnItem.isManualNetTotal && (
                              <span className="text-[7px] bg-amber-500 text-white px-1 rounded font-bold animate-pulse">MANUAL</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number"
                              className="w-20 px-1 py-0.5 bg-white/10 border border-white/20 rounded text-[10px] text-right font-bold focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                              value={returnItem.netTotal}
                              onChange={(e) => handleNetTotalChange(Number(e.target.value))}
                              min={0}
                            />
                            {returnItem.isManualNetTotal && (
                              <button 
                                type="button"
                                onClick={resetNetTotal}
                                className="p-0.5 hover:bg-white/10 rounded text-white/60 hover:text-white transition-colors"
                                title="Reset to auto-calculated value"
                              >
                                <RefreshCcw size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-auto pt-1.5 border-t border-white/10">
                        <button 
                          type="button"
                          onClick={handleSubmit}
                          disabled={isProcessing}
                          className="w-full py-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-[10px] font-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                        >
                          <RefreshCcw size={14} className={cn(isProcessing && "animate-spin")} />
                          {isProcessing ? 'Processing...' : 'Confirm Return'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex-1 min-h-[350px] flex flex-col items-center justify-center text-slate-400 space-y-2 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                  <div className="p-3 bg-white rounded-full shadow-sm">
                    <Search size={24} className="text-slate-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-slate-600">No Invoice Selected</p>
                    <p className="text-[9px]">Search for an invoice using the fields above to start a return.</p>
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
        </div>
      )}

      {isViewModalOpen && selectedReturn && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-white">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <ShoppingCart size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold">Return Details</h3>
                  <p className="text-[8px] text-white/60 uppercase tracking-wider">Reference: {selectedReturn.referenceNumber}</p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsViewModalOpen(false);
                }}
                className="p-1.5 hover:bg-white/10 rounded-full transition-colors text-white/60 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 space-y-4 no-scrollbar">
              {/* Party Details */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Date</p>
                  <p className="text-[10px] font-bold text-slate-900">{selectedReturn.date}</p>
                </div>
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Type</p>
                  <p className="text-[10px] font-bold text-slate-900">{selectedReturn.type}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">{selectedReturn.type === 'Sales' ? 'Patient' : 'Supplier'}</p>
                  <p className="text-[10px] font-bold text-slate-900">{selectedReturn.type === 'Sales' ? selectedReturn.customerName : selectedReturn.supplierName}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse table-fixed">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200">
                      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider w-1/2">Medicine Name</th>
                      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider text-center">Qty</th>
                      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider text-right">Price</th>
                      <th className="px-3 py-1.5 text-[9px] font-bold text-slate-600 uppercase tracking-wider text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedReturn.items.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-1 text-[10px] font-medium text-slate-900 truncate">{item.medicineName}</td>
                        <td className="px-3 py-1 text-[10px] text-slate-600 text-center font-bold">{item.quantity}</td>
                        <td className="px-3 py-1 text-[10px] text-slate-600 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-3 py-1 text-[10px] font-bold text-slate-900 text-right">{formatCurrency(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Reason */}
              {selectedReturn.reason && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[8px] text-amber-600 uppercase font-bold tracking-wider mb-0.5">Reason for Return</p>
                  <p className="text-[10px] text-amber-900 italic">"{selectedReturn.reason}"</p>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <div className="flex gap-2">
                <button 
                  onClick={() => handleEditReturn(selectedReturn)}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
                >
                  <Plus size={14} />
                  Edit
                </button>
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsViewModalOpen(false);
                  }}
                  className="px-4 py-1.5 bg-white hover:bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold transition-all border border-slate-200"
                >
                  Cancel
                </button>
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Total Amount</p>
                  <p className="text-base font-black text-slate-900">{formatCurrency(selectedReturn.totalAmount)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Receipt for Printing */}
      <div className="hidden">
        <Receipt 
          type="Return"
          invoiceNumber={returnItem.referenceNumber}
          date={new Date().toLocaleDateString()}
          time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
          partyName={activeTab === 'Sales' ? returnItem.customerName : returnItem.supplierName}
          partyCode={activeTab === 'Sales' ? returnItem.customerCode : returnItem.supplierCode}
          partyContact={activeTab === 'Sales' ? returnItem.customerPhone : returnItem.supplierPhone}
          partyAddress={activeTab === 'Sales' ? returnItem.customerAddress : returnItem.supplierAddress}
          items={returnItem.items.filter(i => i.returnQuantity > 0).map(i => ({
            medicineCode: i.medicineCode,
            medicineName: i.medicineName,
            qty: i.returnQuantity,
            price: i.returnPrice,
            discount: 0,
            total: i.returnTotal
          }))}
          subtotal={returnItem.subtotal}
          discount={0}
          tax={0}
          total={returnItem.totalAmount}
          paid={returnItem.paidAmount}
          remaining={Math.abs(returnItem.paidAmount - (returnItem.subtotal - returnItem.totalAmount))}
          settings={settings}
        />
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[110] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-right-10 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <p className="text-sm font-bold">{toast.message}</p>
        </div>
      )}
    </div>
  );
};
