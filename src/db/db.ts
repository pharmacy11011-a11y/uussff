import Dexie, { type Table } from 'dexie';

export interface Medicine {
  id?: number;
  code: string;
  name: string;
  genericName: string;
  unit?: string;
  supplierName: string;
  companyName: string;
  categoryId: number;
  batchNumber: string;
  barcode: string;
  expiryDate: string;
  purchasePrice: number;
  salePrice: number;
  stockQuantity: number;
  minStockLimit: number;
  supplierId: number;
  image?: string;
  notes?: string;
}

export interface Category {
  id?: number;
  name: string;
  description: string;
}

export interface Supplier {
  id?: number;
  code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  companyName: string;
  currentBalance: number;
}

export interface Customer {
  id?: number;
  code?: string;
  name: string;
  phone: string;
  address: string;
  balance: number;
}

export interface InvoiceItem {
  medicineId: number;
  medicineCode?: string;
  medicineName: string;
  unit?: string;
  batchNumber: string;
  expiryDate?: string;
  quantity: number;
  price: number; // This is sale price
  purchasePrice: number;
  salePrice: number;
  discount: number;
  total: number;
}

export interface Invoice {
  id?: number;
  invoiceNumber: string;
  date: string;
  customerId?: number;
  customerName: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Online';
  status?: string;
  userId: number;
  time?: string;
  previousRemaining?: number;
}

export interface Purchase {
  id?: number;
  invoiceNumber: string;
  supplierId: number;
  supplierName: string;
  supplierPhone?: string;
  supplierAddress?: string;
  date: string;
  items: {
    medicineId: number;
    medicineCode?: string;
    medicineName: string;
    unit?: string;
    quantity: number;
    purchasePrice: number;
    batchNumber: string;
    expiryDate: string;
    discount?: number;
    total: number;
  }[];
  totalCost: number;
  total?: number;
  discount?: number;
  tax?: number;
  paidAmount: number;
  remainingAmount: number;
  paymentMethod: 'Cash' | 'Card' | 'Online';
  status?: string;
  userId?: number;
  time?: string;
  previousRemaining?: number;
  subtotal?: number;
}

export interface Expense {
  id?: number;
  name: string;
  category: string;
  amount: number;
  date: string;
  notes?: string;
}

export interface User {
  id?: number;
  email: string;
  username: string;
  password: string;
  role: 'Admin' | 'Pharmacist' | 'Staff';
  fullName: string;
  status: 'active' | 'blocked';
  createdAt: string;
  lastLogin?: string;
  supabase_id?: string;
}

export interface ActivityLog {
  id?: number;
  timestamp: string;
  action: string;
  details: string;
  userId: number;
}

export interface Settings {
  id?: number;
  pharmacyName: string;
  address: string;
  phone: string;
  easyPaisa?: string;
  currency: string;
  systemTheme: 'light' | 'dark' | 'system';
  lastInvoiceNumber?: number;
  lastSalesInvoiceNumber?: number;
  lastPurchaseInvoiceNumber?: number;
  expiryThreshold?: number; // in months
  defaultPrintType?: 'Thermal' | 'A4' | 'Compact' | 'Detailed';
}

export interface Return {
  id?: number;
  type: 'Sales' | 'Purchase';
  referenceNumber: string; // Invoice or Purchase number
  date: string;
  items: {
    medicineId: number;
    medicineCode?: string;
    medicineName: string;
    quantity: number;
    price: number;
    salePrice?: number;
    purchasePrice?: number;
    total: number;
  }[];
  totalAmount: number;
  netTotal: number;
  isManualNetTotal: boolean;
  reason: string;
  customerName?: string;
  supplierName?: string;
}

export interface Staff {
  id?: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  role: string;
  salary: number;
  joiningDate: string;
}

export interface Due {
  id?: number;
  personName: string;
  personType: 'Customer' | 'Supplier';
  personContact?: string;
  amount: number;
  date: string;
  referenceNumber: string;
  status: 'Pending' | 'Paid';
  invoiceTotal: number;
  paidAmount: number;
  remaining: number;
  notes?: string;
}

export interface SupplierPayment {
  id?: number;
  supplierId: number;
  supplierName: string;
  date: string;
  amount: number;
  paymentMethod: string;
  remainingBalance: number;
  notes?: string;
}

export class PharmaDB extends Dexie {
  medicines!: Table<Medicine>;
  categories!: Table<Category>;
  suppliers!: Table<Supplier>;
  customers!: Table<Customer>;
  invoices!: Table<Invoice>;
  purchases!: Table<Purchase>;
  expenses!: Table<Expense>;
  staff!: Table<Staff>;
  users!: Table<User>;
  activityLogs!: Table<ActivityLog>;
  settings!: Table<Settings>;
  returns!: Table<Return>;
  dues!: Table<Due>;
  supplierPayments!: Table<SupplierPayment>;

