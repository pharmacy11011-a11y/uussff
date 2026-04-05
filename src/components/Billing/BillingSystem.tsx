import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine, type InvoiceItem, type Supplier, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { 
  Search, 
  Trash2, 
  Plus, 
  Calendar,
  Save,
  Printer,
  X,
  Edit,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, formatNumber, cn, handlePrint as globalHandlePrint, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { getNextInvoiceNumber, incrementInvoiceNumber, isInvoiceNumberDuplicate } from '@/src/utils/invoiceUtils';
import { syncService } from '@/src/lib/syncService';

// Billing System Component
export const BillingSystem = ({ setActiveTab, editInvoiceId, onEditComplete }: { setActiveTab: (tab: string) => void, editInvoiceId?: number | null, onEditComplete?: () => void }) => {
  const [invoiceType, setInvoiceType] = useState<'Sales' | 'Purchase'>('Sales');
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [customerInfo, setCustomerInfo] = useState({ id: 0, name: '', phone: '', address: '' });
  const [supplierInfo, setSupplierInfo] = useState({ id: 0, code: '', name: '', phone: '', address: '' });
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Online' | 'Card'>('Cash');
  const [tax, setTax] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [activeSearchField, setActiveSearchField] = useState<'medicineCode' | 'medicineName' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [topSearchQuery, setTopSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  useEffect(() => {
    if (editInvoiceId) {
      const loadInvoice = async () => {
        const invoice = await db.invoices.get(editInvoiceId);
        if (invoice) {
          handleEditInvoice(invoice);
        }
      };
      loadInvoice();
    }
  }, [editInvoiceId]);

  const handleEditInvoice = React.useCallback((invoice: any) => {
    const type = invoice.customerName ? 'Sales' : 'Purchase';
    setInvoiceType(type);
    setInvoiceNumber(invoice.invoiceNumber);
    setInvoiceDate(invoice.date);
    
    if (type === 'Sales') {
      setCustomerInfo({
        id: invoice.customerId || 0,
        name: invoice.customerName || '',
        phone: invoice.customerPhone || '',
        address: invoice.customerAddress || ''
      });
    } else {
      setSupplierInfo({
        id: invoice.supplierId || 0,
        code: '', 
        name: invoice.supplierName || '',
        phone: invoice.supplierPhone || '',
        address: invoice.supplierAddress || ''
      });
    }

    const cartItems = invoice.items.map((item: any) => ({
      medicineId: item.medicineId,
      medicineCode: item.medicineCode || '',
      medicineName: item.medicineName,
      batchNumber: item.batchNumber,
      expiryDate: item.expiryDate || '',
      quantity: item.quantity,
      price: item.price || item.purchasePrice,
      purchasePrice: item.purchasePrice || 0,
      salePrice: item.salePrice || 0,
      discount: item.discount || 0,
      total: item.total
    }));

    const paddedCart = [...cartItems];
    while (paddedCart.length < 15) {
      paddedCart.push({
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        price: 0,
        purchasePrice: 0,
        salePrice: 0,
        discount: 0,
        total: 0
      });
    }

    setCart(paddedCart);
    setTax(invoice.tax || 0);
    setDiscount(invoice.discount || 0);
    setPaidAmount(invoice.paidAmount || 0);
    setPaymentMethod(invoice.paymentMethod || 'Cash');
    setSelectedInvoice(null);
    setIsEditing(true);
    setOriginalInvoice(invoice);
    setIsSaved(false);
    setShowSearchResults(false);
  }, []);

  const handleTopSearch = async () => {
    if (!topSearchQuery) return;
    
    const query = topSearchQuery.toLowerCase();

    // Use Dexie indices for faster searching
    const invByNum = await db.invoices.where('invoiceNumber').startsWithIgnoreCase(query).toArray();
    const purByNum = await db.purchases.where('invoiceNumber').startsWithIgnoreCase(query).toArray();
    
    const invByName = await db.invoices.where('customerName').startsWithIgnoreCase(query).toArray();
    const purByName = await db.purchases.where('supplierName').startsWithIgnoreCase(query).toArray();
    
    const supplierByCode = await db.suppliers.where('code').equalsIgnoreCase(topSearchQuery).first();
    let purBySupplierCode: any[] = [];
    if (supplierByCode) {
      purBySupplierCode = await db.purchases.where('supplierId').equals(supplierByCode.id!).toArray();
    }

    // 4. Search by Phone (Partial)
    const invByPhone = await db.invoices.filter(inv => (inv.customerPhone || '').includes(topSearchQuery)).toArray();
    const purByPhone = await db.purchases.filter(pur => (pur.supplierPhone || '').includes(topSearchQuery)).toArray();
    
    // Combine and de-duplicate results
    const combined = [...invByNum, ...purByNum, ...invByName, ...purByName, ...purBySupplierCode, ...invByPhone, ...purByPhone];
    
    // Use a Map to de-duplicate by ID and type (since IDs might overlap between invoices and purchases)
    const uniqueResultsMap = new Map();
    combined.forEach(res => {
      const key = `${res.invoiceNumber}_${res.customerName ? 'sale' : 'purchase'}`;
      if (!uniqueResultsMap.has(key)) {
        uniqueResultsMap.set(key, res);
      }
    });

    const allResults = Array.from(uniqueResultsMap.values());

    if (allResults.length === 1) {
      handleEditInvoice(allResults[0]);
    } else if (allResults.length > 1) {
      setSearchResults(allResults);
      setShowSearchResults(true);
    } else {
      showToast('No invoice found matching your search.', 'error');
    }
  };

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const patientNameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const supplierCodeRef = useRef<HTMLInputElement>(null);
  const supplierNameRef = useRef<HTMLInputElement>(null);
  const codeRefs = useRef<(HTMLInputElement | null)[]>([]);
  const nameRefs = useRef<(HTMLInputElement | null)[]>([]);
  const quantityRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceRefs = useRef<(HTMLInputElement | null)[]>([]);
  const discountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isSaved, setIsSaved] = useState(false);
  const [paidAmount, setPaidAmount] = useState(0);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);

  const medicines = useLiveQuery(() => db.medicines.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const settings = useLiveQuery(() => db.settings.toCollection().first());

  const [previousRemaining, setPreviousRemaining] = useState(0);

  // Fetch live balance when customer/supplier changes
  useEffect(() => {
    const fetchBalance = async () => {
      if (isEditing && originalInvoice) {
        // If editing and same customer/supplier, use saved previous balance
        if (invoiceType === 'Sales' && customerInfo.name === originalInvoice.customerName) {
          setPreviousRemaining(originalInvoice.previousRemaining || 0);
          return;
        }
        if (invoiceType === 'Purchase' && supplierInfo.id === originalInvoice.supplierId) {
          setPreviousRemaining(originalInvoice.previousRemaining || 0);
          return;
        }
      }

      // Otherwise fetch current live balance
      if (invoiceType === 'Sales' && customerInfo.name) {
        const customerDues = await db.dues
          .where('personName')
          .equals(customerInfo.name)
          .and(d => d.personType === 'Customer' && d.personContact === customerInfo.phone && d.status === 'Pending' && d.referenceNumber !== invoiceNumber)
          .toArray();
        setPreviousRemaining(customerDues.reduce((sum, d) => sum + (d.remaining || 0), 0));
      } else if (invoiceType === 'Purchase' && supplierInfo.id) {
        const supplier = await db.suppliers.get(supplierInfo.id);
        if (supplier) {
          setPreviousRemaining(supplier.currentBalance || 0);
        }
      } else {
        setPreviousRemaining(0);
      }
    };
    fetchBalance();
  }, [customerInfo.name, customerInfo.phone, supplierInfo.id, invoiceType, invoiceNumber, isEditing, originalInvoice]);
  const [supplierNotFound, setSupplierNotFound] = useState(false);
  const [supplierSuggestions, setSupplierSuggestions] = useState<Supplier[]>([]);
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  
  const [customerSuggestions, setCustomerSuggestions] = useState<any[]>([]);
  const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
  const [customerNotFound, setCustomerNotFound] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const initInvoice = async () => {
      if (!isEditing && !editInvoiceId) {
        const num = await getNextInvoiceNumber(invoiceType);
        setInvoiceNumber(num);
      }
    };
    initInvoice();
  }, [invoiceType, isEditing, editInvoiceId]);

  const subtotal = cart.reduce((sum, item) => sum + item.total, 0);
  const currentTotal = subtotal + tax - discount;
  const totalPayable = currentTotal + previousRemaining;
  const remainingAmount = totalPayable - paidAmount;

  const handleSupplierCodeChange = async (code: string) => {
    setSupplierInfo(prev => ({ ...prev, code }));
    setSupplierNotFound(false);
    
    if (code.trim() === '') {
      setSupplierInfo(prev => ({ ...prev, id: 0, name: '', phone: '', address: '' }));
      return;
    }

    const existing = suppliers?.find(s => s.code.toLowerCase() === code.toLowerCase());
    if (existing) {
      setSupplierInfo({
        id: existing.id!,
        code: existing.code || '',
        name: existing.name || '',
        phone: existing.phone || '',
        address: existing.address || ''
      });
      setSupplierNotFound(false);
    } else {
      if (code.length >= 3) {
        setSupplierNotFound(true);
      }
      // Clear other fields but keep the code
      setSupplierInfo(prev => ({ ...prev, id: 0, name: '', phone: '', address: '' }));
    }
  };

  const handleSupplierNameChange = async (name: string) => {
    setSupplierInfo(prev => ({ ...prev, name }));
    setSupplierNotFound(false);
    if (name.length >= 2) {
      const matches = suppliers?.filter(s => s.name.toLowerCase().includes(name.toLowerCase())) || [];
      setSupplierSuggestions(matches);
      setShowSupplierSuggestions(true);
      
      if (matches.length === 0 && name.length >= 3) {
        setSupplierNotFound(true);
      }

      const exactMatch = matches.find(s => s.name.toLowerCase() === name.toLowerCase());
      if (exactMatch) {
        setSupplierInfo({
          id: exactMatch.id!,
          code: exactMatch.code || '',
          name: exactMatch.name || '',
          phone: exactMatch.phone || '',
          address: exactMatch.address || ''
        });
        setShowSupplierSuggestions(false);
        setSupplierNotFound(false);
      }
    } else {
      setSupplierSuggestions([]);
      setShowSupplierSuggestions(false);
    }
  };

  const handleCustomerNameChange = async (name: string) => {
    setCustomerInfo(prev => ({ ...prev, name, id: 0 }));
    setCustomerNotFound(false);
    if (name.length >= 2) {
      // Search in customers table using index
      const matches = await db.customers.where('name').startsWithIgnoreCase(name).limit(10).toArray();
      setCustomerSuggestions(matches);
      setShowCustomerSuggestions(true);

      if (matches.length === 0 && name.length >= 3) {
        setCustomerNotFound(true);
      }

      const exactMatch = matches.find(c => c.name.toLowerCase() === name.toLowerCase());
      if (exactMatch) {
        setCustomerInfo({
          id: exactMatch.id,
          name: exactMatch.name,
          phone: exactMatch.phone,
          address: exactMatch.address
        });
        setShowCustomerSuggestions(false);
        setCustomerNotFound(false);
      }
    } else {
      setCustomerSuggestions([]);
      setShowCustomerSuggestions(false);
    }
  };

  const selectCustomer = async (customer: any) => {
    setCustomerInfo({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address
    });
    setCustomerSuggestions([]);
    setShowCustomerSuggestions(false);
    setCustomerNotFound(false);
  };

  const selectSupplier = (supplier: Supplier) => {
    setSupplierInfo({
      id: supplier.id!,
      code: supplier.code || '',
      name: supplier.name || '',
      phone: supplier.phone || '',
      address: supplier.address || ''
    });
    setSupplierSuggestions([]);
    setShowSupplierSuggestions(false);
    setSupplierNotFound(false);
  };

  const filteredMedicines = React.useMemo(() => {
    if (!medicines) return [];
    const q = searchQuery.toLowerCase();
    if (!q) return medicines.filter(m => invoiceType === 'Purchase' || m.stockQuantity > 0).slice(0, 50);

    return medicines.filter(m => {
      if (activeSearchField === 'medicineCode') {
        return m.code.toLowerCase() === q && (invoiceType === 'Purchase' || m.stockQuantity > 0);
      }
      return (m.name.toLowerCase().includes(q) || 
              m.code.toLowerCase().includes(q) ||
              m.barcode.includes(searchQuery)) && 
             (invoiceType === 'Purchase' || m.stockQuantity > 0);
    }).slice(0, 50); // Limit results for performance
  }, [medicines, searchQuery, activeSearchField, invoiceType]);

  // Initialize with 15 empty rows if cart is empty
  useEffect(() => {
    if (cart.length === 0) {
      const initialRows: InvoiceItem[] = Array(15).fill(null).map(() => ({
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        price: 0,
        purchasePrice: 0,
        salePrice: 0,
        discount: 0,
        total: 0
      }));
      setCart(initialRows);
    }
  }, []);

  const addRow = () => {
    if (cart.length >= 50) {
      showToast('Maximum 50 items allowed per invoice', 'error');
      return;
    }
    setCart([...cart, {
      medicineId: 0,
      medicineCode: '',
      medicineName: '',
      unit: '',
      batchNumber: '',
      expiryDate: '',
      quantity: 0,
      price: 0,
      purchasePrice: 0,
      salePrice: 0,
      discount: 0,
      total: 0
    }]);
  };

  const deleteRow = (index: number) => {
    const newCart = cart.filter((_, i) => i !== index);
    if (newCart.length === 0) {
      setCart([{
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        price: 0,
        purchasePrice: 0,
        salePrice: 0,
        discount: 0,
        total: 0
      }]);
    } else {
      setCart(newCart);
    }
  };

  const handleMedicineSelect = (index: number, medicine: Medicine) => {
    const newCart = [...cart];
    
    // Check if medicine already exists in cart (excluding the current row being edited)
    const existingIndex = newCart.findIndex((item, i) => i !== index && item.medicineId === medicine.id);
    
    if (existingIndex !== -1) {
      // Merge with existing item
      const existingItem = newCart[existingIndex];
      const addedQty = Math.max(1, newCart[index].quantity || 1);
      const newQty = existingItem.quantity + addedQty;
      const price = (invoiceType === 'Sales' ? medicine.salePrice : medicine.purchasePrice) || 0;
      
      newCart[existingIndex] = {
        ...existingItem,
        quantity: newQty,
        price: price, // Update to latest price
        salePrice: medicine.salePrice || 0,
        purchasePrice: medicine.purchasePrice || 0,
        unit: medicine.unit || 'TAB',
        total: (newQty * price) - (existingItem.discount || 0)
      };
      
      // Clear the current row
      newCart[index] = {
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        price: 0,
        purchasePrice: 0,
        salePrice: 0,
        discount: 0,
        total: 0
      };
      
      showToast(`Merged ${medicine.name}. Total Qty: ${newQty}`);
    } else {
      // Standard selection
      const price = (invoiceType === 'Sales' ? medicine.salePrice : medicine.purchasePrice) || 0;
      const item = {
        ...newCart[index],
        medicineId: medicine.id!,
        medicineName: medicine.name,
        medicineCode: medicine.code,
        unit: medicine.unit || 'TAB',
        batchNumber: medicine.batchNumber || '',
        expiryDate: medicine.expiryDate || '',
        price: price,
        purchasePrice: medicine.purchasePrice || 0,
        salePrice: medicine.salePrice || 0,
        quantity: Math.max(1, newCart[index].quantity || 1),
        total: (Math.max(1, newCart[index].quantity || 1) * price) - (newCart[index].discount || 0)
      };
      newCart[index] = item;

      // Auto-add new row if last row is being filled
      if (index === cart.length - 1 && cart.length < 50) {
        newCart.push({
          medicineId: 0,
          medicineCode: '',
          medicineName: '',
          unit: '',
          batchNumber: '',
          expiryDate: '',
          quantity: 0,
          price: 0,
          purchasePrice: 0,
          salePrice: 0,
          discount: 0,
          total: 0
        });
      }
    }

    setCart(newCart);
    setActiveSearchIndex(null);
    setSearchQuery('');
  };

  const updateRow = (index: number, field: keyof InvoiceItem, value: any) => {
    const newCart = [...cart];
    const item = { ...newCart[index], [field]: value };
    
    if (field === 'quantity' || field === 'price' || field === 'salePrice' || field === 'purchasePrice' || field === 'discount') {
      const price = field === 'price' ? Number(value) : item.price;
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const disc = field === 'discount' ? Number(value) : (item.discount || 0);
      item.total = (qty || 0) * (price || 0) - (disc || 0);
    }
    
    newCart[index] = item;
    setCart(newCart);

    // Auto-add new row if last row is being filled
    if (index === cart.length - 1 && (item.medicineName || item.medicineCode || item.batchNumber || item.expiryDate || item.quantity > 0) && cart.length < 50) {
      setCart([...newCart, {
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 0,
        price: 0,
        purchasePrice: 0,
        salePrice: 0,
        discount: 0,
        total: 0
      }]);
    }
  };

  const handleNewInvoice = React.useCallback(async () => {
    const num = await getNextInvoiceNumber(invoiceType);
    setCart(Array(15).fill(null).map(() => ({
      medicineId: 0,
      medicineCode: '',
      medicineName: '',
      batchNumber: '',
      expiryDate: '',
      quantity: 0,
      price: 0,
      purchasePrice: 0,
      salePrice: 0,
      discount: 0,
      total: 0
    })));
    setCustomerInfo({ id: 0, name: '', phone: '', address: '' });
    setSupplierInfo({ id: 0, code: '', name: '', phone: '', address: '' });
    setTax(0);
    setDiscount(0);
    setPaidAmount(0);
    setPaymentMethod('Cash');
    setSearchQuery('');
    setTopSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setInvoiceNumber(num);
    setIsSaved(false);
    setIsEditing(false);
    setOriginalInvoice(null);
    patientNameRef.current?.focus();
  }, [invoiceType]);

  // Reset form on mount or when editInvoiceId changes to null
  useEffect(() => {
    if (!editInvoiceId) {
      handleNewInvoice();
    }
  }, [editInvoiceId, handleNewInvoice]);

  const handleSaveInvoice = React.useCallback(async () => {
    if (isSaved) {
      handleNewInvoice();
      return null;
    }
    if (isProcessing) return null;

    const validItems = cart.filter(item => item.medicineId !== 0 && item.quantity > 0).map(item => ({
      ...item,
      salePrice: invoiceType === 'Sales' ? item.price : item.salePrice,
      purchasePrice: invoiceType === 'Purchase' ? item.price : item.purchasePrice
    }));
    if (validItems.length === 0) {
      showToast('Please add items to the invoice', 'error');
      return null;
    }
    
    // Check for zero prices
    const zeroPriceItem = validItems.find(item => !item.price || item.price <= 0);
    if (zeroPriceItem) {
      showToast(`Please enter a valid price for ${zeroPriceItem.medicineName}`, 'error');
      return null;
    }
    
    setIsProcessing(true);
    try {
      if (invoiceType === 'Sales') {
        if (!customerInfo.name) {
          showToast('Please enter patient name', 'error');
          setIsProcessing(false);
          return null;
        }
        
        const netInvoice = subtotal + tax - discount;
        const invoiceRemaining = Math.max(0, netInvoice - paidAmount);
        
        // Calculate delta for customer balance
        let balanceDelta = netInvoice - paidAmount;
        if (isEditing && originalInvoice) {
          const oldNet = (originalInvoice.subtotal || 0) + (originalInvoice.tax || 0) - (originalInvoice.discount || 0);
          const oldPaid = originalInvoice.paidAmount || 0;
          balanceDelta = (netInvoice - paidAmount) - (oldNet - oldPaid);
        }

        const status = invoiceRemaining === 0 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid');

        const invoice = {
          invoiceNumber,
          date: invoiceDate,
          customerName: customerInfo.name,
          customerPhone: customerInfo.phone,
          customerAddress: customerInfo.address,
          items: validItems,
          subtotal,
          discount: discount,
          tax: 0,
          total: netInvoice,
          paidAmount,
          remainingAmount: remainingAmount,
          paymentMethod,
          status,
          userId: 1,
          time: isEditing ? originalInvoice.time : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          previousRemaining
        };

        try {
          await db.transaction('rw', [db.invoices, db.medicines, db.activityLogs, db.dues, db.customers, db.settings], async () => {
            // Check for duplicate invoice number if it's a new invoice
            if (!isEditing) {
              const isDuplicate = await isInvoiceNumberDuplicate(invoiceNumber, 'Sales');
              if (isDuplicate) {
                const nextNum = await getNextInvoiceNumber('Sales');
                setInvoiceNumber(nextNum);
                throw new Error(`Invoice number ${invoiceNumber} already exists. Using ${nextNum} instead.`);
              }
            }

            // Handle new medicines first in Sales Invoice
            for (let i = 0; i < validItems.length; i++) {
              if (validItems[i].medicineId === 0 && validItems[i].medicineName) {
                // Check if medicine exists by name (case insensitive)
                const existingMed = await db.medicines.where('name').equalsIgnoreCase(validItems[i].medicineName).first();
                if (existingMed) {
                  validItems[i].medicineId = existingMed.id!;
                  validItems[i].medicineCode = existingMed.code;
                } else {
                  // Auto-generate code
                  const allMeds = await db.medicines.toArray();
                  const codes = allMeds.map(m => m.code).filter(c => c.startsWith('MED-'));
                  let nextNum = 1;
                  if (codes.length > 0) {
                    const nums = codes.map(c => parseInt(c.replace('MED-', ''))).filter(n => !isNaN(n));
                    if (nums.length > 0) {
                      nextNum = Math.max(...nums) + 1;
                    }
                  }
                  const newCode = `MED-${nextNum.toString().padStart(3, '0')}`;
                  
                  const newMedId = await db.medicines.add({
                    code: newCode,
                    name: validItems[i].medicineName,
                    categoryId: 1, // Default category
                    purchasePrice: validItems[i].purchasePrice || validItems[i].price * 0.8,
                    salePrice: validItems[i].price,
                    minStockLimit: 10,
                    stockQuantity: 0, // Will be updated below
                    batchNumber: validItems[i].batchNumber || '',
                    expiryDate: validItems[i].expiryDate || new Date(new Date().setFullYear(new Date().getFullYear() + 2)).toISOString().split('T')[0],
                    barcode: newCode,
                    supplierId: 1,
                    genericName: '',
                    companyName: '',
                    supplierName: 'General',
                    notes: 'Auto-created during sales'
                  });
                  
                  validItems[i].medicineId = newMedId;
                  validItems[i].medicineCode = newCode;
                }
              }
            }

            if (isEditing && originalInvoice) {
              // Revert old stock
              for (const item of originalInvoice.items) {
                if (item.medicineId) {
                  const med = await db.medicines.get(item.medicineId);
                  if (med) {
                    await db.medicines.update(item.medicineId, {
                      stockQuantity: med.stockQuantity + item.quantity
                    });
                  }
                }
              }
              // Update existing invoice instead of delete/add to keep ID
              await db.invoices.put({ ...invoice, id: originalInvoice.id });
            } else {
              await db.invoices.add(invoice);
              await incrementInvoiceNumber('Sales');
            }
            
            // Update or create customer
            let customer = await db.customers.where({ 
              name: customerInfo.name, 
              phone: customerInfo.phone,
              address: customerInfo.address 
            }).first();
            
            if (customer) {
              await db.customers.update(customer.id!, {
                balance: (customer.balance || 0) + balanceDelta
              });
            } else if (balanceDelta > 0 || customerInfo.phone) {
              await db.customers.add({
                name: customerInfo.name,
                phone: customerInfo.phone,
                address: customerInfo.address,
                balance: balanceDelta
              });
            }

            for (const item of validItems) {
              if (item.medicineId) {
                const med = await db.medicines.get(item.medicineId);
                if (med) {
                  await db.medicines.update(item.medicineId, {
                    stockQuantity: med.stockQuantity - item.quantity
                  });
                }
              }
            }
            
            // Handle Dues - One per invoice
            if (invoiceRemaining > 0) {
              const existingDue = await db.dues
                .where({ referenceNumber: invoiceNumber, personType: 'Customer' })
                .first();

              if (existingDue) {
                await db.dues.update(existingDue.id!, {
                  amount: invoiceRemaining,
                  remaining: invoiceRemaining,
                  invoiceTotal: netInvoice,
                  paidAmount: paidAmount,
                  date: invoiceDate,
                  status: 'Pending'
                });
              } else {
                await db.dues.add({
                  personName: customerInfo.name,
                  personType: 'Customer',
                  personContact: customerInfo.phone,
                  amount: invoiceRemaining,
                  date: invoiceDate,
                  referenceNumber: invoiceNumber,
                  status: 'Pending',
                  invoiceTotal: netInvoice,
                  paidAmount: paidAmount,
                  remaining: invoiceRemaining
                });
              }
            } else {
              // If paid in full, delete the specific due record
              await db.dues
                .where({ referenceNumber: invoiceNumber, personType: 'Customer' })
                .delete();
            }

            const action = isEditing ? 'Invoice updated' : 'Invoice saved';
            await logActivity(action, `${action}: ${invoiceNumber} for ${invoice.customerName}`);
            
            // Background Sync to Supabase
            syncService.syncInvoice(invoice).catch(err => console.error('Background sync failed:', err));
          });
          setIsSaved(true);
          showToast(isEditing ? 'Invoice updated successfully' : 'Invoice saved successfully');
          if (isEditing && onEditComplete) {
            onEditComplete();
          } else {
            handleNewInvoice();
          }
          return invoice;
        } catch (error: any) {
          console.error('Failed to save invoice:', error);
          if (error.message && error.message.includes('already exists')) {
            showToast(error.message, 'error');
          } else {
            showToast('Error saving invoice', 'error');
          }
          setIsProcessing(false);
          return null;
        }
      } else {
        // Purchase Invoice
        if (!supplierInfo.name) {
          showToast('Please select a supplier', 'error');
          setIsProcessing(false);
          return null;
        }

        const netInvoice = subtotal + tax - discount;
        const invoiceRemaining = Math.max(0, netInvoice - paidAmount);
        
        // Calculate delta for supplier balance
        let balanceDelta = netInvoice - paidAmount;
        if (isEditing && originalInvoice) {
          const oldNet = (originalInvoice.subtotal || 0) + (originalInvoice.tax || 0) - (originalInvoice.discount || 0);
          const oldPaid = originalInvoice.paidAmount || 0;
          balanceDelta = (netInvoice - paidAmount) - (oldNet - oldPaid);
        }

        const status = invoiceRemaining === 0 ? 'Paid' : (paidAmount > 0 ? 'Partially Paid' : 'Unpaid');

        try {
          let purchaseToReturn: any = null;
          await db.transaction('rw', [db.purchases, db.medicines, db.activityLogs, db.suppliers, db.dues, db.settings], async () => {
            // Check for duplicate invoice number if it's a new invoice
            if (!isEditing) {
              const isDuplicate = await isInvoiceNumberDuplicate(invoiceNumber, 'Purchase');
              if (isDuplicate) {
                const nextNum = await getNextInvoiceNumber('Purchase');
                setInvoiceNumber(nextNum);
                throw new Error(`Invoice number ${invoiceNumber} already exists. Using ${nextNum} instead.`);
              }
            }

            // Auto-create supplier if not exists
            let currentSupplierId = supplierInfo.id;
            if (currentSupplierId === 0 && supplierInfo.name) {
              const existingSupplier = await db.suppliers.where('name').equalsIgnoreCase(supplierInfo.name).first();
              if (existingSupplier) {
                currentSupplierId = existingSupplier.id!;
              } else {
                // Generate supplier code if missing
                let sCode = supplierInfo.code;
                if (!sCode) {
                  const allSuppliers = await db.suppliers.toArray();
                  const sCodes = allSuppliers.map(s => s.code).filter(c => c.startsWith('SUP-'));
                  let sNextNum = 1;
                  if (sCodes.length > 0) {
                    const sNums = sCodes.map(c => parseInt(c.replace('SUP-', ''))).filter(n => !isNaN(n));
                    if (sNums.length > 0) {
                      sNextNum = Math.max(...sNums) + 1;
                    }
                  }
                  sCode = `SUP-${sNextNum.toString().padStart(3, '0')}`;
                }

                currentSupplierId = await db.suppliers.add({
                  code: sCode,
                  name: supplierInfo.name,
                  phone: supplierInfo.phone || '',
                  address: supplierInfo.address || '',
                  email: '',
                  companyName: '',
                  currentBalance: 0
                });
                
                await logActivity('Auto-created Supplier', `Supplier ${supplierInfo.name} created during purchase invoice ${invoiceNumber}`);
              }
            }

            // Handle new medicines first
            for (let i = 0; i < validItems.length; i++) {
              if (validItems[i].medicineId === 0 && validItems[i].medicineName) {
                // Check if medicine exists by name (case insensitive)
                const existingMed = await db.medicines.where('name').equalsIgnoreCase(validItems[i].medicineName).first();
                if (existingMed) {
                  validItems[i].medicineId = existingMed.id!;
                  validItems[i].medicineCode = existingMed.code;
                } else {
                  // Auto-generate code
                  const allMeds = await db.medicines.toArray();
                  const codes = allMeds.map(m => m.code).filter(c => c.startsWith('MED-'));
                  let nextNum = 1;
                  if (codes.length > 0) {
                    const nums = codes.map(c => parseInt(c.replace('MED-', ''))).filter(n => !isNaN(n));
                    if (nums.length > 0) {
                      nextNum = Math.max(...nums) + 1;
                    }
                  }
                  const newCode = `MED-${nextNum.toString().padStart(3, '0')}`;
                  
                  const newMedId = await db.medicines.add({
                    code: newCode,
                    name: validItems[i].medicineName,
                    categoryId: 1, // Default category
                    purchasePrice: validItems[i].price,
                    salePrice: validItems[i].salePrice || validItems[i].price * 1.2,
                    minStockLimit: 10,
                    stockQuantity: 0,
                    batchNumber: validItems[i].batchNumber,
                    expiryDate: validItems[i].expiryDate || new Date().toISOString().split('T')[0],
                    barcode: newCode,
                    supplierId: currentSupplierId || 1,
                    genericName: '',
                    companyName: '',
                    supplierName: supplierInfo.name,
                    notes: 'Auto-created during purchase'
                  });
                  
                  validItems[i].medicineId = newMedId;
                  validItems[i].medicineCode = newCode;
                }
              }
            }

            const purchase = {
              invoiceNumber,
              supplierId: currentSupplierId,
              supplierName: supplierInfo.name,
              supplierPhone: supplierInfo.phone,
              supplierAddress: supplierInfo.address,
              date: invoiceDate,
              items: validItems.map(item => ({
                medicineId: item.medicineId,
                medicineCode: item.medicineCode,
                medicineName: item.medicineName,
                quantity: item.quantity,
                purchasePrice: item.price,
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate || new Date().toISOString().split('T')[0],
                discount: item.discount,
                total: item.total
              })),
              total: netInvoice,
              totalCost: netInvoice,
              discount: discount,
              tax,
              paidAmount,
              remainingAmount: remainingAmount,
              paymentMethod,
              status,
              time: isEditing ? originalInvoice.time : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
              previousRemaining,
              subtotal
            };

            purchaseToReturn = purchase;

            if (isEditing && originalInvoice) {
              // Revert old stock
              for (const item of originalInvoice.items) {
                if (item.medicineId) {
                  const med = await db.medicines.get(item.medicineId);
                  if (med) {
                    await db.medicines.update(item.medicineId, {
                      stockQuantity: med.stockQuantity - item.quantity
                    });
                  }
                }
              }
              // Update existing purchase instead of delete/add to keep ID
              await db.purchases.put({ ...purchase, id: originalInvoice.id });
            } else {
              await db.purchases.add(purchase);
              await incrementInvoiceNumber('Purchase');
            }
            for (const item of validItems) {
              if (item.medicineId) {
                const med = await db.medicines.get(item.medicineId);
                if (med) {
                  const updateData: any = {
                    stockQuantity: med.stockQuantity + item.quantity
                  };
                  
                  // Automatically update Purchase Price if it has changed
                  if (item.price !== med.purchasePrice) {
                    updateData.purchasePrice = item.price;
                  }
                  
                  // Update sale price only if explicitly provided and different
                  if (item.salePrice && item.salePrice !== med.salePrice) {
                    updateData.salePrice = item.salePrice;
                  }

                  await db.medicines.update(item.medicineId, updateData);
                }
              }
            }

            // Update supplier balance and dues
            const supplier = (currentSupplierId ? await db.suppliers.get(currentSupplierId) : null) || (supplierInfo.name ? await db.suppliers.where('name').equals(supplierInfo.name).first() : null);
            if (supplier) {
              await db.suppliers.update(supplier.id!, {
                currentBalance: (supplier.currentBalance || 0) + balanceDelta
              });

              // Handle Dues - One per invoice
              if (invoiceRemaining > 0) {
                const existingDue = await db.dues
                  .where({ referenceNumber: invoiceNumber, personType: 'Supplier' })
                  .first();

                if (existingDue) {
                  await db.dues.update(existingDue.id!, {
                    amount: invoiceRemaining,
                    remaining: invoiceRemaining,
                    invoiceTotal: netInvoice,
                    paidAmount: paidAmount,
                    date: invoiceDate,
                    status: 'Pending'
                  });
                } else {
                  await db.dues.add({
                    personName: supplier.name,
                    personType: 'Supplier',
                    personContact: supplier.phone || '',
                    amount: invoiceRemaining,
                    date: invoiceDate,
                    referenceNumber: invoiceNumber,
                    status: 'Pending',
                    invoiceTotal: netInvoice,
                    paidAmount: paidAmount,
                    remaining: invoiceRemaining
                  });
                }
              } else {
                // If paid in full, delete the specific due record
                await db.dues
                  .where({ referenceNumber: invoiceNumber, personType: 'Supplier' })
                  .delete();
              }
            }

            const action = isEditing ? 'Purchase updated' : 'Purchase saved';
            await logActivity(action, `${action}: ${invoiceNumber} from ${purchase.supplierName}`);
            
            // Background Sync to Supabase
            syncService.syncPurchase(purchase).catch(err => console.error('Background sync failed:', err));
          });
          setIsSaved(true);
          showToast(isEditing ? 'Purchase updated successfully' : 'Purchase saved successfully');
          if (isEditing && onEditComplete) {
            onEditComplete();
          } else {
            handleNewInvoice();
          }
          return purchaseToReturn;
        } catch (error: any) {
          console.error('Failed to save purchase:', error);
          if (error.message && error.message.includes('already exists')) {
            showToast(error.message, 'error');
          } else {
            showToast('Error saving purchase invoice', 'error');
          }
          setIsProcessing(false);
          return null;
        }
      }
    } finally {
      setIsProcessing(false);
    }
  }, [isSaved, isProcessing, cart, invoiceType, customerInfo, invoiceNumber, invoiceDate, subtotal, totalPayable, paidAmount, remainingAmount, paymentMethod, supplierInfo, handleNewInvoice, isEditing, originalInvoice]);

  const handlePrint = React.useCallback((autoPrint: boolean = false) => {
    const validItems = cart.filter(item => item.medicineId !== 0 && item.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please add items to the invoice', 'error');
      return;
    }
    
    setPrintPreviewData({
      title: invoiceType === 'Sales' ? 'Sales Invoice' : 'Purchase Invoice',
      type: invoiceType === 'Sales' ? 'Sales Invoice' : 'Purchase Invoice',
      invoiceNumber: invoiceNumber,
      date: invoiceDate,
      time: new Date().toLocaleTimeString(),
      partyName: invoiceType === 'Sales' ? customerInfo.name : supplierInfo.name,
      partyContact: invoiceType === 'Sales' ? customerInfo.phone : supplierInfo.phone,
      partyAddress: invoiceType === 'Sales' ? customerInfo.address : supplierInfo.address,
      items: validItems.map(item => ({
        medicineCode: item.medicineCode,
        medicineName: item.medicineName,
        unit: item.unit || 'TAB',
        qty: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        total: item.total
      })),
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: totalPayable,
      paid: paidAmount,
      remaining: remainingAmount,
      previousRemaining: previousRemaining,
      paymentMethod: paymentMethod
    });
    setShowPrintPreview(true);

    if (autoPrint) {
      setTimeout(() => {
        printTemplate('print-container');
      }, 500);
    }
  }, [cart, invoiceType, invoiceNumber, invoiceDate, customerInfo, supplierInfo, subtotal, discount, tax, totalPayable, paidAmount, remainingAmount, paymentMethod, previousRemaining]);

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef, addRow);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  const handleEnterKey = async (e: React.KeyboardEvent, index: number, field: string) => {
    const isEnter = e.key === 'Enter';
    const isRightArrow = e.key === 'ArrowRight';
    
    if (!isEnter && !isRightArrow) return;
    
    // Only handle ArrowRight for price as requested
    if (isRightArrow && field !== 'price') return;

    e.preventDefault();
    e.stopPropagation();

    if (field === 'medicineCode') {
      const code = cart[index].medicineCode;
      if (code) {
        const medicine = medicines?.find(m => m.code.toLowerCase() === code.toLowerCase());
        if (medicine) {
          handleMedicineSelect(index, medicine);
          // Move to quantity input directly if medicine found
          setTimeout(() => {
            quantityRefs.current[index]?.focus();
            quantityRefs.current[index]?.select();
          }, 0);
          return;
        } else {
          showToast(`Medicine with code "${code}" not found`, 'error');
        }
      }
      // Move to medicine name input if not found or empty
      setTimeout(() => {
        nameRefs.current[index]?.focus();
        nameRefs.current[index]?.select();
      }, 0);
    } else if (field === 'medicineName') {
      const name = cart[index].medicineName;
      if (name) {
        const medicine = medicines?.find(m => m.name.toLowerCase() === name.toLowerCase());
        if (medicine) {
          handleMedicineSelect(index, medicine);
        } else {
          showToast(`Medicine "${name}" not found`, 'error');
        }
      }
      // Move to quantity input
      setTimeout(() => {
        quantityRefs.current[index]?.focus();
        quantityRefs.current[index]?.select();
      }, 0);
    } else if (field === 'quantity') {
      // Move to price input
      setTimeout(() => {
        priceRefs.current[index]?.focus();
        priceRefs.current[index]?.select();
      }, 0);
    } else if (field === 'price') {
      // Move to discount input
      setTimeout(() => {
        discountRefs.current[index]?.focus();
        discountRefs.current[index]?.select();
      }, 0);
    } else if (field === 'discount') {
      // Move to next row's code input
      const nextRow = tableContainerRef.current?.querySelectorAll('tbody tr')[index + 1];
      const nextInput = nextRow?.querySelector('input');
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      } else if (index === cart.length - 1) {
        addRow();
        setTimeout(() => {
          const rows = tableContainerRef.current?.querySelectorAll('tbody tr');
          const lastRow = rows ? rows[rows.length - 1] : null;
          const lastInput = lastRow?.querySelector('input');
          if (lastInput) (lastInput as HTMLInputElement).focus();
        }, 0);
      }
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;

      // F8: Print
      if (e.key === 'F8' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        if (isSaved || selectedInvoice) {
          handlePrint();
        } else if (cart.filter(item => item.medicineId !== 0 && item.quantity > 0).length > 0) {
          handlePrint();
        } else {
          showToast('Please add items to the invoice or search for an invoice to print.', 'error');
        }
      } 
      // F9: Save
      else if (e.key === 'F9' || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        handleSaveInvoice();
      }
      // F10: New Invoice
      else if (e.key === 'F10') {
        e.preventDefault();
        handleNewInvoice();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveInvoice, handleNewInvoice, isSaved, selectedInvoice, isProcessing, cart]);

  return (
    <div className="h-full flex flex-col gap-1 bg-[#F0F2F5] p-1 no-scrollbar overflow-hidden">
      <div className="flex flex-col gap-1 print:hidden h-full overflow-hidden">
        {/* Header & Actions - Fixed */}
        <div className="flex items-center justify-between shrink-0 no-print bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-slate-700">Type:</label>
            <select 
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500 min-w-[110px]"
              value={invoiceType}
              onChange={(e) => {
                const type = e.target.value as 'Sales' | 'Purchase';
                setInvoiceType(type);
              }}
            >
              <option value="Sales">Sales Invoice</option>
              <option value="Purchase">Purchase Invoice</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-500" />
            <label className="text-[10px] font-bold text-slate-700">Date:</label>
            <input 
              type="date"
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-1.5 ml-4 relative">
            <Search className="w-3 h-3 text-slate-500" />
            <input 
              placeholder="Search Name or Invoice #"
              className="px-1.5 py-0.5 bg-slate-50 border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500 w-40"
              value={topSearchQuery}
              onChange={(e) => setTopSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTopSearch()}
            />
            <button 
              onClick={handleTopSearch}
              className="px-2 py-0.5 bg-slate-800 text-white rounded text-[9px] font-bold hover:bg-slate-900 transition-colors"
            >
              Search
            </button>

            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl z-[100] max-h-48 overflow-y-auto min-w-[250px]">
                <div className="p-1.5 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                  <span className="text-[9px] font-bold text-slate-600 uppercase">Search Results</span>
                  <button onClick={() => setShowSearchResults(false)} className="text-slate-400 hover:text-slate-600">
                    <X size={10} />
                  </button>
                </div>
                {searchResults.map((res) => (
                  <div
                    key={`${res.invoiceNumber}_${res.customerName ? 'sale' : 'purchase'}`}
                    className="w-full p-2 flex items-center justify-between hover:bg-blue-50 border-b border-slate-50 last:border-0 group"
                  >
                    <div className="flex-1 cursor-pointer" onClick={() => {
                      setSelectedInvoice(res);
                      setTimeout(() => {
                        globalHandlePrint('print-invoice');
                      }, 150);
                      setShowSearchResults(false);
                    }}>
                      <p className="font-bold text-slate-900 text-[10px]">{res.invoiceNumber}</p>
                      <p className="text-[8px] text-slate-500">{res.customerName || res.supplierName}</p>
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <div className="cursor-pointer" onClick={() => {
                        setSelectedInvoice(res);
                        setTimeout(() => {
                          globalHandlePrint('receipt-content');
                        }, 150);
                        setShowSearchResults(false);
                      }}>
                        <p className="font-bold text-blue-600 text-[10px]">{formatCurrency(res.total || res.totalCost)}</p>
                        <p className="text-[8px] text-slate-400">{res.date}</p>
                      </div>
                      <button 
                        onClick={() => handleEditInvoice(res)}
                        className="p-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors opacity-0 group-hover:opacity-100"
                        title="Edit Invoice"
                      >
                        <Edit size={10} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        
          <div className="flex items-center gap-1.5">
            <button 
              onClick={() => handlePrint(true)}
              className="px-3 py-1 bg-[#167D45] hover:bg-[#116135] text-white rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Printer size={12} />
              Print
            </button>
            <button 
              onClick={handleSaveInvoice}
              className="px-3 py-1 bg-[#1E56A0] hover:bg-[#16427a] text-white rounded-md text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Save size={12} />
              Save
            </button>
          </div>
      </div>

      <div className="flex-1 flex flex-col gap-1 overflow-hidden bg-white p-1.5 rounded-b-lg border-x border-b border-slate-200 shadow-sm">
        {/* Invoice Number Display */}
        <div className="px-2 py-1 flex justify-between items-center border-b border-slate-100 mb-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-black uppercase tracking-tight">Invoice Number:</span>
            <span className="text-[14px] font-bold text-black bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shadow-sm">
              #{invoiceNumber || '---'}
            </span>
          </div>
          {isEditing && (
            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 uppercase">
              Editing Mode
            </span>
          )}
        </div>

        {/* Section 1: Details - Table Style */}
        <div className="shrink-0">
          <form 
            onKeyDown={handleFormKeyDown}
            onSubmit={(e) => e.preventDefault()}
          >
            <div className="bg-[#E9F0F8] px-2 py-0.5 rounded border border-[#D1E1F0] mb-1">
              <h2 className="text-[10px] font-bold text-[#2C3E50]">
                {invoiceType === 'Sales' ? 'Patient Details' : 'Supplier Details'}
              </h2>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden mb-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-[9px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    {invoiceType === 'Purchase' && (
                      <th className="px-2 py-0.5 border-r border-slate-200">Supplier Code</th>
                    )}
                    <th className="px-2 py-0.5 border-r border-slate-200">
                      {invoiceType === 'Sales' ? 'Patient Name' : 'Supplier Name'}
                    </th>
                    <th className="px-2 py-0.5 border-r border-slate-200">
                      {invoiceType === 'Sales' ? 'Mobile Number' : 'Supplier Contact Number'}
                    </th>
                    <th className="px-2 py-0.5">
                      {invoiceType === 'Sales' ? 'Address' : 'Supplier Address'}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    {invoiceType === 'Purchase' && (
                      <td className="p-0 border-r border-slate-200 relative">
                        <input 
                          ref={supplierCodeRef}
                          type="text"
                          className={cn(
                            "w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30",
                            supplierNotFound && supplierInfo.code.length >= 3 && "text-red-600 font-bold"
                          )}
                          value={supplierInfo.code}
                          onChange={(e) => handleSupplierCodeChange(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              e.stopPropagation();
                              handleSupplierCodeChange(supplierInfo.code);
                              // Move to table
                              const firstCodeInput = tableContainerRef.current?.querySelector('tbody input');
                              if (firstCodeInput) (firstCodeInput as HTMLInputElement).focus();
                            }
                          }}
                          placeholder="Supplier Code"
                          autoComplete="off"
                        />
                        {supplierNotFound && supplierInfo.code.length >= 3 && (
                          <div className="absolute top-full left-0 mt-0.5 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 z-[60] shadow-sm flex items-center gap-1">
                            <span className="text-[8px] text-red-600 font-bold whitespace-nowrap">Supplier not found</span>
                            <button 
                              onClick={() => setActiveTab('suppliers')}
                              className="text-[8px] bg-red-600 text-white px-1 rounded hover:bg-red-700 font-bold"
                            >
                              Create New
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                    <td className="p-0 border-r border-slate-200">
                      {invoiceType === 'Sales' ? (
                        <div className="relative">
                          <input 
                            ref={patientNameRef}
                            type="text"
                            className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                            value={customerInfo.name}
                            onChange={(e) => handleCustomerNameChange(e.target.value)}
                            onFocus={() => customerInfo.name.length >= 2 && setShowCustomerSuggestions(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                mobileRef.current?.focus();
                              }
                            }}
                            placeholder="Patient Name"
                            autoComplete="off"
                          />
                          {showCustomerSuggestions && customerSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-xl z-[60] max-h-48 overflow-y-auto">
                              {customerSuggestions.map((customer) => (
                                <button
                                  key={customer.id}
                                  type="button"
                                  className="w-full text-left px-2 py-1.5 hover:bg-blue-50 border-b border-slate-50 last:border-0"
                                  onClick={() => selectCustomer(customer)}
                                >
                                  <p className="text-[10px] font-bold text-slate-900">{customer.name}</p>
                                  <p className="text-[8px] text-slate-500">{customer.phone} • {customer.address}</p>
                                </button>
                              ))}
                            </div>
                          )}
                          {customerNotFound && customerInfo.name.length >= 3 && customerSuggestions.length === 0 && (
                            <div className="absolute top-full left-0 mt-0.5 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 z-[60] shadow-sm flex items-center gap-1">
                              <span className="text-[8px] text-blue-600 font-bold whitespace-nowrap">New Customer</span>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="relative">
                          <input 
                            ref={supplierNameRef}
                            type="text"
                            className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                            value={supplierInfo.name}
                            onChange={(e) => handleSupplierNameChange(e.target.value)}
                            onFocus={() => supplierInfo.name.length >= 2 && setShowSupplierSuggestions(true)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                e.stopPropagation();
                                // Move to table
                                const firstCodeInput = tableContainerRef.current?.querySelector('tbody input');
                                if (firstCodeInput) (firstCodeInput as HTMLInputElement).focus();
                              }
                            }}
                            placeholder="Supplier Name"
                            autoComplete="off"
                          />
                          {supplierNotFound && supplierInfo.name.length >= 3 && supplierSuggestions.length === 0 && (
                            <div className="absolute top-full left-0 mt-0.5 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 z-[60] shadow-sm flex items-center gap-1">
                              <span className="text-[8px] text-red-600 font-bold whitespace-nowrap">Supplier not found</span>
                              <button 
                                onClick={() => setActiveTab('suppliers')}
                                className="text-[8px] bg-red-600 text-white px-1 rounded hover:bg-red-700 font-bold"
                              >
                                Create New
                              </button>
                            </div>
                          )}
                          {showSupplierSuggestions && supplierSuggestions.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded shadow-lg z-50 max-h-32 overflow-y-auto">
                              {supplierSuggestions.map(s => (
                                <button
                                  key={s.id}
                                  type="button"
                                  className="w-full text-left px-2 py-1 hover:bg-slate-50 border-b border-slate-50 last:border-0"
                                  onClick={() => selectSupplier(s)}
                                >
                                  <p className="font-bold text-slate-900 text-[9px]">{s.name}</p>
                                  <p className="text-slate-500 text-[7px]">{s.code}</p>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={mobileRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={invoiceType === 'Sales' ? customerInfo.phone : supplierInfo.phone}
                        onChange={(e) => {
                          if (invoiceType === 'Sales') {
                            setCustomerInfo({ ...customerInfo, phone: e.target.value });
                          } else {
                            setSupplierInfo({ ...supplierInfo, phone: e.target.value });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (invoiceType === 'Sales') {
                              addressRef.current?.focus();
                            } else {
                              // For purchase, mobile to address
                              addressRef.current?.focus();
                            }
                          }
                        }}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        ref={addressRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={invoiceType === 'Sales' ? customerInfo.address : supplierInfo.address}
                        onChange={(e) => {
                          if (invoiceType === 'Sales') {
                            setCustomerInfo({ ...customerInfo, address: e.target.value });
                          } else {
                            setSupplierInfo({ ...supplierInfo, address: e.target.value });
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            // Move to table
                            const firstCodeInput = tableContainerRef.current?.querySelector('tbody input');
                            if (firstCodeInput) (firstCodeInput as HTMLInputElement).focus();
                          }
                        }}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </form>
        </div>

        {/* Section 2: Medicine Information - Dynamic Table */}
        <div className="flex-1 flex flex-col gap-1 overflow-hidden min-h-0">
          <div className="bg-[#E9F0F8] px-2 py-0.5 rounded border border-[#D1E1F0] shrink-0">
            <h2 className="text-[10px] font-bold text-[#2C3E50]">Medicine Information</h2>
          </div>
          
          <div ref={tableContainerRef} className="flex-1 overflow-auto border border-slate-200 rounded mx-0.5 no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#F8FAFC] z-10">
                <tr className="text-slate-700 text-[9px] font-bold border-b border-slate-200">
                  <th className="px-2 py-1 border-r border-slate-200 w-[80px]">Code</th>
                  <th className="px-2 py-1 border-r border-slate-200">Name</th>
                  <th className="px-2 py-1 border-r border-slate-200 w-16">Batch</th>
                  <th className="px-2 py-1 border-r border-slate-200 w-20">Expiry</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-center w-[70px]">Stock</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-center w-[70px]">Qty</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right">Price</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right w-[80px]">Discount</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right w-[120px]">Total</th>
                  <th className="px-2 py-1 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cart.map((item, index) => (
                  <tr key={item.medicineId || `cart-item-${index}`} className="hover:bg-slate-50/50 transition-colors relative">
                    <td className="p-0 border-r border-slate-200">
                      <div className="relative">
                        <input 
                          ref={el => { codeRefs.current[index] = el; }}
                          type="text"
                          className="w-full px-2 py-0.5 text-[10px] outline-none focus:bg-blue-50/30 font-mono"
                          value={item.medicineCode || ''}
                          onChange={(e) => {
                            updateRow(index, 'medicineCode', e.target.value);
                          }}
                          onFocus={() => {
                            // No action on focus for code
                          }}
                          onKeyDown={(e) => {
                            handleEnterKey(e, index, 'medicineCode');
                            handleTableKeyDown(e, index);
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-0 border-r border-slate-200 min-w-[150px]">
                      <div className="relative">
                        <input 
                          ref={el => { nameRefs.current[index] = el; }}
                          type="text"
                          className="w-full px-2 py-0.5 text-[10px] outline-none focus:bg-blue-50/30"
                          value={item.medicineName}
                          onChange={(e) => {
                            updateRow(index, 'medicineName', e.target.value);
                            setSearchQuery(e.target.value);
                            setActiveSearchIndex(index);
                            setActiveSearchField('medicineName');
                          }}
                          onFocus={() => {
                            setActiveSearchIndex(index);
                            setActiveSearchField('medicineName');
                            setSearchQuery(item.medicineName);
                          }}
                          onKeyDown={(e) => {
                            handleEnterKey(e, index, 'medicineName');
                            handleTableKeyDown(e, index);
                          }}
                        />
                        {activeSearchIndex === index && searchQuery && filteredMedicines && filteredMedicines.length > 0 && (
                          <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto">
                            {filteredMedicines.map(med => (
                              <button
                                key={med.id}
                                onClick={() => handleMedicineSelect(index, med)}
                                className="w-full p-1 flex items-center justify-between hover:bg-blue-50 text-left border-b border-slate-50 last:border-0"
                              >
                                <div>
                                  <p className="font-bold text-slate-900 text-[9px]">{med.name}</p>
                                  <p className="text-[7px] text-slate-500">{med.batchNumber}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-blue-600 text-[9px]">{formatNumber(invoiceType === 'Sales' ? med.salePrice : med.purchasePrice)}</p>
                                  <p className="text-[7px] text-slate-400">Stock: {med.stockQuantity}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="text"
                        className="w-full px-2 py-0.5 text-[10px] outline-none focus:bg-blue-50/30"
                        value={item.batchNumber}
                        readOnly={invoiceType === 'Sales'}
                        onChange={(e) => updateRow(index, 'batchNumber', e.target.value)}
                        onKeyDown={(e) => handleTableKeyDown(e, index)}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="date"
                        className="w-full px-1 py-0.5 text-[9px] outline-none focus:bg-blue-50/30"
                        value={item.expiryDate}
                        readOnly={invoiceType === 'Sales'}
                        onChange={(e) => updateRow(index, 'expiryDate', e.target.value)}
                        onKeyDown={(e) => handleTableKeyDown(e, index)}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="text"
                        className="w-full px-2 py-0.5 text-[10px] text-center outline-none focus:bg-blue-50/30 font-bold text-blue-600"
                        value={medicines?.find(m => m.id === item.medicineId)?.stockQuantity || 0}
                        readOnly
                        tabIndex={-1}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { quantityRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-2 py-0.5 text-[10px] text-center outline-none focus:bg-blue-50/30"
                        value={item.quantity || ''}
                        onChange={(e) => updateRow(index, 'quantity', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleEnterKey(e, index, 'quantity');
                          handleTableKeyDown(e, index);
                        }}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { priceRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-2 py-0.5 text-[10px] text-right outline-none focus:bg-blue-50/30"
                        value={item.price || ''}
                        onChange={(e) => updateRow(index, 'price', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleEnterKey(e, index, 'price');
                          handleTableKeyDown(e, index);
                        }}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { discountRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-2 py-0.5 text-[10px] text-right outline-none focus:bg-blue-50/30"
                        value={item.discount || ''}
                        onChange={(e) => updateRow(index, 'discount', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleEnterKey(e, index, 'discount');
                          handleTableKeyDown(e, index);
                        }}
                      />
                    </td>
                    <td className="px-2 py-0.5 border-r border-slate-200 text-right text-[10px] font-bold text-slate-900 bg-slate-50/30">
                      {formatNumber(item.total)}
                    </td>
                    <td className="px-2 py-0.5 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button 
                          onClick={addRow}
                          className="p-0.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Add Row"
                        >
                          <Plus size={10} />
                        </button>
                        <button 
                          onClick={() => deleteRow(index)}
                          className="p-0.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="Delete Row"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 3: Total Summary - Fixed Bottom */}
        <div className="shrink-0 pt-0.5 border-t border-slate-100 bg-slate-50/50">
          <div className="bg-[#E9F0F8] px-2 py-0.5 rounded border border-[#D1E1F0] mb-0.5">
            <h2 className="text-[10px] font-bold text-[#2C3E50]">Summary</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2 px-2 py-0.5">
            {invoiceType === 'Purchase' ? (
              <div className="flex-1 grid grid-cols-7 gap-2">
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Previous Balance:</p>
                  <p className="text-sm font-bold text-slate-900">{formatCurrency(previousRemaining)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Subtotal:</p>
                  <p className="text-sm font-bold text-slate-900">{formatNumber(subtotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Discount:</p>
                  <input 
                    type="number"
                    className="w-16 text-center text-sm font-bold text-blue-600 border-b border-slate-300 outline-none"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Grand Total:</p>
                  <p className="text-sm font-bold text-slate-900">{formatNumber(totalPayable)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Paid Amount:</p>
                  <input 
                    type="number"
                    className="w-16 text-center text-sm font-bold text-emerald-600 border-b border-slate-300 outline-none"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Remaining Balance:</p>
                  <p className="text-sm font-bold text-rose-600">{formatNumber(remainingAmount)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Payment Method:</p>
                  <select 
                    className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500 min-w-[80px]"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as any)}
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Online">Online</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-6 gap-2">
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Previous Balance:</p>
                  <p className="text-sm font-bold text-slate-900">{formatNumber(previousRemaining)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Subtotal:</p>
                  <p className="text-sm font-bold text-slate-900">{formatNumber(subtotal)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Discount:</p>
                  <input 
                    type="number"
                    className="w-16 text-center text-sm font-bold text-blue-600 border-b border-slate-300 outline-none"
                    value={discount}
                    onChange={(e) => setDiscount(Number(e.target.value))}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Grand Total:</p>
                  <p className="text-sm font-bold text-slate-900">{formatNumber(totalPayable)}</p>
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Paid Amount:</p>
                  <input 
                    type="number"
                    className="w-16 text-center text-sm font-bold text-emerald-600 border-b border-slate-300 outline-none"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(Number(e.target.value))}
                  />
                </div>
                <div className="text-center">
                  <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Remaining Balance:</p>
                  <p className="text-sm font-bold text-rose-600">{formatNumber(remainingAmount)}</p>
                </div>
              </div>
            )}
          </div>
        </div>
        </div>
      </div>

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
