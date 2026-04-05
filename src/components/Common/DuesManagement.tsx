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
  Printer,
  ChevronRight,
  Edit2,
  X as CloseIcon,
  ArrowLeft,
  FileDown,
  Share2
} from 'lucide-react';
import { cn, formatCurrency, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

export const DuesManagement = ({ 
  type = 'Customer',
  onEditInvoice,
  hideHeader = false
}: { 
  type?: 'Customer' | 'Supplier',
  onEditInvoice?: (id: number, type: 'Sales' | 'Purchase') => void,
  hideHeader?: boolean
}) => {
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

  // Invoice Detail States
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [partyDetails, setPartyDetails] = useState<any>(null);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  // Fetch items and party details when an invoice is selected
  useEffect(() => {
    const fetchDetails = async () => {
      if (selectedInvoice) {
        // Fetch Party Details
        if (type === 'Customer') {
          const customer = await db.customers.where({ 
            name: selectedInvoice.personName, 
            phone: selectedInvoice.personContact 
          }).first();
          setPartyDetails(customer);
        } else {
          const supplier = await db.suppliers.where({ 
            name: selectedInvoice.personName, 
            phone: selectedInvoice.personContact 
          }).first();
          setPartyDetails(supplier);
        }

        const refNum = selectedInvoice.referenceNumber;
        if (!refNum) return;

        if (refNum.startsWith('MANUAL-DUE-')) {
          setDueItems([{
            code: 'MANUAL',
            name: 'Manual Due Entry',
            qty: 1,
            price: selectedInvoice.amount,
            total: selectedInvoice.amount
          }]);
          return;
        }

        // Try to find in invoices (Sales)
        const invoice = await db.invoices.where('invoiceNumber').equals(refNum).first();
        if (invoice) {
          setDueItems(invoice.items.map(i => ({
            code: i.medicineCode || '',
            name: i.medicineName,
            qty: i.quantity,
            price: i.price,
            total: i.total
          })));
          return;
        }

        // Try to find in purchases
        const purchase = await db.purchases.where('invoiceNumber').equals(refNum).first();
        if (purchase) {
          setDueItems(purchase.items.map(i => ({
            code: i.medicineCode || '',
            name: i.medicineName,
            qty: i.quantity,
            price: i.purchasePrice,
            total: i.total
          })));
          return;
        }
      } else {
        setDueItems([]);
        setPartyDetails(null);
      }
    };
    fetchDetails();
  }, [selectedInvoice, type]);

  // Keyboard Navigation
  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  // Queries
  const dues = useLiveQuery(async () => {
    let collection = db.dues.where('personType').equals(type);
    const items = await collection.toArray();
    
    let filtered = items;

    // Base Filter: Only show dues with remaining balance
    filtered = filtered.filter(d => d.remaining > 0);

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
      await db.transaction('rw', [db.customers, db.suppliers, db.dues, db.activityLogs], async () => {
        if (type === 'Customer') {
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
          } else {
            await db.customers.update(customer.id!, {
              balance: (customer.balance || 0) + amountNum,
              code: formData.code || customer.code,
              address: formData.address || customer.address
            });
          }
        } else {
          let supplier = await db.suppliers.where({ 
            name: formData.name, 
            phone: formData.phone
          }).first();
          
          if (!supplier) {
            await db.suppliers.add({
              name: formData.name,
              code: formData.code,
              phone: formData.phone,
              email: '',
              address: formData.address,
              companyName: '',
              currentBalance: amountNum
            });
          } else {
            await db.suppliers.update(supplier.id!, {
              currentBalance: (supplier.currentBalance || 0) + amountNum,
              code: formData.code || supplier.code,
              address: formData.address || supplier.address
            });
          }
        }

        await db.dues.add({
          personName: formData.name,
          personType: type,
          personContact: formData.phone,
          amount: amountNum,
          remaining: amountNum,
          paidAmount: 0,
          invoiceTotal: amountNum,
          date: new Date().toISOString().split('T')[0],
          referenceNumber: 'MANUAL-DUE-' + Date.now(),
          status: 'Pending'
        });

        await logActivity(`${type} Manual Due Added`, `Added manual due of ${formatCurrency(amountNum)} for ${formData.name}`);
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
      await db.transaction('rw', [db.customers, db.suppliers, db.dues, db.activityLogs], async () => {
        const due = await db.dues.get(paymentModal.id!);
        if (!due) return;

        const payAmount = Math.min(amountNum, due.remaining);
        const newRemaining = due.remaining - payAmount;
        const newPaidAmount = (due.paidAmount || 0) + payAmount;
        const newStatus = newRemaining <= 0 ? 'Paid' : 'Pending';

        if (newRemaining <= 0) {
          await db.dues.delete(due.id!);
        } else {
          await db.dues.update(due.id!, {
            remaining: newRemaining,
            paidAmount: newPaidAmount,
            status: newStatus
          });
        }

        if (type === 'Customer') {
          const customer = await db.customers.where({ 
            name: due.personName, 
            phone: due.personContact 
          }).first();

          if (customer) {
            await db.customers.update(customer.id!, {
              balance: Math.max(0, (customer.balance || 0) - payAmount)
            });
          }
        } else {
          const supplier = await db.suppliers.where({ 
            name: due.personName, 
            phone: due.personContact 
          }).first();

          if (supplier) {
            await db.suppliers.update(supplier.id!, {
              currentBalance: Math.max(0, (supplier.currentBalance || 0) - payAmount)
            });
          }
        }

        await logActivity(`${type} Payment`, `Received ${formatCurrency(payAmount)} from ${due.personName} for due ${due.referenceNumber}`);
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
      await db.transaction('rw', [db.dues, db.customers, db.suppliers, db.activityLogs], async () => {
        const diff = amountNum - editingDue.remaining;
        
        if (amountNum === 0) {
          await db.dues.delete(editingDue.id!);
        } else {
          await db.dues.update(editingDue.id!, {
            remaining: amountNum,
            status: amountNum === 0 ? 'Paid' : 'Pending'
          });
        }

        if (type === 'Customer') {
          const customer = await db.customers.where({ 
            name: editingDue.personName, 
            phone: editingDue.personContact 
          }).first();

          if (customer) {
            await db.customers.update(customer.id!, {
              balance: (customer.balance || 0) + diff
            });
          }
        } else {
          const supplier = await db.suppliers.where({ 
            name: editingDue.personName, 
            phone: editingDue.personContact 
          }).first();

          if (supplier) {
            await db.suppliers.update(supplier.id!, {
              currentBalance: (supplier.currentBalance || 0) + diff
            });
          }
        }

        await logActivity(`${type} Due Edited`, `Updated due for ${editingDue.personName} from ${formatCurrency(editingDue.remaining)} to ${formatCurrency(amountNum)}`);
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
      await db.transaction('rw', [db.dues, db.customers, db.suppliers, db.activityLogs], async () => {
        const due = await db.dues.get(deleteConfirm.id);
        if (!due) return;

        if (type === 'Customer') {
          const customer = await db.customers.where({ 
            name: due.personName, 
            phone: due.personContact 
          }).first();

          if (customer) {
            await db.customers.update(customer.id!, {
              balance: Math.max(0, (customer.balance || 0) - due.remaining)
            });
          }
        } else {
          const supplier = await db.suppliers.where({ 
            name: due.personName, 
            phone: due.personContact 
          }).first();

          if (supplier) {
            await db.suppliers.update(supplier.id!, {
              currentBalance: Math.max(0, (supplier.currentBalance || 0) - due.remaining)
            });
          }
        }

        await db.dues.delete(deleteConfirm.id);
        await logActivity(`${type} Due Deleted`, `Deleted due record for ${due.personName} - ${formatCurrency(due.remaining)}`);
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

  const handleExportPDF = async (share: boolean = false) => {
    if (!dues || dues.length === 0) return;

    const columns = ['Date', type === 'Customer' ? 'Customer' : 'Supplier', 'Reference', 'Total', 'Paid', 'Remaining', 'Status'];
    const data = dues.map(d => [
      new Date(d.date).toLocaleDateString(),
      d.personName,
      d.referenceNumber,
      formatCurrency(d.amount),
      formatCurrency(d.paidAmount),
      formatCurrency(d.remaining),
      d.status
    ]);

    const options = {
      title: `${type === 'Customer' ? 'Customer Dues' : 'Supplier Payables'} Ledger`,
      filename: `${type.toLowerCase()}_dues_ledger_${new Date().toISOString().split('T')[0]}`,
      columns,
      data,
      totals: [
        { label: 'Total Outstanding', value: formatCurrency(totalOutstanding) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  const handleExportSinglePDF = async (share: boolean = false) => {
    if (!selectedInvoice || !dueItems) return;

    const columns = ['Item Name', 'Qty', 'Price', 'Total'];
    const data = dueItems.map(item => [
      item.name,
      item.qty,
      formatCurrency(item.price),
      formatCurrency(item.total)
    ]);

    const options = {
      title: `${type === 'Customer' ? 'Customer' : 'Supplier'} Due Invoice - ${selectedInvoice.referenceNumber}`,
      filename: `due_invoice_${selectedInvoice.referenceNumber}`,
      columns,
      data,
      totals: [
        { label: 'Invoice Total', value: formatCurrency(selectedInvoice.invoiceTotal || selectedInvoice.amount) },
        { label: 'Paid Amount', value: formatCurrency(selectedInvoice.paidAmount || 0) },
        { label: 'Remaining Balance', value: formatCurrency(selectedInvoice.remaining) }
      ]
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  return (
    <div className="h-full flex flex-col gap-2 overflow-y-auto bg-[#F0F2F5] p-2 no-scrollbar">
      {/* Header Section */}
      {!hideHeader && (
        <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              {type === 'Customer' ? 'Customer Dues' : 'Supplier Payables'}
            </h1>
            <p className="text-slate-500 text-[9px]">
              {type === 'Customer' ? 'Track and manage customer outstanding balances.' : 'Track and manage supplier outstanding balances.'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total Outstanding</p>
              <p className="text-sm font-black text-rose-600">{formatCurrency(totalOutstanding)}</p>
            </div>
            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-2 ml-1">
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
            </div>
            <button 
              onClick={() => setIsFormOpen(!isFormOpen)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md ml-1"
            >
              {isFormOpen ? <X size={14} /> : <Plus size={14} />}
              {isFormOpen ? 'Cancel' : 'Add Due'}
            </button>
          </div>
        </div>
      )}

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
              New {type === 'Customer' ? 'Due' : 'Payable'}
            </h2>
            <form onSubmit={handleAddDue} onKeyDown={handleFormKeyDown} className="space-y-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                  {type === 'Customer' ? 'Customer Name *' : 'Supplier Name *'}
                </label>
                <input 
                  type="text"
                  placeholder={type === 'Customer' ? 'Full Name' : 'Supplier Name'}
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
                  <th className="px-3 py-1.5">{type === 'Customer' ? 'Customer' : 'Supplier'}</th>
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
                  <tr 
                    key={due.id} 
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => setSelectedInvoice(due)}
                  >
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
                      <span className="text-[9px] font-mono text-slate-500">{due.referenceNumber}</span>
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
                    <td className="px-3 py-1.5 text-center no-print outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)} onClick={(e) => e.stopPropagation()}>
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

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div className="flex-1">
                <h3 className="text-lg font-bold">{type === 'Customer' ? 'Customer Due' : 'Supplier Payable'} Invoice</h3>
                <p className="text-[10px] text-white/60">Reference: {selectedInvoice.referenceNumber}</p>
              </div>
              <div className="flex items-center gap-2 mr-4">
                <button 
                  onClick={() => handleExportSinglePDF(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold"
                  title="Download PDF"
                >
                  <FileDown size={14} />
                  PDF
                </button>
                <button 
                  onClick={() => handleExportSinglePDF(true)}
                  className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-all flex items-center gap-1.5 text-[10px] font-bold"
                  title="Share on WhatsApp"
                >
                  <Share2 size={14} />
                  Share
                </button>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="p-2 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={20} className="text-white/60" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
              {/* Party & Invoice Header Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <User size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Name</p>
                      <p className="text-[11px] font-bold text-slate-900 leading-tight">{selectedInvoice.personName}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Code</p>
                      <p className="text-[11px] font-bold text-slate-900">{partyDetails?.code || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Contact</p>
                      <p className="text-[11px] font-bold text-slate-900">{selectedInvoice.personContact || 'N/A'}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <MapPin size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Address</p>
                      <p className="text-[11px] font-bold text-slate-900 truncate">{partyDetails?.address || 'N/A'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Invoice Date</p>
                      <p className="text-[11px] font-bold text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard size={12} className="text-slate-400" />
                    <div className="flex-1">
                      <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Invoice Number</p>
                      <p className="text-[11px] font-bold text-slate-900">{selectedInvoice.referenceNumber}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 bg-white border border-slate-200 rounded-xl text-center shadow-sm">
                  <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Total Amount</p>
                  <p className="text-sm font-black text-slate-900">{formatCurrency(selectedInvoice.invoiceTotal || selectedInvoice.amount)}</p>
                </div>
                <div className="p-2 bg-emerald-50 border border-emerald-100 rounded-xl text-center shadow-sm">
                  <p className="text-[8px] font-bold text-emerald-400 uppercase tracking-widest mb-0.5">Paid Amount</p>
                  <p className="text-sm font-black text-emerald-600">{formatCurrency(selectedInvoice.paidAmount || 0)}</p>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-center shadow-sm">
                  <p className="text-[8px] font-bold text-rose-400 uppercase tracking-widest mb-0.5">Remaining</p>
                  <p className="text-sm font-black text-rose-600">{formatCurrency(selectedInvoice.remaining || 0)}</p>
                </div>
              </div>

              {/* Items Table */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col h-[180px] shrink-0">
                <div className="bg-slate-50 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                  <h4 className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Invoice Items</h4>
                  <span className="text-[9px] font-bold text-slate-500">{dueItems.length} Items</span>
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
                      {dueItems.map((item, idx) => (
                        <tr key={item.id || `due-item-${idx}`} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-1.5">
                            <p className="text-[10px] font-bold text-slate-900">{item.name}</p>
                            <p className="text-[8px] text-slate-400">{item.code}</p>
                          </td>
                          <td className="px-3 py-1.5 text-center">
                            <span className="text-[10px] font-bold text-slate-700">{item.qty}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-[10px] font-bold text-slate-700">{formatCurrency(item.price)}</span>
                          </td>
                          <td className="px-3 py-1.5 text-right">
                            <span className="text-[10px] font-black text-slate-900">{formatCurrency(item.total)}</span>
                          </td>
                        </tr>
                      ))}
                      {dueItems.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-3 py-8 text-center text-[10px] text-slate-400 italic">
                            No items found for this invoice.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all flex items-center gap-2 border border-slate-200"
              >
                <X size={12} /> Cancel
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={async () => {
                    const refNum = selectedInvoice.referenceNumber;
                    if (refNum.startsWith('MANUAL-DUE-')) {
                      showToast('Manual dues cannot be edited directly', 'error');
                      return;
                    }
                    
                    // Find invoice ID and type
                    const inv = await db.invoices.where('invoiceNumber').equals(refNum).first();
                    if (inv) {
                      onEditInvoice?.(inv.id!, 'Sales');
                      setSelectedInvoice(null);
                      return;
                    }
                    
                    const pur = await db.purchases.where('invoiceNumber').equals(refNum).first();
                    if (pur) {
                      onEditInvoice?.(pur.id!, 'Purchase');
                      setSelectedInvoice(null);
                      return;
                    }
                    
                    showToast('Original invoice not found', 'error');
                  }}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold rounded-lg transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Layout */}
      <div className="hidden" id="print-due-receipt">
        {selectedInvoice && (
          <Receipt 
            type={type === 'Customer' ? 'CUSTOMER DUES' : 'SUPPLIER PAYABLE'}
            invoiceNumber={selectedInvoice.referenceNumber}
            date={new Date(selectedInvoice.date).toLocaleDateString()}
            time=""
            partyName={selectedInvoice.personName}
            partyContact={selectedInvoice.personContact || ''}
            partyAddress={partyDetails?.address || ''}
            items={dueItems}
            subtotal={selectedInvoice.subtotal || selectedInvoice.invoiceTotal || selectedInvoice.amount}
            discount={selectedInvoice.discount || 0}
            tax={selectedInvoice.tax || 0}
            total={selectedInvoice.invoiceTotal || selectedInvoice.amount}
            paid={selectedInvoice.paidAmount || 0}
            remaining={selectedInvoice.remaining || 0}
            settings={settings}
          />
        )}
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="bg-red-600 px-4 py-3 text-white flex items-center gap-2">
              <Trash2 size={18} />
              <h3 className="font-bold text-base">Confirm Delete</h3>
            </div>
            <div className="p-5">
              <p className="text-slate-600 text-xs leading-relaxed">
                Are you sure you want to delete the due record for <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? This will also adjust the customer's total balance.
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
                disabled={isProcessing}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md disabled:bg-slate-300"
              >
                {isProcessing ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 z-[200] px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <p className="text-[11px] font-bold">{toast.message}</p>
        </div>
      )}
    </div>
  );
};
