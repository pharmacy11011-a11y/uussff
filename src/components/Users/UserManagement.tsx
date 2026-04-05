import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type User, logActivity } from '@/src/db/db';
import { UserPlus, Shield, Edit2, Trash2, User as UserIcon, Key, Save, AlertCircle } from 'lucide-react';
import { cn } from '@/src/utils/utils';

import { useKeyboardNavigation } from '@/src/hooks/useKeyboardNavigation';

export const UserManagement = () => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; name: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const users = useLiveQuery(() => db.users.toArray());

  const initiateDelete = async (id: number) => {
    const user = users?.find(u => u.id === id);
    if (!user) return;
    
    if (user.username === 'admin') {
      setToast({ message: 'Cannot delete the main administrator account.', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }
    
    setDeleteConfirm({ id, name: user.username });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await db.users.delete(deleteConfirm.id);
      await logActivity('User deleted', `Deleted user account: ${deleteConfirm.name}`);
      setToast({ message: 'User deleted successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to delete user:", error);
      setToast({ message: 'Error deleting user', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setDeleteConfirm(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const data = {
      email: formData.get('email') as string,
      username: formData.get('username') as string,
      fullName: formData.get('fullName') as string,
      password: formData.get('password') as string,
      role: formData.get('role') as 'Admin' | 'Pharmacist' | 'Staff',
    };

    try {
      if (editingUser?.id) {
        await db.users.update(editingUser.id, data);
        await logActivity('User edited', `Edited user account: ${data.username}`);
        setToast({ message: 'User updated successfully', type: 'success' });
      } else {
        // Check if username or email already exists locally
        const existingUsername = await db.users.where('username').equalsIgnoreCase(data.username).first();
        const existingEmail = await db.users.where('email').equalsIgnoreCase(data.email).first();
        
        if (existingUsername) {
          setToast({ message: 'Username already exists locally', type: 'error' });
          setTimeout(() => setToast(null), 3000);
          return;
        }
        
        if (existingEmail) {
          setToast({ message: 'Email already exists locally', type: 'error' });
          setTimeout(() => setToast(null), 3000);
          return;
        }

        // Use put to avoid any potential duplicate key issues with id
        await db.users.put({
          ...data,
          status: 'active',
          createdAt: new Date().toISOString()
        });
        await logActivity('User added', `Added new user account: ${data.username}`);
        setToast({ message: 'User added successfully', type: 'success' });
      }
      setIsFormOpen(false);
      setEditingUser(null);
      setTimeout(() => setToast(null), 3000);
    } catch (error: any) {
      console.error("Failed to save user:", error);
      // Show the actual error message if available
      const errorMsg = error?.message || (typeof error === 'string' ? error : 'Database error saving new user');
      setToast({ message: errorMsg, type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
          <p className="text-slate-500 text-sm">Control access levels and manage staff accounts.</p>
        </div>
        {!isFormOpen && (
          <button 
            onClick={() => { setEditingUser(null); setIsFormOpen(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
          >
            <UserPlus size={20} />
            Add New User
          </button>
        )}
      </div>

      {isFormOpen && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900">{editingUser ? 'Edit User' : 'Add New User'}</h2>
            <button onClick={() => { setIsFormOpen(false); setEditingUser(null); }} className="text-slate-400 hover:text-slate-600">
              <Trash2 size={20} className="rotate-45" />
            </button>
          </div>
          <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Full Name *</label>
              <input name="fullName" defaultValue={editingUser?.fullName} required autoFocus className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Email *</label>
              <input type="email" name="email" defaultValue={editingUser?.email} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Username *</label>
              <input name="username" defaultValue={editingUser?.username} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Password *</label>
              <input type="password" name="password" defaultValue={editingUser?.password} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none" />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl shadow-lg shadow-emerald-100 transition-all">
                {editingUser ? 'Update' : 'Save'}
              </button>
              <button type="button" onClick={() => { setIsFormOpen(false); setEditingUser(null); }} className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all">
                Cancel
              </button>
            </div>
            <div className="md:col-span-5">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">Role *</label>
              <select name="role" defaultValue={editingUser?.role || 'Staff'} required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none">
                <option value="Staff">Staff (Limited Access)</option>
                <option value="Pharmacist">Pharmacist (Medicine & Billing)</option>
                <option value="Admin">Admin (Full Access)</option>
              </select>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {users?.map(user => (
          <div key={user.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 flex gap-1">
              <button onClick={() => { setEditingUser(user); setIsFormOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 size={16} /></button>
              <button onClick={() => user.id && initiateDelete(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16} /></button>
            </div>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={cn(
                "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold",
                user.role === 'Admin' ? "bg-indigo-100 text-indigo-700" : 
                user.role === 'Pharmacist' ? "bg-blue-100 text-blue-700" : 
                "bg-emerald-100 text-emerald-700"
              )}>
                {user.fullName.charAt(0)}
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">{user.fullName}</h3>
                <div className="flex items-center gap-1.5">
                  <span className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                    user.role === 'Admin' ? "bg-indigo-600 text-white" : 
                    user.role === 'Pharmacist' ? "bg-blue-600 text-white" : 
                    "bg-emerald-600 text-white"
                  )}>
                    {user.role}
                  </span>
                  <span className="text-xs text-slate-400">@{user.username}</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{user.email}</p>
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-slate-50">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Shield size={14} />
                  <span>Access Level</span>
                </div>
                <span className="font-bold text-slate-900">
                  {user.role === 'Admin' ? 'Full Access' : user.role === 'Pharmacist' ? 'Med & Billing' : 'Limited Access'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 text-slate-500">
                  <Key size={14} />
                  <span>Password</span>
                </div>
                <span className="text-slate-400">••••••••</span>
              </div>
            </div>
          </div>
        ))}
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
                Are you sure you want to delete the user account: <span className="font-bold text-slate-900">{deleteConfirm.name}</span>? This action cannot be undone.
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
