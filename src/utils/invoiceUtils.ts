import { db } from '../db/db';

export async function getNextInvoiceNumber(type: 'Sales' | 'Purchase' = 'Sales'): Promise<string> {
  const settings = await db.settings.toCollection().first();
  if (!settings) return '1';

  const field = type === 'Sales' ? 'lastSalesInvoiceNumber' : 'lastPurchaseInvoiceNumber';
  const lastNumber = settings[field] || 0;
  let nextNumber = lastNumber + 1;
  
  if (nextNumber > 1000000) {
    nextNumber = 1;
  }

  // Double check against the actual table to ensure no duplicates if settings got out of sync
  let exists = true;
  while (exists) {
    if (type === 'Sales') {
      const count = await db.invoices.where('invoiceNumber').equals(nextNumber.toString()).count();
      if (count === 0) exists = false;
      else nextNumber++;
    } else {
      const count = await db.purchases.where('invoiceNumber').equals(nextNumber.toString()).count();
      if (count === 0) exists = false;
      else nextNumber++;
    }
  }

  return nextNumber.toString();
}

export async function incrementInvoiceNumber(type: 'Sales' | 'Purchase' = 'Sales', currentNumber?: string): Promise<void> {
  const settings = await db.settings.toCollection().first();
  if (!settings) return;

  const field = type === 'Sales' ? 'lastSalesInvoiceNumber' : 'lastPurchaseInvoiceNumber';
  const numToSet = currentNumber ? parseInt(currentNumber) : (settings[field] || 0) + 1;
  
  // Update the counter in settings
  await db.settings.update(settings.id!, { [field]: numToSet });
}

export async function isInvoiceNumberDuplicate(number: string, type: 'Sales' | 'Purchase' = 'Sales'): Promise<boolean> {
  if (type === 'Sales') {
    const count = await db.invoices.where('invoiceNumber').equals(number).count();
    return count > 0;
  } else {
    const count = await db.purchases.where('invoiceNumber').equals(number).count();
    return count > 0;
  }
}
