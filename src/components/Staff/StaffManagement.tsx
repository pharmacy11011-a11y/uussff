import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Staff, logActivity } from '@/src/db/db';
import { Plus, Search, Trash2, UserSquare, Phone, Mail, MapPin, Calendar, DollarSign, X, Edit2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatCurrency, cn } from '@/src/utils/utils';

import { useKeyboardNavigation } from '@/src/hooks/useKeyboardNavigation';

export const StaffManagement = () => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    role: 'Pharmacist',
    salary: '',
    joiningDate: new Date().toISOString().split('T')[0]
  });

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const staffList = useLiveQuery(() => {
    if (searchQuery) {
      return db.staff.filter(s => s.name.toLowerCase().includes(searchQuery.toLowerCase())).toArray();
    }
    return db.staff.toArray();
  }, [searchQuery]);

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) return;

    try {
      const staffData = {
        name: formData.name,
        phone: formData.phone,
        email: formData.email,
        address: formData.address,
        role: formData.role,
        salary: parseFloat(formData.salary) || 0,
        joiningDate: formData.joiningDate
      };

      if (editingStaff?.id) {
        await db.staff.update(editingStaff.id, staffData);
        await logActivity('Staff updated', `Updated staff: ${formData.name}`);
        showToast('Staff member updated successfully');
      } else {
        await db.staff.add(staffData);
        await logActivity('Staff added', `Added new staff: ${formData.name}`);
        showToast('Staff member added successfully');
      }

      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        role: 'Pharmacist',
        salary: '',
        joiningDate: new Date().toISOString().split('T')[0]
      });
      setEditingStaff(null);
      setIsFormOpen(false);
    } catch (error) {
      console.error('Failed to save staff:', error);
      showToast('Failed to save staff member', 'error');
    }
  };

  const handleEdit = (staff: Staff) => {
    setEditingStaff(staff);
    setFormData({
      name: staff.name || '',
      phone: staff.phone || '',
      email: staff.email || '',
      address: staff.address || '',
      role: staff.role || 'Pharmacist',
      salary: staff.salary?.toString() || '',
      joiningDate: staff.joiningDate || new Date().toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const initiateDelete = (staff: Staff) => {
    setDeleteConfirm({ id: staff.id!, name: staff.name });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.staff.delete(deleteConfirm.id);
      await logActivity('Staff deleted', `Deleted staff: ${deleteConfirm.name}`);
      showToast('Staff member deleted successfully');
    } catch (error) {
      console.error('Failed to delete staff:', error);
      showToast('Failed to delete staff member', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  return (
    <div className="h-full flex flex-col gap-6 overflow-hidden">
      {/* Header Section */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Staff Management</h1>
          <p className="text-slate-500 text-sm">Manage employee records, roles, and salaries.</p>
        </div>
        <button 
          onClick={() => {
            setIsFormOpen(!isFormOpen);
            if (isFormOpen) {
              setEditingStaff(null);
              setFormData({ name: '', phone: '', email: '', address: '', role: 'Pharmacist', salary: '', joiningDate: new Date().toISOString().split('T')[0] });
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-100"
        >
          {isFormOpen ? <X size={18} /> : <Plus size={18} />}
          {isFormOpen ? 'Cancel' : 'Add Staff Member'}
        </button>
      </div>

      {/* Search Section */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4 shrink-0 no-print">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text"
            placeholder="Search staff by name..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-0">
        {/* Form Section */}
        {isFormOpen && (
          <div className="w-96 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm shrink-0 overflow-y-auto no-scrollbar">
            <h2 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              {editingStaff ? <Edit2 size={18} className="text-blue-600" /> : <Plus size={18} className="text-blue-600" />}
              {editingStaff ? 'Edit Staff Member' : 'New Staff Member'}
            </h2>
            <form onSubmit={handleSaveStaff} onKeyDown={handleFormKeyDown} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Full Name *</label>
                <input 
                  type="text"
                  placeholder="Enter full name..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Mobile Number *</label>
                  <input 
                    type="text"
                    placeholder="03xx-xxxxxxx"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Role</label>
                  <select 
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="Pharmacist">Pharmacist</option>
                    <option value="Staff">Staff</option>
                    <option value="Manager">Manager</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Email Address</label>
                <input 
                  type="email"
                  placeholder="email@example.com"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Home Address</label>
                <textarea 
                  placeholder="Enter full address..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all h-20 resize-none"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Salary (PKR)</label>
                  <input 
                    type="number"
                    placeholder="0.00"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-bold"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Joining Date</label>
                  <input 
                    type="date"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    value={formData.joiningDate}
                    onChange={(e) => setFormData({ ...formData, joiningDate: e.target.value })}
                  />
                </div>
              </div>
              <div className="pt-4">
                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-blue-100"
                >
                  {editingStaff ? 'Update Staff Member' : 'Save Staff Member'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Table Section */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-white z-10">
                <tr className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Staff Member</th>
                  <th className="px-6 py-4">Contact Info</th>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Salary</th>
                  <th className="px-6 py-4">Joining Date</th>
                  <th className="px-6 py-4 text-center no-print">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {staffList?.map((staff) => (
                  <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center font-bold">
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{staff.name}</p>
                          <div className="flex items-center gap-1 text-slate-400 mt-0.5">
                            <MapPin size={10} />
                            <span className="text-[10px] truncate max-w-[150px]">{staff.address || 'No address'}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 text-slate-600">
                          <Phone size={12} className="text-slate-400" />
                          <span className="text-xs">{staff.phone}</span>
                        </div>
                        {staff.email && (
                          <div className="flex items-center gap-2 text-slate-600">
                            <Mail size={12} className="text-slate-400" />
                            <span className="text-xs">{staff.email}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold uppercase tracking-wider">
                        {staff.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black text-slate-900">{formatCurrency(staff.salary || 0)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-slate-600">
                        <Calendar size={14} className="text-slate-400" />
                        <span className="text-xs">{new Date(staff.joiningDate).toLocaleDateString()}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center no-print">
                      <div className="flex items-center justify-center gap-2">
                        <button 
                          onClick={() => handleEdit(staff)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button 
                          onClick={() => initiateDelete(staff)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(!staffList || staffList.length === 0) && (
                  <tr>
                    <td colSpan={6} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-2 text-slate-400">
                        <UserSquare size={40} strokeWidth={1} />
                        <p className="text-sm italic">No staff records found.</p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Delete Staff Member?</h3>
              <p className="text-slate-500 text-sm mb-6">
                Are you sure you want to delete <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setDeleteConfirm(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmDelete}
                  className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-red-100"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
