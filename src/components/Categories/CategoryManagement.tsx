import React, { useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Category, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { Plus, Edit2, Trash2, Search, Tags, X, Save, AlertCircle } from 'lucide-react';
import { cn } from '@/src/utils/utils';

export const CategoryManagement = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string; message: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const categories = useLiveQuery(() => db.categories.toArray());
  const medicines = useLiveQuery(() => db.medicines.toArray());

  const filteredCategories = categories?.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initiateDelete = async (id: number) => {
    const cat = await db.categories.get(id);
    if (!cat) return;
    setDeleteConfirm({ 
      id, 
      name: cat.name, 
      message: `Are you sure you want to delete the category "${cat.name}"? This might affect medicines in this category.` 
    });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.categories.delete(deleteConfirm.id);
      await logActivity('Category deleted', `Deleted category: ${deleteConfirm.name}`);
      setToast({ message: 'Category deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete category:", error);
      setToast({ message: 'Error deleting category', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
    };

    if (editingCategory?.id) {
      await db.categories.update(editingCategory.id, data);
      await logActivity('Category edited', `Edited category: ${data.name}`);
    } else {
      await db.categories.add(data);
      await logActivity('Category added', `Added new category: ${data.name}`);
    }
    setIsFormOpen(false);
    setEditingCategory(null);
  };

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Medicine Categories</h1>
          <p className="text-slate-500 text-sm">Organize your medicines into logical groups.</p>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => { setEditingCategory(null); setIsFormOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm font-bold"
          >
            <Plus size={20} />
            Add Category
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">{editingCategory ? 'Edit Category' : 'Add New Category'}</h2>
            <button onClick={() => { setIsFormOpen(false); setEditingCategory(null); }} className="text-slate-400 hover:text-slate-600">
              <X size={20} />
            </button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Category Name *</label>
              <input name="name" defaultValue={editingCategory?.name} required autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="md:col-span-1">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Description</label>
              <input name="description" defaultValue={editingCategory?.description} className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl shadow-lg shadow-emerald-100 transition-all flex items-center justify-center gap-2">
                <Save size={18} />
                {editingCategory ? 'Update' : 'Save'}
              </button>
              <button type="button" onClick={() => { setIsFormOpen(false); setEditingCategory(null); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search categories..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div ref={tableContainerRef} className="flex-1 overflow-y-auto no-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-slate-500 text-[10px] uppercase tracking-wider font-bold border-b border-slate-200">
                <th className="px-6 py-4">Category Name</th>
                <th className="px-6 py-4">Medicines</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCategories?.map((cat, rowIndex) => (
                <tr key={cat.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Tags size={16} />
                      </div>
                      <span className="text-sm font-bold text-slate-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    <div className="flex flex-wrap gap-1">
                      {medicines?.filter(m => m.categoryId === cat.id).map(m => (
                        <span key={m.id} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px] font-medium">
                          {m.name}
                        </span>
                      ))}
                      {medicines?.filter(m => m.categoryId === cat.id).length === 0 && (
                        <span className="text-slate-400 text-[10px] italic">No medicines</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right outline-none focus:bg-blue-50" tabIndex={0} onKeyDown={(e) => handleTableKeyDown(e, rowIndex)}>
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => { setEditingCategory(cat); setIsFormOpen(true); }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button 
                        onClick={() => cat.id && initiateDelete(cat.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {(!filteredCategories || filteredCategories.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-6 py-20 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Tags size={40} strokeWidth={1} />
                      <p className="text-sm italic">No categories found.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
