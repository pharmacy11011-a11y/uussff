import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, type Medicine, logActivity } from '@/src/db/db';
import { useTableKeyboardNavigation } from '@/src/hooks/useTableKeyboardNavigation';
import { useFormKeyboardNavigation } from '@/src/hooks/useFormKeyboardNavigation';
import { 
  Search, 
  Trash2, 
  Plus, 
  Calendar,
  Truck,
  Save,
  Printer,
  X,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, formatNumber, cn, printTemplate } from '@/src/utils/utils';
import { Receipt } from '../Common/Receipt';
import { PrintPreviewModal } from '../Common/PrintPreviewModal';
import { getNextInvoiceNumber, incrementInvoiceNumber, isInvoiceNumberDuplicate } from '@/src/utils/invoiceUtils';

interface PurchaseItem {
  medicineId: number;
  medicineCode?: string;
  medicineName: string;
  unit?: string;
  batchNumber: string;
  quantity: number;
  purchasePrice: number;
  salePrice: number;
  expiryDate: string;
  discount: number;
  total: number;
}

export const PurchaseManagement = ({ setActiveTab, editInvoiceId, onEditComplete }: { setActiveTab: (tab: string) => void, editInvoiceId?: number | null, onEditComplete?: () => void }) => {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>(Array(15).fill(null).map(() => ({
    medicineId: 0,
    medicineCode: '',
    medicineName: '',
    batchNumber: '',
    quantity: 0,
    purchasePrice: 0,
    salePrice: 0,
    expiryDate: '',
    discount: 0,
    total: 0
  })));
  const [supplierInfo, setSupplierInfo] = useState({ name: '', phone: '', address: '', code: '' });
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [showSupplierSearch, setShowSupplierSearch] = useState(false);
  const [tax, setTax] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewData, setPrintPreviewData] = useState<any>(null);
  const [originalInvoice, setOriginalInvoice] = useState<any>(null);

  useEffect(() => {
    if (editInvoiceId) {
      const loadPurchase = async () => {
        const purchase = await db.purchases.get(editInvoiceId);
        if (purchase) {
          handleEditPurchase(purchase);
        }
      };
      loadPurchase();
    }
  }, [editInvoiceId]);

  const handleEditPurchase = React.useCallback((purchase: any) => {
    const purchaseItems = purchase.items.map((item: any) => ({
      medicineId: item.medicineId,
      medicineCode: item.medicineCode || '',
      medicineName: item.medicineName,
      batchNumber: item.batchNumber || '',
      quantity: item.quantity,
      purchasePrice: item.purchasePrice,
      salePrice: item.salePrice || 0,
      expiryDate: item.expiryDate || '',
      discount: item.discount || 0,
      total: item.total
    }));

    const paddedItems = [...purchaseItems];
    while (paddedItems.length < 15) {
      paddedItems.push({
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        expiryDate: '',
        discount: 0,
        total: 0
      });
    }

    setPurchaseItems(paddedItems);
    setSupplierInfo({
      name: purchase.supplierName,
      phone: purchase.supplierPhone || '',
      address: purchase.supplierAddress || '',
      code: purchase.supplierCode || ''
    });
    setInvoiceNumber(purchase.invoiceNumber);
    setPurchaseDate(purchase.date);
    setTax(purchase.tax || 0);
    setPaidAmount(purchase.paidAmount || 0);
    setPreviousRemaining(purchase.previousRemaining || 0);
    setIsEditing(true);
    setOriginalInvoice(purchase);
    setIsSaved(false);
  }, []);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const supplierCodeRef = useRef<HTMLInputElement>(null);
  const supplierNameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const addressRef = useRef<HTMLInputElement>(null);
  const quantityRefs = useRef<(HTMLInputElement | null)[]>([]);
  const priceRefs = useRef<(HTMLInputElement | null)[]>([]);
  const discountRefs = useRef<(HTMLInputElement | null)[]>([]);

  const settings = useLiveQuery(() => db.settings.toCollection().first());
  const medicines = useLiveQuery(() => db.medicines.toArray());
  const suppliers = useLiveQuery(() => db.suppliers.toArray());
  const purchases = useLiveQuery(() => db.purchases.toArray());

  const filteredMedicines = medicines?.filter(m => 
    (m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
     m.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
     m.barcode.includes(searchQuery))
  );

  const filteredSuppliers = suppliers?.filter(s => 
    s.name.toLowerCase().includes(supplierSearchQuery.toLowerCase()) || 
    s.code.toLowerCase().includes(supplierSearchQuery.toLowerCase())
  );

  const [previousRemaining, setPreviousRemaining] = useState(0);

  useEffect(() => {
    const initInvoice = async () => {
      if (!isEditing && !editInvoiceId) {
        const num = await getNextInvoiceNumber('Purchase');
        setInvoiceNumber(num);
      }
    };
    initInvoice();
  }, [isEditing, editInvoiceId]);

  const totalCost = purchaseItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalPayable = totalCost + tax + previousRemaining;
  const remainingAmount = totalPayable - paidAmount;

  useEffect(() => {
    if (activeSearchIndex !== null && searchQuery) {
      const exactMatch = medicines?.find(m => 
        m.code.toLowerCase() === searchQuery.toLowerCase()
      );
      if (exactMatch) {
        handleMedicineSelect(activeSearchIndex, exactMatch);
      }
    }
  }, [searchQuery, activeSearchIndex, medicines]);

  // Fetch live balance when supplier changes
  useEffect(() => {
    const fetchPreviousRemaining = async () => {
      if (isEditing && originalInvoice) {
        // If editing and same supplier, use saved previous balance
        if (supplierInfo.name === originalInvoice.supplierName) {
          setPreviousRemaining(originalInvoice.previousRemaining || 0);
          return;
        }
      }

      if (supplierSearchQuery) {
        const exactMatch = suppliers?.find(s => 
          s.code.toLowerCase() === supplierSearchQuery.toLowerCase() ||
          s.name.toLowerCase() === supplierSearchQuery.toLowerCase()
        );
        if (exactMatch) {
          setSupplierInfo({
            name: exactMatch.name || '',
            phone: exactMatch.phone || '',
            address: exactMatch.address || '',
            code: exactMatch.code || ''
          });
          setShowSupplierSearch(false);
          
          // Fetch previous remaining
          setPreviousRemaining(exactMatch.currentBalance || 0);
        } else {
          setPreviousRemaining(0);
        }
      }
    };
    fetchPreviousRemaining();
  }, [supplierSearchQuery, suppliers, isEditing, originalInvoice]);

  const addRow = () => {
    if (purchaseItems.length >= 50) {
      showToast('Maximum 50 items allowed per invoice', 'error');
      return;
    }
    setPurchaseItems([...purchaseItems, {
      medicineId: 0,
      medicineName: '',
      unit: '',
      batchNumber: '',
      quantity: 0,
      purchasePrice: 0,
      salePrice: 0,
      expiryDate: '',
      discount: 0,
      total: 0
    }]);
  };

  const deleteRow = (index: number) => {
    const newItems = purchaseItems.filter((_, i) => i !== index);
    if (newItems.length === 0) {
      setPurchaseItems([{
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        expiryDate: '',
        discount: 0,
        total: 0
      }]);
    } else {
      setPurchaseItems(newItems);
    }
  };

  const handleMedicineSelect = (index: number, medicine: Medicine) => {
    const newItems = [...purchaseItems];
    const item = {
      ...newItems[index],
      medicineId: medicine.id!,
      medicineCode: medicine.code,
      medicineName: medicine.name,
      unit: medicine.unit || 'TAB',
      batchNumber: medicine.batchNumber || '',
      purchasePrice: medicine.purchasePrice,
      salePrice: medicine.salePrice,
      expiryDate: medicine.expiryDate || '',
      quantity: newItems[index].quantity || 1,
      discount: newItems[index].discount || 0,
      total: ((newItems[index].quantity || 1) * medicine.purchasePrice) - (newItems[index].discount || 0)
    };
    newItems[index] = item;

    // Auto-add new row if last row is being filled
    if (index === purchaseItems.length - 1 && purchaseItems.length < 50) {
      newItems.push({
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        expiryDate: '',
        discount: 0,
        total: 0
      });
    }

    setPurchaseItems(newItems);
    setActiveSearchIndex(null);
    setSearchQuery('');
  };

  const updateRow = (index: number, field: keyof PurchaseItem, value: any) => {
    const newItems = [...purchaseItems];
    const item = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'purchasePrice' || field === 'discount') {
      const qty = field === 'quantity' ? Number(value) : item.quantity;
      const price = field === 'purchasePrice' ? Number(value) : item.purchasePrice;
      const disc = field === 'discount' ? Number(value) : item.discount;
      item.total = (qty || 0) * (price || 0) - (disc || 0);
    }
    
    newItems[index] = item;
    setPurchaseItems(newItems);

    // Auto-add new row if last row is being filled
    if (index === purchaseItems.length - 1 && (item.medicineName || item.medicineCode || item.batchNumber || item.quantity > 0) && purchaseItems.length < 50) {
      setPurchaseItems([...newItems, {
        medicineId: 0,
        medicineCode: '',
        medicineName: '',
        unit: '',
        batchNumber: '',
        quantity: 0,
        purchasePrice: 0,
        salePrice: 0,
        expiryDate: '',
        discount: 0,
        total: 0
      }]);
    }
  };

  const handleSavePurchase = async () => {
    if (isSaved) {
      handleNewPurchase();
      return false;
    }
    const validItems = purchaseItems.filter(item => (item.medicineId !== 0 || item.medicineName.trim() !== '') && item.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please add items to the purchase', 'error');
      return false;
    }
    
    if (!supplierInfo.name) {
      showToast('Please enter supplier name', 'error');
      return false;
    }
    if (!invoiceNumber) {
      showToast('Please enter invoice number', 'error');
      return false;
    }

    const netInvoice = totalCost + tax;
    const invoiceRemaining = Math.max(0, netInvoice - paidAmount);
    
    // Calculate delta for supplier balance
    let balanceDelta = netInvoice - paidAmount;
    if (isEditing && originalInvoice) {
      const oldNet = (originalInvoice.total || 0);
      const oldPaid = originalInvoice.paidAmount || 0;
      balanceDelta = (netInvoice - paidAmount) - (oldNet - oldPaid);
    }

    const purchaseData = {
      invoiceNumber,
      supplierId: 0,
      supplierName: supplierInfo.name,
      supplierPhone: supplierInfo.phone,
      supplierAddress: supplierInfo.address,
      supplierCode: supplierInfo.code,
      date: purchaseDate,
      items: validItems,
      totalCost,
      tax,
      total: netInvoice,
      paidAmount,
      remainingAmount: invoiceRemaining,
      previousRemaining,
      paymentMethod: 'Cash' as const,
      userId: 1,
      time: isEditing ? originalInvoice.time : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    };

    setIsProcessing(true);
    try {
      await db.transaction('rw', [db.purchases, db.medicines, db.activityLogs, db.dues, db.suppliers, db.settings], async () => {
        // Check for duplicate invoice number if it's a new invoice
        if (!isEditing) {
          const isDuplicate = await isInvoiceNumberDuplicate(invoiceNumber, 'Purchase');
          if (isDuplicate) {
            const nextNum = await getNextInvoiceNumber('Purchase');
            setInvoiceNumber(nextNum);
            throw new Error(`Invoice number ${invoiceNumber} already exists. Using ${nextNum} instead.`);
          }
        }

        if (isEditing && originalInvoice) {
          // Revert old stock
          for (const item of originalInvoice.items) {
            const med = await db.medicines.get(item.medicineId);
            if (med) {
              await db.medicines.update(item.medicineId, {
                stockQuantity: med.stockQuantity - Number(item.quantity)
              });
            }
          }
          // Revert supplier balance
          const oldSupplier = suppliers?.find(s => s.name === originalInvoice.supplierName);
          if (oldSupplier) {
            await db.suppliers.update(oldSupplier.id!, {
              currentBalance: (oldSupplier.currentBalance || 0) - (originalInvoice.remainingAmount || 0)
            });
          }
          // Delete old dues
          await db.dues.where({ referenceNumber: originalInvoice.invoiceNumber, personType: 'Supplier' }).delete();
        }

        const itemsToSave = [];
        for (const item of validItems) {
          let medId = item.medicineId;
          
          // If medicineId is 0, it's a new medicine
          if (medId === 0) {
            medId = await db.medicines.add({
              code: `MED-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
              name: item.medicineName,
              genericName: '',
              supplierName: supplierInfo.name,
              companyName: '',
              categoryId: 0, // Uncategorized
              batchNumber: item.batchNumber,
              barcode: '',
              expiryDate: item.expiryDate,
              purchasePrice: Number(item.purchasePrice),
              salePrice: Number(item.salePrice),
              stockQuantity: Number(item.quantity),
              minStockLimit: 10,
              supplierId: 0
            });
          } else {
            const med = await db.medicines.get(medId);
            if (med) {
              const updateData: any = {
                stockQuantity: med.stockQuantity + Number(item.quantity),
                batchNumber: item.batchNumber,
                expiryDate: item.expiryDate
              };
              
              // Automatically update Purchase Price if it has changed
              if (Number(item.purchasePrice) !== med.purchasePrice) {
                updateData.purchasePrice = Number(item.purchasePrice);
              }
              
              // Update sale price only if explicitly provided and different
              if (Number(item.salePrice) && Number(item.salePrice) !== med.salePrice) {
                updateData.salePrice = Number(item.salePrice);
              }

              await db.medicines.update(medId, updateData);
            }
          }
          itemsToSave.push({ ...item, medicineId: medId });
        }

        if (isEditing && originalInvoice) {
          await db.purchases.put({
            ...purchaseData,
            items: itemsToSave,
            id: originalInvoice.id
          });
        } else {
          await db.purchases.add({
            ...purchaseData,
            items: itemsToSave
          });
          await incrementInvoiceNumber('Purchase');
        }

        // Update supplier balance and dues
        const supplier = suppliers?.find(s => s.name === supplierInfo.name);
        if (supplier) {
          await db.suppliers.update(supplier.id!, {
            currentBalance: (supplier.currentBalance || 0) + balanceDelta
          });

          // Update or create a single due record for this supplier
          const existingDue = await db.dues
            .where({ personName: supplierInfo.name, personType: 'Supplier' })
            .first();

          const currentSupplierBalance = (supplier.currentBalance || 0) + balanceDelta;

          if (existingDue) {
            if (currentSupplierBalance <= 0) {
              await db.dues.delete(existingDue.id!);
            } else {
              await db.dues.update(existingDue.id!, {
                amount: currentSupplierBalance,
                remaining: currentSupplierBalance,
                invoiceTotal: (existingDue.invoiceTotal || 0) + (isEditing ? (netInvoice - (originalInvoice?.total || 0)) : netInvoice),
                paidAmount: (existingDue.paidAmount || 0) + (isEditing ? (paidAmount - (originalInvoice?.paidAmount || 0)) : paidAmount),
                date: purchaseDate,
                status: 'Pending'
              });
            }
          } else if (currentSupplierBalance > 0) {
            await db.dues.add({
              personName: supplierInfo.name,
              personType: 'Supplier',
              personContact: supplier?.phone || '',
              amount: currentSupplierBalance,
              remaining: currentSupplierBalance,
              date: purchaseDate,
              referenceNumber: invoiceNumber,
              status: 'Pending',
              invoiceTotal: netInvoice,
              paidAmount: paidAmount
            });
          }
        }
        
        await logActivity('Purchase recorded', `Recorded purchase: ${invoiceNumber} from ${supplierInfo.name}`);
      });
      setIsSaved(true);
      showToast(isEditing ? 'Purchase updated successfully' : 'Purchase saved successfully');
      if (isEditing && onEditComplete) {
        onEditComplete();
      } else {
        handleNewPurchase();
      }
      return true;
    } catch (error: any) {
      console.error(error);
      if (error.message && error.message.includes('already exists')) {
        showToast(error.message, 'error');
      } else {
        showToast('Error recording purchase', 'error');
      }
      setIsProcessing(false);
      return false;
    }
  };

  const handlePrint = () => {
    const validItems = purchaseItems.filter(item => (item.medicineId !== 0 || item.medicineName.trim() !== '') && item.quantity > 0);
    if (validItems.length === 0) {
      showToast('Please add items to the purchase', 'error');
      return;
    }
    
    setPrintPreviewData({
      title: 'Purchase Invoice',
      type: 'Purchase Invoice',
      invoiceNumber: invoiceNumber,
      date: purchaseDate,
      time: new Date().toLocaleTimeString(),
      partyName: supplierInfo.name,
      partyContact: supplierInfo.phone,
      partyAddress: supplierInfo.address,
      items: validItems.map(item => ({
        medicineCode: item.medicineCode,
        medicineName: item.medicineName,
        unit: item.unit || 'TAB',
        qty: item.quantity,
        price: item.purchasePrice,
        discount: item.discount || 0,
        total: item.total
      })),
      subtotal: totalCost,
      discount: 0,
      tax: tax,
      total: totalPayable,
      paid: paidAmount,
      remaining: remainingAmount,
      previousRemaining: previousRemaining,
      paymentMethod: 'Cash'
    });
    setShowPrintPreview(true);
  };

  const handleNewPurchase = async () => {
    setPurchaseItems(Array(15).fill(null).map(() => ({
      medicineId: 0,
      medicineCode: '',
      medicineName: '',
      batchNumber: '',
      quantity: 0,
      purchasePrice: 0,
      salePrice: 0,
      expiryDate: '',
      discount: 0,
      total: 0
    })));
    setSupplierInfo({ name: '', phone: '', address: '', code: '' });
    setPreviousRemaining(0);
    const num = await getNextInvoiceNumber('Purchase');
    setInvoiceNumber(num);
    setSearchQuery('');
    setSupplierSearchQuery('');
    setTax(0);
    setPaidAmount(0);
    setPurchaseDate(new Date().toISOString().split('T')[0]);
    setIsSaved(false);
    setIsEditing(false);
    setOriginalInvoice(null);
    supplierNameRef.current?.focus();
  };

  // Reset form on mount or when editInvoiceId changes to null
  useEffect(() => {
    if (!editInvoiceId) {
      handleNewPurchase();
    }
  }, [editInvoiceId]);

  const { handleKeyDown: handleTableKeyDown } = useTableKeyboardNavigation(tableContainerRef, addRow);
  const { handleKeyDown: handleFormKeyDown } = useFormKeyboardNavigation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isProcessing) return;

      // F8: Print
      if (e.key === 'F8' || (e.ctrlKey && e.key === 'p')) {
        e.preventDefault();
        if (isSaved || purchaseItems.filter(item => (item.medicineId !== 0 || item.medicineName.trim() !== '') && item.quantity > 0).length > 0) {
          handlePrint();
        } else {
          showToast('Please add items to the purchase to print.', 'error');
        }
      } 
      // F9: Save
      else if (e.key === 'F9' || (e.ctrlKey && e.key === 's')) {
        e.preventDefault();
        handleSavePurchase();
      }
      // F10: New Purchase
      else if (e.key === 'F10') {
        e.preventDefault();
        handleNewPurchase();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSavePurchase, handleNewPurchase, isSaved, isProcessing, purchaseItems, handlePrint]);

  const handleEnterKey = async (e: React.KeyboardEvent, index: number, field: string) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();

    if (field === 'medicineCode') {
      const code = purchaseItems[index].medicineCode;
      if (code) {
        const medicine = medicines?.find(m => m.code.toLowerCase() === code.toLowerCase());
        if (medicine) {
          handleMedicineSelect(index, medicine);
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
    } else if (field === 'purchasePrice') {
      // Move to discount input
      setTimeout(() => {
        discountRefs.current[index]?.focus();
        discountRefs.current[index]?.select();
      }, 0);
    } else if (field === 'discount') {
      const nextRow = tableContainerRef.current?.querySelectorAll('tbody tr')[index + 1];
      const nextInput = nextRow?.querySelector('input');
      if (nextInput) {
        (nextInput as HTMLInputElement).focus();
      } else if (index === purchaseItems.length - 1) {
        addRow();
        setTimeout(() => {
          const rows = tableContainerRef.current?.querySelectorAll('tbody tr');
          const lastRow = rows ? rows[rows.length - 1] : null;
          const lastInput = lastRow?.querySelector('input');
          if (lastInput) (lastInput as HTMLInputElement).focus();
        }, 0);
      }
    } else {
      const inputs = Array.from((e.target as HTMLElement).closest('tr')?.querySelectorAll('input') || []);
      const currentIndex = inputs.indexOf(e.target as HTMLInputElement);
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }
  };

  return (
    <div className="min-h-full flex flex-col gap-1 bg-[#F0F2F5] p-1 no-scrollbar">
      <div className="flex flex-col gap-1 min-h-full">
        {/* Header & Actions */}
        <div className="flex items-center justify-between shrink-0 no-print bg-white px-3 py-1.5 rounded-t-lg border-x border-t border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <label className="text-[10px] font-bold text-slate-700">Type:</label>
            <select 
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500 min-w-[120px]"
              value="purchases"
              onChange={(e) => setActiveTab(e.target.value)}
            >
              <option value="billing">Sales Invoice</option>
              <option value="purchases">Purchase Invoice</option>
            </select>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 text-slate-500" />
            <label className="text-[10px] font-bold text-slate-700">Date:</label>
            <input 
              type="date"
              className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          <button 
            onClick={handlePrint}
            className="px-3 py-1 bg-[#167D45] hover:bg-[#116135] text-white rounded text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
          >
            <Printer size={12} />
            Print
          </button>
          <button 
            onClick={handleSavePurchase}
            className="px-3 py-1 bg-[#1E56A0] hover:bg-[#16427a] text-white rounded text-[10px] font-bold transition-all shadow-sm flex items-center gap-1.5"
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

        {/* Section 1: Supplier Details - Table Style */}
        <div className="shrink-0">
          <form onKeyDown={handleFormKeyDown}>
            <div className="bg-[#E9F0F8] px-2 py-0.5 rounded border border-[#D1E1F0] mb-1">
              <h2 className="text-[10px] font-bold text-[#2C3E50]">Supplier Details</h2>
            </div>
            <div className="border border-slate-200 rounded overflow-hidden mb-1">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50">
                  <tr className="text-[9px] font-bold text-slate-500 uppercase border-b border-slate-200">
                    <th className="px-2 py-0.5 border-r border-slate-200">Code</th>
                    <th className="px-2 py-0.5 border-r border-slate-200">Name</th>
                    <th className="px-2 py-0.5 border-r border-slate-200">Mobile</th>
                    <th className="px-2 py-0.5">Address</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-0 border-r border-slate-200 relative">
                      <input 
                        ref={supplierCodeRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={supplierInfo.code}
                        onChange={(e) => {
                          setSupplierInfo({ ...supplierInfo, code: e.target.value });
                          setSupplierSearchQuery(e.target.value);
                          setShowSupplierSearch(true);
                        }}
                        onFocus={() => setShowSupplierSearch(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Move to table
                            const firstCodeInput = tableContainerRef.current?.querySelector('tbody input');
                            if (firstCodeInput) (firstCodeInput as HTMLInputElement).focus();
                          }
                        }}
                      />
                      {showSupplierSearch && supplierSearchQuery && filteredSuppliers && filteredSuppliers.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-0.5 bg-white border border-slate-200 rounded-lg shadow-xl z-50 max-h-32 overflow-y-auto">
                          {filteredSuppliers.map(s => (
                            <button
                              key={s.id}
                              onClick={() => {
                                setSupplierInfo({
                                  code: s.code,
                                  name: s.name,
                                  phone: s.phone,
                                  address: s.address
                                });
                                setShowSupplierSearch(false);
                              }}
                              className="w-full p-1 flex items-center justify-between hover:bg-blue-50 text-left border-b border-slate-50 last:border-0"
                            >
                              <div>
                                <p className="font-bold text-slate-900 text-[9px]">{s.name}</p>
                                <p className="text-[7px] text-slate-500">{s.code}</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-0 border-r border-slate-200 relative">
                      <input 
                        ref={supplierNameRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={supplierInfo.name}
                        onChange={(e) => {
                          setSupplierInfo({ ...supplierInfo, name: e.target.value });
                          setSupplierSearchQuery(e.target.value);
                          setShowSupplierSearch(true);
                        }}
                        onFocus={() => setShowSupplierSearch(true)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            // Move to table
                            const firstCodeInput = tableContainerRef.current?.querySelector('tbody input');
                            if (firstCodeInput) (firstCodeInput as HTMLInputElement).focus();
                          }
                        }}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={mobileRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={supplierInfo.phone}
                        onChange={(e) => setSupplierInfo({ ...supplierInfo, phone: e.target.value })}
                      />
                    </td>
                    <td className="p-0">
                      <input 
                        ref={addressRef}
                        type="text"
                        className="w-full px-2 py-1 text-[10px] outline-none focus:bg-blue-50/30"
                        value={supplierInfo.address}
                        onChange={(e) => setSupplierInfo({ ...supplierInfo, address: e.target.value })}
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
          
          <div ref={tableContainerRef} className="flex-1 overflow-y-auto border border-slate-200 rounded mx-0.5 no-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="sticky top-0 bg-[#F8FAFC] z-10">
                <tr className="text-slate-700 text-[9px] font-bold border-b border-slate-200">
                  <th className="px-2 py-1 border-r border-slate-200">Code</th>
                  <th className="px-2 py-1 border-r border-slate-200">Name</th>
                  <th className="px-2 py-1 border-r border-slate-200 w-16">Batch</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-center">Stock</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-center">Qty</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right">Price</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right">Discount</th>
                  <th className="px-2 py-1 border-r border-slate-200 text-right">Total</th>
                  <th className="px-2 py-1 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchaseItems.map((item, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors relative">
                    <td className="p-0 border-r border-slate-200">
                      <div className="relative">
                        <input 
                          type="text"
                          className="w-full px-1.5 py-0.5 text-[9px] outline-none focus:bg-blue-50/30 font-mono"
                          value={item.medicineCode || medicines?.find(m => m.id === item.medicineId)?.code || ''}
                          onChange={(e) => {
                            updateRow(index, 'medicineCode', e.target.value);
                            setSearchQuery(e.target.value);
                            setActiveSearchIndex(index);
                          }}
                          onFocus={() => {
                            setActiveSearchIndex(index);
                            setSearchQuery(item.medicineCode || '');
                          }}
                          onKeyDown={(e) => {
                            handleTableKeyDown(e, index);
                            handleEnterKey(e, index, 'medicineCode');
                          }}
                        />
                      </div>
                    </td>
                    <td className="p-0 border-r border-slate-200 min-w-[150px]">
                      <div className="relative">
                        <input 
                          type="text"
                          className="w-full px-1.5 py-0.5 text-[9px] outline-none focus:bg-blue-50/30"
                          value={item.medicineName}
                          onChange={(e) => {
                            updateRow(index, 'medicineName', e.target.value);
                            setSearchQuery(e.target.value);
                            setActiveSearchIndex(index);
                          }}
                          onFocus={() => {
                            setActiveSearchIndex(index);
                            setSearchQuery(item.medicineName);
                          }}
                          onKeyDown={(e) => handleTableKeyDown(e, index)}
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
                                  <p className="font-bold text-blue-600 text-[9px]">{formatNumber(med.purchasePrice)}</p>
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
                        className="w-full px-1.5 py-0.5 text-[9px] outline-none focus:bg-blue-50/30"
                        value={item.batchNumber}
                        onChange={(e) => updateRow(index, 'batchNumber', e.target.value)}
                        onKeyDown={(e) => handleTableKeyDown(e, index)}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        type="text"
                        className="w-full px-1.5 py-0.5 text-[9px] text-center outline-none focus:bg-blue-50/30 font-bold text-blue-600"
                        value={medicines?.find(m => m.id === item.medicineId)?.stockQuantity || 0}
                        readOnly
                        tabIndex={-1}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { quantityRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-1.5 py-0.5 text-[9px] text-center outline-none focus:bg-blue-50/30"
                        value={item.quantity || ''}
                        onChange={(e) => updateRow(index, 'quantity', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleTableKeyDown(e, index);
                          handleEnterKey(e, index, 'quantity');
                        }}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { priceRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-1.5 py-0.5 text-[9px] text-right outline-none focus:bg-blue-50/30"
                        value={item.purchasePrice || ''}
                        onChange={(e) => updateRow(index, 'purchasePrice', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleTableKeyDown(e, index);
                          handleEnterKey(e, index, 'purchasePrice');
                        }}
                      />
                    </td>
                    <td className="p-0 border-r border-slate-200">
                      <input 
                        ref={el => { discountRefs.current[index] = el; }}
                        type="number"
                        className="w-full px-1.5 py-0.5 text-[9px] text-right outline-none focus:bg-blue-50/30"
                        value={item.discount || ''}
                        onChange={(e) => updateRow(index, 'discount', Number(e.target.value))}
                        onKeyDown={(e) => {
                          handleTableKeyDown(e, index);
                          handleEnterKey(e, index, 'discount');
                        }}
                      />
                    </td>
                    <td className="px-1.5 py-0.5 border-r border-slate-200 text-right text-[9px] font-bold text-slate-900 bg-slate-50/30">
                      {formatNumber(item.total)}
                    </td>
                    <td className="px-1.5 py-0.5 text-center">
                      <div className="flex items-center justify-center gap-0.5">
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
            <h2 className="text-[10px] font-bold text-[#2C3E50]">Total Summary</h2>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between gap-1.5 px-2 py-0.5">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-slate-700">Payment:</label>
                <select className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] outline-none focus:ring-1 focus:ring-blue-500 min-w-[90px]">
                  <option>Cash</option>
                  <option>Credit</option>
                  <option>Bank Transfer</option>
                </select>
              </div>
            </div>

            <div className="flex-1 grid grid-cols-6 gap-2">
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Invoice Total:</p>
                <p className="text-sm font-bold text-slate-900">{formatNumber(totalCost)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Prev Remaining:</p>
                <p className="text-sm font-bold text-slate-900">{formatNumber(previousRemaining)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Tax:</p>
                <input 
                  type="number"
                  className="w-16 text-center text-sm font-bold text-slate-900 border-b border-slate-300 outline-none"
                  value={tax}
                  onChange={(e) => setTax(Number(e.target.value))}
                />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Total Payable:</p>
                <p className="text-sm font-bold text-slate-900">{formatNumber(totalPayable)}</p>
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Paid Amount:</p>
                <input 
                  type="number"
                  className="w-20 text-center text-sm font-bold text-emerald-600 border-b border-slate-300 outline-none"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(Number(e.target.value))}
                />
              </div>
              <div className="text-center">
                <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0">Remaining:</p>
                <p className="text-sm font-bold text-rose-600">{formatNumber(remainingAmount)}</p>
              </div>
            </div>
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
