import React, { useState, useEffect } from 'react';
import { db, logActivity } from '@/src/db/db';
import { supabase } from '@/src/lib/supabase';
import { 
  Database, 
  Download, 
  Upload, 
  RefreshCw, 
  AlertCircle, 
  Save, 
  Trash2,
  Cloud,
  CheckCircle,
  Link
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/utils/utils';
import { getAuthUrl, exchangeCodeForToken, uploadToDrive, listDriveFiles, downloadFromDrive } from '@/src/lib/googleDrive';

import { useGoogleSync } from '@/src/hooks/useGoogleSync';

export const BackupManagement = () => {
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  
  // Google Drive Sync Hook
  const { isSyncing, lastSyncTime, isConnected, performBackup, performRestore } = useGoogleSync();

  const isConnectingRef = React.useRef(false);

  useEffect(() => {
    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_CODE') {
        isConnectingRef.current = true;
        handleGoogleCallback(event.data.code);
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        isConnectingRef.current = true;
        setToast({ message: 'Connection Failed, try again', type: 'error' });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleGoogleCallback = async (code: string) => {
    try {
      const redirectUri = window.location.origin + '/auth-callback.html';
      const tokens = await exchangeCodeForToken(code, redirectUri);
      
      // Store tokens securely
      localStorage.setItem('google_drive_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokens.refresh_token);
      }
      
      setToast({ message: 'Google Drive Connected Successfully', type: 'success' });
      window.location.reload(); // Reload to trigger initial sync
    } catch (error) {
      console.error(error);
      setToast({ message: 'Connection Failed, try again', type: 'error' });
    } finally {
      isConnectingRef.current = false;
    }
  };

  const handleGoogleConnect = () => {
    if (isConnected) {
      setToast({ message: 'Already Connected', type: 'success' });
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      setToast({ message: 'Google Client ID not configured', type: 'error' });
      return;
    }
    const redirectUri = window.location.origin + '/auth-callback.html';
    const authUrl = getAuthUrl(clientId, redirectUri);
    
    // Open popup
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;
    const popup = window.open(authUrl, 'google_auth', `width=${width},height=${height},left=${left},top=${top}`);

    isConnectingRef.current = false;

    // Check if popup was closed without message
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        setTimeout(() => {
          if (!isConnectingRef.current && !localStorage.getItem('google_drive_token')) {
            setToast({ message: 'Connection Cancelled', type: 'error' });
          }
        }, 500);
      }
    }, 1000);
  };

  const handleGoogleBackup = async () => {
    if (!isConnected) return;
    try {
      await performBackup();
      setToast({ message: 'Backup uploaded to Google Drive!', type: 'success' });
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error uploading to Google Drive', type: 'error' });
    }
  };

  const handleGoogleRestore = async () => {
    if (!isConnected) return;
    setIsRestoring(true);
    try {
      await performRestore();
      setToast({ message: 'System restored from Google Drive! Reloading...', type: 'success' });
      setTimeout(() => window.location.reload(), 2000);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error restoring from Google Drive', type: 'error' });
    } finally {
      setIsRestoring(false);
    }
  };

  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const backupData: any = {};
      const tables = ['medicines', 'categories', 'suppliers', 'invoices', 'purchases', 'expenses', 'staff', 'returns', 'activityLogs', 'settings', 'users'];
      
      for (const table of tables) {
        backupData[table] = await (db as any)[table].toArray();
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pharmaflow_backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      await logActivity('Backup Created', 'System backup file generated and downloaded');
      setToast({ message: 'Backup created successfully!', type: 'success' });
      setTimeout(() => setToast(null), 3000);
    } catch (error) {
      console.error(error);
      setToast({ message: 'Error creating backup', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRestoreFile(file);
    setIsRestoreConfirmOpen(true);
    e.target.value = '';
  };

  const confirmRestore = async () => {
    if (!restoreFile) return;

    setIsRestoring(true);
    setIsRestoreConfirmOpen(false);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target?.result as string);
        const tables = ['medicines', 'categories', 'suppliers', 'invoices', 'purchases', 'expenses', 'staff', 'returns', 'activityLogs', 'settings', 'users'];
        
        await db.transaction('rw', tables, async () => {
          for (const table of tables) {
            if (backupData[table] && (db as any)[table]) {
              await (db as any)[table].clear();
              await (db as any)[table].bulkAdd(backupData[table]);
            }
          }
        });

        await logActivity('System Restored', 'Database restored from backup file');
        setToast({ message: 'System restored successfully! Reloading...', type: 'success' });
        setTimeout(() => window.location.reload(), 2000);
      } catch (error) {
        console.error(error);
        setToast({ message: 'Error restoring backup. Invalid file.', type: 'error' });
        setTimeout(() => setToast(null), 3000);
      } finally {
        setIsRestoring(false);
        setRestoreFile(null);
      }
    };
    reader.readAsText(restoreFile);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4 p-2 overflow-y-auto h-full no-scrollbar">
      <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
        <h1 className="text-base font-bold text-slate-900 leading-tight">Backup & Restore</h1>
        <p className="text-slate-500 text-[9px]">Manage your pharmacy data safety by creating backups or restoring from previous ones.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Local Backup Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Local Backup</h2>
              <p className="text-[9px] text-slate-500">Download a complete copy of your database.</p>
            </div>
          </div>
          
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
            <ul className="grid grid-cols-2 gap-1">
              {['Medicines', 'Sales', 'Purchases', 'Staff', 'Settings'].map((item, i) => (
                <li key={i} className="flex items-center gap-1.5 text-[10px] text-slate-600">
                  <div className="w-1 h-1 bg-blue-400 rounded-full" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <button 
            onClick={handleBackup}
            disabled={isBackingUp}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-lg transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isBackingUp ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
            {isBackingUp ? 'Creating...' : 'Download Backup'}
          </button>
        </div>

        {/* Local Restore Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <Upload size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Local Restore</h2>
              <p className="text-[9px] text-slate-500">Upload a backup file to restore your system.</p>
            </div>
          </div>

          <div className="p-2 bg-amber-50 rounded-lg border border-amber-100 flex gap-2">
            <AlertCircle className="text-amber-600 shrink-0" size={14} />
            <p className="text-[9px] text-amber-700 leading-tight">
              <strong>Warning:</strong> Restoring data will permanently delete all current records. This action cannot be undone.
            </p>
          </div>

          <div className="relative">
            <input 
              type="file" 
              accept=".json"
              onChange={handleFileSelect}
              disabled={isRestoring}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="w-full py-2 border-2 border-dashed border-slate-200 rounded-lg flex flex-col items-center justify-center gap-1 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 transition-all">
              {isRestoring ? <RefreshCw size={18} className="animate-spin" /> : <Upload size={18} />}
              <span className="text-[10px] font-bold">{isRestoring ? 'Restoring...' : 'Select Backup File'}</span>
            </div>
          </div>
        </div>

        {/* Google Drive Sync Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 md:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-sky-50 text-sky-600 rounded-lg">
                <Cloud size={18} />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">Google Drive Auto-Sync</h2>
                <p className="text-[9px] text-slate-500">Your data is automatically synced to Google Drive across all devices.</p>
              </div>
            </div>
            {isConnected && (
              <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                <CheckCircle size={10} />
                Auto-Sync Active
              </div>
            )}
          </div>

          {!isConnected ? (
            <div className="p-6 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400">
                <Link size={24} />
              </div>
              <div className="space-y-1">
                <h3 className="text-xs font-bold text-slate-900">Enable Cloud Sync</h3>
                <p className="text-[9px] text-slate-500 max-w-[200px]">Connect your Google account to enable seamless data synchronization across all your devices.</p>
              </div>
              <button 
                onClick={handleGoogleConnect}
                disabled={isSyncing}
                className="px-6 py-2 bg-slate-900 text-white text-[11px] font-bold rounded-lg hover:bg-slate-800 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <Cloud size={14} />}
                Connect Google Drive
              </button>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-xs font-bold text-slate-900">Syncing is enabled</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Last synced: {lastSyncTime ? lastSyncTime.toLocaleString() : 'Just now'}
                  </p>
                </div>
                
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleGoogleBackup}
                    disabled={isSyncing}
                    className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[11px] font-bold rounded-lg hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    Sync Now
                  </button>
                  <button 
                    onClick={() => { localStorage.removeItem('google_drive_token'); localStorage.removeItem('google_drive_refresh_token'); window.location.reload(); }}
                    className="px-4 py-2 bg-white border border-red-100 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-50 transition-all"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-900 text-white p-3 rounded-xl flex items-center gap-4">
        <div className="p-2 bg-white/10 rounded-lg">
          <Database size={24} className="text-blue-400" />
        </div>
        <div>
          <h3 className="font-bold text-xs">Data Security Recommendation</h3>
          <p className="text-slate-400 text-[9px] mt-0.5">
            We recommend creating a backup at the end of every business day. Store your backup files in a secure external drive or cloud storage.
          </p>
        </div>
      </div>

      {/* Restore Confirmation Modal */}
      {isRestoreConfirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200">
            <div className="bg-red-600 px-4 py-3 text-white flex items-center gap-2">
              <AlertCircle size={18} />
              <h3 className="font-bold text-base">Confirm Restore</h3>
            </div>
            <div className="p-4">
              <p className="text-slate-600 text-xs leading-relaxed">
                Warning: Restoring will <span className="font-bold text-red-600 underline">overwrite all current data</span>. Are you sure you want to proceed?
              </p>
            </div>
            <div className="p-4 bg-slate-50 flex gap-3">
              <button 
                onClick={() => { setIsRestoreConfirmOpen(false); setRestoreFile(null); }}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={confirmRestore}
                className="flex-1 px-4 py-2 text-[11px] font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-all shadow-md"
              >
                Restore Now
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