  constructor() {
    super('PharmaDB');
    this.version(12).stores({
      medicines: '++id, code, name, genericName, categoryId, supplierId, barcode',
      categories: '++id, name',
      suppliers: '++id, code, name, [name+phone+address]',
      customers: '++id, code, name, phone, address, [name+phone+address]',
      invoices: '++id, invoiceNumber, date, customerId, customerName',
      purchases: '++id, invoiceNumber, date, supplierId, supplierName',
      expenses: '++id, name, category, date',
      staff: '++id, name, phone',
      users: '++id, username, email, supabase_id',
      activityLogs: '++id, timestamp, userId',
      settings: '++id',
      returns: '++id, type, referenceNumber, date, customerName, supplierName',
      dues: '++id, personName, personType, date, status, referenceNumber, remaining, [referenceNumber+personType], [personName+personType]',
      supplierPayments: '++id, supplierId, date'
    });
  }
}

export const db = new PharmaDB();

// Export a global sync trigger that can be set by the useGoogleSync hook
export let globalSyncTrigger: (() => void) | null = null;
export const setGlobalSyncTrigger = (trigger: () => void) => {
  globalSyncTrigger = trigger;
};

// Add hooks to all tables to trigger sync on changes
db.tables.forEach(table => {
  table.hook('creating', () => { if (globalSyncTrigger) globalSyncTrigger(); });
  table.hook('updating', () => { if (globalSyncTrigger) globalSyncTrigger(); });
  table.hook('deleting', () => { if (globalSyncTrigger) globalSyncTrigger(); });
});

export async function logActivity(action: string, details: string, userId: number = 1) {
  await db.activityLogs.add({
    timestamp: new Date().toISOString(),
    action,
    details,
    userId
  });
}

// Initialize default settings and admin user if not exists
export async function initializeDB() {
  console.log('Starting database initialization...');
  
  // Safety timeout for DB initialization
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => {
      console.warn('Database initialization timeout reached in db.ts');
      reject(new Error('Database initialization timeout'));
    }, 4000)
  );

  const initPromise = (async () => {
    try {
      // Ensure DB is open
      if (!db.isOpen()) {
        console.log('Opening database...');
        await db.open();
      }
      
      console.log('Checking settings...');
      const settingsCount = await db.settings.count();
      if (settingsCount === 0) {
        console.log('Adding default settings...');
        await db.settings.add({
          pharmacyName: 'PharmaFlow Pro',
          address: '123 Pharmacy St, Medical District',
          phone: '+1 234 567 890',
          easyPaisa: '03319325183',
          currency: '',
          systemTheme: 'light',
          lastInvoiceNumber: 0,
          lastSalesInvoiceNumber: 0,
          lastPurchaseInvoiceNumber: 0,
          expiryThreshold: 3
        });
      }

      console.log('Checking categories...');
      const categoryCount = await db.categories.count();
      if (categoryCount === 0) {
        console.log('Adding default categories...');
        const defaultCategories = [
          { name: 'Tablets', description: 'Oral tablets' },
          { name: 'Syrups', description: 'Liquid oral medicines' },
          { name: 'Injections', description: 'Injectable medicines' },
          { name: 'Drops', description: 'Eye, ear, or nasal drops' },
          { name: 'Other', description: 'Other medicine types' }
        ];
        for (const cat of defaultCategories) {
          await db.categories.add(cat);
        }
      }

      console.log('Checking users...');
      const userCount = await db.users.count();
      if (userCount === 0) {
        console.log('Adding default users...');
        // Super Admin
        await db.users.add({
          email: 'hazirk777@gmail.com',
          username: 'superadmin',
          password: 'admin', // Default password, should be changed
          role: 'Admin',
          fullName: 'Super Admin',
          status: 'active',
          createdAt: new Date().toISOString()
        });

        // Default Admin
        await db.users.add({
          email: 'admin@yousaf.com',
          username: 'admin',
          password: 'admin',
          role: 'Admin',
          fullName: 'System Administrator',
          status: 'active',
          createdAt: new Date().toISOString()
        });

        // Yousaf Pharmacy Admin
        await db.users.add({
          email: 'yousafpharmacy9@gmail.com',
          username: 'yousafadmin',
          password: 'admin',
          role: 'Admin',
          fullName: 'Yousaf Pharmacy Admin',
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }

      console.log('Cleaning up dues...');
      // Cleanup Dues with 0 remaining
      await db.dues.where('remaining').equals(0).delete();
      
      console.log('Database initialization complete.');
    } catch (error) {
      console.error('Error during database initialization:', error);
      // We don't rethrow here to allow the app to try and load anyway
    }
  })();

  return Promise.race([initPromise, timeoutPromise]).catch(err => {
    console.warn('initializeDB race result:', err.message);
    // Return successfully even on timeout to unblock App.tsx
    return true;
  });
}
