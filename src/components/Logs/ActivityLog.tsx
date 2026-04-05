import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { Clock, Search, Filter, Trash2, AlertCircle, Save } from 'lucide-react';
import { cn } from '@/src/utils/utils';

export const ActivityLog = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAction, setFilterAction] = useState<string>('all');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const logs = useLiveQuery(() => 
    db.activityLogs.orderBy('timestamp').reverse().toArray()
  );

  const actions = Array.from(new Set(logs?.map(log => log.action) || []));

  const filteredLogs = logs?.filter(log => {
    const matchesSearch = log.details.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         log.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAction = filterAction === 'all' || log.action === filterAction;
    return matchesSearch && matchesAction;
  });

  const confirmClearLogs = async () => {
    try {
      await db.activityLogs.clear();
      setToast({ message: 'Activity logs cleared successfully', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error("Failed to clear logs:", error);
      setToast({ message: 'Error clearing logs', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsClearConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Activity Log</h1>
          <p className="text-slate-500 text-sm">Monitor all system activities and user actions.</p>
        </div>
        <button 
          onClick={() => setIsClearConfirmOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-all text-sm font-bold border border-red-100"
        >
          <Trash2 size={18} />
          Clear All Logs
        </button>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
            <input 
              placeholder="Search logs by action or details..."
              className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={18} className="text-slate-400" />
            <select 
              className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              value={filterAction}
              onChange={(e) => setFilterAction(e.target.value)}
            >
              <option value="all">All Actions</option>
              {actions.map(action => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-100">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-bold">Timestamp</th>
                <th className="px-6 py-4 font-bold">Action</th>
                <th className="px-6 py-4 font-bold">Details</th>
                <th className="px-6 py-4 font-bold">User</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredLogs?.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-slate-500 whitespace-nowrap">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      log.action.includes('added') || log.action.includes('created') ? "bg-emerald-100 text-emerald-700" :
                      log.action.includes('deleted') ? "bg-red-100 text-red-700" :
                      log.action.includes('edited') ? "bg-blue-100 text-blue-700" :
                      "bg-slate-100 text-slate-700"
                    )}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {log.details}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-slate-900">
                    Admin
                  </td>
                </tr>
              ))}
              {(!filteredLogs || filteredLogs.length === 0) && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Clock size={48} strokeWidth={1} />
                      <p className="text-sm italic">No activity logs found</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex gap-3">
        <AlertCircle className="text-amber-600 shrink-0" size={20} />
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Security Note:</strong> Activity logs are stored locally in your browser's database. Clearing logs will permanently remove them from this device.
        </p>
      </div>

      {/* Clear Confirmation Modal */}
      {isClearConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 px-4 py-3 text-white flex items-center gap-2">
              <Trash2 size={18} />
              <h3 className="font-bold text-base">Clear All Logs</h3>
            </div>
            <div className="p-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                Are you sure you want to clear all activity logs? <span className="font-bold text-red-600 underline">This action cannot be undone.</span>
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setIsClearConfirmOpen(false);
                }}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmClearLogs}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md"
              >
                Clear All
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
