export const syncService = {
  async syncInvoice(invoice: any) {
    // Cloud sync disabled as Supabase is disconnected
    console.log('Cloud sync disabled for invoice:', invoice.invoiceNumber);
    return true;
  },

  async syncPurchase(purchase: any) {
    // Cloud sync disabled as Supabase is disconnected
    console.log('Cloud sync disabled for purchase:', purchase.invoiceNumber);
    return true;
  }
};
