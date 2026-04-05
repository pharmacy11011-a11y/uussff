import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Pill, 
  Tags, 
  Receipt, 
  ShoppingCart, 
  Truck, 
  Users, 
  Package, 
  BarChart3, 
  RotateCcw, 
  Database, 
  Settings as SettingsIcon, 
  UserCog,
  LogOut,
  Bell,
  User as UserIcon,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  Clock,
  Wallet,
  CreditCard,
  History,
  UserSquare,
  Keyboard,
  Info,
  ShieldCheck
} from 'lucide-react';
import { cn } from '@/src/utils/utils';

interface SidebarItemProps {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
  collapsed?: boolean;
}

const SidebarItem = ({ icon: Icon, label, active, onClick, collapsed }: SidebarItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "flex items-center w-full px-4 py-3 transition-all duration-200 group relative",
      active 
        ? "bg-[#34495E] text-white" 
        : "text-slate-300 hover:bg-[#34495E] hover:text-white"
    )}
  >
    {active && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
    <Icon className={cn("w-5 h-5 shrink-0", active ? "text-white" : "text-slate-400 group-hover:text-white")} />
    {!collapsed && <span className="ml-3 font-medium text-sm">{label}</span>}
  </button>
);

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  user: any;
  onLogout: () => void;
}

export const Layout = ({ children, activeTab, setActiveTab, user, onLogout }: LayoutProps) => {
  const [collapsed, setCollapsed] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'medicines', label: 'Medicines', icon: Pill },
    { id: 'inventory', label: 'Inventory', icon: Package },
    { id: 'billing', label: 'Billing', icon: Receipt },
    { id: 'customer-dues', label: 'Customer Dues', icon: Users },
    { id: 'supplier', label: 'Supplier', icon: Truck },
    { id: 'expenses', label: 'Expenses', icon: Wallet },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    { id: 'returns', label: 'Returns', icon: RotateCcw },
    ...(user?.email === 'hazirk777@gmail.com' || user?.email === 'hazirk888@gmail.com' || user?.email === 'yousafpharmacy9@gmail.com' ? [{ id: 'admin-panel', label: 'Admin Panel', icon: ShieldCheck }] : []),
    { id: 'settings', label: 'Settings', icon: SettingsIcon },
  ];

  const shortcuts = [
    { key: 'F1', action: 'Dashboard' },
    { key: 'F2', action: 'Billing' },
    { key: 'F3', action: 'Purchases' },
    { key: 'F4', action: 'Medicines' },
    { key: 'F5', action: 'Suppliers' },
    { key: 'F6', action: 'Expenses' },
    { key: 'F7', action: 'Reports' },
    { key: 'F8 / Ctrl+P', action: 'Print Invoice/Purchase' },
    { key: 'F9 / Ctrl+S', action: 'Save / Update' },
    { key: 'F10', action: 'New / Focus Form' },
    { key: 'F11', action: 'Toggle Fullscreen' },
    { key: 'F12', action: 'Settings' },
  ];

  return (
    <div className="flex h-screen bg-[#F0F2F5] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside 
        className={cn(
          "bg-[#2C3E50] flex flex-col transition-all duration-300 ease-in-out z-30 no-print",
          collapsed ? "w-14" : "w-52"
        )}
      >
        <div className="p-3 flex items-center gap-2 h-12 border-b border-white/10 shrink-0">
          <div className="w-6 h-6 bg-blue-500 rounded flex items-center justify-center shrink-0">
            <Pill className="text-white w-4 h-4" />
          </div>
          {!collapsed && <span className="font-bold text-white text-base tracking-tight">Pharmacy</span>}
        </div>

        <nav className="flex-1 overflow-y-auto py-1 no-scrollbar">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center w-full px-3 py-2 transition-all duration-200 group relative",
                activeTab === item.id 
                  ? "bg-[#34495E] text-white" 
                  : "text-slate-300 hover:bg-[#34495E] hover:text-white"
              )}
            >
              {activeTab === item.id && <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500" />}
              <item.icon className={cn("w-4 h-4 shrink-0", activeTab === item.id ? "text-white" : "text-slate-400 group-hover:text-white")} />
              {!collapsed && <span className="ml-2.5 font-medium text-xs">{item.label}</span>}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - Simplified */}
        <header className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-20 no-print">
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCollapsed(!collapsed)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors"
            >
              <Menu size={18} />
            </button>
            <h2 className="text-lg font-bold text-slate-800 capitalize">
              {activeTab.replace('-', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowShortcuts(true)}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors flex items-center gap-2"
              title="Keyboard Shortcuts"
            >
              <Keyboard size={18} />
              <span className="text-[10px] font-bold text-slate-400 hidden md:inline">Shortcuts</span>
            </button>
            
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-slate-700 leading-none">{user?.fullName || 'Administrator'}</span>
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{user?.role || 'Admin'}</span>
            </div>
            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
          </div>
        </header>

        {/* Content Area - Slightly Larger (less padding) */}
        <main className={cn(
          "flex-1 p-2 bg-[#F0F2F5] print:p-0 no-scrollbar",
          activeTab === 'billing' ? "overflow-hidden" : "overflow-y-auto"
        )}>
          <div className={cn(
            "w-full max-w-[1800px] mx-auto",
            activeTab === 'billing' ? "h-full" : "min-h-full"
          )}>
            {children}
          </div>
        </main>
      </div>

      {/* Shortcuts Modal */}
      {showShortcuts && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden border border-white/20 animate-in fade-in zoom-in duration-200">
            <div className="bg-slate-900 px-4 py-3 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Keyboard size={18} />
                <h3 className="font-bold text-base">Keyboard Shortcuts</h3>
              </div>
              <button 
                onClick={() => setShowShortcuts(false)}
                className="p-1 hover:bg-white/10 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                {shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between py-1 border-b border-slate-100 last:border-0">
                    <span className="text-[11px] text-slate-500 font-medium">{s.action}</span>
                    <kbd className="px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded text-[10px] font-mono font-bold text-slate-700 shadow-sm">
                      {s.key}
                    </kbd>
                  </div>
                ))}
              </div>
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-2">
                <Info size={14} className="text-blue-600 mt-0.5 shrink-0" />
                <p className="text-[10px] text-blue-700 leading-relaxed">
                  These shortcuts are global and work from any screen. Some shortcuts like <strong>F8</strong> and <strong>F9</strong> are context-aware and work specifically in Billing and Purchase screens.
                </p>
              </div>
            </div>
            <div className="p-3 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowShortcuts(false)}
                className="px-4 py-1.5 text-[11px] font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-all shadow-md"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
