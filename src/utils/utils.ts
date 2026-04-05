import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, _currency?: string) {
  return (amount || 0).toLocaleString(undefined, { 
    minimumFractionDigits: 0, 
    maximumFractionDigits: 2 
  });
}

export function formatNumber(num: number) {
  return (num || 0).toLocaleString();
}

export function formatDate(date: string | Date) {
  return new Date(date).toLocaleDateString();
}

export function formatReceiptNumber(num: any) {
  if (num === undefined || num === null || num === '') return '0';
  const val = typeof num === 'string' ? parseFloat(num) : num;
  if (isNaN(val)) return num;
  
  // Clean number formatting, no currency symbols
  return val.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/,/g, '');
}

import { printTemplate } from './printUtils';

export { printTemplate, printTemplate as handlePrint };
