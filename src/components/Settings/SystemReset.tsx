import React, { useState } from 'react';
import { db, logActivity } from '@/src/db/db';
import { Trash2, AlertTriangle, RefreshCw, CheckCircle2, X, AlertCircle } from 'lucide-react';
import { cn } from '@/src/utils/utils';

export const SystemReset = () => {
  const [showModal, setShowModal] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const [options, setOptions] = useState({
    keepMedicines: true,
    keepParties: true, // Suppliers & Customers
  });

  const handleReset = async () => {
    if (confirmText !== 'RESET') {
      showToast('Please type RESET to confirm', 'error');
      return;
    }

    setIsResetting(true);
    try {
      // 1. Clear Transactional Data
      await db.invoices.clear();
      await db.purchases.clear();
      await db.returns.clear();
      await db.dues.clear();
      await db.supplierPayments.clear();
      await db.expenses.clear();
      await db.activityLogs.clear();

      // 2. Handle Medicines
      if (!options.keepMedicines) {
        await db.medicines.clear();
      }

      // 3. Handle Suppliers & Customers
      if (options.keepParties) {
        // Reset balances but keep records
        await db.suppliers.toCollection().modify({ 
          currentBalance: 0
        });
        await db.customers.toCollection().modify({ 
          balance: 0 
        });
      } else {
        await db.suppliers.clear();
        await db.customers.clear();
      }

      // 4. Reset Settings counters
      const settings = await db.settings.toCollection().first();
      if (settings?.id) {
        await db.settings.update(settings.id, {
          lastInvoiceNumber: 0,
          lastSalesInvoiceNumber: 0,
          lastPurchaseInvoiceNumber: 0
        });
      }

      await logActivity('System Reset', 'Full system data reset performed');
      setResetComplete(true);
      
      // Reload page after a short delay to refresh all states
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (error) {
      console.error('Reset failed:', error);
      showToast('System reset failed. Please check console for details.', 'error');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm space-y-2">
      <div className="flex items-center gap-2 mb-0.5">
        <div className="p-1 bg-red-50 text-red-600 rounded">
          <RefreshCw size={14} />
        </div>
        <h2 className="text-xs font-bold text-slate-900">System Maintenance</h2>
      </div>
      
      <div className="p-2 bg-red-50/50 border border-red-100 rounded-lg flex items-center justify-between gap-3">
        <div className="flex gap-2 items-center">
          <AlertTriangle className="text-red-500 shrink-0" size={14} />
          <p className="text-[9px] text-red-700 leading-tight max-w-[200px]">
            Resetting will permanently delete all transactional history. This action cannot be undone.
          </p>
        </div>
        
        <button 
          onClick={() => setShowModal(true)}
          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-[9px] font-bold transition-colors flex items-center gap-1.5 shadow-sm shrink-0"
        >
          <Trash2 size={12} />
          Reset System
        </button>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
            {/* Modal Header */}
            <div className="bg-red-600 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-white">
                <AlertTriangle size={18} />
                <h3 className="font-bold text-sm">Confirm System Reset</h3>
              </div>
              <button onClick={(e) => {
                e.stopPropagation();
                !isResetting && setShowModal(false);
              }} className="text-white/80 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4">
              {!resetComplete ? (
                <>
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                    <AlertTriangle className="text-amber-600 shrink-0" size={20} />
                    <p className="text-[11px] text-amber-800 leading-relaxed">
                      You are about to clear all transactional data. This will reset your dashboard, reports, and accounts to zero.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reset Options</p>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={options.keepMedicines}
                          onChange={(e) => setOptions({...options, keepMedicines: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[11px] text-slate-700 group-hover:text-slate-900 transition-colors">Keep Medicine List (Recommended)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input 
                          type="checkbox" 
                          checked={options.keepParties}
                          onChange={(e) => setOptions({...options, keepParties: e.target.checked})}
                          className="w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-[11px] text-slate-700 group-hover:text-slate-900 transition-colors">Keep Supplier & Customer Records (Reset Balances)</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Type "RESET" to confirm</label>
                    <input 
                      type="text"
                      placeholder="Type RESET here"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-red-500 outline-none transition-all font-mono"
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowModal(false);
                      }}
                      disabled={isResetting}
                      className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleReset}
                      disabled={isResetting || confirmText !== 'RESET'}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold hover:bg-red-700 transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isResetting ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        <>
                          <Trash2 size={14} />
                          Confirm Reset
                        </>
                      )}
                    </button>
                  </div>
                </>
              ) : (
                <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center animate-bounce">
                    <CheckCircle2 size={32} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-slate-900">System Reset Successful</h4>
                    <p className="text-xs text-slate-500">The system is restarting to apply changes...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-4 right-4 z-[1000] animate-in slide-in-from-bottom-5 duration-300">
          <div className={cn(
            "px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 text-white font-bold text-xs",
            toast.type === 'success' ? "bg-emerald-600" : "bg-red-600"
          )}>
            {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
};
