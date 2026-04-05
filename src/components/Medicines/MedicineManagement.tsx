import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { Plus, Search, Filter, Edit2, Trash2, Image as ImageIcon, AlertCircle, X, Save } from 'lucide-react';
import { formatCurrency, cn } from '@/src/utils/utils';
import { useRef } from 'react';

export const MedicineManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMedicine, setEditingMedicine] = useState<Medicine | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | 'all'>('all');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const initialFormValues = {
    code: '',
    name: '',
    categoryId: 1,
    stockQuantity: 0,
    minStockLimit: 10,
    purchasePrice: 0,
    salePrice: 0,
    expiryDate: '',
    batchNumber: ''
  };

  const [formValues, setFormValues] = useState(initialFormValues);

  const isSavingRef = useRef(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const medicines = useLiveQuery(() => 
    db.medicines.toArray()
  );
  const categories = useLiveQuery(() => db.categories.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const filteredMedicines = React.useMemo(() => {
    if (!medicines) return [];
    return [...medicines]
      .sort((a, b) => (b.id || 0) - (a.id || 0))
      .filter(m => {
        const matchesSearch = m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             m.code.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = filterCategory === 'all' || m.categoryId === filterCategory;
        return matchesSearch && matchesCategory;
      });
  }, [medicines, searchQuery, filterCategory]);

  React.useEffect(() => {
    if (editingMedicine) {
      setFormValues({
        code: editingMedicine.code || '',
        name: editingMedicine.name || '',
        categoryId: editingMedicine.categoryId || 1,
        stockQuantity: editingMedicine.stockQuantity || 0,
        minStockLimit: editingMedicine.minStockLimit || 0,
        purchasePrice: editingMedicine.purchasePrice || 0,
        salePrice: editingMedicine.salePrice || 0,
        expiryDate: editingMedicine.expiryDate || '',
        batchNumber: editingMedicine.batchNumber || ''
      });
    }
  }, [editingMedicine]);

  const handleCodeChange = (code: string) => {
    if (code === '') {
      setEditingMedicine(null);
      setFormValues(initialFormValues);
      return;
    }

    if (editingMedicine && editingMedicine.code !== code) {
      setEditingMedicine(null);
      setFormValues({ ...initialFormValues, code });
    } else {
      setFormValues(prev => ({ ...prev, code }));
    }
  };

  const handleNameChange = (name: string) => {
    if (name === '') {
      setEditingMedicine(null);
      setFormValues(initialFormValues);
      return;
    }

    if (editingMedicine && editingMedicine.name !== name) {
      setEditingMedicine(null);
      setFormValues({ ...initialFormValues, name });
    } else {
      setFormValues(prev => ({ ...prev, name }));
    }
  };

  const handleFetchMedicine = async (e: React.KeyboardEvent, type: 'code' | 'name') => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = type === 'code' ? formValues.code : formValues.name;
      if (!value) return;

      const existing = await db.medicines.where(type).equals(value).first();
      if (existing) {
        setEditingMedicine(existing);
        setToast({ message: 'Medicine data fetched successfully', type: 'success' });
        setTimeout(() => setToast(null), 2000);
        
        // Move to next field after fetch
        const nextFieldName = type === 'code' ? 'name' : 'categoryId';
        const nextInput = document.querySelector(`[name="${nextFieldName}"]`);
        if (nextInput) (nextInput as HTMLElement).focus();
      } else {
        setEditingMedicine(null);
        // Do NOT clear the input, just move to next field
        setToast({ message: 'New Medicine – Please enter details', type: 'success' });
        setTimeout(() => setToast(null), 2000);
        
        const nextFieldName = type === 'code' ? 'name' : 'categoryId';
        const nextInput = document.querySelector(`[name="${nextFieldName}"]`);
        if (nextInput) (nextInput as HTMLElement).focus();
      }
    }
  };

  const handleFieldKeyDown = (e: React.KeyboardEvent, currentField: string) => {
    if (e.key === 'Enter') {
      // Special handling for code and name is already in handleFetchMedicine
      if (currentField === 'code' || currentField === 'name') return;
      
      e.preventDefault();
      const fields = [
        'code', 'name', 'categoryId', 'stockQuantity', 
        'minStockLimit', 'purchasePrice', 'salePrice', 
        'expiryDate', 'batchNumber'
      ];
      const currentIndex = fields.indexOf(currentField);
      
      if (currentIndex !== -1 && currentIndex < fields.length - 1) {
        const nextFieldName = fields[currentIndex + 1];
        const nextInput = document.querySelector(`[name="${nextFieldName}"]`);
        if (nextInput) (nextInput as HTMLElement).focus();
      } else if (currentField === 'batchNumber') {
        // Trigger save on Enter from Batch Number
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }
    }
  };

  const initiateDelete = async (id: number) => {
    const med = await db.medicines.get(id);
    if (!med) return;

    // Check if medicine is used in any invoices or purchases
    const usedInInvoices = await db.invoices.filter(inv => inv.items.some(item => item.medicineId === id)).count();
    const usedInPurchases = await db.purchases.filter(p => p.items.some(item => item.medicineId === id)).count();

    let message = `Are you sure you want to delete ${med.name}?`;
    if (usedInInvoices > 0 || usedInPurchases > 0) {
      message = `This medicine is used in ${usedInInvoices} invoices and ${usedInPurchases} purchases. Deleting it may cause issues in reports. Are you sure you want to delete it permanently?`;
    }

    setDeleteConfirm({ id, name: med.name, message });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.medicines.delete(deleteConfirm.id);
      await logActivity('Medicine deleted', `Deleted medicine: ${deleteConfirm.name}`);
      setToast({ message: 'Medicine deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete medicine:", error);
      setToast({ message: 'Error deleting medicine', type: 'error' });
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

  const handleRowKeyDown = (e: React.KeyboardEvent, med: Medicine) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (med.id) initiateDelete(med.id);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSavingRef.current) return;
    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const form = e.currentTarget;
      let finalCode = formValues.code;

      // Auto-generate code if empty
      if (!finalCode) {
        const allMeds = await db.medicines.toArray();
        const codes = allMeds.map(m => m.code).filter(c => c.startsWith('MED-'));
        let nextNum = 1;
        if (codes.length > 0) {
          const nums = codes.map(c => parseInt(c.replace('MED-', ''))).filter(n => !isNaN(n));
          if (nums.length > 0) {
            nextNum = Math.max(...nums) + 1;
          }
        }
        finalCode = `MED-${nextNum.toString().padStart(3, '0')}`;
      }

      // Check if this code already exists for ANOTHER medicine
      const existingByCode = await db.medicines.where('code').equals(finalCode).first();
      
      const medicineData: any = {
        code: finalCode,
        name: formValues.name,
        categoryId: Number(formValues.categoryId),
        purchasePrice: Number(formValues.purchasePrice),
        salePrice: Number(formValues.salePrice),
        minStockLimit: Number(formValues.minStockLimit),
        stockQuantity: Number(formValues.stockQuantity),
        genericName: '',
        companyName: '',
        supplierName: '',
        batchNumber: formValues.batchNumber,
        barcode: finalCode,
        expiryDate: formValues.expiryDate,
        supplierId: 1,
        notes: '',
      };

      if (editingMedicine?.id) {
        // We are explicitly editing a medicine
        await db.medicines.update(editingMedicine.id, medicineData);
        await logActivity('Medicine edited', `Edited medicine: ${medicineData.name}`);
        setToast({ message: 'Medicine updated successfully', type: 'success' });
      } else if (existingByCode) {
        // Code exists but we weren't "editing" - update the existing one instead of creating duplicate
        await db.medicines.update(existingByCode.id!, medicineData);
        await logActivity('Medicine updated', `Updated existing medicine via code match: ${medicineData.name}`);
        setToast({ message: 'Existing medicine updated', type: 'success' });
      } else {
        // Truly new medicine
        await db.medicines.add(medicineData);
        await logActivity('Medicine added', `Added new medicine: ${medicineData.name}`);
        setToast({ message: 'Medicine added successfully', type: 'success' });
      }

      setEditingMedicine(null);
      setFormValues(initialFormValues);
      
      // Focus back to first field
      const firstInput = form.querySelector('input');
      if (firstInput) (firstInput as HTMLInputElement).focus();
    } catch (error) {
      console.error("Failed to save medicine:", error);
      setToast({ message: 'Error saving medicine', type: 'error' });
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
      setTimeout(() => setToast(null), 3000);
    }
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
      // F10: Focus first input
      else if (e.key === 'F10') {
        e.preventDefault();
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
          <h1 className="text-base font-bold text-slate-900 leading-tight">Medicine Management</h1>
          <p className="text-slate-500 text-[9px]">Add and manage your pharmacy inventory.</p>
        </div>
      </div>

      <div className="bg-white p-3 border-x border-b border-slate-200 rounded-b-lg shadow-sm shrink-0">
        <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-2">
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Medicine Code *</label>
              <input 
                name="code" 
                value={formValues.code}
                onChange={(e) => handleCodeChange(e.target.value)}
                onKeyDown={(e) => handleFetchMedicine(e, 'code')}
                placeholder="Press Enter to fetch"
                required 
                autoFocus
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Medicine Name *</label>
              <input 
                name="name" 
                value={formValues.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onKeyDown={(e) => handleFetchMedicine(e, 'name')}
                placeholder="Press Enter to fetch"
                required 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Category *</label>
              <select 
                name="categoryId" 
                value={formValues.categoryId}
                onChange={(e) => setFormValues(prev => ({ ...prev, categoryId: Number(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'categoryId')}
                required 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none"
              >
                {categories?.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Stock *</label>
              <input 
                type="number" 
                name="stockQuantity" 
                value={formValues.stockQuantity}
                onChange={(e) => setFormValues(prev => ({ ...prev, stockQuantity: Number(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'stockQuantity')}
                required 
                min="0" 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Min Stock Limit *</label>
              <input 
                type="number" 
                name="minStockLimit" 
                value={formValues.minStockLimit}
                onChange={(e) => setFormValues(prev => ({ ...prev, minStockLimit: Number(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'minStockLimit')}
                required 
                min="0" 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Purchase Price *</label>
              <input 
                type="number" 
                step="0.01" 
                name="purchasePrice" 
                value={formValues.purchasePrice}
                onChange={(e) => setFormValues(prev => ({ ...prev, purchasePrice: Number(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'purchasePrice')}
                required 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Sale Price *</label>
              <input 
                type="number" 
                step="0.01" 
                name="salePrice" 
                value={formValues.salePrice}
                onChange={(e) => setFormValues(prev => ({ ...prev, salePrice: Number(e.target.value) }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'salePrice')}
                required 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Expiry Date *</label>
              <input 
                type="date" 
                name="expiryDate" 
                value={formValues.expiryDate}
                onChange={(e) => setFormValues(prev => ({ ...prev, expiryDate: e.target.value }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'expiryDate')}
                required 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
            <div>
              <label className="block text-[9px] font-bold text-slate-500 mb-0.5 uppercase">Batch Number</label>
              <input 
                name="batchNumber" 
                value={formValues.batchNumber}
                onChange={(e) => setFormValues(prev => ({ ...prev, batchNumber: e.target.value }))}
                onKeyDown={(e) => handleFieldKeyDown(e, 'batchNumber')}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none" 
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingMedicine && (
              <button 
                type="button" 
                onClick={() => setEditingMedicine(null)}
                className="px-3 py-1 text-[10px] font-bold text-slate-600 hover:bg-slate-100 rounded transition-colors"
              >
                Cancel
              </button>
            )}
            <button 
              type="submit"
              disabled={isSaving}
              className={cn(
                "px-4 py-1 text-[10px] font-bold text-white rounded transition-all shadow-sm flex items-center gap-1.5",
                isSaving ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700"
              )}
            >
              {isSaving ? (
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Save size={12} />
              )}
              {editingMedicine ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      {/* Filters & Table */}
      <div className="flex-1 flex flex-col gap-2 overflow-hidden min-h-[300px]">
        <div className="bg-white p-1.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-4 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 w-3 h-3" />
            <input
              type="text"
              placeholder="Search medicines..."
              className="w-full pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded text-[11px] focus:ring-1 focus:ring-emerald-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div ref={tableContainerRef} className="flex-1 overflow-auto">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-slate-50 z-10">
                <tr className="text-slate-500 text-[9px] uppercase tracking-wider font-bold border-b border-slate-200">
                  <th className="px-3 py-1.5">Code</th>
                  <th className="px-3 py-1.5">Name</th>
                  <th className="px-3 py-1.5">Category</th>
                  <th className="px-3 py-1.5 text-center">Stock</th>
                  <th className="px-3 py-1.5 text-center">Min Stock</th>
                  <th className="px-3 py-1.5 text-right">Purchase</th>
                  <th className="px-3 py-1.5 text-right">Sale</th>
                  <th className="px-3 py-1.5 text-center">Expiry</th>
                  <th className="px-3 py-1.5">Batch</th>
                  <th className="px-3 py-1.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMedicines?.map((med, rowIndex) => (
                  <tr 
                    key={med.id} 
                    className="hover:bg-slate-50/50 transition-colors group outline-none focus:bg-blue-50"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      handleTableKeyDown(e, rowIndex);
                      handleRowKeyDown(e, med);
                    }}
                  >
                    <td className="px-3 py-1.5">
                      <p className="text-[9px] font-mono text-slate-500">{med.code}</p>
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="text-[10px] font-bold text-slate-900 leading-tight">{med.name}</p>
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="text-[9px] text-slate-500">
                        {categories?.find(c => c.id === med.categoryId)?.name || 'Uncategorized'}
                      </p>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn(
                        "text-[10px] font-bold px-1.5 py-0.5 rounded",
                        med.stockQuantity <= med.minStockLimit ? "bg-red-50 text-red-600" : "text-slate-900"
                      )}>
                        {med.stockQuantity}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <p className="text-[9px] text-slate-500">{med.minStockLimit}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <p className="text-[9px] text-slate-500">{med.purchasePrice.toFixed(2)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <p className="text-[10px] font-bold text-emerald-600">{med.salePrice.toFixed(2)}</p>
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={cn(
                        "text-[9px] px-1.5 py-0.5 rounded",
                        new Date(med.expiryDate) <= new Date(new Date().setMonth(new Date().getMonth() + 3)) 
                          ? "bg-orange-50 text-orange-600 font-bold" 
                          : "text-slate-500"
                      )}>
                        {med.expiryDate}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <p className="text-[9px] font-mono text-slate-500">{med.batchNumber}</p>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingMedicine(med);
                          }}
                          className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            med.id && initiateDelete(med.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredMedicines?.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-slate-400 text-[10px] italic">No medicines found.</td>
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
