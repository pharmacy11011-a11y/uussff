import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Supplier, logActivity } from '@/src/db/db';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { Search, Edit2, Trash2, Save, Wallet, AlertCircle, Printer, X, Calendar, CreditCard, Filter, Clock } from 'lucide-react';
import { cn, formatCurrency, formatNumber, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';

export const SupplierManagement = ({ onEditInvoice }: { onEditInvoice?: (id: number, type: 'Sales' | 'Purchase') => void }) => {
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [formValues, setFormValues] = useState({
    code: '',
    name: '',
    phone: '',
    email: '',
    address: '',
    companyName: '',
    currentBalance: 0
  });

  const [nameSuggestions, setNameSuggestions] = useState<Supplier[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [notFoundMessage, setNotFoundMessage] = useState('');

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [activeTab, setActiveTab] = useState<'suppliers' | 'history' | 'dues'>('suppliers');
  const [historyFilter, setHistoryFilter] = useState<'Daily' | 'Monthly' | 'Yearly' | 'All'>('All');
  const [historyDate, setHistoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [supplierSearchInModal, setSupplierSearchInModal] = useState('');
  const [showModalSuggestions, setShowModalSuggestions] = useState(false);

  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [dueItems, setDueItems] = useState<any[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [printData, setPrintData] = useState<any>(null);

  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const payments = useLiveQuery(() => db.supplierPayments.toArray());
  const dues = useLiveQuery(() => db.dues.where('personType').equals('Supplier').toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const handlePrintList = () => {
    if (!suppliers || suppliers.length === 0) return;
    const dataToPrint = suppliers.map(s => ({
      code: s.code,
      name: s.name,
      company: s.companyName || '-',
      phone: s.phone || '-',
      balance: s.currentBalance || 0
    }));
    
    // Pass summary for report
    const totalBalance = dataToPrint.reduce((sum, item) => sum + item.balance, 0);
    const summary = [
      { label: 'Total Balance', value: totalBalance, isBold: true }
    ];
    
    setPrintData({
      items: dataToPrint,
      summary
    });
    
    printTemplate('print-container', 'Supplier List Report');
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

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier || paymentAmount <= 0) return;

    await db.transaction('rw', [db.suppliers, db.supplierPayments, db.activityLogs, db.expenses, db.dues], async () => {
      const newPayable = (selectedSupplier.currentBalance || 0) - paymentAmount;
      await db.suppliers.update(selectedSupplier.id!, { currentBalance: newPayable });
      await db.supplierPayments.add({
        supplierId: selectedSupplier.id!,
        supplierName: selectedSupplier.name,
        amount: paymentAmount,
        date: paymentDate,
        paymentMethod,
        remainingBalance: newPayable,
        notes: paymentNotes || `Payment of ${formatCurrency(paymentAmount)} to ${selectedSupplier.name}`
      });

      // Update Dues
      const supplierDue = await db.dues
        .where({ personName: selectedSupplier.name, personType: 'Supplier' })
        .first();
      
      if (supplierDue) {
        const newDueAmount = (supplierDue.amount || 0) - paymentAmount;
        const newPaidAmount = (supplierDue.paidAmount || 0) + paymentAmount;
        if (newDueAmount <= 0) {
          await db.dues.delete(supplierDue.id!);
        } else {
          await db.dues.update(supplierDue.id!, { 
            amount: newDueAmount,
            paidAmount: newPaidAmount,
            remaining: newDueAmount,
            status: newDueAmount <= 0 ? 'Paid' : 'Pending'
          });
        }
      }

      // Automatically record as expense
      await db.expenses.add({
        name: `Supplier Payment - ${selectedSupplier.name}`,
        category: 'Supplier Payment',
        amount: paymentAmount,
        date: paymentDate,
        notes: `Payment to ${selectedSupplier.name} via ${paymentMethod}. ${paymentNotes}`
      });

      await logActivity('Supplier Payment', `Paid ${formatCurrency(paymentAmount)} to ${selectedSupplier.name}`);
    });

    setIsPaymentModalOpen(false);
    setPaymentAmount(0);
    setSelectedSupplier(null);
    setSupplierSearchInModal('');
    setPaymentNotes('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setToast({ message: 'Payment recorded and added to expenses.', type: 'success' });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSupplierCodeSearch = async (code: string) => {
    setSupplierSearchInModal(code);
    const supplier = suppliers?.find(s => s.code.toLowerCase() === code.toLowerCase());
    if (supplier) {
      setSelectedSupplier(supplier);
      setShowModalSuggestions(false);
    } else {
      setSelectedSupplier(null);
      const matches = suppliers?.filter(s => 
        s.name.toLowerCase().includes(code.toLowerCase()) || 
        s.code.toLowerCase().includes(code.toLowerCase())
      ) || [];
      setNameSuggestions(matches);
      setShowModalSuggestions(true);
    }
  };

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    s.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const sortedPayments = payments?.filter(p => {
    if (historyFilter === 'All') return true;
    const today = new Date().toISOString().split('T')[0];
    if (historyFilter === 'Daily') return p.date === historyDate;
    if (historyFilter === 'Monthly') return p.date.startsWith(historyDate.substring(0, 7));
    if (historyFilter === 'Yearly') return p.date.startsWith(historyDate.substring(0, 4));
    return true;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  React.useEffect(() => {
    if (editingSupplier) {
      setFormValues({
        code: editingSupplier.code || '',
        name: editingSupplier.name || '',
        phone: editingSupplier.phone || '',
        email: editingSupplier.email || '',
        address: editingSupplier.address || '',
        companyName: editingSupplier.companyName || '',
        currentBalance: editingSupplier.currentBalance || 0
      });
    } else {
      setFormValues({
        code: '',
        name: '',
        phone: '',
        email: '',
        address: '',
        companyName: '',
        currentBalance: 0
      });
    }
  }, [editingSupplier]);

  const handleCodeChange = async (code: string) => {
    setFormValues(prev => ({ ...prev, code }));
    setNotFoundMessage('');
    if (code.length >= 3) {
      const existing = suppliers?.find(s => s.code.toLowerCase() === code.toLowerCase());
      if (existing) {
        setEditingSupplier(existing);
      } else {
        setNotFoundMessage('Supplier not found, create new?');
      }
    }
  };

  const handleNameChange = async (name: string) => {
    setFormValues(prev => ({ ...prev, name }));
    setNotFoundMessage('');
    if (name.length >= 2) {
      const matches = suppliers?.filter(s => s.name.toLowerCase().includes(name.toLowerCase())) || [];
      setNameSuggestions(matches);
      setShowSuggestions(true);
      
      const exactMatch = matches.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (exactMatch) {
        setEditingSupplier(exactMatch);
        setShowSuggestions(false);
      }
    } else {
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const selectSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setNameSuggestions([]);
    setShowSuggestions(false);
    setNotFoundMessage('');
  };

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
      setToast({ message: 'Supplier and related records deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete supplier:", error);
      setToast({ message: 'Error deleting supplier', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Check for duplicate code
    const existingWithCode = suppliers?.find(s => 
      s.code.toLowerCase() === formValues.code.toLowerCase() && 
      s.id !== editingSupplier?.id
    );

    if (existingWithCode) {
      setToast({ message: `Supplier code "${formValues.code}" is already in use by ${existingWithCode.name}.`, type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const supplierData: any = {
      code: formValues.code,
      name: formValues.name,
      phone: formValues.phone,
      email: formValues.email,
      address: formValues.address,
      companyName: formValues.companyName,
      currentBalance: Number(formValues.currentBalance)
    };

    if (editingSupplier?.id) {
      await db.suppliers.update(editingSupplier.id, supplierData);
      
      // Update or create a single due record for this supplier
      const existingDue = await db.dues
        .where({ personName: supplierData.name, personType: 'Supplier' })
        .first();

      if (existingDue) {
        if (supplierData.currentBalance <= 0) {
          await db.dues.delete(existingDue.id!);
        } else {
          await db.dues.update(existingDue.id!, {
            amount: supplierData.currentBalance,
            remaining: supplierData.currentBalance,
            status: 'Pending'
          });
        }
      } else if (supplierData.currentBalance > 0) {
        await db.dues.add({
          personName: supplierData.name,
          personType: 'Supplier',
          personContact: supplierData.phone || '',
          amount: supplierData.currentBalance,
          date: new Date().toISOString().split('T')[0],
          referenceNumber: 'INITIAL-BALANCE',
          status: 'Pending',
          invoiceTotal: supplierData.currentBalance,
          paidAmount: 0,
          remaining: supplierData.currentBalance
        });
      }

      await logActivity('Supplier edited', `Edited supplier: ${supplierData.name}`);
    } else {
      const id = await db.suppliers.add(supplierData);
      
      if (supplierData.currentBalance > 0) {
        await db.dues.add({
          personName: supplierData.name,
          personType: 'Supplier',
          personContact: supplierData.phone || '',
          amount: supplierData.currentBalance,
          date: new Date().toISOString().split('T')[0],
          referenceNumber: 'INITIAL-BALANCE',
          status: 'Pending',
          invoiceTotal: supplierData.currentBalance,
          paidAmount: 0,
          remaining: supplierData.currentBalance
        });
      }

      await logActivity('Supplier added', `Added new supplier: ${supplierData.name}`);
    }

    setEditingSupplier(null);
    setNotFoundMessage('');
  };

  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();
  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F9: Save
      if (e.key === 'F9' || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        // Trigger form submission
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
      // F10: New Supplier
      else if (e.key === 'F10') {
        e.preventDefault();
        setEditingSupplier(null);
        setFormValues({
          code: '', name: '', phone: '', email: '', address: '', companyName: '', currentBalance: 0
        });
        setNotFoundMessage('');
        const firstInput = document.querySelector('input[name="code"]');
        if (firstInput) (firstInput as HTMLInputElement).focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-full flex flex-col gap-2 bg-[#F0F2F5] p-2 no-scrollbar">
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Supplier Credit & Payment</h1>
          <p className="text-slate-500 text-[9px]">Manage supplier debts, partial payments, and history.</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button 
            onClick={() => {
              setEditingSupplier(null);
              setFormValues({
                code: '', name: '', phone: '', email: '', address: '', companyName: '', currentBalance: 0
              });
              setNotFoundMessage('');
            }}
            className="px-2 py-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded border border-emerald-200 transition-all"
          >
            + Add
          </button>
          <button 
            onClick={() => {
              setSelectedSupplier(null);
              setIsPaymentModalOpen(true);
            }}
            className="px-2 py-1 text-[10px] font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 transition-all"
          >
            $ Pay
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1 px-3 bg-white border-x border-slate-200 shrink-0">
        <button 
          onClick={() => setActiveTab('suppliers')}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold transition-all border-b-2",
            activeTab === 'suppliers' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          Suppliers
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={cn(
            "px-3 py-1.5 text-[10px] font-bold transition-all border-b-2",
            activeTab === 'history' ? "border-blue-600 text-blue-600" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
        >
          History
        </button>
        {activeTab === 'history' && (
          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
              {(['All', 'Daily', 'Monthly', 'Yearly'] as const).map((filter) => (
                <button
                  key={filter}
                  onClick={() => setHistoryFilter(filter)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                    historyFilter === filter 
                      ? "bg-white text-blue-600 shadow-sm" 
                      : "text-slate-500 hover:text-slate-700"
                  )}
                >
                  {filter}
                </button>
              ))}
            </div>
            {historyFilter !== 'All' && (
              <input 
                type={historyFilter === 'Daily' ? 'date' : historyFilter === 'Monthly' ? 'month' : 'number'}
                className="px-2 py-0.5 bg-slate-50 border border-slate-200 rounded text-[10px] outline-none"
                value={historyFilter === 'Yearly' ? historyDate.substring(0, 4) : historyFilter === 'Monthly' ? historyDate.substring(0, 7) : historyDate}
                onChange={(e) => {
                  let val = e.target.value;
                  if (historyFilter === 'Yearly') val = `${val}-01-01`;
                  if (historyFilter === 'Monthly') val = `${val}-01`;
                  setHistoryDate(val);
                }}
              />
            )}
          </div>
        )}
      </div>

      {activeTab === 'suppliers' ? (
        <>
          <div className="bg-white p-3 border-x border-b border-slate-200 rounded-b-lg shadow-sm shrink-0">
            <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Supplier Code *</label>
                  <input 
                    name="code" 
                    value={formValues.code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    required 
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
                  />
                </div>
                <div className="relative">
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Supplier Name *</label>
                  <input 
                    name="name" 
                    value={formValues.name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    onFocus={() => formValues.name.length >= 2 && setShowSuggestions(true)}
                    required 
                    autoComplete="off"
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
                  />
                  {showSuggestions && nameSuggestions.length > 0 && (
                    <div className="absolute z-50 left-0 right-0 mt-1 bg-white border border-slate-200 rounded shadow-lg max-h-40 overflow-y-auto">
                      {nameSuggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full text-left px-3 py-1.5 text-[10px] hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                          onClick={() => selectSupplier(s)}
                        >
                          <p className="font-bold text-slate-900">{s.name}</p>
                          <p className="text-slate-500 text-[8px]">{s.code} • {s.phone}</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Supplier Contact Number</label>
                  <input 
                    name="phone" 
                    value={formValues.phone}
                    onChange={(e) => setFormValues(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Supplier Payable</label>
                  <input 
                    type="number"
                    name="currentBalance" 
                    value={formValues.currentBalance}
                    onChange={(e) => setFormValues(prev => ({ ...prev, currentBalance: Number(e.target.value) }))}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Supplier Address</label>
                  <input 
                    name="address" 
                    value={formValues.address}
                    onChange={(e) => setFormValues(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
                  />
                </div>
                <div className="flex items-end gap-2">
                  <button 
                    type="submit"
                    className="flex-1 py-1 text-[10px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded transition-all shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <Save size={12} />
                    {editingSupplier ? 'Update' : 'Save'}
                  </button>
                  {notFoundMessage && (
                    <p className="absolute -bottom-4 left-0 text-[8px] font-bold text-amber-600 animate-pulse">{notFoundMessage}</p>
                  )}
                </div>
              </div>
            </form>
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-[300px]">
            <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                <input
                  type="text"
                  placeholder="Search suppliers..."
                  className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
              <div ref={tableContainerRef} className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-slate-50 z-10">
                    <tr className="text-slate-500 text-[9px] uppercase tracking-wider font-bold border-b border-slate-200">
                      <th className="px-3 py-1.5">Supplier Code</th>
                      <th className="px-3 py-1.5">Supplier Name</th>
                      <th className="px-3 py-1.5">Supplier Contact Number</th>
                      <th className="px-3 py-1.5">Supplier Address</th>
                      <th className="px-3 py-1.5 text-right">Supplier Payable</th>
                      <th className="px-3 py-1.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSuppliers?.map((s, rowIndex) => (
                      <tr 
                        key={s.id} 
                        className="hover:bg-slate-50/50 transition-colors group outline-none focus:bg-blue-50"
                        tabIndex={0}
                        onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}
                      >
                        <td className="px-3 py-1.5">
                          <p className="text-[9px] font-mono text-slate-500">{s.code}</p>
                        </td>
                        <td className="px-3 py-1.5">
                          <p className="text-[10px] font-bold text-slate-900 leading-tight">{s.name}</p>
                        </td>
                        <td className="px-3 py-1.5">
                          <p className="text-[9px] text-slate-500">{s.phone}</p>
                        </td>
                        <td className="px-3 py-1.5">
                          <p className="text-[9px] text-slate-500 truncate max-w-[150px]">{s.address}</p>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <p className="text-[10px] font-bold text-rose-600">{formatCurrency(s.currentBalance || 0)}</p>
                        </td>
                        <td className="px-3 py-1.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              onClick={() => {
                                setSelectedSupplier(s);
                                setIsPaymentModalOpen(true);
                              }}
                              className="px-1.5 py-0.5 text-[9px] font-bold text-emerald-600 hover:bg-emerald-50 rounded border border-emerald-100 transition-colors"
                            >
                              Pay
                            </button>
                            <button 
                              onClick={() => setEditingSupplier(s)}
                              className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button 
                              onClick={() => s.id && initiateDelete(s.id)}
                              className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : activeTab === 'dues' ? (
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-500 text-[9px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Supplier Name</th>
                  <th className="px-3 py-1.5">Reference</th>
                  <th className="px-3 py-1.5 text-right">Total</th>
                  <th className="px-3 py-1.5 text-right">Paid</th>
                  <th className="px-3 py-1.5 text-right">Remaining</th>
                  <th className="px-3 py-1.5 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dues?.map((due) => (
                  <tr key={due.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-1.5 text-[9px] text-slate-500">{new Date(due.date).toLocaleDateString()}</td>
                    <td className="px-3 py-1.5 text-[10px] font-bold text-slate-900 leading-tight">{due.personName}</td>
                    <td className="px-3 py-1.5">
                      <button 
                        onClick={() => handleViewInvoice(due.referenceNumber)}
                        className="text-[9px] font-mono text-blue-600 hover:underline font-bold"
                      >
                        {due.referenceNumber}
                      </button>
                    </td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-bold text-slate-700">{formatCurrency(due.amount)}</td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-bold text-emerald-600">{formatCurrency(due.paidAmount)}</td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-black text-rose-600">{formatCurrency(due.remaining)}</td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider",
                        due.status === 'Paid' ? "bg-emerald-100 text-emerald-600" : "bg-rose-100 text-rose-600"
                      )}>
                        {due.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {(!dues || dues.length === 0) && (
                  <tr>
                    <td colSpan={7} className="px-3 py-6 text-center text-slate-400 text-[10px] italic">No payable records found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-500 text-[9px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Supplier Name</th>
                  <th className="px-3 py-1.5">Method</th>
                  <th className="px-3 py-1.5 text-right">Paid</th>
                  <th className="px-3 py-1.5 text-right">Balance</th>
                  <th className="px-3 py-1.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sortedPayments?.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-3 py-1.5 text-[9px] text-slate-500">{new Date(p.date).toLocaleDateString()}</td>
                    <td className="px-3 py-1.5 text-[10px] font-bold text-slate-900 leading-tight">{p.supplierName}</td>
                    <td className="px-3 py-1.5 text-[9px] text-slate-500">{p.paymentMethod}</td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-bold text-emerald-600">{formatCurrency(p.amount || 0)}</td>
                    <td className="px-3 py-1.5 text-right text-[10px] font-bold text-rose-600">{formatCurrency(p.remainingBalance || 0)}</td>
                    <td className="px-3 py-1.5 text-[9px] text-slate-500 truncate max-w-[100px]">{p.notes}</td>
                  </tr>
                ))}
                {(!sortedPayments || sortedPayments.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-center text-slate-400 text-[10px] italic">No payment history found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-2 overflow-y-auto backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm my-auto overflow-hidden flex flex-col max-h-[95vh] border border-white/20">
            <div className="bg-[#1E56A0] px-4 py-3 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-white/20 rounded flex items-center justify-center">
                  <Wallet size={14} />
                </div>
                <h3 className="font-bold text-base">Supplier Payment</h3>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsPaymentModalOpen(false);
                }} 
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handlePayment} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                <div className="grid grid-cols-1 gap-3">
                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Supplier Code / Name</label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
                      <input 
                        type="text"
                        placeholder="Search supplier..."
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        value={supplierSearchInModal}
                        onChange={(e) => handleSupplierCodeSearch(e.target.value)}
                        onFocus={() => supplierSearchInModal.length >= 2 && setShowModalSuggestions(true)}
                      />
                      {showModalSuggestions && nameSuggestions.length > 0 && (
                        <div className="absolute z-[60] left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-40 overflow-y-auto">
                          {nameSuggestions.map(s => (
                            <button
                              key={s.id}
                              type="button"
                              className="w-full text-left px-3 py-2 text-[10px] hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                              onClick={() => {
                                setSelectedSupplier(s);
                                setSupplierSearchInModal(s.name);
                                setShowModalSuggestions(false);
                              }}
                            >
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-bold text-slate-900">{s.name}</p>
                                  <p className="text-slate-500 text-[8px]">{s.code}</p>
                                </div>
                                <p className="text-[9px] font-bold text-rose-600">{formatCurrency(s.currentBalance || 0)}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <label className="block text-[8px] font-black text-slate-400 mb-0.5 uppercase tracking-widest">Name</label>
                      <p className="font-bold text-slate-700 text-[10px] truncate">
                        {selectedSupplier?.name || '---'}
                      </p>
                    </div>
                    
                    <div className="bg-rose-50 p-2 rounded-lg border border-rose-100">
                      <label className="block text-[8px] font-black text-rose-400 mb-0.5 uppercase tracking-widest">Payable</label>
                      <p className="font-black text-rose-600 text-[10px]">
                        {formatCurrency(selectedSupplier?.currentBalance || 0)}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Date</label>
                      <input 
                        type="date"
                        required
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Method</label>
                      <select 
                        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                      >
                        <option value="Cash">Cash</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                        <option value="Cheque">Cheque</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-emerald-600 text-sm"></span>
                      <input 
                        type="number"
                        required
                        autoFocus
                        placeholder="0.00"
                        className="w-full pl-10 pr-3 py-2 bg-emerald-50 border border-emerald-100 rounded-lg text-xl font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition-all"
                        value={paymentAmount || ''}
                        onChange={(e) => setPaymentAmount(Number(e.target.value))}
                      />
                    </div>
                    {selectedSupplier && (
                      <div className="flex justify-between items-center mt-1 px-1">
                        <p className="text-[9px] text-slate-500 font-medium">Remaining:</p>
                        <p className="text-[9px] font-black text-slate-700">
                          {formatCurrency(selectedSupplier.currentBalance - paymentAmount)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[9px] font-black text-slate-400 mb-1 uppercase tracking-widest">Notes</label>
                    <textarea 
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[11px] focus:ring-1 focus:ring-blue-500 outline-none h-16 transition-all resize-none"
                      placeholder="Add notes..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="p-4 bg-slate-50 border-t border-slate-200 shrink-0 flex gap-3">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsPaymentModalOpen(false);
                  }}
                  className="flex-1 px-4 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!selectedSupplier || paymentAmount <= 0}
                  className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  <Save size={14} />
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
              <div>
                <h3 className="text-lg font-bold">{selectedInvoice.type === 'Return' ? 'Return Details' : 'Invoice Details'}</h3>
                <p className="text-[10px] text-white/60">
                  {selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'} 
                  {selectedInvoice.partyCode && ` (${selectedInvoice.partyCode})`} • {selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
                </p>
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
              {/* Financial Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center shadow-sm">
                  <p className="text-[8px] font-bold text-blue-400 uppercase mb-0.5">Total Amount</p>
                  <p className="text-base font-black text-blue-600">
                    {formatCurrency(
                      selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName 
                        ? (selectedInvoice.totalCost - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)) 
                        : (selectedInvoice.total || selectedInvoice.totalCost || selectedInvoice.totalAmount)
                    )}
                  </p>
                </div>
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-center shadow-sm">
                  <p className="text-[8px] font-bold text-emerald-400 uppercase mb-0.5">Paid Amount</p>
                  <p className="text-base font-black text-emerald-600">{formatCurrency(selectedInvoice.paidAmount || selectedInvoice.totalAmount || 0)}</p>
                </div>
                {(selectedInvoice.remainingAmount !== undefined || selectedInvoice.remainingBalance !== undefined) && (
                  <div className="p-3 bg-rose-50 rounded-xl border border-rose-100 text-center shadow-sm">
                    <p className="text-[8px] font-bold text-rose-400 uppercase mb-0.5">Remaining Balance</p>
                    <p className="text-base font-black text-rose-600">{formatCurrency(selectedInvoice.remainingAmount || selectedInvoice.remainingBalance || 0)}</p>
                  </div>
                )}
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
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
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
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-6 gap-y-2 pt-3 border-t border-slate-100">
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">Date</span>
                  <span className="font-bold text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString()}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">Invoice #</span>
                  <span className="font-bold text-slate-900">{selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}</span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">Type</span>
                  <span className={cn(
                    "font-bold uppercase tracking-wider",
                    selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? "text-blue-600" : "text-emerald-600"
                  )}>
                    {selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? 'Purchase' : 'Sales'}
                  </span>
                </div>
                <div className="flex justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase tracking-widest">Party</span>
                  <span className="font-bold text-slate-900 truncate max-w-[120px]">
                    {selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
                  </span>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex justify-between gap-3 shrink-0">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedInvoice(null);
                }}
                className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
              >
                Cancel
              </button>
              <div className="flex gap-2">
                <button 
                  onClick={() => {
                    const type = selectedInvoice.customerName || selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase';
                    onEditInvoice?.(selectedInvoice.id, type);
                    setSelectedInvoice(null);
                  }}
                  className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-blue-600/20"
                >
                  <Edit2 size={12} /> Edit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Print Layout */}
      <div className="hidden">
        {selectedInvoice && (
          <Receipt 
            id="print-container"
            type={selectedInvoice.type === 'Return' ? 'Return' : (selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase')}
            invoiceNumber={selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
            date={new Date(selectedInvoice.date).toLocaleDateString()}
            time={selectedInvoice.time || ""}
            partyName={selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
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
        {printData && printData.items && (
          <Receipt 
            id="print-container"
            type="Supplier List Report"
            items={printData.items.map((item: any) => ({
              name: `${item.code} - ${item.name}`,
              qty: item.company,
              price: 0,
              discount: item.phone,
              total: item.balance
            }))}
            summary={printData.summary}
            settings={settings}
          />
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
