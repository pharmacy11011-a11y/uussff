import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Expense, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { Plus, Search, Filter, Trash2, Wallet, Calendar, Tag, CreditCard, X, Save, AlertCircle, Printer } from 'lucide-react';
import { formatCurrency, cn, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';

const EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity',
  'Staff Salary',
  'Transport',
  'Internet',
  'Maintenance',
  'Supplier Payment',
  'Other'
];

export const ExpenseManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('All Categories');
  const [timeFilter, setTimeFilter] = useState<'Daily' | 'Monthly' | 'Yearly' | 'All'>('All');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Other',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [printData, setPrintData] = useState<any[]>([]);

  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const expenses = useLiveQuery(() => {
    let collection = db.expenses.toCollection();
    
    return collection.toArray().then(items => {
      let filtered = items;
      
      // Category Filter
      if (filterCategory !== 'All Categories') {
        filtered = filtered.filter(exp => exp.category === filterCategory);
      }
      
      // Time Filter
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const currentMonth = today.substring(0, 7); // YYYY-MM
      const currentYear = today.substring(0, 4);  // YYYY
      
      if (timeFilter === 'Daily') {
        filtered = filtered.filter(exp => exp.date === selectedDate);
      } else if (timeFilter === 'Monthly') {
        filtered = filtered.filter(exp => exp.date.startsWith(currentMonth));
      } else if (timeFilter === 'Yearly') {
        filtered = filtered.filter(exp => exp.date.startsWith(currentYear));
      }
      
      return filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    });
  }, [filterCategory, timeFilter]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) return;

    try {
      await db.expenses.add({
        name: formData.name,
        category: formData.category,
        amount: parseFloat(formData.amount),
        date: formData.date,
        notes: formData.notes
      });
      await logActivity('Expense added', `Added expense: ${formData.name} - ${formatCurrency(parseFloat(formData.amount))}`);
      setFormData({
        name: '',
        category: 'Other',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        notes: ''
      });
      setIsFormOpen(false);
    } catch (error) {
      console.error('Failed to add expense:', error);
    }
  };

  const initiateDelete = async (id: number) => {
    const expense = await db.expenses.get(id);
    if (!expense) return;
    setDeleteConfirm({ id, name: expense.name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.expenses.delete(deleteConfirm.id);
      await logActivity('Expense deleted', `Deleted expense: ${deleteConfirm.name}`);
      setToast({ message: 'Expense deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete expense:", error);
      setToast({ message: 'Error deleting expense', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const totalExpense = expenses?.reduce((sum, exp) => sum + exp.amount, 0) || 0;

  const handlePrint = () => {
    if (!expenses || expenses.length === 0) {
      setToast({ message: 'No expenses found to print', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const formattedData = expenses.map(exp => ({
      code: exp.category,
      name: exp.name,
      qty: exp.date,
      price: exp.amount,
      total: exp.amount
    }));

    setPrintPreviewData({
      title: 'EXPENSE REPORT',
      type: 'EXPENSE REPORT',
      items: formattedData,
      total: formattedData.reduce((acc, item) => acc + (item.total || 0), 0),
      columns: [
        { header: 'CATEGORY', key: 'code' },
        { header: 'EXPENSE NAME', key: 'name' },
        { header: 'DATE', key: 'qty' },
        { header: 'AMOUNT', key: 'price', align: 'right' }
      ]
    });
    setShowPrintPreview(true);
  };

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // F9: Save
      if (e.key === 'F9' || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        // Trigger form submission
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
      // F10: Toggle Form
      else if (e.key === 'F10') {
        e.preventDefault();
        setIsFormOpen(prev => !prev);
      }
      // F8: Print
      else if (e.key === 'F8') {
        e.preventDefault();
        handlePrint();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-full flex flex-col gap-2 bg-[#F0F2F5] p-2 no-scrollbar">
      {/* Header Section */}
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div>
          <h1 className="text-base font-bold text-slate-900 leading-tight">Expense Management</h1>
          <p className="text-slate-500 text-[9px]">Track and manage your daily pharmacy expenses.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 shadow-sm">
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Total</p>
            <p className="text-sm font-black text-red-600">{formatCurrency(totalExpense)}</p>
          </div>
          <button 
            onClick={() => setIsFormOpen(!isFormOpen)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1.5 transition-all shadow-md"
          >
            {isFormOpen ? <X size={14} /> : <Plus size={14} />}
            {isFormOpen ? 'Cancel' : 'Add'}
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white p-1.5 border-x border-slate-200 flex items-center justify-between shrink-0 no-print">
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-[150px]">
            <Filter className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <select 
              className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all appearance-none"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
            >
              <option>All Categories</option>
              {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
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
        {/* Add Expense Form */}
        {isFormOpen && (
          <div className="w-64 bg-white p-3 rounded-lg border border-slate-200 shadow-sm shrink-0 overflow-y-auto no-scrollbar">
            <h2 className="font-bold text-slate-900 mb-2 text-[11px] flex items-center gap-1.5">
              <Plus size={14} className="text-blue-600" />
              New Expense
            </h2>
            <form onSubmit={handleAddExpense} onKeyDown={handleFormKeyDown} className="space-y-2">
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Name</label>
                <input 
                  type="text"
                  placeholder="e.g. Electricity"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Category</label>
                <select 
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  {EXPENSE_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Amount</label>
                <div className="relative">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold"></span>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full pl-7 pr-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all font-bold"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Date</label>
                <input 
                  type="date"
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Notes</label>
                <textarea 
                  placeholder="Details..."
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-blue-500 outline-none transition-all h-12 resize-none"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
              <div className="pt-1 flex gap-1.5">
                <button 
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-1 rounded text-[10px] font-bold transition-all"
                >
                  Add
                </button>
                <button 
                  type="button"
                  onClick={() => setFormData({ name: '', category: 'Other', amount: '', date: new Date().toISOString().split('T')[0], notes: '' })}
                  className="px-2 bg-slate-100 hover:bg-slate-200 text-slate-600 py-1 rounded text-[10px] font-bold transition-all"
                >
                  Clear
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Expense Table */}
        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div ref={tableContainerRef} className="overflow-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-slate-50 text-slate-500 text-[9px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-3 py-1.5">Date</th>
                  <th className="px-3 py-1.5">Expense</th>
                  <th className="px-3 py-1.5">Category</th>
                  <th className="px-3 py-1.5 text-right">Amount</th>
                  <th className="px-3 py-1.5 text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {expenses?.map((exp, rowIndex) => (
                  <tr key={exp.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-[10px]">{new Date(exp.date).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <p className="text-[10px] font-bold text-slate-900 leading-tight">{exp.name}</p>
                    </td>
                    <td className="px-3 py-1.5 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[8px] font-bold uppercase tracking-wider">
                        {exp.category}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-right outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <p className="text-[10px] font-black text-red-600">{formatCurrency(exp.amount)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-center no-print outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                      <button 
                        onClick={() => initiateDelete(exp.id!)}
                        className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {(!expenses || expenses.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <Wallet size={40} strokeWidth={1} />
                        <p className="text-sm italic">No expenses found for the selected category.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
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
                Are you sure you want to delete the expense: <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? This action cannot be undone.
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
      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <Save size={14} /> : <AlertCircle size={14} />}
          <p className="text-[11px] font-bold">{toast.message}</p>
        </div>
      )}

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
    </div>
  );
};
