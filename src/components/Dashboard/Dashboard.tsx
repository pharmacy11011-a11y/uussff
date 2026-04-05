import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/src/db/db';
import { 
  TrendingUp, 
  AlertTriangle, 
  Clock, 
  ShoppingCart, 
  Receipt as ReceiptIcon,
  Wallet,
  Calendar,
  Filter,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Search,
  Package,
  DollarSign,
  BarChart3,
  PieChart as PieChartIcon,
  Activity,
  Plus,
  User,
  Users,
  Truck,
  Tag,
  Printer,
  X,
  RefreshCw,
  Edit2,
  FileDown,
  Share2
} from 'lucide-react';
import { cn, formatCurrency, formatNumber, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { downloadPDF, sharePDFViaWhatsApp } from '@/src/utils/pdfUtils';

type ViewType = 'main' | 'sales' | 'purchases' | 'low-stock' | 'full-inventory' | 'expenses' | 'expiring-soon' | 'profit-loss' | 'item-wise-sales' | 'dues' | 'returns';
type FilterType = 'Daily' | 'Weekly' | 'Monthly' | 'Yearly' | 'Category-wise';

const StatCard = ({ title, value, icon: Icon, color, onClick }: any) => (
  <button 
    onClick={onClick}
    className={cn(
      "w-full h-full relative overflow-hidden rounded-xl p-3 text-white transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md flex items-center justify-between text-left min-h-[100px]",
      color
    )}
  >
    <div className="relative z-10">
      <p className="text-[9px] font-bold uppercase tracking-widest opacity-80 mb-0.5">{title}</p>
      <p className="text-lg font-black">{value}</p>
    </div>
    <div className="relative z-10 p-1.5 bg-white/20 rounded-lg">
      <Icon size={16} />
    </div>
    {/* Decorative background circle */}
    <div className="absolute -right-3 -bottom-3 w-16 h-16 bg-white/10 rounded-full" />
  </button>
);

const DashboardSection = ({ title, children, className, action }: any) => (
  <div className={cn("bg-white rounded-lg border border-slate-200 shadow-sm flex flex-col overflow-hidden", className)}>
    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
      <h2 className="font-bold text-slate-900 text-[9px] uppercase tracking-widest">{title}</h2>
      {action || <ChevronRight size={12} className="text-slate-300" />}
    </div>
    <div className="flex-1 p-3">
      {children}
    </div>
  </div>
);

const AdvancedDuesCard = ({ customerDues, supplierDues, onCustomerClick, onSupplierClick, onCustomerPrint, onSupplierPrint }: any) => (
  <div className="bg-white rounded-xl border border-slate-200 shadow-md overflow-hidden flex h-full min-h-[100px]">
    {/* Left Section: Customer Dues */}
    <div className="flex-1 flex flex-col">
      <button 
        onClick={onCustomerClick}
        className="flex-1 p-3 bg-[#E8F8F0] hover:bg-[#DCF5E8] transition-all group relative overflow-hidden text-left flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-1 relative z-10">
          <div className="p-1.5 bg-white/60 rounded-lg text-[#0F9D58] shadow-sm">
            <Users size={18} />
          </div>
          <span className="px-1.5 py-0.5 bg-[#0F9D58] text-white text-[7px] font-bold rounded-full uppercase tracking-wider shadow-sm">Receivable</span>
        </div>
        <div className="relative z-10">
          <p className="text-[9px] font-bold text-[#0F9D58]/80 uppercase tracking-widest mb-0.5">Customer Dues</p>
          <p className="text-xl font-black text-[#0F9D58] leading-none">{formatCurrency(customerDues)}</p>
          <p className="text-[8px] font-medium text-[#0F9D58]/70 mt-1 italic">You will receive</p>
        </div>
        {/* Subtle background decoration */}
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-[#0F9D58]/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
      </button>
    </div>

    {/* Divider */}
    <div className="w-[2px] bg-[#ddd] self-stretch shrink-0" />

    {/* Right Section: Supplier Payable */}
    <div className="flex-1 flex flex-col">
      <button 
        onClick={onSupplierClick}
        className="flex-1 p-3 bg-[#FDECEC] hover:bg-[#FCE4E4] transition-all group relative overflow-hidden text-left flex flex-col justify-between"
      >
        <div className="flex items-center justify-between mb-1 relative z-10">
          <div className="p-1.5 bg-white/60 rounded-lg text-[#D93025] shadow-sm">
            <Truck size={18} />
          </div>
          <span className="px-1.5 py-0.5 bg-[#D93025] text-white text-[7px] font-bold rounded-full uppercase tracking-wider shadow-sm">Payable</span>
        </div>
        <div className="relative z-10">
          <p className="text-[9px] font-bold text-[#D93025]/80 uppercase tracking-widest mb-0.5">Supplier Payable</p>
          <p className="text-xl font-black text-[#D93025] leading-none">{formatCurrency(supplierDues)}</p>
          <p className="text-[8px] font-medium text-[#D93025]/70 mt-1 italic">You need to pay</p>
        </div>
        {/* Subtle background decoration */}
        <div className="absolute -right-4 -bottom-4 w-16 h-16 bg-[#D93025]/5 rounded-full group-hover:scale-125 transition-transform duration-500" />
      </button>
    </div>
  </div>
);

export const Dashboard = ({ setActiveTab, onEditInvoice }: { setActiveTab: (tab: string) => void, onEditInvoice?: (id: number, type: 'Sales' | 'Purchase') => void }) => {
  const [view, setView] = useState<ViewType>('main');
  const [filter, setFilter] = useState<FilterType>('Monthly');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [duesTypeFilter, setDuesTypeFilter] = useState<'Customer' | 'Supplier'>('Customer');
  const [selectedDue, setSelectedDue] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const [selectedMedicine, setSelectedMedicine] = useState<any>(null);
  const [selectedItemAnalysis, setSelectedItemAnalysis] = useState<{name: string, invoices: any[]} | null>(null);
  const [selectedSupplierDetail, setSelectedSupplierDetail] = useState<any>(null);
  const [selectedEntity, setSelectedEntity] = useState<{ name: string, type: 'Customer' | 'Supplier' | 'Expense' | 'Return', invoices: any[] } | null>(null);
  const [printReportData, setPrintReportData] = useState<any>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [dueItems, setDueItems] = useState<any[]>([]);
  const [partyDetails, setPartyDetails] = useState<{ contact?: string, address?: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const medicines = useLiveQuery(() => db.medicines.toArray());
  const invoices = useLiveQuery(() => db.invoices.toArray());
  const purchases = useLiveQuery(() => db.purchases.toArray());
  const expenses = useLiveQuery(() => db.expenses.toArray());
  const dues = useLiveQuery(() => db.dues.toArray());
  const returns = useLiveQuery(() => db.returns.toArray());
  const categories = useLiveQuery(() => db.categories.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  // Summary Calculations
  const filteredInvoices = useMemo(() => {
    if (!invoices) return [];
    let data = invoices;
    if (filter === 'Daily') {
      data = data.filter(i => i.date === selectedDate);
    } else if (filter === 'Weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      data = data.filter(i => new Date(i.date) >= weekAgo);
    } else if (filter === 'Monthly') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      data = data.filter(i => new Date(i.date) >= monthAgo);
    } else if (filter === 'Yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      data = data.filter(i => new Date(i.date) >= yearAgo);
    }
    return data;
  }, [invoices, filter, selectedDate]);

  const filteredPurchases = useMemo(() => {
    if (!purchases) return [];
    let data = purchases;
    if (filter === 'Daily') {
      data = data.filter(p => p.date === selectedDate);
    } else if (filter === 'Weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      data = data.filter(p => new Date(p.date) >= weekAgo);
    } else if (filter === 'Monthly') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      data = data.filter(p => new Date(p.date) >= monthAgo);
    } else if (filter === 'Yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      data = data.filter(p => new Date(p.date) >= yearAgo);
    }
    return data;
  }, [purchases, filter, selectedDate]);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    let data = expenses;
    if (filter === 'Daily') {
      data = data.filter(e => e.date === selectedDate);
    } else if (filter === 'Weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      data = data.filter(e => new Date(e.date) >= weekAgo);
    } else if (filter === 'Monthly') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      data = data.filter(e => new Date(e.date) >= monthAgo);
    } else if (filter === 'Yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      data = data.filter(e => new Date(e.date) >= yearAgo);
    }
    return data;
  }, [expenses, filter, selectedDate]);

  const filteredReturns = useMemo(() => {
    if (!returns) return [];
    let data = returns;
    if (filter === 'Daily') {
      data = data.filter(r => r.date === selectedDate);
    } else if (filter === 'Weekly') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      data = data.filter(r => new Date(r.date) >= weekAgo);
    } else if (filter === 'Monthly') {
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      data = data.filter(r => new Date(r.date) >= monthAgo);
    } else if (filter === 'Yearly') {
      const yearAgo = new Date();
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      data = data.filter(r => new Date(r.date) >= yearAgo);
    }
    return data;
  }, [returns, filter, selectedDate]);

  const totalSales = useMemo(() => {
    const salesTotal = filteredInvoices.reduce((sum, inv) => {
      const invTotal = inv.subtotal !== undefined ? ((inv.subtotal || 0) - (inv.discount || 0) + (inv.tax || 0)) : (inv.total || 0);
      return sum + invTotal;
    }, 0);
    const salesReturns = filteredReturns.filter(r => r.type === 'Sales').reduce((sum, r) => sum + r.totalAmount, 0);
    return salesTotal - salesReturns;
  }, [filteredInvoices, filteredReturns]);

  const totalPurchases = useMemo(() => {
    const purchaseTotal = filteredPurchases.reduce((sum, p) => {
      const pTotal = p.subtotal !== undefined ? ((p.subtotal || 0) - (p.discount || 0) + (p.tax || 0)) : (p.total || 0);
      return sum + pTotal;
    }, 0);
    const purchaseReturns = filteredReturns.filter(r => r.type === 'Purchase').reduce((sum, r) => sum + r.totalAmount, 0);
    return purchaseTotal - purchaseReturns;
  }, [filteredPurchases, filteredReturns]);

  const totalExpenses = useMemo(() => filteredExpenses.reduce((sum, e) => sum + e.amount, 0), [filteredExpenses]);
  const totalReturns = useMemo(() => filteredReturns.reduce((sum, r) => sum + r.totalAmount, 0), [filteredReturns]);
  const totalCustomerDues = useMemo(() => dues?.filter(d => d.status === 'Pending' && d.personType === 'Customer').reduce((sum, d) => sum + d.remaining, 0) || 0, [dues]);
  const totalSupplierPayable = useMemo(() => dues?.filter(d => d.status === 'Pending' && d.personType === 'Supplier').reduce((sum, d) => sum + d.remaining, 0) || 0, [dues]);
  
  const totalProfit = useMemo(() => {
    if (!filteredInvoices || !filteredReturns || !invoices) return 0;
    
    const salesProfit = filteredInvoices.reduce((sum, inv) => {
      const invProfit = (inv.items || []).reduce((iSum, item) => {
        const salePrice = item.salePrice || item.price || 0;
        const purchasePrice = item.purchasePrice || 0;
        const profitPerItem = salePrice - purchasePrice;
        return iSum + (profitPerItem * (item.quantity || 0));
      }, 0);
      return sum + invProfit;
    }, 0);

    const returnLoss = filteredReturns.filter(r => r.type === 'Sales').reduce((sum, ret) => {
      const retLoss = ret.items.reduce((iSum: number, item: any) => {
        const purchasePrice = item.purchasePrice || 0;
        const profitPerItem = (item.salePrice || item.price || 0) - purchasePrice;
        return iSum + (profitPerItem * (item.quantity || 0));
      }, 0);
      return sum + retLoss;
    }, 0);

    const netProfit = salesProfit - returnLoss - totalExpenses;
    return netProfit;
  }, [filteredInvoices, filteredReturns, invoices, totalExpenses]);

  const totalLoss = useMemo(() => {
    return totalExpenses; 
  }, [totalExpenses]);

  const lowStockMeds = useMemo(() => medicines?.filter(m => m.stockQuantity <= m.minStockLimit) || [], [medicines]);
  const expiringSoonMeds = useMemo(() => medicines?.filter(m => {
    const expiry = new Date(m.expiryDate);
    const today = new Date();
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    const thresholdDays = (settings?.expiryThreshold || 3) * 30;
    return diff > 0 && diff <= thresholdDays;
  }) || [], [medicines, settings?.expiryThreshold]);

  const recentInvoices = invoices?.slice(-3).reverse() || [];

  const expiringMedsList = medicines?.filter(m => {
    const expiry = new Date(m.expiryDate);
    const today = new Date();
    const diff = (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diff > 0 && diff <= 180;
  }).slice(0, 6) || [];

  const handlePrintReport = useCallback((data: any[], totalValue: number, overrideType?: ViewType, customSummary?: any[]) => {
    let title = '';
    let columns: any[] = [];
    let formattedData: any[] = [];
    let summary: any[] = [];

    const type = overrideType || view;
    switch (type) {
      case 'sales':
        title = 'SALES REPORT';
        columns = [
          { header: 'Invoice #', key: 'invoiceNumber' },
          { header: 'Customer', key: 'customerName' },
          { header: 'Date', key: 'date' },
          { header: 'Total', key: 'total', align: 'right' },
          { header: 'Status', key: 'status', align: 'center' }
        ];
        formattedData = (data as any[]).map(item => ({
          invoiceNumber: item.invoiceNumber,
          customerName: item.customerName || 'Walk-in',
          date: new Date(item.date).toLocaleDateString(),
          total: item.total,
          status: item.status
        }));
        summary = customSummary || [{ label: 'Total Sales', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'purchases':
        title = 'PURCHASE REPORT';
        columns = [
          { header: 'Invoice #', key: 'invoiceNumber' },
          { header: 'Supplier', key: 'supplierName' },
          { header: 'Date', key: 'date' },
          { header: 'Total', key: 'total', align: 'right' },
          { header: 'Status', key: 'status', align: 'center' }
        ];
        formattedData = (data as any[]).map(item => ({
          invoiceNumber: item.invoiceNumber,
          supplierName: item.supplierName || 'General',
          date: new Date(item.date).toLocaleDateString(),
          total: item.total,
          status: item.status
        }));
        summary = customSummary || [{ label: 'Total Purchases', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'low-stock':
        title = 'LOW STOCK ITEMS';
        columns = [
          { header: 'Item Code', key: 'code' },
          { header: 'Item Name', key: 'name' },
          { header: 'Quantity', key: 'qty', align: 'center' },
          { header: 'Price', key: 'price', align: 'right' },
          { header: 'Total', key: 'total', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          code: item.code || '-',
          name: item.name,
          qty: item.stockQuantity,
          price: item.purchasePrice || item.salePrice || 0,
          total: (item.stockQuantity || 0) * (item.purchasePrice || item.salePrice || 0)
        }));
        summary = [{ label: 'Total Value', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'full-inventory':
        title = 'FULL INVENTORY REPORT';
        columns = [
          { header: 'Item Code', key: 'code' },
          { header: 'Item Name', key: 'name' },
          { header: 'Quantity', key: 'qty', align: 'center' },
          { header: 'Price', key: 'price', align: 'right' },
          { header: 'Total', key: 'total', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          code: item.code || '-',
          name: item.name,
          qty: item.stockQuantity,
          price: item.purchasePrice || item.salePrice || 0,
          total: (item.stockQuantity || 0) * (item.purchasePrice || item.salePrice || 0)
        }));
        summary = [{ label: 'Total Inventory Value', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'profit-loss':
        title = 'PROFIT & LOSS';
        columns = [
          { header: 'Period', key: 'period' },
          { header: 'Gross Profit', key: 'profit', align: 'right' },
          { header: 'Expenses', key: 'expenses', align: 'right' },
          { header: 'Net Profit/Loss', key: 'net', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          period: item.period,
          profit: item.profit,
          expenses: item.expenses,
          net: item.net
        }));
        summary = [{ label: 'Net Total', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'expiring-soon':
        title = 'EXPIRING SOON';
        columns = [
          { header: 'Medicine Name', key: 'name' },
          { header: 'Batch', key: 'batch' },
          { header: 'Expiry Date', key: 'expiry' },
          { header: 'Stock', key: 'stock', align: 'center' }
        ];
        formattedData = (data as any[]).map(item => ({
          name: item.name,
          batch: item.batchNumber,
          expiry: new Date(item.expiryDate).toLocaleDateString(),
          stock: item.stockQuantity
        }));
        break;
      case 'dues':
        title = duesTypeFilter === 'Customer' ? 'CUSTOMER DUES' : 'SUPPLIER REPORT';
        columns = [
          { header: duesTypeFilter === 'Customer' ? 'Customer Name' : 'Supplier Name', key: 'name' },
          { header: 'Phone', key: 'phone' },
          { header: duesTypeFilter === 'Customer' ? 'Total Receivable' : 'Total Payable', key: 'amount', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          name: item.name,
          phone: item.phone || '-',
          amount: item.amount
        }));
        summary = [{ label: duesTypeFilter === 'Customer' ? 'Total Receivable' : 'Total Payable', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'item-wise-sales':
        title = 'ITEM-WISE SALES';
        columns = [
          { header: 'Code', key: 'code' },
          { header: 'Medicine Name', key: 'name' },
          { header: 'Qty Sold', key: 'qty', align: 'center' },
          { header: 'Total Revenue', key: 'total', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          code: item.code || '-',
          name: item.name,
          qty: item.qty,
          total: item.total
        }));
        summary = [{ label: 'Total Revenue', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'expenses':
        title = 'EXPENSE REPORT';
        columns = [
          { header: 'Expense Category', key: 'name' },
          { header: 'Amount', key: 'total', align: 'right' }
        ];
        formattedData = (data as any[]).map(item => ({
          name: item.name,
          total: item.total
        }));
        summary = [{ label: 'Total Expenses', value: totalValue, isBold: true, isSolid: true }];
        break;
      case 'returns':
        title = 'RETURNS REPORT';
        formattedData = (data as any[]).map(item => ({
          name: `${item.referenceNumber || item.invoiceNumber} ${item.customerName || item.supplierName || 'Walk-in'}`,
          qty: 1,
          price: item.total,
          discount: 0,
          total: item.total
        }));
        summary = [{ label: 'Total Returns', value: totalValue, isBold: true, isSolid: true }];
        break;
    }

    if (formattedData.length > 0) {
      setPrintPreviewData({ 
        title, 
        type: title,
        items: formattedData, 
        columns,
        summary,
        total: formattedData.reduce((acc, item) => acc + (item.total || 0), 0)
      });
      setShowPrintPreview(true);
    } else {
      setToast({ message: 'No items found to print', type: 'error' });
      setTimeout(() => setToast(null), 3000);
    }
  }, [view, categories]);
  
  const handleExportPDF = async (share: boolean = false, overrideType?: ViewType) => {
    const type = overrideType || view;
    let title = '';
    let columns: string[] = [];
    let formattedData: any[] = [];
    let totalValue = 0;

    switch (type) {
      case 'sales':
        title = 'SALES REPORT';
        columns = ['Invoice #', 'Customer', 'Date', 'Total', 'Status'];
        formattedData = filteredInvoices.map(item => [
          item.invoiceNumber,
          item.customerName || 'Walk-in',
          new Date(item.date).toLocaleDateString(),
          formatCurrency(item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0)),
          item.status || 'Unpaid'
        ]);
        totalValue = totalSales;
        break;
      case 'purchases':
        title = 'PURCHASE REPORT';
        columns = ['Invoice #', 'Supplier', 'Date', 'Total', 'Status'];
        formattedData = filteredPurchases.map(item => [
          item.invoiceNumber,
          item.supplierName || 'General',
          new Date(item.date).toLocaleDateString(),
          formatCurrency(item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0)),
          item.status || 'Unpaid'
        ]);
        totalValue = totalPurchases;
        break;
      case 'low-stock':
        title = 'LOW STOCK ITEMS REPORT';
        columns = ['Item Code', 'Item Name', 'Quantity', 'Price', 'Total'];
        formattedData = lowStockMeds.map(item => [
          item.code || '-',
          item.name,
          item.stockQuantity,
          formatCurrency(item.purchasePrice || item.salePrice || 0),
          formatCurrency((item.stockQuantity || 0) * (item.purchasePrice || item.salePrice || 0))
        ]);
        totalValue = lowStockMeds.reduce((acc, item) => acc + (item.stockQuantity * (item.purchasePrice || item.salePrice || 0)), 0);
        break;
      case 'full-inventory':
        title = 'FULL INVENTORY REPORT';
        columns = ['Item Code', 'Item Name', 'Quantity', 'Price', 'Total'];
        formattedData = medicines?.map(item => [
          item.code || '-',
          item.name,
          item.stockQuantity,
          formatCurrency(item.purchasePrice || item.salePrice || 0),
          formatCurrency((item.stockQuantity || 0) * (item.purchasePrice || item.salePrice || 0))
        ]) || [];
        totalValue = medicines?.reduce((acc, item) => acc + (item.stockQuantity * (item.purchasePrice || item.salePrice || 0)), 0) || 0;
        break;
      case 'profit-loss':
        title = 'PROFIT & LOSS REPORT';
        columns = ['Period', 'Gross Profit', 'Expenses', 'Net Profit/Loss'];
        // For simplicity, we'll export the current view's data
        formattedData = [[
          filter,
          formatCurrency(totalProfit),
          formatCurrency(totalExpenses),
          formatCurrency(totalProfit - totalExpenses)
        ]];
        totalValue = totalProfit - totalExpenses;
        break;
      case 'expiring-soon':
        title = 'EXPIRING SOON REPORT';
        columns = ['Medicine Name', 'Batch', 'Expiry Date', 'Stock'];
        formattedData = expiringSoonMeds.map(item => [
          item.name,
          item.batchNumber,
          new Date(item.expiryDate).toLocaleDateString(),
          item.stockQuantity
        ]);
        break;
      case 'dues':
        title = duesTypeFilter === 'Customer' ? 'CUSTOMER DUES REPORT' : 'SUPPLIER PAYABLE REPORT';
        columns = [duesTypeFilter === 'Customer' ? 'Customer Name' : 'Supplier Name', 'Phone', 'Amount'];
        
        const rawDuesData = dues?.filter(d => d.status === 'Pending' && d.personType === duesTypeFilter) || [];
        const duesMap = new Map<string, { name: string, amount: number, phone?: string }>();
        rawDuesData.forEach(due => {
          const existing = duesMap.get(due.personName) || { name: due.personName, amount: 0, phone: due.personContact };
          existing.amount += due.remaining;
          duesMap.set(due.personName, existing);
        });
        const aggregatedDues = Array.from(duesMap.values()).filter(d => d.amount > 0);
        
        formattedData = aggregatedDues.map(item => [
          item.name,
          item.phone || '-',
          formatCurrency(item.amount)
        ]);
        totalValue = aggregatedDues.reduce((sum, item) => sum + item.amount, 0);
        break;
      case 'item-wise-sales':
        title = 'ITEM-WISE SALES REPORT';
        columns = ['Code', 'Medicine Name', 'Qty Sold', 'Total Revenue'];
        // Aggregate item sales
        const itemSalesMap = new Map<string, { name: string, code: string, qty: number, total: number }>();
        invoices?.forEach(inv => {
          inv.items.forEach(item => {
            const key = item.medicineId.toString();
            const existing = itemSalesMap.get(key) || { name: item.medicineName, code: item.medicineCode || '', qty: 0, total: 0 };
            existing.qty += item.quantity;
            existing.total += item.total;
            itemSalesMap.set(key, existing);
          });
        });
        const aggregatedSales = Array.from(itemSalesMap.values());
        formattedData = aggregatedSales.map(item => [
          item.code || '-',
          item.name,
          item.qty,
          formatCurrency(item.total)
        ]);
        totalValue = aggregatedSales.reduce((sum, item) => sum + item.total, 0);
        break;
      case 'expenses':
        title = 'EXPENSE REPORT';
        columns = ['Expense Category', 'Amount'];
        const expenseCategoryMap = new Map<string, { name: string, total: number }>();
        expenses?.forEach(exp => {
          const cat = exp.category || 'General';
          const existing = expenseCategoryMap.get(cat) || { name: cat, total: 0 };
          existing.total += exp.amount;
          expenseCategoryMap.set(cat, existing);
        });
        const aggregatedExpenses = Array.from(expenseCategoryMap.values());
        formattedData = aggregatedExpenses.map(item => [
          item.name,
          formatCurrency(item.total)
        ]);
        totalValue = aggregatedExpenses.reduce((sum, item) => sum + item.total, 0);
        break;
      case 'returns':
        title = 'RETURNS REPORT';
        columns = ['Party Name', 'Return Count', 'Total Amount'];
        const returnPartyMap = new Map<string, { name: string, total: number, count: number }>();
        returns?.forEach(ret => {
          const name = ret.customerName || ret.supplierName || 'Walk-in';
          const existing = returnPartyMap.get(name) || { name, total: 0, count: 0 };
          existing.total += ret.totalAmount;
          existing.count += 1;
          returnPartyMap.set(name, existing);
        });
        const aggregatedReturns = Array.from(returnPartyMap.values());
        formattedData = aggregatedReturns.map(item => [
          item.name,
          item.count,
          formatCurrency(item.total)
        ]);
        totalValue = aggregatedReturns.reduce((sum, item) => sum + item.total, 0);
        break;
    }

    if (formattedData.length === 0) {
      setToast({ message: 'No items found to export', type: 'error' });
      setTimeout(() => setToast(null), 3000);
      return;
    }

    const options = {
      title,
      filename: `${type}_report_${new Date().toISOString().split('T')[0]}`,
      columns,
      data: formattedData,
      totals: totalValue > 0 ? [
        { label: 'Total Value', value: formatCurrency(totalValue) }
      ] : []
    };

    if (share) {
      await sharePDFViaWhatsApp(options);
    } else {
      await downloadPDF(options);
    }
  };

  const openCustomerLedgerPrint = async () => {
    const allDues = await db.dues.where('personType').equals('Customer').toArray();
    const allCustomers = await db.customers.toArray();
    
    const aggregated = new Map<string, { name: string, phone: string, total: number, paid: number, remaining: number }>();
    
    allDues.forEach(due => {
      const customer = allCustomers.find(c => c.name === due.personName);
      const existing = aggregated.get(due.personName) || { 
        name: due.personName, 
        phone: customer?.phone || due.personContact || '-', 
        total: 0, 
        paid: 0, 
        remaining: 0 
      };
      existing.total += due.invoiceTotal || 0;
      existing.paid += due.paidAmount || 0;
      existing.remaining += due.remaining || 0;
      aggregated.set(due.personName, existing);
    });

    const data = Array.from(aggregated.values());
    setPrintPreviewData({
      title: 'CUSTOMER DUES LEDGER',
      type: 'CUSTOMER DUES LEDGER',
      items: data.map(item => ({
        name: item.name,
        phone: item.phone,
        total: item.total,
        paid: item.paid,
        remaining: item.remaining
      })),
      total: data.reduce((sum, item) => sum + item.remaining, 0)
    });
    setShowPrintPreview(true);
  };

  const openSupplierLedgerPrint = async () => {
    const allDues = await db.dues.where('personType').equals('Supplier').toArray();
    const allSuppliers = await db.suppliers.toArray();
    
    const aggregated = new Map<string, { name: string, code: string, total: number, paid: number, remaining: number }>();
    
    allDues.forEach(due => {
      const supplier = allSuppliers.find(s => s.name === due.personName);
      const existing = aggregated.get(due.personName) || { 
        name: due.personName, 
        code: supplier?.code || '-', 
        total: 0, 
        paid: 0, 
        remaining: 0 
      };
      existing.total += due.invoiceTotal || 0;
      existing.paid += due.paidAmount || 0;
      existing.remaining += due.remaining || 0;
      aggregated.set(due.personName, existing);
    });

    const data = Array.from(aggregated.values());
    setPrintPreviewData({
      title: 'SUPPLIER PAYABLE LEDGER',
      type: 'SUPPLIER PAYABLE LEDGER',
      items: data.map(item => ({
        name: item.name,
        code: item.code,
        total: item.total,
        paid: item.paid,
        remaining: item.remaining
      })),
      total: data.reduce((sum, item) => sum + item.remaining, 0)
    });
    setShowPrintPreview(true);
  };

  // Handle URL parameters for direct view and print
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewType;

    if (viewParam && ['main', 'sales', 'purchases', 'low-stock', 'expenses', 'expiring-soon', 'profit-loss', 'item-wise-sales', 'dues', 'returns'].includes(viewParam)) {
      setView(viewParam);
    }
  }, []);

  // Sync view state with URL
  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === 'main') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', view);
    }
    window.history.replaceState({}, '', url);
  }, [view]);

  useEffect(() => {
    if (!selectedEntity && !selectedItemAnalysis) {
      setModalSearchQuery('');
    }
  }, [selectedEntity, selectedItemAnalysis]);

  useEffect(() => {
    const fetchItems = async () => {
      if (selectedDue || selectedInvoice) {
        const item = selectedDue || selectedInvoice;
        
        // Fetch party details (contact, address)
        let contact = '';
        let address = '';
        const personName = item.personName || item.customerName || item.supplierName;
        const personType = item.personType || (item.customerName || item.type === 'Sales' ? 'Customer' : 'Supplier');

        if (personName && personName !== 'Walk-in') {
          if (personType === 'Customer') {
            const customer = await db.customers.where('name').equals(personName).first();
            if (customer) {
              contact = customer.phone || '';
              address = customer.address || '';
            }
          } else {
            const supplier = await db.suppliers.where('name').equals(personName).first();
            if (supplier) {
              contact = supplier.phone || '';
              address = supplier.address || '';
            }
          }
        }
        setPartyDetails({ contact, address });

        // If items are already present (e.g. from aggregated view), use them
        if (item.items && Array.isArray(item.items) && item.items.length > 0) {
          setDueItems(item.items.map((i: any) => ({
            name: `${i.medicineCode || ''} ${i.medicineName || i.name}`,
            qty: i.quantity || i.qty,
            price: i.price || i.purchasePrice || i.salePrice,
            discount: i.discount || 0,
            total: i.total
          })));
          return;
        }

        const refNum = item.referenceNumber || item.invoiceNumber;
        if (!refNum) return;
        
        // Handle Returns explicitly
        if (item.type === 'Return' || view === 'returns') {
          const returnRec = await db.returns.where('referenceNumber').equals(refNum).first();
          if (returnRec) {
            setDueItems(returnRec.items.map(i => ({
              name: `${(i as any).medicineCode || (i as any).medicineId?.toString() || ''} ${i.medicineName}`,
              qty: i.quantity,
              price: i.price,
              discount: (i as any).discount || 0,
              total: i.total
            })));
            return;
          }
        }

        // Determine if it's a customer or supplier transaction
        let type = 'Customer';
        if (item.personType) {
          type = item.personType;
        } else if (item.supplierName || item.type === 'Purchase' || (selectedInvoice && !selectedInvoice.customerName && selectedInvoice.supplierName)) {
          type = 'Supplier';
        } else if (item.customerName || item.type === 'Sales' || (selectedInvoice && selectedInvoice.customerName)) {
          type = 'Customer';
        }

        if (type === 'Customer') {
          const invoice = await db.invoices.where('invoiceNumber').equals(refNum).first();
          if (invoice) {
            setDueItems(invoice.items.map(i => ({
              name: `${i.medicineCode || ''} ${i.medicineName}`,
              qty: i.quantity,
              price: i.price,
              discount: i.discount || 0,
              total: i.total
            })));
            if (selectedDue && selectedDue.referenceNumber === refNum && selectedDue.previousRemaining === undefined) {
              setSelectedDue({ ...selectedDue, previousRemaining: invoice.previousRemaining || 0 });
            }
          }
        } else {
          const purchase = await db.purchases.where('invoiceNumber').equals(refNum).first();
          if (purchase) {
            setDueItems(purchase.items.map(i => ({
              name: `${i.medicineCode || ''} ${i.medicineName}`,
              qty: i.quantity,
              price: i.purchasePrice,
              discount: i.discount || 0,
              total: i.total
            })));
            if (selectedDue && selectedDue.referenceNumber === refNum && selectedDue.previousRemaining === undefined) {
              setSelectedDue({ ...selectedDue, previousRemaining: purchase.previousRemaining || 0 });
            }
          }
        }
      } else {
        setDueItems([]);
        setPartyDetails(null);
      }
    };
    fetchItems();
  }, [selectedDue, selectedInvoice, view]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F8') {
        e.preventDefault();
        if (view !== 'main') {
          if (view === 'dues' && selectedDue) {
            printTemplate();
          } else if (['sales', 'purchases', 'returns'].includes(view) && selectedInvoice) {
            printTemplate();
          } else {
            const printBtn = document.getElementById('print-report-btn') || document.getElementById('print-low-stock-btn');
            if (printBtn) {
              (printBtn as HTMLButtonElement).click();
            } else {
              printTemplate();
            }
          }
        } else {
          // For main dashboard, we don't have a specific print section, 
          // but we can print the whole visible area or a specific container if needed.
          printTemplate();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [view, selectedDue, selectedInvoice]);

  const renderDetailView = () => {
    let title = "";
    let icon = TrendingUp;
    let filters: FilterType[] = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
    let data: any[] = [];
    let totalValue = 0;
    let tableHeaders: string[] = [];
    let color = "text-blue-600";
    const now = new Date();

    switch (view) {
      case 'profit-loss':
        title = "Profit & Loss Dashboard";
        icon = TrendingUp;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        totalValue = totalProfit - totalExpenses;
        tableHeaders = ["Period", "Gross Profit", "Expenses", "Net Profit/Loss"];
        color = totalValue >= 0 ? "text-emerald-600" : "text-rose-600";
        
        if (filter === 'Daily') {
          const todayInvoices = invoices?.filter(i => i.date === selectedDate) || [];
          const todayReturns = returns?.filter(r => r.date === selectedDate) || [];
          const todayProfit = todayInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((iSum, item) => {
            const purchasePrice = item.purchasePrice || 0;
            const salePrice = item.salePrice || item.price || 0;
            return iSum + ((salePrice - purchasePrice) * item.quantity);
          }, 0), 0);
          const todayReturnLoss = todayReturns.reduce((sum, ret) => sum + (ret.items || []).reduce((iSum, item) => {
            const purchasePrice = item.purchasePrice || 0;
            const salePrice = item.salePrice || item.price || 0;
            return iSum + ((salePrice - purchasePrice) * item.quantity);
          }, 0), 0);
          const todayExpenses = expenses?.filter(e => e.date === selectedDate).reduce((s, e) => s + e.amount, 0) || 0;
          const grossProfit = todayProfit - todayReturnLoss;
          data = [{
            period: new Date(selectedDate).toLocaleDateString(),
            profit: grossProfit,
            expenses: todayExpenses,
            net: grossProfit - todayExpenses
          }];
        } else if (filter === 'Weekly') {
          data = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayInvoices = invoices?.filter(inv => new Date(inv.date).toDateString() === d.toDateString()) || [];
            const dayReturns = returns?.filter(ret => new Date(ret.date).toDateString() === d.toDateString()) || [];
            const dayProfit = dayInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);
            const dayReturnLoss = dayReturns.reduce((sum, ret) => sum + (ret.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);
            const dayExpenses = expenses?.filter(e => new Date(e.date).toDateString() === d.toDateString()).reduce((s, e) => s + e.amount, 0) || 0;
            const grossProfit = dayProfit - dayReturnLoss;
            return { period: d.toLocaleDateString(), profit: grossProfit, expenses: dayExpenses, net: grossProfit - dayExpenses };
          });
        } else if (filter === 'Monthly') {
          data = Array.from({ length: 30 }).map((_, i) => {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayInvoices = invoices?.filter(inv => new Date(inv.date).toDateString() === d.toDateString()) || [];
            const dayReturns = returns?.filter(ret => new Date(ret.date).toDateString() === d.toDateString()) || [];
            const dayProfit = dayInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);
            const dayReturnLoss = dayReturns.reduce((sum, ret) => sum + (ret.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);
            const dayExpenses = expenses?.filter(e => new Date(e.date).toDateString() === d.toDateString()).reduce((s, e) => s + e.amount, 0) || 0;
            const grossProfit = dayProfit - dayReturnLoss;
            return { period: d.toLocaleDateString(), profit: grossProfit, expenses: dayExpenses, net: grossProfit - dayExpenses };
          });
        } else if (filter === 'Yearly') {
          data = Array.from({ length: 12 }).map((_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStr = d.toLocaleString('default', { month: 'short', year: 'numeric' });
            const monthInvoices = invoices?.filter(inv => {
              const invDate = new Date(inv.date);
              return invDate.getMonth() === d.getMonth() && invDate.getFullYear() === d.getFullYear();
            }) || [];
            const monthReturns = returns?.filter(ret => {
              const retDate = new Date(ret.date);
              return retDate.getMonth() === d.getMonth() && retDate.getFullYear() === d.getFullYear();
            }) || [];
            
            const monthProfit = monthInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);
            
            const monthReturnLoss = monthReturns.reduce((sum, ret) => sum + (ret.items || []).reduce((iSum, item) => {
              const purchasePrice = item.purchasePrice || 0;
              const salePrice = item.salePrice || item.price || 0;
              return iSum + ((salePrice - purchasePrice) * item.quantity);
            }, 0), 0);

            const monthExpenses = expenses?.filter(e => {
              const eDate = new Date(e.date);
              return eDate.getMonth() === d.getMonth() && eDate.getFullYear() === d.getFullYear();
            }).reduce((s, e) => s + e.amount, 0) || 0;
            
            const grossProfit = monthProfit - monthReturnLoss;
            return { period: monthStr, profit: grossProfit, expenses: monthExpenses, net: grossProfit - monthExpenses };
          });
        }

        if (searchQuery) {
          data = data.filter(item => 
            (item.period || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        totalValue = data.reduce((sum, item) => sum + (item.net || 0), 0);
        break;
      case 'item-wise-sales':
        title = "Item-wise Sales Analytics";
        icon = Package;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        color = "text-blue-600";
        tableHeaders = ["Medicine Code", "Medicine Name", "Total Quantity Sold", "Total Sales Amount"];
        
        const itemSalesMap = new Map<string, { id: string, name: string, code: string, qty: number, total: number }>();
        invoices?.forEach(inv => {
          const invDate = new Date(inv.date);
          const isMatch = filter === 'Daily' ? inv.date === selectedDate :
                         filter === 'Weekly' ? invDate >= new Date(new Date(selectedDate).getTime() - 7 * 24 * 60 * 60 * 1000) :
                         filter === 'Monthly' ? invDate >= new Date(new Date(selectedDate).getTime() - 30 * 24 * 60 * 60 * 1000) :
                         invDate >= new Date(new Date(selectedDate).getTime() - 365 * 24 * 60 * 60 * 1000);
          
          if (isMatch) {
            inv.items.forEach(item => {
              const key = item.medicineId.toString();
              const existing = itemSalesMap.get(key) || { id: key, name: item.medicineName, code: item.medicineCode || '', qty: 0, total: 0 };
              existing.qty += item.quantity;
              existing.total += item.total;
              itemSalesMap.set(key, existing);
            });
          }
        });
        data = Array.from(itemSalesMap.values());
        
        if (searchQuery) {
          data = data.filter(item => 
            (item.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (item.code || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        
        totalValue = data.reduce((sum, item) => sum + item.total, 0);
        break;
      case 'sales':
        title = "Sales Report (Individual Invoices)";
        icon = ReceiptIcon;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        color = "text-emerald-600";
        
        // Individual Invoices
        let salesData = invoices || [];
        
        if (filter === 'Daily') {
          salesData = salesData.filter(i => i.date === selectedDate);
        } else if (filter === 'Weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          salesData = salesData.filter(i => new Date(i.date) >= weekAgo);
        } else if (filter === 'Monthly') {
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          salesData = salesData.filter(i => new Date(i.date) >= monthAgo);
        } else if (filter === 'Yearly') {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          salesData = salesData.filter(i => new Date(i.date) >= yearAgo);
        }

        data = salesData;

        if (searchQuery) {
          data = data.filter(inv => 
            ((inv.customerName || 'Walk-in')).toLowerCase().includes(searchQuery.toLowerCase()) ||
            (inv.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        tableHeaders = ["Invoice No", "Customer Name", "Date", "Net Sales", "Status", "Actions"];
        
        const filteredReturnsForSales = returns?.filter(r => r.type === 'Sales' && (
          filter === 'Daily' ? r.date === selectedDate :
          filter === 'Weekly' ? new Date(r.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
          filter === 'Monthly' ? new Date(r.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
          new Date(r.date) >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        )) || [];

        const grossSales = data.reduce((sum, item) => {
          const itemTotal = item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0);
          return sum + itemTotal;
        }, 0);
        
        const salesReturns = filteredReturnsForSales.reduce((sum, item) => sum + item.totalAmount, 0);
        totalValue = grossSales - salesReturns;
        break;
      case 'purchases':
        title = "Purchase Report (Individual Invoices)";
        icon = ShoppingCart;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        color = "text-blue-600";
        
        let purchaseData = purchases || [];
        
        if (filter === 'Daily') {
          purchaseData = purchaseData.filter(p => p.date === selectedDate);
        } else if (filter === 'Weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          purchaseData = purchaseData.filter(p => new Date(p.date) >= weekAgo);
        } else if (filter === 'Monthly') {
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          purchaseData = purchaseData.filter(p => new Date(p.date) >= monthAgo);
        } else if (filter === 'Yearly') {
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          purchaseData = purchaseData.filter(p => new Date(p.date) >= yearAgo);
        }

        data = purchaseData;

        if (searchQuery) {
          data = data.filter(pur => 
            (pur.supplierName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (pur.invoiceNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }

        tableHeaders = ["Invoice No", "Supplier Name", "Date", "Net Purchase", "Status", "Actions"];
        
        const filteredReturnsForPurchases = returns?.filter(r => r.type === 'Purchase' && (
          filter === 'Daily' ? r.date === selectedDate :
          filter === 'Weekly' ? new Date(r.date) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
          filter === 'Monthly' ? new Date(r.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
          new Date(r.date) >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        )) || [];

        const grossPurchases = data.reduce((sum, item) => {
          const itemTotal = item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0);
          return sum + itemTotal;
        }, 0);
        
        const purchaseReturns = filteredReturnsForPurchases.reduce((sum, item) => sum + item.totalAmount, 0);
        totalValue = grossPurchases - purchaseReturns;
        break;
      case 'low-stock':
        title = "Low Stock Inventory Report";
        icon = AlertTriangle;
        filters = [];
        tableHeaders = ["Medicine Name", "Code", "Stock Quantity", "Purchase Price", "Sale Price", "Expiry Date"];
        color = "text-orange-600";
        data = lowStockMeds;
        totalValue = data.reduce((sum, m) => sum + (m.stockQuantity * (m.purchasePrice || m.salePrice || 0)), 0);
        if (searchQuery) {
          data = data.filter(m => 
            (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (m.batchNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        break;
      case 'expenses':
        title = "Expense Report (By Category)";
        icon = Wallet;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly', 'Category-wise'];
        tableHeaders = ["Category", "Expense Count", "Total Amount"];
        color = "text-rose-600";
        let filteredExpenses = expenses || [];
        if (filter === 'Daily') {
          filteredExpenses = filteredExpenses.filter(e => e.date === selectedDate);
        } else if (filter === 'Weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredExpenses = filteredExpenses.filter(e => new Date(e.date) >= weekAgo);
        } else if (filter === 'Monthly') {
          filteredExpenses = filteredExpenses.filter(e => new Date(e.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
        } else if (filter === 'Yearly') {
          filteredExpenses = filteredExpenses.filter(e => new Date(e.date) >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
        }

        // Aggregate by category
        const expenseCategoryMap = new Map<string, { name: string, total: number, count: number, items: any[] }>();
        filteredExpenses.forEach(exp => {
          const cat = exp.category || 'General';
          const existing = expenseCategoryMap.get(cat) || { name: cat, total: 0, count: 0, items: [] };
          existing.total += exp.amount;
          existing.count += 1;
          existing.items.push(exp);
          expenseCategoryMap.set(cat, existing);
        });

        data = Array.from(expenseCategoryMap.values());

        if (searchQuery) {
          data = data.filter(e => 
            (e.name || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        totalValue = data.reduce((sum, item) => sum + (item.total || 0), 0);
        break;
      case 'expiring-soon':
        title = "Expiring Medicines";
        icon = Clock;
        filters = [];
        tableHeaders = ["Medicine Name", "Batch Number", "Expiry Date", "Stock"];
        color = "text-red-700";
        data = expiringSoonMeds;
        if (searchQuery) {
          data = data.filter(m => 
            (m.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            (m.batchNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
          );
        }
        break;
      case 'dues':
        title = duesTypeFilter === 'Customer' ? "Customer Dues (Receivable)" : "Supplier Payable";
        icon = Wallet;
        filters = []; // Remove date filters for dues as it should show total current balance
        color = duesTypeFilter === 'Customer' ? "text-emerald-600" : "text-rose-600";
        tableHeaders = duesTypeFilter === 'Customer' 
          ? ["Customer Name", "Total Receivable", "Last Transaction", "Status"] 
          : ["Supplier Name", "Total Payable", "Last Transaction", "Status"];
        
        const rawDuesData = dues?.filter(d => d.status === 'Pending' && d.personType === duesTypeFilter) || [];
        
        // For Dues/Payable, we show the total current balance independent of the date filter
        let filteredDues = rawDuesData;
        
        // Aggregate dues by person
        const duesMap = new Map<string, { name: string, amount: number, lastDate: string, invoices: any[], phone?: string }>();
        filteredDues.forEach(due => {
          const existing = duesMap.get(due.personName) || { 
            name: due.personName, 
            amount: 0, 
            lastDate: due.date, 
            invoices: [],
            phone: due.personContact 
          };
          existing.amount += due.remaining;
          if (new Date(due.date) > new Date(existing.lastDate)) {
            existing.lastDate = due.date;
          }
          existing.invoices.push(due);
          duesMap.set(due.personName, existing);
        });

        data = Array.from(duesMap.values()).filter(d => d.amount > 0);

        if (searchQuery) {
          data = data.filter(d => 
            (d.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            d.invoices.some((inv: any) => (inv.referenceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }

        totalValue = data.reduce((sum, item) => sum + item.amount, 0);
        break;
      case 'returns':
        title = "Return Reports (By Party)";
        icon = RefreshCw;
        filters = ['Daily', 'Weekly', 'Monthly', 'Yearly'];
        color = "text-orange-600";
        tableHeaders = ["Party Name", "Return Count", "Total Amount"];
        
        const returnData = returns || [];
        let filteredReturns = returnData;
        if (filter === 'Daily') {
          filteredReturns = returnData.filter(r => r.date === selectedDate);
        } else if (filter === 'Weekly') {
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          filteredReturns = returnData.filter(r => new Date(r.date) >= weekAgo);
        } else if (filter === 'Monthly') {
          filteredReturns = returnData.filter(r => new Date(r.date) >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000));
        } else if (filter === 'Yearly') {
          filteredReturns = returnData.filter(r => new Date(r.date) >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000));
        }

        // Aggregate by party
        const returnPartyMap = new Map<string, { name: string, total: number, count: number, items: any[] }>();
        filteredReturns.forEach(ret => {
          const name = ret.customerName || ret.supplierName || 'Walk-in';
          const existing = returnPartyMap.get(name) || { name, total: 0, count: 0, items: [] };
          existing.total += ret.totalAmount;
          existing.count += 1;
          existing.items.push(ret);
          returnPartyMap.set(name, existing);
        });

        data = Array.from(returnPartyMap.values());

        if (searchQuery) {
          data = data.filter(r => 
            (r.name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
            r.items.some((ret: any) => (ret.referenceNumber || '').toLowerCase().includes(searchQuery.toLowerCase()))
          );
        }
        totalValue = data.reduce((sum, item) => sum + (item.total || 0), 0);
        break;
    }

    return (
      <div className="h-full flex flex-col gap-6 overflow-hidden">
        <div className="hidden">
          {selectedDue && (
            <Receipt 
              id="print-container"
              type="Dues"
              invoiceNumber={selectedDue.referenceNumber}
              date={new Date(selectedDue.date).toLocaleDateString()}
              time={new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })}
              partyName={selectedDue.personName}
              partyContact={selectedDue.personType === 'Customer' ? 'Customer' : 'Supplier'}
              items={dueItems}
              subtotal={selectedDue.subtotal}
              discount={selectedDue.discount}
              tax={selectedDue.tax}
              total={selectedDue.invoiceTotal || selectedDue.amount}
              paid={selectedDue.paidAmount || 0}
              remaining={selectedDue.remaining || selectedDue.amount}
              previousRemaining={selectedDue.previousRemaining || 0}
              settings={settings}
            />
          )}
          {selectedInvoice && !selectedDue && (
            <Receipt 
              id="print-container"
              type={view === 'sales' ? 'Sales' : view === 'purchases' ? 'Purchase' : 'Return'}
              invoiceNumber={selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
              date={new Date(selectedInvoice.date).toLocaleDateString()}
              time=""
              partyName={selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
              partyCode={selectedInvoice.partyCode || ""}
              partyContact=""
              items={dueItems}
              subtotal={selectedInvoice.subtotal || selectedInvoice.total || selectedInvoice.totalCost}
              discount={selectedInvoice.discount || 0}
              tax={selectedInvoice.tax || 0}
              total={selectedInvoice.total || selectedInvoice.totalCost || selectedInvoice.totalAmount}
              paid={selectedInvoice.paidAmount || selectedInvoice.totalAmount || 0}
              remaining={selectedInvoice.remainingBalance || 0}
              previousRemaining={selectedInvoice.previousRemaining || 0}
              paymentMethod={selectedInvoice.paymentMethod}
              settings={settings}
            />
          )}
        </div>
        
        <div className="flex flex-col gap-6 flex-1 overflow-hidden print:hidden">
          <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setView('main')}
              className="p-2 hover:bg-slate-100 rounded-xl text-slate-600 transition-all"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-black text-slate-900">{title}</h1>
              <p className="text-slate-500 text-sm">Detailed analysis and records.</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleExportPDF(false)}
              className="p-2 bg-slate-100 text-slate-600 rounded-xl hover:bg-slate-200 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
              title="Download PDF"
            >
              <FileDown size={18} />
              PDF
            </button>
            <button 
              onClick={() => handleExportPDF(true)}
              className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
              title="Share on WhatsApp"
            >
              <Share2 size={18} />
              Share
            </button>
            {(view === 'sales' || view === 'purchases') ? (
              <button 
                id={`print-${view}-report-btn`}
                onClick={() => handlePrintReport(data, totalValue, view)}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-black transition-all hover:bg-blue-700 flex items-center gap-2 shadow-lg shadow-blue-200"
              >
                <Printer size={18} /> PRINT {view.toUpperCase()} REPORT
              </button>
            ) : (
              <button 
                id="print-report-btn"
                onClick={() => handlePrintReport(data, totalValue, view)}
                className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shadow-sm flex items-center gap-2 text-xs font-bold"
                title="Print Report"
              >
                <Printer size={18} />
                Print
              </button>
            )}
            {view === 'dues' && (
              <div className="flex bg-slate-100 p-1 rounded-xl mr-2">
                {(['Customer', 'Supplier'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setDuesTypeFilter(type)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      duesTypeFilter === type 
                        ? "bg-white text-blue-600 shadow-sm" 
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    {type} {type === 'Supplier' ? 'Payable' : 'Dues'}
                  </button>
                ))}
              </div>
            )}
            {filter === 'Daily' && (
              <input 
                type="date"
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
              />
            )}
            {filters.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  filter === f ? "bg-blue-600 text-white shadow-lg shadow-blue-100" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 pb-6">
          {/* Entity Invoices Modal (Drill-down) */}
          {selectedEntity && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-1.5 text-white rounded-lg shadow-sm", 
                      selectedEntity.type === 'Customer' ? "bg-emerald-600" : 
                      selectedEntity.type === 'Supplier' ? "bg-blue-600" :
                      selectedEntity.type === 'Expense' ? "bg-rose-600" : "bg-orange-600"
                    )}>
                      {selectedEntity.type === 'Customer' ? <Users size={14} /> : 
                       selectedEntity.type === 'Supplier' ? <Truck size={14} /> :
                       selectedEntity.type === 'Expense' ? <Wallet size={14} /> : <RefreshCw size={14} />}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{selectedEntity.name}</h3>
                      <p className="text-[8px] text-white/60 leading-none">{selectedEntity.invoices.length} {selectedEntity.type} Records</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntity(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                      type="text" 
                      placeholder={`Search ${selectedEntity.type} records...`}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    {selectedEntity.invoices
                      .filter(inv => {
                        if (!modalSearchQuery) return true;
                        const query = modalSearchQuery.toLowerCase();
                        return (
                          (inv.invoiceNumber?.toLowerCase() || '').includes(query) ||
                          (inv.referenceNumber?.toLowerCase() || '').includes(query) ||
                          (inv.name?.toLowerCase() || '').includes(query) ||
                          (inv.category?.toLowerCase() || '').includes(query) ||
                          (inv.customerName?.toLowerCase() || '').includes(query) ||
                          (inv.supplierName?.toLowerCase() || '').includes(query)
                        );
                      })
                      .map((inv, idx) => (
                      <div 
                        key={`entity-analysis-inv-${inv.id || inv.invoiceNumber || inv.referenceNumber || idx}`} 
                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-all cursor-pointer shadow-sm group"
                        onClick={async () => {
                          if (view === 'dues') {
                            let code = '';
                            const personName = inv.personName || inv.customerName || inv.supplierName || inv.name;
                            if (personName) {
                              if (inv.personType === 'Customer' || inv.customerName) {
                                const customer = await db.customers.where('name').equals(personName).first();
                                code = customer?.code || '';
                              } else {
                                const supplier = await db.suppliers.where('name').equals(personName).first();
                                code = supplier?.code || '';
                              }
                            }
                            setSelectedDue({ ...inv, partyCode: code });
                          } else if (view === 'expenses') {
                            setSelectedExpense(inv);
                          } else {
                            let code = '';
                            if (inv.customerId) {
                              const customer = await db.customers.get(inv.customerId);
                              code = customer?.code || '';
                            } else if (inv.supplierId) {
                              const supplier = await db.suppliers.get(inv.supplierId);
                              code = supplier?.code || '';
                            }
                            setSelectedInvoice({ ...inv, partyCode: code });
                          }
                          setSelectedEntity(null);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-white rounded-md border border-slate-200 text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-colors shadow-sm">
                            <ReceiptIcon size={12} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-900 leading-tight">
                              {inv.invoiceNumber || inv.referenceNumber || inv.name || `Record #${idx + 1}`}
                            </p>
                            <p className="text-[8px] text-slate-500 font-bold">{new Date(inv.date).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-900 leading-tight">
                            {formatCurrency(inv.total || inv.totalCost || inv.amount || inv.totalAmount || 0)}
                          </p>
                          <p className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">View Details</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEntity(null);
                    }}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Supplier Detail Modal */}
          {selectedSupplierDetail && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm">
                      <Truck size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Supplier Profile</h3>
                      <p className="text-[8px] text-white/60 leading-none">{selectedSupplierDetail.name} • {selectedSupplierDetail.code}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSupplierDetail(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-4 no-scrollbar">
                  {/* Supplier Info Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shadow-sm">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Contact Number</p>
                      <p className="text-[10px] font-black text-slate-900 leading-tight">{selectedSupplierDetail.phone || 'N/A'}</p>
                    </div>
                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 shadow-sm md:col-span-2">
                      <p className="text-[8px] font-black text-slate-400 uppercase mb-0.5 tracking-tighter">Address</p>
                      <p className="text-[10px] font-black text-slate-900 leading-tight truncate">{selectedSupplierDetail.address || 'N/A'}</p>
                    </div>
                    <div className="p-2 bg-rose-50 rounded-lg border border-rose-100 shadow-sm">
                      <p className="text-[8px] font-black text-rose-400 uppercase mb-0.5 tracking-tighter">Current Payable</p>
                      <p className="text-[12px] font-black text-rose-600 leading-tight">{formatCurrency(selectedSupplierDetail.currentBalance || 0)}</p>
                    </div>
                  </div>

                  {/* History Sections */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-1">
                      <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Transaction History</h4>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Purchase History */}
                      <div className="space-y-2">
                        <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <ShoppingCart size={10} /> Recent Purchases
                        </h5>
                        <div className="space-y-1.5">
                          {selectedSupplierDetail.purchases?.slice(-5).reverse().map((p: any) => (
                            <div key={p.id} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between shadow-sm group hover:bg-slate-100 transition-colors">
                              <div>
                                <p className="text-[9px] font-black text-slate-900 leading-tight">{p.invoiceNumber}</p>
                                <p className="text-[7px] text-slate-500 font-bold">{new Date(p.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-blue-600 leading-tight">{formatCurrency(p.totalCost)}</p>
                                <p className="text-[7px] text-slate-400 font-bold">Paid: {formatCurrency(p.paidAmount)}</p>
                              </div>
                            </div>
                          ))}
                          {(!selectedSupplierDetail.purchases || selectedSupplierDetail.purchases.length === 0) && (
                            <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                              <p className="text-[9px] text-slate-400 italic">No purchase history</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Payment History */}
                      <div className="space-y-2">
                        <h5 className="text-[8px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                          <Wallet size={10} /> Recent Payments
                        </h5>
                        <div className="space-y-1.5">
                          {selectedSupplierDetail.payments?.slice(-5).reverse().map((p: any) => (
                            <div key={p.id} className="p-2 bg-emerald-50 rounded-lg border border-emerald-100 flex items-center justify-between shadow-sm group hover:bg-emerald-100 transition-colors">
                              <div>
                                <p className="text-[9px] font-black text-slate-900 leading-tight">{p.paymentMethod}</p>
                                <p className="text-[7px] text-slate-500 font-bold">{new Date(p.date).toLocaleDateString()}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-[9px] font-black text-emerald-600 leading-tight">{formatCurrency(p.amount)}</p>
                                <p className="text-[7px] text-slate-400 font-bold">Bal: {formatCurrency(p.remainingBalance)}</p>
                              </div>
                            </div>
                          ))}
                          {(!selectedSupplierDetail.payments || selectedSupplierDetail.payments.length === 0) && (
                            <div className="p-4 text-center bg-slate-50 rounded-lg border border-dashed border-slate-200">
                              <p className="text-[9px] text-slate-400 italic">No payment history</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSupplierDetail(null);
                    }}
                    className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}          {/* Dues Detail Modal */}
          {selectedDue && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-orange-600 text-white rounded-lg">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Due Details</h3>
                      <p className="text-[8px] text-white/60 leading-none">Invoice: {selectedDue.referenceNumber}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDue(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  {/* Party Details Section */}
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-2 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Party Name</p>
                        <p className="text-xs font-black text-slate-900 leading-tight">{selectedDue.personName}</p>
                        {selectedDue.partyCode && <p className="text-[8px] text-slate-500 font-bold">Code: {selectedDue.partyCode}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Date</p>
                        <p className="text-[9px] font-bold text-slate-900">{new Date(selectedDue.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-slate-200/60">
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Contact Number</p>
                        <p className="text-[9px] font-bold text-slate-700">{partyDetails?.contact || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Address</p>
                        <p className="text-[9px] font-bold text-slate-700 truncate">{partyDetails?.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Previous Balance</p>
                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(selectedDue.previousRemaining || 0)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Invoice Total</p>
                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(selectedDue.invoiceTotal || 0)}</p>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">Grand Total</p>
                        <p className="text-[11px] font-black text-blue-700">
                          {formatCurrency((selectedDue.previousRemaining || 0) + (selectedDue.invoiceTotal || 0))}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Paid Amount</p>
                        <p className="text-[10px] font-black text-emerald-700">{formatCurrency(selectedDue.paidAmount || 0)}</p>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 bg-rose-50/50 -mx-2.5 px-2.5 py-1">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-tighter">Remaining Balance</p>
                        <p className="text-sm font-black text-rose-700">
                          {formatCurrency(((selectedDue.previousRemaining || 0) + (selectedDue.invoiceTotal || 0)) - (selectedDue.paidAmount || 0))}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col h-[180px] shrink-0 shadow-sm">
                    <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                      <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Invoice Items</h4>
                      <span className="text-[8px] font-bold text-slate-500">{dueItems.length} Items</span>
                    </div>
                    <div className="flex-1 overflow-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                          <tr className="text-[7px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                            <th className="px-2 py-1.5">Item Name</th>
                            <th className="px-2 py-1.5 text-center">Qty</th>
                            <th className="px-2 py-1.5 text-right">Price</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dueItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5">
                                <p className="text-[9px] font-bold text-slate-900 leading-tight">{item.name}</p>
                                <p className="text-[7px] text-slate-400 font-mono">{item.code}</p>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className="text-[9px] font-bold text-slate-700">{item.qty}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <span className="text-[9px] font-bold text-slate-700">{formatCurrency(item.price)}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <span className="text-[9px] font-black text-slate-900">{formatCurrency(item.total)}</span>
                              </td>
                            </tr>
                          ))}
                          {dueItems.length === 0 && (
                            <tr>
                              <td colSpan={4} className="px-2 py-8 text-center text-slate-400 text-[9px] italic">No items found</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDue(null);
                    }}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
                  >
                    Close
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={async () => {
                        const refNum = selectedDue.referenceNumber;
                        const invoice = await db.invoices.where('invoiceNumber').equals(refNum).first();
                        if (invoice) {
                          onEditInvoice?.(invoice.id!, 'Sales');
                          setSelectedDue(null);
                          return;
                        }
                        const purchase = await db.purchases.where('invoiceNumber').equals(refNum).first();
                        if (purchase) {
                          onEditInvoice?.(purchase.id!, 'Purchase');
                          setSelectedDue(null);
                          return;
                        }
                      }}
                      className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Invoice/Return Detail Modal */}
          {selectedInvoice && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm print:hidden">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                      <ReceiptIcon size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{selectedInvoice.type === 'Return' ? 'Return Details' : 'Invoice Details'}</h3>
                      <p className="text-[8px] text-white/60 leading-none">Ref: {selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInvoice(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  {/* Party Details Section */}
                  <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-2 shadow-sm">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Party Name</p>
                        <p className="text-xs font-black text-slate-900 leading-tight">{selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}</p>
                        {selectedInvoice.partyCode && <p className="text-[8px] text-slate-500 font-bold">Code: {selectedInvoice.partyCode}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Date</p>
                        <p className="text-[9px] font-bold text-slate-900">{new Date(selectedInvoice.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1.5 border-t border-slate-200/60">
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Contact Number</p>
                        <p className="text-[9px] font-bold text-slate-700">{partyDetails?.contact || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Address</p>
                        <p className="text-[9px] font-bold text-slate-700 truncate">{partyDetails?.address || 'N/A'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <div className="bg-slate-50 rounded-lg border border-slate-200 p-2.5 space-y-1.5 shadow-sm">
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Previous Balance</p>
                        <p className="text-[10px] font-black text-slate-900">{formatCurrency(selectedInvoice.previousRemaining || 0)}</p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">Invoice Total</p>
                        <p className="text-[10px] font-black text-slate-900">
                          {formatCurrency(
                            (selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)
                          )}
                        </p>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60">
                        <p className="text-[9px] font-bold text-blue-600 uppercase tracking-tighter">Grand Total</p>
                        <p className="text-[11px] font-black text-blue-700">
                          {formatCurrency(
                            (selectedInvoice.previousRemaining || 0) + 
                            ((selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0))
                          )}
                        </p>
                      </div>
                      <div className="flex justify-between items-center">
                        <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-tighter">Paid Amount</p>
                        <p className="text-[10px] font-black text-emerald-700">{formatCurrency(selectedInvoice.paidAmount || 0)}</p>
                      </div>
                      <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 bg-rose-50/50 -mx-2.5 px-2.5 py-1">
                        <p className="text-[10px] font-black text-rose-600 uppercase tracking-tighter">Remaining Balance</p>
                        <p className="text-sm font-black text-rose-700">
                          {formatCurrency(
                            ((selectedInvoice.previousRemaining || 0) + 
                            ((selectedInvoice.subtotal || 0) - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0))) - 
                            (selectedInvoice.paidAmount || 0)
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Items Table */}
                  <div className="bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col h-[180px] shrink-0 shadow-sm">
                    <div className="bg-slate-50 px-2 py-1.5 border-b border-slate-200 flex items-center justify-between shrink-0">
                      <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Invoice Items</h4>
                      <span className="text-[8px] font-bold text-slate-500">{dueItems.length} Items</span>
                    </div>
                    <div className="flex-1 overflow-auto no-scrollbar">
                      <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 bg-slate-50 z-10 shadow-sm">
                          <tr className="text-[7px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200">
                            <th className="px-2 py-1.5">Item Name</th>
                            <th className="px-2 py-1.5 text-center">Qty</th>
                            <th className="px-2 py-1.5 text-right">Price</th>
                            <th className="px-2 py-1.5 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {dueItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                              <td className="px-2 py-1.5">
                                <p className="text-[9px] font-bold text-slate-900 leading-tight">{item.name}</p>
                                <p className="text-[7px] text-slate-400 font-mono">{item.code}</p>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className="text-[9px] font-bold text-slate-700">{item.qty}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <span className="text-[9px] font-bold text-slate-700">{formatCurrency(item.price)}</span>
                              </td>
                              <td className="px-2 py-1.5 text-right">
                                <span className="text-[9px] font-black text-slate-900">{formatCurrency(item.total)}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedInvoice(null);
                    }}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
                  >
                    Close
                  </button>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        const type = selectedInvoice.customerName || selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase';
                        onEditInvoice?.(selectedInvoice.id, type);
                        setSelectedInvoice(null);
                      }}
                      className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-all flex items-center gap-1.5 shadow-sm"
                    >
                      <Edit2 size={10} /> Edit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Medicine Detail Modal */}
          {selectedMedicine && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-[280px] overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-indigo-600 text-white rounded-lg">
                      <Package size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Medicine</h3>
                      <p className="text-[8px] text-white/60 leading-none">{selectedMedicine.category}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedicine(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="p-3 space-y-3">
                  <div className="p-2.5 bg-indigo-50 rounded-lg border border-indigo-100 text-center shadow-sm">
                    <p className="text-[7px] font-bold text-indigo-400 uppercase mb-0.5 tracking-tighter">Current Stock</p>
                    <p className="text-xl font-black text-indigo-600 leading-none">{selectedMedicine.stock}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-sm">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Name</span>
                      <span className="font-bold text-slate-900 text-right max-w-[140px] truncate">{selectedMedicine.name}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Category</span>
                      <span className="font-bold text-slate-900">{selectedMedicine.category}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Min Level</span>
                      <span className="font-bold text-slate-900">{selectedMedicine.minStock}</span>
                    </div>
                    {selectedMedicine.expiryDate && (
                      <div className="flex justify-between text-[9px]">
                        <span className="text-slate-400 font-bold uppercase tracking-tighter">Expiry</span>
                        <span className={cn("font-bold", new Date(selectedMedicine.expiryDate) < new Date() ? "text-rose-600" : "text-slate-900")}>
                          {new Date(selectedMedicine.expiryDate).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedMedicine(null);
                    }}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Expense Detail Modal */}
          {selectedExpense && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-[280px] overflow-hidden flex flex-col">
                <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-rose-600 text-white rounded-lg shadow-sm">
                      <Wallet size={14} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">Expense</h3>
                      <p className="text-[8px] text-white/60 leading-none">{selectedExpense.category}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExpense(null);
                    }}
                    className="p-1 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="p-3 space-y-3">
                  <div className="p-2.5 bg-rose-50 rounded-lg border border-rose-100 text-center shadow-sm">
                    <p className="text-[7px] font-bold text-rose-400 uppercase mb-0.5 tracking-tighter">Amount Spent</p>
                    <p className="text-xl font-black text-rose-600 leading-none">{formatCurrency(selectedExpense.amount || 0)}</p>
                  </div>

                  <div className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-100 shadow-sm">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Name</span>
                      <span className="font-bold text-slate-900 text-right max-w-[140px] truncate">{selectedExpense.name}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Category</span>
                      <span className="font-bold text-slate-900">{selectedExpense.category}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-slate-400 font-bold uppercase tracking-tighter">Date</span>
                      <span className="font-bold text-slate-900">{new Date(selectedExpense.date).toLocaleDateString()}</span>
                    </div>
                    {selectedExpense.notes && (
                      <div className="pt-1.5 border-t border-slate-200/60">
                        <p className="text-[7px] font-bold text-slate-400 uppercase mb-0.5 tracking-tighter">Notes</p>
                        <p className="text-[9px] text-slate-600 italic leading-tight">{selectedExpense.notes}</p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end gap-2 shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedExpense(null);
                    }}
                    className="px-4 py-1.5 text-[10px] font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-all border border-slate-200"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Item Analysis Modal */}
          {selectedItemAnalysis && (
            <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[80vh]">
                <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white shrink-0">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-blue-600 text-white rounded-lg">
                      <Package size={14} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sales Analysis</h3>
                      <p className="text-[9px] text-white/60 leading-none">{selectedItemAnalysis.name}</p>
                    </div>
                  </div>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemAnalysis(null);
                    }}
                    className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <X size={16} className="text-white/60" />
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 no-scrollbar">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                    <input 
                      type="text" 
                      placeholder="Search related invoices..."
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] outline-none focus:ring-1 focus:ring-blue-500 shadow-sm"
                      value={modalSearchQuery}
                      onChange={(e) => setModalSearchQuery(e.target.value)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <h4 className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Related Invoices</h4>
                    <span className="text-[8px] font-bold text-slate-500">{selectedItemAnalysis.invoices.length} Invoices</span>
                  </div>
                  <div className="space-y-1.5">
                    {selectedItemAnalysis.invoices
                      .filter(inv => {
                        if (!modalSearchQuery) return true;
                        const query = modalSearchQuery.toLowerCase();
                        return (
                          (inv.invoiceNumber?.toLowerCase() || '').includes(query) ||
                          (inv.customerName?.toLowerCase() || '').includes(query) ||
                          (inv.supplierName?.toLowerCase() || '').includes(query)
                        );
                      })
                      .map((inv, idx) => (
                      <div 
                        key={`item-analysis-inv-${inv.id || inv.invoiceNumber || idx}`} 
                        className="p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between hover:bg-slate-100 transition-all cursor-pointer shadow-sm group"
                        onClick={async () => {
                          let code = '';
                          if (inv.customerId) {
                            const customer = await db.customers.get(inv.customerId);
                            code = customer?.code || '';
                          } else if (inv.supplierId) {
                            const supplier = await db.suppliers.get(inv.supplierId);
                            code = supplier?.code || '';
                          }
                          setSelectedInvoice({ ...inv, partyCode: code });
                          setSelectedItemAnalysis(null);
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-1.5 bg-white rounded-md border border-slate-200 text-slate-400 group-hover:text-blue-500 group-hover:border-blue-200 transition-colors shadow-sm">
                            <ReceiptIcon size={12} />
                          </div>
                          <div>
                            <p className="text-[10px] font-black text-slate-900 leading-tight">{inv.invoiceNumber}</p>
                            <p className="text-[8px] text-slate-500 font-bold">{inv.customerName || inv.supplierName || 'Walk-in'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-black text-slate-900 leading-tight">{formatCurrency(inv.total || inv.totalCost || 0)}</p>
                          <p className="text-[8px] text-slate-400 font-bold">{new Date(inv.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    ))}
                    {selectedItemAnalysis.invoices.length === 0 && (
                      <p className="text-center text-[10px] text-slate-400 italic py-4">No related invoices found</p>
                    )}
                  </div>
                </div>

                <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 flex justify-end shrink-0">
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedItemAnalysis(null);
                    }}
                    className="px-4 py-1.5 bg-slate-900 text-white text-[10px] font-bold rounded-lg hover:bg-slate-800 transition-all shadow-sm"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Hidden Print Layout */}
          <div className="hidden">
            {selectedDue && (
              <Receipt 
                id="print-container"
                type={selectedDue.personType === 'Customer' ? 'Sales' : 'Purchase'}
                invoiceNumber={selectedDue.referenceNumber}
                date={new Date(selectedDue.date).toLocaleDateString()}
                time=""
                partyName={selectedDue.personName}
                partyContact={selectedDue.personContact || ''}
                items={dueItems}
                subtotal={selectedDue.subtotal || selectedDue.invoiceTotal}
                discount={selectedDue.discount || 0}
                tax={selectedDue.tax || 0}
                total={selectedDue.invoiceTotal || 0}
                paid={selectedDue.paidAmount ?? 0}
                remaining={selectedDue.remaining ?? 0}
                previousRemaining={selectedDue.previousRemaining || 0}
                settings={settings}
              />
            )}
            {selectedInvoice && (
              <Receipt 
                id="print-container"
                type={selectedInvoice.type === 'Return' ? 'Return' : (selectedInvoice.customerName || selectedInvoice.type === 'Sales' ? 'Sales' : 'Purchase')}
                invoiceNumber={selectedInvoice.invoiceNumber || selectedInvoice.referenceNumber}
                date={new Date(selectedInvoice.date).toLocaleDateString()}
                time=""
                partyName={selectedInvoice.customerName || selectedInvoice.supplierName || 'Walk-in'}
                partyContact=""
                items={dueItems}
                subtotal={selectedInvoice.subtotal || selectedInvoice.total || selectedInvoice.totalCost}
                discount={selectedInvoice.discount || 0}
                tax={selectedInvoice.tax || 0}
                total={selectedInvoice.type === 'Purchase' || selectedInvoice.supplierName ? (selectedInvoice.totalCost - (selectedInvoice.discount || 0) + (selectedInvoice.tax || 0)) : (selectedInvoice.total || selectedInvoice.totalCost || selectedInvoice.totalAmount)}
                paid={selectedInvoice.paidAmount || selectedInvoice.totalAmount || 0}
                remaining={selectedInvoice.remainingAmount || selectedInvoice.remainingBalance || 0}
                previousRemaining={selectedInvoice.previousRemaining || 0}
                paymentMethod={selectedInvoice.paymentMethod}
                settings={settings}
              />
            )}
          </div>

          {/* Summary Row */}
          {(view === 'sales' || view === 'purchases' || view === 'expenses' || view === 'returns' || view === 'item-wise-sales' || view === 'profit-loss') && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className={cn("p-3 rounded-xl bg-slate-50", color)}>
                  <DollarSign size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {view === 'profit-loss' ? 'Net Profit/Loss' : `Total ${view.replace('-', ' ')}`}
                  </p>
                  <p className="text-2xl font-black text-slate-900">{formatCurrency(totalValue)}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-50 text-blue-600">
                  <Activity size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Records</p>
                  <p className="text-2xl font-black text-slate-900">{data.length}</p>
                </div>
              </div>
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="p-3 rounded-xl bg-slate-50 text-emerald-600">
                  <TrendingUp size={24} />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                  <p className="text-2xl font-black text-emerald-600">Active</p>
                </div>
              </div>
            </div>
          )}

          {/* Table Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <h3 className="font-bold text-slate-900">Low Stock Records</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search medicines..."
                  className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto no-scrollbar">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-widest sticky top-0 z-10 shadow-sm">
                  <tr>
                    {tableHeaders.map((h, i) => <th key={`${h}-${i}`} className="px-6 py-4 border-b border-slate-200">{h}</th>)}
                    {view !== 'low-stock' && view !== 'expiring-soon' && !tableHeaders.includes('Status') && <th className="px-6 py-4 text-center border-b border-slate-200">Status</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {view === 'profit-loss' && (data as any[]).map((item, idx) => {
                    return (
                      <tr 
                        key={`pl-${item.period}-${idx}`} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={() => {
                          setSearchQuery(item.period);
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.period}</td>
                        <td className="px-6 py-4 text-sm text-emerald-600 font-bold">{formatCurrency(item.profit || 0)}</td>
                        <td className="px-6 py-4 text-sm text-rose-600 font-bold">{formatCurrency(item.expenses || 0)}</td>
                        <td className={cn("px-6 py-4 text-sm font-black text-right", item.net >= 0 ? "text-emerald-700" : "text-rose-700")}>
                          {formatCurrency(item.net || 0)}
                        </td>
                      </tr>
                    );
                  })}
                  {view === 'item-wise-sales' && (data as any[]).map((item, idx) => (
                    <tr 
                      key={`item-sale-${item.id || idx}`} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={async () => {
                        const allInvoices = await db.invoices.toArray();
                        const relatedInvoices = allInvoices.filter(inv => 
                          inv.items.some(i => i.medicineId.toString() === item.id || i.medicineName === item.name)
                        );
                        setSelectedItemAnalysis({ name: item.name, invoices: relatedInvoices });
                      }}
                    >
                      <td className="px-6 py-4 text-sm text-slate-500 font-mono">{item.code || '-'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.qty}</td>
                      <td className="px-6 py-4 text-sm font-black text-blue-600 text-right">{formatCurrency(item.total || 0)}</td>
                    </tr>
                  ))}
                  {view === 'sales' && (data as any[]).map((item, idx) => {
                    return (
                      <tr 
                        key={`sale-${item.id || item.invoiceNumber || idx}`} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={async () => {
                          let code = '';
                          if (item.customerId) {
                            const customer = await db.customers.get(item.customerId);
                            code = customer?.code || '';
                          }
                          setSelectedInvoice({ ...item, partyCode: code });
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.invoiceNumber}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.customerName || 'Walk-in'}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-black text-emerald-600 text-right">
                          {formatCurrency(item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            item.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : 
                            item.status === 'Partially Paid' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {item.status || 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditInvoice?.(item.id, 'Sales');
                            }}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {view === 'purchases' && (data as any[]).map((item, idx) => {
                    return (
                      <tr 
                        key={`purchase-${item.id || item.invoiceNumber || idx}`} 
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                        onClick={async () => {
                          let code = '';
                          if (item.supplierId) {
                            const supplier = await db.suppliers.get(item.supplierId);
                            code = supplier?.code || '';
                          }
                          setSelectedInvoice({ ...item, partyCode: code });
                        }}
                      >
                        <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.invoiceNumber}</td>
                        <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.supplierName}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{new Date(item.date).toLocaleDateString()}</td>
                        <td className="px-6 py-4 text-sm font-black text-blue-600 text-right">
                          {formatCurrency(item.subtotal !== undefined ? ((item.subtotal || 0) - (item.discount || 0) + (item.tax || 0)) : (item.total || 0))}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={cn(
                            "px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider",
                            item.status === 'Paid' ? "bg-emerald-100 text-emerald-700" : 
                            item.status === 'Partially Paid' ? "bg-blue-100 text-blue-700" : "bg-rose-100 text-rose-700"
                          )}>
                            {item.status || 'Unpaid'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center flex items-center justify-center gap-2">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              onEditInvoice?.(item.id, 'Purchase');
                            }}
                            className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Edit Invoice"
                          >
                            <Edit2 size={12} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {view === 'expenses' && (data as any[]).map((item, idx) => (
                    <tr 
                      key={`expense-${item.name || idx}`} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntity({ name: item.name, type: 'Expense', invoices: item.items })}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.count} Records</td>
                      <td className="px-6 py-4 text-sm font-black text-rose-600 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">View All</span>
                      </td>
                    </tr>
                  ))}
                  {view === 'low-stock' && (data as any[]).map(item => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer bg-orange-50/30"
                      onClick={async () => {
                        const id = parseInt(item.id);
                        if (!isNaN(id)) {
                          const med = await db.medicines.get(id);
                          setSelectedMedicine(med || {
                            name: item.name,
                            category: item.category || 'General',
                            stock: item.stockQuantity,
                            minStock: item.minStockLimit
                          });
                        } else {
                          setSelectedMedicine({
                            name: item.name,
                            category: item.category || 'General',
                            stock: item.stockQuantity,
                            minStock: item.minStockLimit
                          });
                        }
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.code || '-'}</td>
                      <td className="px-6 py-4 text-sm font-black text-orange-600">{item.stockQuantity}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(item.purchasePrice)}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(item.salePrice)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{item.expiryDate ? new Date(item.expiryDate).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))}
                  {view === 'expiring-soon' && (data as any[]).map(item => (
                    <tr 
                      key={item.id} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer bg-red-50/30"
                      onClick={async () => {
                        const id = parseInt(item.id);
                        if (!isNaN(id)) {
                          const med = await db.medicines.get(id);
                          setSelectedMedicine(med || {
                            name: item.name,
                            category: 'General',
                            stock: item.stockQuantity,
                            expiryDate: item.expiryDate
                          });
                        } else {
                          setSelectedMedicine({
                            name: item.name,
                            category: 'General',
                            stock: item.stockQuantity,
                            expiryDate: item.expiryDate
                          });
                        }
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm font-mono text-slate-500">{item.batchNumber}</td>
                      <td className="px-6 py-4 text-sm font-black text-red-600">{new Date(item.expiryDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{item.stockQuantity}</td>
                    </tr>
                  ))}
                  {view === 'dues' && (data as any[]).map((item, idx) => (
                    <tr 
                      key={`due-${item.name || idx}`} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={async () => {
                        let allInvoices: any[] = [];
                        if (item.name) {
                          if (duesTypeFilter === 'Customer') {
                            allInvoices = await db.invoices.where('customerName').equals(item.name).toArray();
                          } else {
                            allInvoices = await db.purchases.where('supplierName').equals(item.name).toArray();
                          }
                        }
                        // Also include pending dues that might not have a full invoice record (e.g. manual dues)
                        const pendingDues = dues?.filter(d => d.personName === item.name && d.status === 'Pending' && d.personType === duesTypeFilter) || [];
                        
                        // Merge and deduplicate by reference/invoice number
                        const merged = [...allInvoices, ...pendingDues];
                        const unique = Array.from(new Map(merged.map(m => [m.invoiceNumber || m.referenceNumber, m])).values());
                        
                        setSelectedEntity({ name: item.name, type: duesTypeFilter as any, invoices: unique });
                      }}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{formatCurrency(item.amount || 0)}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{new Date(item.lastDate).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">Pending</span>
                      </td>
                    </tr>
                  ))}
                  {view === 'returns' && (data as any[]).map((item, idx) => (
                    <tr 
                      key={`return-${item.name || idx}`} 
                      className="hover:bg-slate-50 transition-colors cursor-pointer"
                      onClick={() => setSelectedEntity({ name: item.name, type: 'Return', invoices: item.items })}
                    >
                      <td className="px-6 py-4 text-sm font-bold text-slate-900">{item.name}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{item.count} Returns</td>
                      <td className="px-6 py-4 text-sm font-black text-orange-600 text-right">{formatCurrency(item.total || 0)}</td>
                      <td className="px-6 py-4 text-center">
                        <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-[10px] font-bold uppercase tracking-wider">View All</span>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 && (
                    <tr><td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">No records found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="min-h-full">
      {view !== 'main' ? renderDetailView() : (
        <div className="flex flex-col gap-3 pb-4 print:hidden">
          {/* Dashboard Header with Filters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
        <div>
          <h1 className="text-xl font-black text-slate-900 leading-tight">Dashboard Overview</h1>
          <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Real-time business performance</p>
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full sm:w-auto">
          {filter === 'Daily' && (
            <input 
              type="date"
              className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[10px] font-bold outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          )}
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {(['Daily', 'Weekly', 'Monthly', 'Yearly'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-[9px] font-bold transition-all",
                  filter === f ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Top Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        <StatCard 
          title="Sales" 
          value={formatCurrency(totalSales)} 
          icon={TrendingUp} 
          color="bg-emerald-500"
          onClick={() => setView('sales')}
        />
        <StatCard 
          title="Purchases" 
          value={formatCurrency(totalPurchases)} 
          icon={ShoppingCart} 
          color="bg-blue-600 ring-2 ring-white/20 shadow-lg shadow-blue-500/20"
          onClick={() => setView('purchases')}
        />
        <StatCard 
          title="Profit & Loss" 
          value={formatCurrency(totalProfit)} 
          icon={TrendingUp} 
          color={totalProfit >= 0 ? "bg-emerald-600" : "bg-rose-600"}
          onClick={() => setView('profit-loss')}
        />
        <StatCard 
          title="Expenses" 
          value={formatCurrency(totalExpenses)} 
          icon={Wallet} 
          color="bg-rose-500"
          onClick={() => setView('expenses')}
        />
        <StatCard 
          title="Low Stock" 
          value={lowStockMeds.length} 
          icon={AlertTriangle} 
          color="bg-orange-500"
          onClick={() => setView('low-stock')}
        />
        <StatCard 
          title="Expiry Items" 
          value={expiringSoonMeds.length} 
          icon={Clock} 
          color="bg-red-700"
          onClick={() => setView('expiring-soon')}
        />
      </div>

      {/* Second Row Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 shrink-0">
        <div className="lg:col-span-3">
          <StatCard 
            title="Returns" 
            value={formatCurrency(totalReturns)} 
            icon={RefreshCw} 
            color="bg-orange-600"
            onClick={() => setView('returns')}
          />
        </div>
        <div className="lg:col-span-6">
          <AdvancedDuesCard 
            customerDues={totalCustomerDues}
            supplierDues={totalSupplierPayable}
            onCustomerClick={() => {
              setView('dues');
              setDuesTypeFilter('Customer');
            }}
            onSupplierClick={() => {
              setView('dues');
              setDuesTypeFilter('Supplier');
            }}
            onCustomerPrint={openCustomerLedgerPrint}
            onSupplierPrint={openSupplierLedgerPrint}
          />
        </div>
        <div className="lg:col-span-3">
          <StatCard 
            title="Item-wise Sales" 
            value="View Analysis" 
            icon={Package} 
            color="bg-blue-600"
            onClick={() => setView('item-wise-sales')}
          />
        </div>
      </div>

      {/* Middle Charts - REMOVED */}

      {/* Bottom Section: Last Items Section & Expiring Medicines */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 shrink-0">
        <DashboardSection 
          title="Low Stock Medicines"
          action={
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setView('low-stock')}
                className="text-[10px] font-bold text-blue-600 hover:underline"
              >
                View All
              </button>
            </div>
          }
        >
          <div className="space-y-1.5">
            {lowStockMeds.slice(0, 5).map((med, i) => (
              <div key={med.id || `low-stock-stat-${i}`} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white rounded-md text-orange-400">
                    <AlertTriangle size={12} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-900 truncate max-w-[120px]">{med.name}</p>
                    <p className="text-[8px] text-slate-500">Min: {med.minStockLimit}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-orange-600">Stock: {med.stockQuantity}</p>
                  <p className="text-[8px] text-slate-400">Batch: {med.batchNumber}</p>
                </div>
              </div>
            ))}
            {lowStockMeds.length === 0 && (
              <p className="text-center text-[9px] text-slate-400 italic py-2">No low stock items</p>
            )}
          </div>
        </DashboardSection>

        <DashboardSection 
          title="Last Created Invoices"
          action={
            <button 
              onClick={() => {
                setView('sales');
                setFilter('Daily');
              }}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              title="View All Sales"
            >
              <span className="text-[10px] font-bold text-blue-600 hover:underline">View All</span>
            </button>
          }
        >
          <div className="space-y-1.5">
            {invoices?.slice(-5).reverse().map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100 group">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white rounded-md text-slate-400">
                    <ReceiptIcon size={12} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-900 truncate max-w-[120px]">{inv.invoiceNumber} - {inv.customerName || 'Walk-in'}</p>
                    <p className="text-[8px] text-slate-500">{new Date(inv.date).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-black text-emerald-600">{formatCurrency(inv.total)}</p>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditInvoice?.(inv.id, 'Sales');
                    }}
                    className="p-1 bg-blue-50 text-blue-600 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Edit Invoice"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>
              </div>
            ))}
            {(!invoices || invoices.length === 0) && (
              <p className="text-center text-[9px] text-slate-400 italic py-2">No invoices found</p>
            )}
          </div>
        </DashboardSection>

        <DashboardSection 
          title="Expiring Medicines"
          action={
            <button 
              onClick={() => setView('expiring-soon')}
              className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors"
              title="View All Expiring"
            >
              <X size={12} className="hidden" /> {/* Placeholder to keep spacing if needed, but button is fine */}
              <span className="text-[10px] font-bold text-blue-600 hover:underline">View All</span>
            </button>
          }
        >
          <div className="space-y-1.5">
            {expiringMedsList.slice(0, 5).map((med, i) => (
              <div key={med.id || `expiring-stat-${i}`} className="flex items-center justify-between p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-1 bg-white rounded-md text-red-400">
                    <Clock size={12} />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-900 truncate max-w-[120px]">{med.name}</p>
                    <p className="text-[8px] text-slate-500">Exp: {new Date(med.expiryDate).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-700">Stock: {med.stockQuantity}</p>
                  <p className="text-[8px] text-slate-400">Batch: {med.batchNumber}</p>
                </div>
              </div>
            ))}
            {expiringMedsList.length === 0 && (
              <p className="text-center text-[9px] text-slate-400 italic py-2">No medicines expiring soon</p>
            )}
          </div>
        </DashboardSection>
      </div>
    </div>
  )}

      {/* Print Preview Modal */}
      <PrintPreviewModal 
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        title={printPreviewData?.title || 'Print Preview'}
        type={printPreviewData?.type || 'Report'}
        items={printPreviewData?.items || []}
        columns={printPreviewData?.columns}
        total={printPreviewData?.total}
        subtotal={printPreviewData?.subtotal}
        discount={printPreviewData?.discount}
        tax={printPreviewData?.tax}
        paid={printPreviewData?.paid}
        remaining={printPreviewData?.remaining}
        previousRemaining={printPreviewData?.previousRemaining}
        paymentMethod={printPreviewData?.paymentMethod}
        invoiceNumber={printPreviewData?.invoiceNumber}
        date={printPreviewData?.date}
        time={printPreviewData?.time}
        partyName={printPreviewData?.partyName}
        partyContact={printPreviewData?.partyContact}
        partyAddress={printPreviewData?.partyAddress}
        summary={printPreviewData?.summary}
        settings={settings}
      />

      {/* Hidden Print Report Section */}
      <div className="hidden">
        {printReportData && !selectedDue && !selectedInvoice && (
          <Receipt 
            id="print-report-container"
            type={printReportData.title}
            items={printReportData.data}
            columns={printReportData.columns}
            summary={printReportData.summary}
            total={printReportData.total}
            settings={settings}
          />
        )}
        {printPreviewData && !printReportData && !selectedDue && !selectedInvoice && (
          <Receipt 
            id="print-container"
            type={printPreviewData.type}
            items={printPreviewData.items}
            total={printPreviewData.total}
            settings={settings}
          />
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={cn(
          "fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg shadow-lg flex items-center gap-2 animate-in slide-in-from-bottom-4 duration-300",
          toast.type === 'success' ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        )}>
          {toast.type === 'success' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
          <p className="text-[11px] font-bold">{toast.message}</p>
        </div>
      )}
    </div>
  );
};
