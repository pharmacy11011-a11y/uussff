import React, { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, type Due, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { 
  Plus, 
  Search, 
  Filter, 
  Trash2, 
  Wallet, 
  Calendar, 
  Tag, 
  CreditCard, 
  X, 
  Save, 
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  History,
  User,
  Phone,
  MapPin,
  UserPlus,
  Edit2,
  Printer,
  ChevronRight,
  Clock
} from 'lucide-react';
import { cn, formatCurrency, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';

export const CustomerDuesPayment = ({ onEditInvoice }: { onEditInvoice?: (id: number, type: 'Sales' | 'Purchase') => void }) => {
  // UI State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'All' | 'Pending' | 'Paid'>('All');
  const [timeFilter, setTimeFilter] = useState<'Daily' | 'Monthly' | 'Yearly' | 'All'>('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  // Form States
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    amount: ''
  });

  // Modal States
  const [paymentModal, setPaymentModal] = useState<Due | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: 'Cash',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [editingDue, setEditingDue] = useState<Due | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [printData, setPrintData] = useState<any[]>([]);

  const settings = useLiveQuery(() => db.settings.toCollection().first());

  // Keyboard Navigation
  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  // Queries
  const dues = useLiveQuery(async () => {
    let collection = db.dues.where('personType').equals('Customer');
    const items = await collection.toArray();
    
    let filtered = items;

    // Search Filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(d => 
        d.personName.toLowerCase().includes(q) || 
        d.referenceNumber.toLowerCase().includes(q) ||
        (d.personContact && d.personContact.includes(q))
      );
    }

    // Status Filter
    if (filterStatus !== 'All') {
      filtered = filtered.filter(d => d.status === filterStatus);
    }

    // Time Filter
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = today.substring(0, 7);
    const currentYear = today.substring(0, 4);

    if (timeFilter === 'Daily') {
      filtered = filtered.filter(d => d.date === selectedDate);
    } else if (timeFilter === 'Monthly') {
      filtered = filtered.filter(d => d.date.startsWith(currentMonth));
    } else if (timeFilter === 'Yearly') {
      filtered = filtered.filter(d => d.date.startsWith(currentYear));
    }

    return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [searchQuery, filterStatus, timeFilter, selectedDate]);

  const totalOutstanding = dues?.reduce((sum, d) => sum + d.remaining, 0) || 0;

  const handlePrintList = () => {
    if (!dues || dues.length === 0) return;
    const dataToPrint = dues.map(d => ({
      date: d.date,
      customer: d.personName,
      contact: d.personContact || '-',
      reference: d.referenceNumber,
      amount: d.amount,
      remaining: d.remaining,
      status: d.status
    }));
    setPrintData(dataToPrint);
    
    // Direct print
    setTimeout(() => {
      printTemplate('print-customer-dues-list', 'Customer Dues Report');
    }, 150);
  };

  const handleViewInvoice = async (refNum: string) => {
    if (!refNum) return;
    
    // Try to find in invoices first (Sales)
    const invoice = await db.invoices.where('invoiceNumber').equals(refNum).first();
    if (invoice) {
      let code = '';
      if (invoice.customerId) {
        const customer = await db.customers.get(invoice.customerId);
        code = customer?.code || '';
      }
      setSelectedInvoice({ ...invoice, type: 'Sales', partyCode: code });
      setDueItems(invoice.items.map(i => ({
        code: i.medicineCode || '',
        name: i.medicineName,
        qty: i.quantity,
        price: i.price,
        total: i.total
      })));
      return;
    }

    // Try to find in purchases (Purchase)
    const purchase = await db.purchases.where('invoiceNumber').equals(refNum).first();
    if (purchase) {
      let code = '';
      if (purchase.supplierId) {
        const supplier = await db.suppliers.get(purchase.supplierId);
        code = supplier?.code || '';
      }
      setSelectedInvoice({ ...purchase, type: 'Purchase', partyCode: code });
      setDueItems(purchase.items.map(i => ({
        code: i.medicineCode || '',
        name: i.medicineName,
        qty: i.quantity,
        price: i.purchasePrice,
        total: i.total
      })));
      return;
    }
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAddDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(formData.amount);
    if (!formData.name || isNaN(amountNum) || amountNum <= 0) {
      showToast('Please enter name and valid amount', 'error');
      return;
    }

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.dues, db.activityLogs], async () => {
        let customer = await db.customers.where({ 
          name: formData.name, 
          phone: formData.phone
        }).first();
        
        if (!customer) {
          const id = await db.customers.add({
            name: formData.name,
            code: formData.code,
            phone: formData.phone,
            address: formData.address,
            balance: amountNum
          });
          customer = { 
            id, 
            name: formData.name, 
            code: formData.code, 
            phone: formData.phone, 
            address: formData.address, 
            balance: amountNum 
          };
        } else {
          await db.customers.update(customer.id!, {
            balance: (customer.balance || 0) + amountNum,
            code: formData.code || customer.code,
            address: formData.address || customer.address
          });
        }

        await db.dues.add({
          personName: formData.name,
          personType: 'Customer',
          personContact: formData.phone,
          amount: amountNum,
          remaining: amountNum,
          paidAmount: 0,
          invoiceTotal: amountNum,
          date: new Date().toISOString().split('T')[0],
          referenceNumber: 'MANUAL-DUE-' + Date.now(),
          status: 'Pending'
        });

        await logActivity('Manual Due Added', `Added manual due of ${formatCurrency(amountNum)} for ${formData.name}`);
      });

      showToast('Manual due added successfully');
      setFormData({ name: '', code: '', phone: '', address: '', amount: '' });
      setIsFormOpen(false);
    } catch (error) {
      console.error(error);
      showToast('Error adding manual due', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentModal) return;
    const amountNum = parseFloat(paymentData.amount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.dues, db.activityLogs], async () => {
        const due = await db.dues.get(paymentModal.id!);
        if (!due) return;

        const payAmount = Math.min(amountNum, due.remaining);
        const newRemaining = due.remaining - payAmount;
        const newPaidAmount = (due.paidAmount || 0) + payAmount;
        const newStatus = newRemaining <= 0 ? 'Paid' : 'Pending';

        await db.dues.update(due.id!, {
          remaining: newRemaining,
          paidAmount: newPaidAmount,
          status: newStatus
        });

        const customer = await db.customers.where({ 
          name: due.personName, 
          phone: due.personContact 
        }).first();

        if (customer) {
          await db.customers.update(customer.id!, {
            balance: Math.max(0, (customer.balance || 0) - payAmount)
          });
        }

        await logActivity('Customer Payment', `Received ${formatCurrency(payAmount)} from ${due.personName} for due ${due.referenceNumber}`);
      });

      showToast('Payment recorded successfully');
      setPaymentModal(null);
      setPaymentData({ amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0], notes: '' });
    } catch (error) {
      console.error(error);
      showToast('Error recording payment', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEditDue = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(editAmount);
    if (!editingDue || isNaN(amountNum) || amountNum < 0) return;

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.dues, db.customers, db.activityLogs], async () => {
        const diff = amountNum - editingDue.remaining;
        
        await db.dues.update(editingDue.id!, {
          remaining: amountNum,
          status: amountNum === 0 ? 'Paid' : 'Pending'
        });

        const customer = await db.customers.where({ 
          name: editingDue.personName, 
          phone: editingDue.personContact 
        }).first();

        if (customer) {
          await db.customers.update(customer.id!, {
            balance: (customer.balance || 0) + diff
          });
        }

        await logActivity('Due Edited', `Updated due for ${editingDue.personName} from ${formatCurrency(editingDue.remaining)} to ${formatCurrency(amountNum)}`);
      });
      showToast('Due updated successfully');
      setEditingDue(null);
    } catch (error) {
      console.error(error);
      showToast('Error updating due', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.dues, db.customers, db.activityLogs], async () => {
        const due = await db.dues.get(deleteConfirm.id);
        if (!due) return;

        const customer = await db.customers.where({ 
          name: due.personName, 
          phone: due.personContact 
        }).first();

        if (customer) {
          await db.customers.update(customer.id!, {
            balance: Math.max(0, (customer.balance || 0) - due.remaining)
          });
        }

        await db.dues.delete(deleteConfirm.id);
        await logActivity('Due Deleted', `Deleted due record for ${due.personName} - ${formatCurrency(due.remaining)}`);
      });
      showToast('Due record deleted');
      setDeleteConfirm(null);
    } catch (error) {
      console.error(error);
      showToast('Error deleting due', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto bg-[#F0F2F5] p-2 no-scrollbar">
      {/* Header Section */}
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Customer Dues Management</h1>
          <p className="text-slate-500 text-[9px]">Track outstanding balances and process customer payments.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Outstanding</p>
            <p className="text-sm font-black text-rose-600">{formatCurrency(totalOutstanding)}</p>
          </div>
          <button 
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md"
          >
            {isFormOpen ? <X size={14} /> : <Plus size={14} />}
            {isFormOpen ? 'Cancel' : 'Add Due'}
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-1.5 border-x border-slate-200 flex items-center justify-between shrink-0 no-print gap-2">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-[200px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <input 
              type="text"
              placeholder="Search customer or ref..."
              className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="relative w-32">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <select 
              className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all appearance-none"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
            >
              <option value="All">All Status</option>
              <option value="Pending">Pending</option>
              <option value="Paid">Paid</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {timeFilter === 'Daily' && (
            <input 
              type="date"
              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          )}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            {(['All', 'Daily', 'Monthly', 'Yearly'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setTimeFilter(filter)}
                className={cn(
                  "px-3 py-1 rounded-md text-[10px] font-bold transition-all",
                  timeFilter === filter 
                    ? "bg-white text-blue-600 shadow-sm" 
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex gap-2 min-h-0">
        {/* Add Due Form */}
        {isFormOpen && (
          <div className="w-72 bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0 overflow-y-auto no-scrollbar">
            <h2 className="font-bold text-slate-900 mb-2 text-[11px] flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" />
              New Customer Due
            </h2>
            <form onSubmit={handleAddDue} onKeyDown={handleFormKeyDown} className="space-y-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Customer Name *</label>
                <input 
                  type="text"
                  placeholder="Full Name"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Code</label>
                  <input 
                    type="text"
                    placeholder="Optional"
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Phone</label>
                  <input 
                    type="text"
                    placeholder="Contact"
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Address</label>
                <input 
                  type="text"
                  placeholder="Full Address"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Due Amount *</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold"></span>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold text-rose-600"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="pt-1 flex gap-1.5">
                <button 
                  type="submit"
                  disabled={isProcessing}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-[10px] font-bold transition-all disabled:bg-slate-300"
                >
                  {isProcessing ? 'Saving...' : 'Add Due'}
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ name: '', code: '', phone: '', address: '', amount: '' })}
                  className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1 rounded text-[10px] font-bold transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Dues Table */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div ref={tableContainerRef} className="overflow-auto flex-1 no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Customer</th>
                  <th className="px-3 py-1.5">Reference</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                  <th className="px-3 py-1.5 text-right">Paid</th>
                  <th className="px-3 py-1.5 text-right">Remaining</th>
                  <th className="px-3 py-1.5 text-center">Status</th>
                  <th className="px-3 py-1.5 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {dues?.map((due, rowIndex) => (
                  <tr key={due.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-[10px]">{new Date(due.date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <div>
                        <p className="text-[10px] font-bold text-slate-900 leading-tight">{due.personName}</p>
                        <p className="text-[8px] text-slate-400">{due.personContact || 'No contact'}</p>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewInvoice(due.referenceNumber);
                        }}
                        className="text-[9px] font-mono text-blue-600 hover:underline font-bold"
                      >
                        {due.referenceNumber}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <p className="text-[10px] font-bold text-slate-700">{formatCurrency(due.amount)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <p className="text-[10px] font-bold text-emerald-600">{formatCurrency(due.paidAmount)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <p className="text-[10px] font-black text-rose-600">{formatCurrency(due.remaining)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-center outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                        due.status === 'Paid' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        {due.status}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center no-print outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <div className="flex items-center justify-center gap-1">
                        {due.remaining > 0 && (
                          <button 
                            onClick={() => setPaymentModal(due)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                            title="Record Payment"
                          >
                            <CreditCard size={12} />
                          </button>
                        )}
                        <button 
                          onClick={() => { setEditingDue(due); setEditAmount(due.remaining.toString()); }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-all"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={() => setDeleteConfirm({ id: due.id!, name: due.personName })}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!dues || dues.length === 0) && (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Wallet size={40} strokeWidth={1} />
                        <p className="text-sm italic">No dues records found.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {paymentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-emerald-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard size={18} />
                <h3 className="font-bold text-base">Record Payment</h3>
              </div>
              <button onClick={(e) => {
                e.stopPropagation();
                setPaymentModal(null);
              }} className="hover:bg-white/20 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handlePayment} className="p-5 space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Customer</span>
                  <span className="text-xs font-black text-slate-900">{paymentModal.personName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">Remaining Due</span>
                  <span className="text-sm font-black text-rose-600">{formatCurrency(paymentModal.remaining)}</span>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Payment Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-500 font-black"></span>
                  <input 
                    type="number"
                    required
                    max={paymentModal.remaining}
                    min="0.01"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-emerald-600 focus:ring-2 focus:ring-emerald-500 outline-none"
                    value={paymentData.amount}
                    onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                  />
                </div>
                <button 
                  type="button"
                  onClick={() => setPaymentData({ ...paymentData, amount: paymentModal.remaining.toString() })}
                  className="text-[9px] font-black text-emerald-600 uppercase hover:underline"
                >
                  Pay Full Amount
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                  <input 
                    type="date"
                    required
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    value={paymentData.date}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Method</label>
                  <select 
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    value={paymentData.method}
                    onChange={(e) => setPaymentData({ ...paymentData, method: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Online">Online</option>
                    <option value="Card">Card</option>
                    <option value="Cheque">Cheque</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Notes</label>
                <textarea 
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs h-16 resize-none"
                  placeholder="Optional remarks..."
                  value={paymentData.notes}
                  onChange={(e) => setPaymentData({ ...paymentData, notes: e.target.value })}
                />
              </div>

              <button 
                type="submit"
                disabled={isProcessing || !paymentData.amount}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:bg-slate-300"
              >
                <CheckCircle2 size={16} />
                {isProcessing ? 'Processing...' : 'Confirm Payment'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit Due Modal */}
      {editingDue && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-blue-600 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Edit2 size={18} />
                <h3 className="font-bold text-base">Edit Due</h3>
              </div>
              <button onClick={(e) => {
                e.stopPropagation();
                setEditingDue(null);
              }} className="hover:bg-white/20 p-1 rounded-lg">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleEditDue} className="p-5 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer</label>
                <p className="text-sm font-bold text-slate-900">{editingDue.personName}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Remaining Amount</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 font-black"></span>
                  <input 
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black text-blue-600 focus:ring-2 focus:ring-blue-500 outline-none"
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                  />
                </div>
              </div>
              <button 
                type="submit"
                disabled={isProcessing}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-lg shadow-blue-100 transition-all flex items-center justify-center gap-2 active:scale-[0.98] disabled:bg-slate-300"
              >
                <Save size={16} />
                {isProcessing ? 'Saving...' : 'Update Due'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{selectedInvoice.type === 'Return' ? 'Return Details' : 'Invoice Details'}</h3>
                <p className="text-xs text-slate-500">
                  {selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'} 
                  {selectedInvoice.partyCode && ` (${selectedInvoice.partyCode})`} • {selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
                </p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="p-2 hover:bg-slate-200 rounded-full transition-colors"
              >
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            
            <div className="p-6 space-y-6 overflow-y-auto no-scrollbar max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 text-center">
                  <p className="text-[10px] font-bold text-blue-400 uppercase mb-1">Total Amount</p>
                  <p className="text-2xl font-black text-blue-600">
                    {formatCurrency(
                      selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName 
                        ? (selectedInvoice.totalCost - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)) 
                        : (selectedInvoice.total || selectedInvoice.totalCost || selectedInvoice.totalAmount)
                    )}
                  </p>
                </div>
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-center">
                  <p className="text-[10px] font-bold text-emerald-400 uppercase mb-1">Paid Amount</p>
                  <p className="text-2xl font-black text-emerald-600">{formatCurrency(selectedInvoice.paidAmount || selectedInvoice.totalAmount || 0)}</p>
                </div>
                {(selectedInvoice.remainingAmount !== undefined || selectedInvoice.remainingBalance !== undefined) && (
                  <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 text-center">
                    <p className="text-[10px] font-bold text-rose-400 uppercase mb-1">Remaining Balance</p>
                    <p className="text-2xl font-black text-rose-600">{formatCurrency(selectedInvoice.remainingAmount || selectedInvoice.remainingBalance || 0)}</p>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items</h4>
                <div className="space-y-2 max-h-60 overflow-y-auto no-scrollbar pr-1">
                  {dueItems.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm p-3 bg-white rounded-xl border border-slate-100 hover:border-blue-200 transition-all shadow-sm">
                      <div>
                        <p className="font-bold text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-500 font-medium">{item.qty} x {formatCurrency(item.price)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-black text-slate-900">{formatCurrency(item.total)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-3 pt-4 border-t border-slate-100">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Date</span>
                  <span className="font-bold text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Invoice #</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Type</span>
                  <span className={cn(
                    "font-bold uppercase tracking-wider",
                    selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? "text-blue-600" : "text-emerald-600"
                  )}>
                    {selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? 'Purchase' : 'Sales'}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Party</span>
                  <span className="font-bold text-slate-900 truncate max-w-[150px]">
                    {selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
              >
                Close
              </button>
              <button 
                onClick={() => {
                  const type = selectedInvoice.customerName || selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase';
                  onEditInvoice?.(selectedInvoice.id, type);
                  setSelectedInvoice(null);
                }}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2"
              >
                <Edit2 size={16} /> Edit
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Receipt for Printing */}
      <div className="hidden" id="print-customer-invoice">
        {selectedInvoice && (
          <Receipt 
            type={selectedInvoice.type === 'Return' ? 'Return' : (selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase')}
            invoiceNumber={selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
            date={new Date(selectedInvoice.date).toLocaleDateString()}
            time={selectedInvoice.time || ""}
            partyName={selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
            partyCode={selectedInvoice.partyCode || ""}
            partyContact={selectedInvoice.customerPhone || selectedInvoice.supplierPhone || ""}
            partyAddress={selectedInvoice.customerAddress || selectedInvoice.supplierAddress || ""}
            items={dueItems}
            subtotal={selectedInvoice.subtotal || selectedInvoice.total || selectedInvoice.totalCost}
            discount={selectedInvoice.discount || 0}
            tax={selectedInvoice.tax || 0}
            total={selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? (selectedInvoice.totalCost - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)) : (selectedInvoice.total || selectedInvoice.totalCost || selectedInvoice.totalAmount)}
            paid={selectedInvoice.paidAmount || selectedInvoice.totalAmount || 0}
            remaining={selectedInvoice.remainingAmount || selectedInvoice.remainingBalance || 0}
            previousRemaining={selectedInvoice.previousRemaining || 0}
            settings={settings}
          />
        )}
        
        {printData.length > 0 && !selectedInvoice && (
          <div id="print-customer-dues-list">
            <Receipt 
              type="Customer Dues Report"
              items={printData.map((item: any) => ({
                name: `${item.date} - ${item.reference}`,
                qty: item.customer,
                price: item.amount,
                discount: item.contact,
                total: item.remaining
              }))}
              settings={settings}
            />
          </div>
        )}
      </div>
    </div>
  );
};
