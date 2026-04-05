import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, logActivity } from '../../db/db';
import { Save, Globe, CheckCircle2, AlertCircle, LogOut, Printer, Loader2, Cloud, RefreshCw, CheckCircle, Download, Upload } from 'lucide-react';
import { cn } from '../../utils/utils';
import { SystemReset } from './SystemReset';
import { getAuthUrl, exchangeCodeForToken, uploadToDrive } from '@/src/lib/googleDrive';

import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';

export const SettingsManagement = ({ onLogout }: { onLogout: () => void }) => {
  const { handleFormKeyDown } = useKeyboardNavigation();
  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const [formData, setFormData] = useState<any>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Google Drive State
  const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('google_drive_token'));
  const [isGoogleSyncing, setIsGoogleSyncing] = useState(false);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const isConnectingRef = React.useRef(false);

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }

    // Listen for message from popup
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'GOOGLE_AUTH_CODE') {
        isConnectingRef.current = true;
        handleGoogleCallback(event.data.code);
      } else if (event.data?.type === 'GOOGLE_AUTH_ERROR') {
        isConnectingRef.current = true;
        showToast('Connection Failed, try again', 'error');
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [settings]);

  const handleGoogleCallback = async (code: string) => {
    setIsGoogleSyncing(true);
    try {
      const redirectUri = window.location.origin + '/auth-callback.html';
      const tokens = await exchangeCodeForToken(code, redirectUri);
      
      // Store tokens securely
      localStorage.setItem('google_drive_token', tokens.access_token);
      if (tokens.refresh_token) {
        localStorage.setItem('google_drive_refresh_token', tokens.refresh_token);
      }
      
      setGoogleToken(tokens.access_token);
      showToast('Google Drive Connected Successfully');
    } catch (error) {
      console.error(error);
      showToast('Connection Failed, try again', 'error');
    } finally {
      setIsGoogleSyncing(false);
      isConnectingRef.current = false;
    }
  };

  const handleGoogleConnect = () => {
    if (googleToken) {
      showToast('Already Connected');
      return;
    }

    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    if (!clientId) {
      showToast('Google Client ID not configured', 'error');
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
            showToast('Connection Cancelled', 'error');
          }
        }, 500);
      }
    }, 1000);
  };

  const handleGoogleBackup = async () => {
    if (!googleToken) return;
    setIsGoogleSyncing(true);
    try {
      const backupData: any = {};
      const tables = ['medicines', 'categories', 'suppliers', 'invoices', 'purchases', 'expenses', 'staff', 'returns', 'activityLogs', 'settings', 'users'];
      
      for (const table of tables) {
        backupData[table] = await (db as any)[table].toArray();
      }

      const fileName = `pharmaflow_backup_${new Date().toISOString().split('T')[0]}.json`;
      await uploadToDrive(googleToken, fileName, JSON.stringify(backupData, null, 2));

      await logActivity('Google Drive Backup', 'Database backed up to Google Drive via Settings');
      showToast('Backup uploaded to Google Drive!');
    } catch (error) {
      console.error(error);
      showToast('Error uploading to Google Drive', 'error');
    } finally {
      setIsGoogleSyncing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    try {
      if (formData.id) {
        await db.settings.update(formData.id, formData);
      } else {
        await db.settings.add(formData);
      }
      await logActivity('Settings updated', 'Updated pharmacy system settings');
      showToast('Settings saved successfully!');
    } catch (error) {
      console.error(error);
      showToast('Error saving settings', 'error');
    }
  };

  if (!formData) return <div className="p-8 text-center text-slate-500">Loading settings...</div>;

  return (
    <>
      <form onSubmit={handleSubmit} onKeyDown={handleFormKeyDown} className="min-h-full flex flex-col gap-1 bg-[#F0F2F5] p-2 no-scrollbar print:hidden">
      <div className="flex items-center justify-between shrink-0 bg-white px-3 py-1 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-sm font-bold text-slate-900 leading-tight">System Settings</h1>
            <p className="text-slate-500 text-[8px]">Configure your pharmacy details and preferences.</p>
          </div>
          <button 
            type="button"
            onClick={(e) => {
              e.preventDefault();
              onLogout();
            }}
            className="flex items-center gap-1.5 px-3 py-1 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[9px] font-bold border border-red-100 transition-all shadow-sm"
          >
            <LogOut size={12} />
            Logout
          </button>
        </div>
        <button 
          onClick={handleSubmit}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1 rounded flex items-center gap-1.5 transition-all shadow-md text-[9px] font-bold"
        >
          <Save size={12} />
          Save Changes
        </button>
      </div>

      <div className="flex-1 pb-2">
        <div className="max-w-2xl mx-auto space-y-2">
          {/* Pharmacy Info */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-1 bg-blue-50 text-blue-600 rounded">
                <Globe size={14} />
              </div>
              <h2 className="text-xs font-bold text-slate-900">Pharmacy Information</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Pharmacy Name *</label>
                <input 
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                  value={formData.pharmacyName}
                  onChange={(e) => setFormData({...formData, pharmacyName: e.target.value})}
                  autoFocus
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Phone Number *</label>
                <input 
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Easy Paisa</label>
                <input 
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                  value={formData.easyPaisa || ''}
                  onChange={(e) => setFormData({...formData, easyPaisa: e.target.value})}
                />
              </div>
              <div className="space-y-0.5">
                <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Address *</label>
                <input 
                  className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none"
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center gap-2 mb-0.5">
              <div className="p-1 bg-emerald-50 text-emerald-600 rounded">
                <Printer size={14} />
              </div>
              <h2 className="text-xs font-bold text-slate-900">Print Settings</h2>
            </div>
            <div className="space-y-1">
              <label className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Default Print Type</label>
              <select 
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[10px] focus:ring-1 focus:ring-emerald-500 outline-none appearance-none"
                value={formData.defaultPrintType || 'Thermal'}
                onChange={(e) => setFormData({...formData, defaultPrintType: e.target.value})}
              >
                <option value="Thermal">Thermal (80mm)</option>
                <option value="A4">A4 (Standard)</option>
                <option value="Compact">Compact</option>
                <option value="Detailed">Detailed</option>
              </select>
            </div>
          </div>

          {/* Google Drive Sync */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 mb-0.5">
                <div className="p-1 bg-sky-50 text-sky-600 rounded">
                  <Cloud size={14} />
                </div>
                <h2 className="text-xs font-bold text-slate-900">Cloud Backup & Sync</h2>
              </div>
              {googleToken && (
                <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                  <CheckCircle size={10} />
                  Connected
                </div>
              )}
            </div>
            
            {!googleToken ? (
              <div className="p-3 border border-dashed border-slate-200 rounded-lg flex flex-col items-center gap-2 text-center">
                <p className="text-[9px] text-slate-500">Connect your Google Drive to enable automated cloud backups.</p>
                <button 
                  type="button"
                  onClick={handleGoogleConnect}
                  className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded hover:bg-slate-800 transition-all flex items-center gap-2"
                >
                  <Cloud size={12} />
                  Connect Google Drive
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={handleGoogleBackup}
                  disabled={isGoogleSyncing}
                  className="flex-1 py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold rounded transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGoogleSyncing ? <RefreshCw size={12} className="animate-spin" /> : <Cloud size={12} />}
                  Sync Now
                </button>
                <button 
                  type="button"
                  onClick={() => { localStorage.removeItem('google_drive_token'); setGoogleToken(null); }}
                  className="px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-[10px] font-bold rounded hover:bg-slate-50 transition-all"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>

          <div className="pt-1">
            <SystemReset />
          </div>
        </div>
      </div>
    </form>

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
    </>
  );
};
