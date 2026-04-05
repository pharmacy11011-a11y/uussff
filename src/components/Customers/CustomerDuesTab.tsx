import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity } from '@/src/db/db';
import { formatCurrency } from '@/src/utils/utils';
import { useKeyboardNavigation } from '@/src/hooks/useKeyboardNavigation';
import { 
  Plus, 
  Wallet, 
  Search, 
  User, 
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

export const CustomerDuesTab = () => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);

  // Form States
  const [addFormData, setAddFormData] = useState({
    name: '',
    phone: '',
    address: '',
    amount: '',
    notes: ''
  });

  const [paymentFormData, setPaymentFormData] = useState({
    customerId: '',
    amount: '',
    notes: '',
    searchQuery: ''
  });

  const customers = useLiveQuery(async () => {
    const all = await db.customers.toArray();
    let filtered = all.filter(c => (c.balance || 0) > 0);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(q) || 
        (c.phone && c.phone.includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q))
      );
    }
    return filtered.sort((a, b) => (b.balance || 0) - (a.balance || 0));
  }, [searchQuery]);

  const allCustomers = useLiveQuery(() => db.customers.toArray()) || [];

  // Smart Search for Payment Modal
  const paymentSearchResults = useLiveQuery(async () => {
    if (!paymentFormData.searchQuery || paymentFormData.customerId) return [];
    
    const q = paymentFormData.searchQuery.toLowerCase();
    const all = await db.customers.toArray();
    
    return all.filter(c => 
      c.name.toLowerCase().includes(q) || 
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 5); // Limit to 5 results for clarity
  }, [paymentFormData.searchQuery, paymentFormData.customerId]);

  // Auto-select logic for exact match
  React.useEffect(() => {
    if (paymentSearchResults && paymentSearchResults.length === 1 && !paymentFormData.customerId) {
      const match = paymentSearchResults[0];
      const q = paymentFormData.searchQuery.toLowerCase();
      
      // Auto select if exact phone match or exact name match (if unique)
      if (match.phone === paymentFormData.searchQuery || 
          (match.name.toLowerCase() === q && paymentSearchResults.length === 1)) {
        setPaymentFormData(prev => ({ ...prev, customerId: match.id!.toString() }));
      }
    }
  }, [paymentSearchResults, paymentFormData.searchQuery, paymentFormData.customerId]);

  const [printData, setPrintData] = useState<any>(null);
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handlePrint = (customer: any) => {
    // Pass summary for report
    const summary = [
      { label: 'Total Dues', value: customer.balance || 0, isBold: true }
    ];
    
    setPrintData({
      type: 'CUSTOMER DUES',
      partyName: customer.name,
      partyContact: customer.phone,
      partyAddress: customer.address,
      total: customer.balance || 0,
      remaining: customer.balance || 0,
      items: [], // No items table for customer dues as per requirements
      summary
    });
    
    setTimeout(() => {
      printTemplate('print-container', 'CUSTOMER DUES');
    }, 100);
  };

  const handleExportSinglePDF = async (customer: any, share: boolean = false) => {
    const options = {
      title: `CUSTOMER REPORT - ${customer.name}`,
      filename: `customer_report_${customer.name.replace(/\s+/g, '_').toLowerCase()}`,
      columns: ['Description', 'Amount'],
      data: [
        ['Current Dues', formatCurrency(customer.balance || 0)]
      ],
      totals: [
        { label: 'Total Dues', value: formatCurrency(customer.balance || 0) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  const handleAddDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(addFormData.amount);
    if (!addFormData.name || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter name and valid amount', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.dues, db.activityLogs], async () => {
        let customer = await db.customers.where({ 
          name: addFormData.name, 
          phone: addFormData.phone
        }).first();
        
        if (!customer) {
          const id = await db.customers.add({
            name: addFormData.name,
            phone: addFormData.phone,
            address: addFormData.address,
            balance: amountNum
          });
        } else {
          await db.customers.update(customer.id!, {
            balance: (customer.balance || 0) + amountNum,
            address: addFormData.address || customer.address
          });
        }

        await db.dues.add({
          personName: addFormData.name,
          personType: 'Customer',
          personContact: addFormData.phone,
          amount: amountNum,
          remaining: amountNum,
          paidAmount: 0,
          invoiceTotal: amountNum,
          date: new Date().toISOString().split('T')[0],
          referenceNumber: 'MANUAL-DUE-' + Date.now(),
          status: 'Pending',
          notes: addFormData.notes
        });

        await logActivity('Customer Manual Due Added', `Added manual due of ${formatCurrency(amountNum)} for ${addFormData.name}`);
      });

      showToast('Manual due added successfully');
      setAddFormData({ name: '', phone: '', address: '', amount: '', notes: '' });
      setIsAddModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error adding manual due', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(paymentFormData.amount);
    const customerId = parseInt(paymentFormData.customerId);
    
    if (isNaN(customerId) || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please select customer and enter valid amount', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.dues, db.activityLogs], async () => {
        const customer = await db.customers.get(customerId);
        if (!customer) throw new Error('Customer not found');

        const payAmount = Math.min(amountNum, customer.balance || 0);
        
        // Update customer balance
        await db.customers.update(customerId, {
          balance: Math.max(0, (customer.balance || 0) - payAmount)
        });

        // Update individual dues (FIFO)
        let remainingToPay = payAmount;
        const dues = await db.dues
          .where('personType').equals('Customer')
          .and(d => d.personName === customer.name && d.remaining > 0)
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

        await logActivity('Customer Payment', `Received ${formatCurrency(payAmount)} from ${customer.name}`);
      });

      showToast('Payment recorded successfully');
      setPaymentFormData({ customerId: '', amount: '', notes: '', searchQuery: '' });
      setIsPaymentModalOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error recording payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedCustomer = paymentFormData.customerId 
    ? allCustomers.find(c => c.id === parseInt(paymentFormData.customerId)) 
    : null;

  const initiateDelete = async (id: number) => {
    const customer = await db.customers.get(id);
    if (!customer) return;

    // Check if customer has any invoices or returns
    const invoiceCount = await db.invoices.where('customerId').equals(id).count();
    const returnCount = await db.returns.where('customerName').equals(customer.name).count();

    let message = `Are you sure you want to delete customer: ${customer.name}?`;
    if (invoiceCount > 0 || returnCount > 0) {
      message = `This customer has ${invoiceCount} invoices and ${returnCount} returns. Deleting will remove them permanently. Are you sure?`;
    }

    setDeleteConfirm({ id, name: customer.name, message });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.dues, db.activityLogs, db.invoices, db.returns], async () => {
        // Delete related invoices
        await db.invoices.where('customerId').equals(deleteConfirm.id).delete();
        
        // Delete related returns (using indexed customerName)
        await db.returns.where('customerName').equals(deleteConfirm.name).delete();
        
        // Delete related dues
        await db.dues.where({ personName: deleteConfirm.name, personType: 'Customer' }).delete();
        
        // Delete the customer
        await db.customers.delete(deleteConfirm.id);
        
        await logActivity('Customer deleted', `Deleted customer: ${deleteConfirm.name} and all related records`);
      });
      showToast('Customer and related records deleted successfully');
    } catch (error) {
      console.error("Failed to delete customer:", error);
      showToast('Error deleting customer', 'error');
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-4 p-4 bg-[#F0F2F5]">
      {/* Top Buttons & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Plus size={18} />
            Add Customer Dues
          </button>
          <button 
            onClick={() => setIsPaymentModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-md"
          >
            <Wallet size={18} />
            Payment (Pay)
          </button>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search by Name, Phone, Address..."
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
                <th className="px-6 py-4">Customer Name</th>
                <th className="px-6 py-4">Mobile Number</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4 text-right">Total Dues</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {customers?.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-xs">
                        {customer.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-bold text-slate-900">{customer.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">{customer.phone || 'N/A'}</td>
                  <td className="px-6 py-4 text-sm text-slate-600 truncate max-w-[200px]">{customer.address || 'N/A'}</td>
                  <td className="px-6 py-4 text-right">
                    <span className="text-sm font-black text-rose-600">{formatCurrency(customer.balance || 0)}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleExportSinglePDF(customer, false)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Download PDF"
                      >
                        <FileDown size={14} />
                      </button>
                      <button 
                        onClick={() => handleExportSinglePDF(customer, true)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="Share on WhatsApp"
                      >
                        <Share2 size={14} />
                      </button>
                      <button 
                        onClick={() => handlePrint(customer)}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Print Report"
                      >
                        <Printer size={14} />
                      </button>
                      <button 
                        onClick={() => customer.id && initiateDelete(customer.id)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Delete Customer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!customers || customers.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-3 text-slate-400">
                      <Wallet size={48} strokeWidth={1} />
                      <p className="text-sm italic font-medium">No outstanding dues found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Due Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-6 py-4 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plus size={20} />
                <h3 className="font-bold text-lg">Add Customer Dues</h3>
              </div>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            <form 
              onSubmit={handleAddDue} 
              onKeyDown={(e) => handleFormKeyDown(e)}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Customer Name *</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Full Name"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={addFormData.name}
                    onChange={(e) => setAddFormData({ ...addFormData, name: e.target.value })}
                    required
                    autoFocus
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Mobile Number</label>
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
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Dues Amount *</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold text-rose-600 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={addFormData.amount}
                    onChange={(e) => setAddFormData({ ...addFormData, amount: e.target.value })}
                    required
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
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Notes (Optional)</label>
                <textarea 
                  placeholder="Additional details..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none h-20"
                  value={addFormData.notes}
                  onChange={(e) => setAddFormData({ ...addFormData, notes: e.target.value })}
                />
              </div>
              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:bg-slate-300"
                >
                  <Save size={18} />
                  {isProcessing ? 'Processing...' : 'Save Dues Entry'}
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
                <h3 className="font-bold text-lg">Record Payment</h3>
              </div>
              <button 
                onClick={() => {
                  setIsPaymentModalOpen(false);
                  setPaymentFormData({ customerId: '', amount: '', notes: '', searchQuery: '' });
                }} 
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <form 
              onSubmit={handlePayment} 
              onKeyDown={(e) => handleFormKeyDown(e)}
              className="p-6 space-y-4"
            >
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search Customer (Name, Phone, Address) *</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                  <input 
                    type="text"
                    placeholder="Type to search..."
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={paymentFormData.searchQuery}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, searchQuery: e.target.value, customerId: '' })}
                    autoFocus
                  />
                  
                  {/* Search Results Dropdown */}
                  {paymentSearchResults && paymentSearchResults.length > 0 && !paymentFormData.customerId && (
                    <div className="absolute top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-xl z-50 mt-1 overflow-hidden">
                      {paymentSearchResults.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-4 py-3 text-left hover:bg-slate-50 flex items-center justify-between transition-colors border-b border-slate-100 last:border-0"
                          onClick={() => setPaymentFormData({ 
                            ...paymentFormData, 
                            customerId: c.id!.toString(),
                            searchQuery: c.name
                          })}
                        >
                          <div>
                            <p className="text-sm font-bold text-slate-900">{c.name}</p>
                            <p className="text-[10px] text-slate-500">{c.address || 'No Address'} • {c.phone || 'No Phone'}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-rose-600">{formatCurrency(c.balance || 0)}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {selectedCustomer && (
                <div className="animate-in fade-in slide-in-from-top-2 duration-200 space-y-4">
                  <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Customer Name</p>
                        <p className="text-sm font-bold text-blue-900">{selectedCustomer.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Current Dues</p>
                        <p className="text-lg font-black text-blue-700">{formatCurrency(selectedCustomer.balance || 0)}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-blue-100">
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Address</p>
                        <p className="text-[11px] text-blue-800">{selectedCustomer.address || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Mobile</p>
                        <p className="text-[11px] text-blue-800">{selectedCustomer.phone || 'N/A'}</p>
                      </div>
                    </div>
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
                      max={selectedCustomer?.balance || undefined}
                    />
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
                  disabled={isProcessing || !paymentFormData.customerId}
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
            partyContact={printData.partyContact}
            partyAddress={printData.partyAddress}
            total={printData.total}
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
