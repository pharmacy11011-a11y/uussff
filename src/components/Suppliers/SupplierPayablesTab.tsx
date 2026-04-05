import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity } from '@/src/db/db';
import { formatCurrency } from '@/src/utils/utils';
import { useKeyboardNavigation } from '@/src/hooks/useKeyboardNavigation';
import { 
  Plus, 
  Wallet, 
  Search, 
  Truck, 
  Phone, 
  MapPin, 
  X, 
  Save, 
  AlertCircle,
  CheckCircle2,
  Printer,
  FileDown,
  Share2,
  Trash2
} from 'lucide-react';
import { cn, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const SupplierPayablesTab = () => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);

  // Form States
  const [addFormData, setAddFormData] = useState({
    code: '',
    name: '',
    phone: '',
    address: '',
    amount: '',
    notes: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    supplierId: '',
    amount: '',
    paymentMethod: 'Cash' as 'Cash' | 'Bank',
    notes: '',
    searchQuery: ''
  });

  const suppliers = useLiveQuery(async () => {
    const all = await db.suppliers.toArray();
    let filtered = all.filter(s => (s.currentBalance || 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(q) || 
        (s.phone && s.phone.includes(q)) ||
        (s.code && s.code.toLowerCase().includes(q))
      );
    }
    return filtered.sort((a, b) => (b.currentBalance || 0) - (a.currentBalance || 0));
  }, [searchQuery]);

  const allSuppliers = useLiveQuery(() => db.suppliers.toArray()) || [];

  const [printData, setPrintData] = useState<any>(null);
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePrint = (supplier: any) => {
    // Pass summary for report
    const summary = [
      { label: 'Total Payable', value: supplier.currentBalance || 0, isBold: true }
    ];
    
    setPrintData({
      type: 'SUPPLIER REPORT',
      partyName: supplier.name,
      partyCode: supplier.code,
      partyContact: supplier.phone,
      partyAddress: supplier.address,
      total: supplier.currentBalance || 0,
      paid: 0,
      remaining: supplier.currentBalance || 0,
      items: [], // No items table for supplier report as per requirements
      summary
    });
    
    setTimeout(() => {
      printTemplate('print-container', 'SUPPLIER REPORT');
    }, 100);
  };

  const handleExportPDF = async (share: boolean = false) => {
    if (!suppliers || suppliers.length === 0) return;

    const columns = ['Code', 'Supplier Name', 'Contact Number', 'Address', 'Total Payable'];
    const data = suppliers.map(s => [
      s.code || '---',
      s.name,
      s.phone || 'N/A',
      s.address || 'N/A',
      formatCurrency(s.currentBalance || 0)
    ]);

    const totalPayable = suppliers.reduce((sum, s) => sum + (s.currentBalance || 0), 0);

    const options = {
      title: 'SUPPLIER CREDITS REPORT',
      filename: `supplier_credits_${new Date().toISOString().split('T')[0]}`,
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

  const handleExportSinglePDF = async (supplier: any, share: boolean = false) => {
    const options = {
      title: `SUPPLIER REPORT - ${supplier.name}`,
      filename: `supplier_report_${supplier.name.replace(/\s+/g, '_').toLowerCase()}`,
      columns: ['Description', 'Amount'],
      data: [
        ['Current Balance', formatCurrency(supplier.currentBalance || 0)]
      ],
      totals: [
        { label: 'Total Payable', value: formatCurrency(supplier.currentBalance || 0) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  const handleAddPayable = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(addFormData.amount);
    if (!addFormData.name || isNaN(amountNum) || amountNum < 0) {
      showToast('Please enter name and valid amount', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.suppliers, db.dues, db.activityLogs], async () => {
        let supplier = await db.suppliers.where({ 
          name: addFormData.name, 
          phone: addFormData.phone
        }).first();
        
        if (!supplier) {
          await db.suppliers.add({
            name: addFormData.name,
            phone: addFormData.phone,
            address: addFormData.address,
            currentBalance: amountNum,
            code: addFormData.code || 'SUP-' + Date.now(),
            email: '',
            companyName: ''
          });
        } else {
          await db.suppliers.update(supplier.id!, {
            currentBalance: (supplier.currentBalance || 0) + amountNum,
            address: addFormData.address || supplier.address,
            code: addFormData.code || supplier.code
          });
        }

        if (amountNum > 0) {
          await db.dues.add({
            personName: addFormData.name,
            personType: 'Supplier',
            personContact: addFormData.phone,
            amount: amountNum,
            remaining: amountNum,
            paidAmount: 0,
            invoiceTotal: amountNum,
            date: new Date().toISOString().split('T')[0],
            referenceNumber: 'MANUAL-PAYABLE-' + Date.now(),
            status: 'Pending',
            notes: addFormData.notes
          });
        }

        await logActivity('Supplier Manual Payable Added', `Added manual payable of ${formatCurrency(amountNum)} for ${addFormData.name}`);
      });

      showToast('Supplier added successfully');
      setAddFormData({ code: '', name: '', phone: '', address: '', amount: '', notes: '' });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error adding supplier', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentFormData.amount);
    const supplierId = parseInt(paymentFormData.supplierId);
    
    if (isNaN(supplierId) || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please select supplier and enter valid amount', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.suppliers, db.dues, db.activityLogs], async () => {
        const supplier = await db.suppliers.get(supplierId);
        if (!supplier) throw new Error('Supplier not found');

        const payAmount = Math.min(amountNum, supplier.currentBalance || 0);
        
        // Update supplier balance
        await db.suppliers.update(supplierId, {
          currentBalance: Math.max(0, (supplier.currentBalance || 0) - payAmount)
        });

        // Update individual dues (FIFO)
        let remainingToPay = payAmount;
        const dues = await db.dues
          .where('personType').equals('Supplier')
          .and(d => d.personName === supplier.name && d.remaining > 0)
          .toArray();

        for (const due of dues) {
          if (remainingToPay <= 0) break;
          const paymentForThisDue = Math.min(remainingToPay, due.remaining);
          const newRemaining = due.remaining - paymentForThisDue;
          
          if (newRemaining <= 0) {
            await db.dues.delete(due.id!);
          } else {
            await db.dues.update(due.id!, {
              remaining: newRemaining,
              paidAmount: (due.paidAmount || 0) + paymentForThisDue,
              status: 'Pending'
            });
          }
          remainingToPay -= paymentForThisDue;
        }

        await logActivity('Supplier Payment', `Paid ${formatCurrency(payAmount)} to ${supplier.name} via ${paymentFormData.paymentMethod}`);
      });

      showToast('Payment recorded successfully');
      setPaymentFormData({ supplierId: '', amount: '', paymentMethod: 'Cash', notes: '', searchQuery: '' });
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error recording payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedSupplier = paymentFormData.supplierId 
    ? allSuppliers.find(s => s.id === parseInt(paymentFormData.supplierId)) 
    : null;

  const lastDue = useLiveQuery(async () => {
    if (!selectedSupplier) return null;
    return await db.dues
      .where('personType').equals('Supplier')
      .and(d => d.personName === selectedSupplier.name)
      .reverse()
      .first();
  }, [selectedSupplier]);

  // Search results for payment modal
  const paymentSearchResults = paymentFormData.searchQuery.length >= 1
    ? allSuppliers.filter(s => 
        s.name.toLowerCase().includes(paymentFormData.searchQuery.toLowerCase()) ||
        (s.code && s.code.toLowerCase().includes(paymentFormData.searchQuery.toLowerCase()))
      ).slice(0, 5)
    : [];

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
      await db.transaction('rw', [db.suppliers, db.dues, db.activityLogs, db.purchases, db.supplierPayments], async () => {
        // Delete related purchases
        await db.purchases.where('supplierId').equals(deleteConfirm.id).delete();
        
        // Delete related payments
        await db.supplierPayments.where('supplierId').equals(deleteConfirm.id).delete();
        
        // Delete related dues
        await db.dues.where({ personName: deleteConfirm.name, personType: 'Supplier' }).delete();
        
        // Delete the supplier
        await db.suppliers.delete(deleteConfirm.id);
        
        await logActivity('Supplier deleted', `Deleted supplier: ${deleteConfirm.name} and all related records`);
      });
      showToast('Supplier and related records deleted successfully');
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      showToast('Error deleting supplier', 'error');
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-4 p-4 bg-[#F0F2F5]">
      {/* Top Buttons & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h1 className="text-xl font-black text-slate-900">Supplier Credits & Payment</h1>
          <p className="text-slate-500 text-xs">Manage supplier credits and record payments.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={18} />
            Add Supplier
          </button>
          <button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Wallet size={18} />
            Pay Supplier
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search by Code or Name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Table Section */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="overflow-auto flex-1 no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-white z-10">
              <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Supplier Code</th>
                <th className="px-6 py-4">Supplier Name</th>
                <th className="px-6 py-4">Contact Number</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-right">Total Payable</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {suppliers?.map((supplier) => (
                <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{supplier.code || '---'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        {supplier.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{supplier.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{supplier.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">{supplier.address || 'N/A'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-rose-600">{formatCurrency(supplier.currentBalance || 0)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleExportSinglePDF(supplier, false)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Download PDF"
                      >
                        <FileDown size={14} />
                      </button>
                      <button 
                        onClick={() => handleExportSinglePDF(supplier, true)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Share on WhatsApp"
                      >
                        <Share2 size={14} />
                      </button>
                      <button 
                        onClick={() => handlePrint(supplier)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Print Report"
                      >
                        <Printer size={14} />
                      </button>
                      <button 
                        onClick={() => supplier.id && initiateDelete(supplier.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Supplier"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!suppliers || suppliers.length === 0) && (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Truck size={48} strokeWidth={1} />
                      <p className="text-sm italic font-medium">No outstanding payables found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={20} />
                <h3 className="font-bold text-lg">Add Supplier</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form 
              onSubmit={handleAddPayable} 
              onKeyDown={(e) => handleFormKeyDown(e)}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supplier Code</label>
                <input 
                  type="text"
                  placeholder="SUP-001"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={addFormData.code}
                  onChange={(e) => setAddFormData({ ...addFormData, code: e.target.value })}
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supplier Name *</label>
                <div className="relative">
                  <Truck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Company Name"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Contact Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input 
                      type="text"
                      placeholder="Contact"
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      value={addFormData.phone}
                      onChange={(e) => setAddFormData({ ...addFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Supplier Payable (Opening Balance)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-rose-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Address</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Full Address"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={addFormData.address}
                    onChange={(e) => setAddFormData({ ...addFormData, address: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:bg-slate-300"
                >
                  <Save size={18} />
                  {isProcessing ? 'Processing...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-emerald-600 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet size={20} />
                <h3 className="font-bold text-lg">Pay Supplier</h3>
              </div>
              <button onClick={() => setIsPaymentModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form 
              onSubmit={handlePayment} 
              onKeyDown={(e) => handleFormKeyDown(e)}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Supplier (Code or Name) *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Type code or name..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={paymentFormData.searchQuery}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, searchQuery: e.target.value, supplierId: '' })}
                    autoFocus
                  />
                  {paymentSearchResults.length > 0 && !paymentFormData.supplierId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
                      {paymentSearchResults.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-100 last:border-0"
                          onClick={() => setPaymentFormData({ 
                            ...paymentFormData, 
                            supplierId: s.id!.toString(),
                            searchQuery: s.name
                          })}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s.name}</p>
                            <p className="text-[10px] text-slate-500 font-mono">{s.code || 'No Code'}</p>
                          </div>
                          <p className="text-xs font-bold text-rose-600">{formatCurrency(s.currentBalance || 0)}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedSupplier && (
                <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Supplier Name</p>
                      <p className="text-sm font-bold text-blue-900">{selectedSupplier.name}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Current Payable</p>
                      <p className="text-lg font-black text-blue-700">{formatCurrency(selectedSupplier.currentBalance || 0)}</p>
                    </div>
                    {lastDue && (
                      <div className="col-span-2 pt-2 border-t border-blue-100/50">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Last Due Date</p>
                        <p className="text-xs font-bold text-blue-600">{new Date(lastDue.date).toLocaleDateString()}</p>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Method *</label>
                      <select 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentFormData.paymentMethod}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, paymentMethod: e.target.value as 'Cash' | 'Bank' })}
                        required
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank">Bank</option>
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Payment Amount *</label>
                      <input 
                        type="number"
                        placeholder="0.00"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                        value={paymentFormData.amount}
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, amount: e.target.value })}
                        required
                        max={selectedSupplier?.currentBalance || undefined}
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Notes (Optional)</label>
                    <textarea 
                      placeholder="Payment reference, etc..."
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none h-20"
                      value={paymentFormData.notes}
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isProcessing || !paymentFormData.supplierId}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2 disabled:bg-slate-300"
                >
                  <Save size={18} />
                  {isProcessing ? 'Processing...' : 'Save Payment'}
                </button>
              </div>
            </form>
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

      {/* Hidden Print Content */}
      <div className="hidden">
        {printData && (
          <Receipt 
            id="print-container"
            type={printData.type}
            partyName={printData.partyName}
            partyCode={printData.partyCode}
            partyContact={printData.partyContact}
            partyAddress={printData.partyAddress}
            total={printData.total}
            paid={printData.paid}
            remaining={printData.remaining}
            items={printData.items}
            summary={printData.summary}
            settings={settings}
          />
        )}
      </div>
    </div>
  );
};
