import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Customer, logActivity } from '@/src/db/db';
import { Plus, Edit2, Trash2, Search, Phone, MapPin, History, Save, AlertCircle, Printer, X } from 'lucide-react';
import { cn, formatCurrency, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { useKeyboardNavigation } from '@/src/hooks/useKeyboardNavigation';

export const CustomerManagement = () => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [printData, setPrintData] = useState<any>(null);

  const customers = useLiveQuery(() => db.customers.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const handlePrint = () => {
    if (!filteredCustomers || filteredCustomers.length === 0) return;
    const dataToPrint = filteredCustomers.map(c => ({
      name: c.name,
      phone: c.phone,
      address: c.address || '-',
      balance: c.balance || 0
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
    
    // Use global printTemplate
    printTemplate('print-container', 'Customer List Report');
  };

  const filteredCustomers = customers?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.phone.includes(searchQuery)
  );

  const initiateDelete = async (id: number) => {
    const cust = await db.customers.get(id);
    if (!cust) return;

    // Check if customer has any invoices or returns
    const invoiceCount = await db.invoices.where('customerId').equals(id).count();
    const returnCount = await db.returns.where('customerName').equals(cust.name).count();

    let message = `Are you sure you want to delete customer: ${cust.name}?`;
    if (invoiceCount > 0 || returnCount > 0) {
      message = `This customer has ${invoiceCount} invoices and ${returnCount} returns. Deleting will remove them permanently. Are you sure?`;
    }

    setDeleteConfirm({ id, name: cust.name, message });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.customers, db.invoices, db.returns, db.dues, db.activityLogs], async () => {
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
      setToast({ message: 'Customer and related records deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete customer:", error);
      setToast({ message: 'Error deleting customer', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsProcessing(false);
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      phone: formData.get('phone') as string,
      address: formData.get('address') as string,
      balance: editingCustomer?.balance || 0,
    };

    if (editingCustomer?.id) {
      await db.customers.update(editingCustomer.id, data);
      await logActivity('Customer edited', `Edited customer: ${data.name}`);
    } else {
      await db.customers.add(data);
      await logActivity('Customer added', `Added new customer: ${data.name}`);
    }
    setIsFormOpen(false);
    setEditingCustomer(null);
  };

  return (
    <div className="min-h-full space-y-6 bg-[#F0F2F5] p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm">Manage your regular customers and their purchase history.</p>
        </div>
        <div className="flex items-center gap-2">
          {!isFormOpen && (
            <>
              <button 
                onClick={() => { setEditingCustomer(null); setIsFormOpen(true); }}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
              >
                <Plus size={20} />
                Add Customer
              </button>
            </>
          )}
        </div>
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">{editingCustomer ? 'Edit Customer' : 'Add New Customer'}</h2>
            <button onClick={() => { setIsFormOpen(false); setEditingCustomer(null); }} className="text-slate-400 hover:text-slate-600">
              <Trash2 size={20} className="rotate-45" />
            </button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Customer Name *</label>
              <input name="name" defaultValue={editingCustomer?.name} required autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Phone Number *</label>
              <input name="phone" defaultValue={editingCustomer?.phone} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl shadow-lg shadow-emerald-100 transition-all">
                {editingCustomer ? 'Update' : 'Save'}
              </button>
              <button type="button" onClick={() => { setIsFormOpen(false); setEditingCustomer(null); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Address</label>
              <input name="address" defaultValue={editingCustomer?.address} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search customers by name or phone..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
              <th className="px-6 py-4 font-semibold">Customer Name</th>
              <th className="px-6 py-4 font-semibold">Phone Number</th>
              <th className="px-6 py-4 font-semibold">Address</th>
              <th className="px-6 py-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredCustomers?.map(cust => (
              <tr key={cust.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {cust.name.charAt(0)}
                    </div>
                    <span className="text-sm font-bold text-slate-900">{cust.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone size={14} className="text-slate-400" />
                    {cust.phone}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin size={14} className="text-slate-400" />
                    <span className="truncate max-w-[200px]">{cust.address || 'N/A'}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg" title="View History">
                      <History size={16} />
                    </button>
                    <button onClick={() => { setEditingCustomer(cust); setIsFormOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => cust.id && initiateDelete(cust.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

      {/* Hidden Print Layout (for window.print) */}
      <div className="hidden">
        {printData && (
          <Receipt 
            id="print-container"
            type="Customer List Report"
            items={printData.items?.map((item: any) => ({
              name: item.name,
              qty: item.phone,
              price: 0,
              discount: item.address,
              total: item.balance
            })) || []}
            summary={printData.summary}
            settings={settings}
          />
        )}
      </div>
    </div>
  );
};
