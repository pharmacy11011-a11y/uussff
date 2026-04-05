import React, { useState, useEffect } from 'react';
import { 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  Mail, 
  Calendar, 
  Clock,
  ShieldCheck,
  MoreVertical,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, User, logActivity } from '../../db/db';
import { useLiveQuery } from 'dexie-react-hooks';

export const AdminPanel: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'blocked'>('all');
  
  const users = useLiveQuery(
    () => db.users.toArray(),
    []
  );

  const handleToggleStatus = async (user: User) => {
    const newStatus = user.status === 'active' ? 'blocked' : 'active';
    await db.users.update(user.id!, { status: newStatus });
    await logActivity(
      'User Status Changed', 
      `User ${user.email} status changed to ${newStatus}`
    );
  };

  const filteredUsers = users?.filter(user => {
    const email = user.email || '';
    const fullName = user.fullName || '';
    const matchesSearch = email.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'all' || user.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Admin Control Panel</h1>
          <p className="text-slate-500 text-sm">Manage user access and monitor account status.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="bg-sky-50 text-sky-700 px-4 py-2 rounded-xl text-xs font-bold border border-sky-100 flex items-center gap-2">
            <ShieldCheck size={16} />
            Restricted Access
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <Users size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Users</p>
              <h3 className="text-2xl font-bold text-slate-900">{users?.length || 0}</h3>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl">
              <UserCheck size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Active Accounts</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {users?.filter(u => u.status === 'active').length || 0}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
              <UserX size={24} />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Blocked Accounts</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {users?.filter(u => u.status === 'blocked').length || 0}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Search by email or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-sky-500 outline-none transition-all"
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-slate-400 ml-2" />
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-sky-500 transition-all"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="blocked">Blocked Only</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">User Info</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest">Timestamps</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <AnimatePresence mode="popLayout">
                {filteredUsers?.map((user) => (
                  <motion.tr 
                    key={user.id}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 font-bold">
                          {user.fullName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-900">{user.fullName}</p>
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <Mail size={12} />
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        user.status === 'active' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-red-100 text-red-700'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          user.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'
                        }`} />
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <Calendar size={10} />
                          Joined: {new Date(user.createdAt).toLocaleDateString()}
                        </p>
                        {user.lastLogin && (
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <Clock size={10} />
                            Last Login: {new Date(user.lastLogin).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleToggleStatus(user)}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                            user.status === 'active'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                          }`}
                        >
                          {user.status === 'active' ? (
                            <div className="flex items-center gap-2">
                              <UserX size={14} />
                              Block User
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <UserCheck size={14} />
                              Activate User
                            </div>
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
        
        {filteredUsers?.length === 0 && (
          <div className="p-12 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-50 text-slate-300 mb-4">
              <Users size={32} />
            </div>
            <h3 className="text-slate-900 font-bold">No users found</h3>
            <p className="text-slate-500 text-sm">Try adjusting your search or filter.</p>
          </div>
        )}
      </div>
    </div>
  );
};
