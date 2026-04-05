import React, { useState, useEffect } from 'react';
import { initializeDB, db, setGlobalSyncTrigger } from './db/db';
import { supabase } from './lib/supabase';
import { useGoogleSync } from './hooks/useGoogleSync';
import { Layout } from './components/Layout/Layout';
import { Dashboard } from './components/Dashboard/Dashboard';
import { MedicineManagement } from './components/Medicines/MedicineManagement';
import { CategoryManagement } from './components/Categories/CategoryManagement';
import { BillingSystem } from './components/Billing/BillingSystem';
import { PurchaseManagement } from './components/Purchases/PurchaseManagement';
import { SupplierManagement } from './components/Suppliers/SupplierManagement';
import { Reports } from './components/Reports/Reports';
import { ReturnsManagement } from './components/Returns/ReturnsManagement';
import { BackupManagement } from './components/Backup/BackupManagement';
import { SettingsManagement } from './components/Settings/SettingsManagement';
import { UserManagement } from './components/Users/UserManagement';
import { ActivityLog } from './components/Logs/ActivityLog';
import { InventoryManagement } from './components/Inventory/InventoryManagement';
import { ExpenseManagement } from './components/Expenses/ExpenseManagement';
import { ItemWiseSalesPage } from './components/Reports/ItemWiseSalesPage';
import { CustomerDuesPage } from './components/Customers/CustomerDuesPage';
import { SupplierPayablesPage } from './components/Suppliers/SupplierPayablesPage';
import { DuesManagement } from './components/Common/DuesManagement';
import { PWAInstallPrompt } from './components/PWA/PWAInstallPrompt';
import { AuthPage } from './components/Auth/AuthPage';
import { AdminPanel } from './components/Admin/AdminPanel';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [editInvoiceId, setEditInvoiceId] = useState<number | null>(null);
  const [editInvoiceType, setEditInvoiceType] = useState<'Sales' | 'Purchase' | null>(null);
  const [user, setUser] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('pharma_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState<'login' | 'signup' | 'reset' | 'update-password'>('login');
  const [showSyncToast, setShowSyncToast] = useState(false);

  // Initialize Google Sync
  const { isSyncing, lastSyncTime, error: syncError, isConnected, triggerSync } = useGoogleSync();

  useEffect(() => {
    console.log('App version: 2.2.1 - AUTH FLOW OPTIMIZED');
    setGlobalSyncTrigger(triggerSync);
  }, [triggerSync]);

  useEffect(() => {
    if (lastSyncTime) {
      setShowSyncToast(true);
      const timer = setTimeout(() => setShowSyncToast(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastSyncTime]);

  // Safety timeout to prevent infinite loading
  useEffect(() => {
    console.log('Setting up safety timeout...');
    const timer = setTimeout(() => {
      if (isAuthLoading) {
        console.warn('Auth loading timeout reached in App.tsx. Forcing load.');
        setIsAuthLoading(false);
      }
      if (!isInitialized) {
        console.warn('DB initialization timeout reached in App.tsx. Forcing load.');
        setIsInitialized(true);
      }
    }, 3000); 
    return () => clearTimeout(timer);
  }, [isAuthLoading, isInitialized]);

  useEffect(() => {
    console.log('App state changed:', { isAuthLoading, isInitialized, user: !!user });
  }, [isAuthLoading, isInitialized, user]);

  useEffect(() => {
    // Check for existing session on mount
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const userData = {
            email: session.user.email,
            fullName: profile?.full_name || session.user.user_metadata?.full_name || 'User',
            role: profile?.role || 'Staff',
            status: profile?.status || 'active',
            id: session.user.id
          };
          
          setUser(userData);
          localStorage.setItem('pharma_user', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('Error checking session:', error);
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, session?.user?.email);
      
      if (event === 'PASSWORD_RECOVERY') {
        setAuthMode('update-password');
        setIsAuthLoading(false);
        return;
      }

      if (session?.user) {
        // If we already have the user and it's just a token refresh, we don't necessarily need to re-fetch profile
        try {
          const savedUserStr = localStorage.getItem('pharma_user');
          const savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
          
          if (savedUser?.id === session.user.id && event === 'TOKEN_REFRESHED') {
            setIsAuthLoading(false);
            return;
          }
        } catch (e) {
          console.warn('Error parsing saved user during auth change:', e);
        }

        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const userData = {
            email: session.user.email,
            fullName: profile?.full_name || session.user.user_metadata?.full_name || 'User',
            role: profile?.role || 'Staff',
            status: profile?.status || 'active',
            id: session.user.id
          };
          
          setUser(userData);
          localStorage.setItem('pharma_user', JSON.stringify(userData));
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
          setUser(null);
          localStorage.removeItem('pharma_user');
          setIsAuthLoading(false);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (activeTab !== 'billing' && activeTab !== 'purchases') {
      setEditInvoiceId(null);
      setEditInvoiceType(null);
    }
  }, [activeTab]);

  const handleEditInvoice = (id: number, type: 'Sales' | 'Purchase') => {
    setEditInvoiceId(id);
    setEditInvoiceType(type);
    setActiveTab(type === 'Sales' ? 'billing' : 'purchases');
  };
  
  const handleLogin = (userData: any) => {
    setUser(userData);
    localStorage.setItem('pharma_user', JSON.stringify(userData));
    localStorage.setItem('yousaf_has_account', 'true');
  };

  const handleLogout = async () => {
    console.log('Logging out...');
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setUser(null);
      localStorage.clear();
      sessionStorage.clear();
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        await initializeDB();
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setIsInitialized(true);
      }
      
      // Check if we are returning from Google Auth
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has('code')) {
        setActiveTab('backup');
      }
    };
    init();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!user) return; // Disable shortcuts if not logged in

      // Navigation Shortcuts
      if (e.key === 'F1') {
        e.preventDefault();
        setActiveTab('dashboard');
      } else if (e.key === 'F2') {
        e.preventDefault();
        setActiveTab('billing');
      } else if (e.key === 'F3') {
        e.preventDefault();
        setActiveTab('purchases');
      } else if (e.key === 'F4') {
        e.preventDefault();
        setActiveTab('medicines');
      } else if (e.key === 'F5') {
        e.preventDefault();
        setActiveTab('suppliers');
      } else if (e.key === 'F6') {
        e.preventDefault();
        setActiveTab('expenses');
      } else if (e.key === 'F7') {
        e.preventDefault();
        setActiveTab('reports');
      } else if (e.key === 'F8') {
        e.preventDefault();
        window.print();
      } else if (e.key === 'F12') {
        e.preventDefault();
        setActiveTab('settings');
      }
      
      // Fullscreen Toggle
      else if (e.key === 'F11') {
        e.preventDefault();
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
        } else {
          if (document.exitFullscreen) {
            document.exitFullscreen();
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [user]);

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <p className="text-slate-600 font-bold animate-pulse">Checking Authentication...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthPage onLogin={handleLogin} initialMode={authMode} />
    );
  }

  const renderContent = () => {
    if (!isInitialized) {
      return (
        <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium animate-pulse">Initializing Database...</p>
          <div className="flex gap-4 mt-4">
            <button 
              onClick={() => setIsInitialized(true)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold shadow-lg hover:bg-emerald-700 transition-all"
            >
              Force Load App
            </button>
            <button 
              onClick={handleLogout}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all"
            >
              Back to Login
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-2 italic">If this takes too long, click Force Load</p>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard setActiveTab={setActiveTab} onEditInvoice={handleEditInvoice} />;
      case 'medicines': return <MedicineManagement />;
      case 'categories': return <CategoryManagement />;
      case 'billing': return <BillingSystem setActiveTab={setActiveTab} editInvoiceId={editInvoiceId} onEditComplete={() => setEditInvoiceId(null)} />;
      case 'inventory': return <InventoryManagement />;
      case 'purchases': return <PurchaseManagement setActiveTab={setActiveTab} editInvoiceId={editInvoiceId} onEditComplete={() => setEditInvoiceId(null)} />;
      case 'expenses': return <ExpenseManagement />;
      case 'suppliers': return <SupplierManagement onEditInvoice={handleEditInvoice} />;
      case 'reports': return <Reports onEditInvoice={handleEditInvoice} />;
      case 'returns': return <ReturnsManagement />;
      case 'logs': return <ActivityLog />;
      case 'backup': return <BackupManagement />;
      case 'settings': return <SettingsManagement onLogout={handleLogout} />;
      case 'users': return <UserManagement />;
      case 'admin-panel': 
        if (user.email === 'hazirk777@gmail.com' || user.email === 'hazirk888@gmail.com' || user.email === 'yousafpharmacy9@gmail.com') return <AdminPanel />;
        return <Dashboard setActiveTab={setActiveTab} onEditInvoice={handleEditInvoice} />;
      case 'customer-dues': return <CustomerDuesPage onEditInvoice={handleEditInvoice} />;
      case 'supplier': return <SupplierPayablesPage onEditInvoice={handleEditInvoice} />;
      case 'item-wise-sales': return <ItemWiseSalesPage onBack={() => setActiveTab('dashboard')} />;
      default: return <Dashboard setActiveTab={setActiveTab} onEditInvoice={handleEditInvoice} />;
    }
  };

  return (
    <>
      <Layout 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        user={user} 
        onLogout={handleLogout}
      >
        {renderContent()}
      </Layout>
      {user && <PWAInstallPrompt />}
      
      {/* Sync Status Indicator */}
      {(isSyncing || showSyncToast) && (
        <div className="fixed bottom-20 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl border ${
            isSyncing ? 'bg-white border-emerald-100' : 'bg-emerald-600 border-emerald-500 text-white'
          }`}>
            {isSyncing ? (
              <>
                <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-600">Syncing with Google Drive...</span>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-sm font-medium">Data Synced Successfully</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sync Error Notification */}
      {syncError && (
        <div className="fixed bottom-20 right-4 z-[9999] animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-4 py-3 bg-red-600 border border-red-500 text-white rounded-xl shadow-2xl">
            <div className="flex items-center justify-center w-5 h-5 bg-white/20 rounded-full">
              <span className="text-xs font-bold">!</span>
            </div>
            <span className="text-sm font-medium">Sync Error: Check Connection</span>
          </div>
        </div>
      )}
    </>
  );
}
