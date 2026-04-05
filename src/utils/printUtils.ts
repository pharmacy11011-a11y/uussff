/**
 * Global Print System for Thermal Printers (58mm)
 * Strictly based on reference image layout
 */

export function printTemplate(sectionId: string = 'print-container', titleText: string = 'PRINT') {
  // Small delay to ensure React has finished rendering the content
  setTimeout(() => {
    const content = document.getElementById(sectionId);

    if (!content) {
      console.error(`Print section with ID "${sectionId}" not found`);
      // Fallback to searching for any print container
      const fallback = document.querySelector('[id*="print-container"]') || document.querySelector('[id*="receipt-content"]');
      if (fallback) {
        window.print();
      } else {
        // If still not found, just print the whole page as a last resort
        window.print();
      }
      return;
    }

    // Set the document title for the print job
    const originalTitle = document.title;
    document.title = titleText;

    // Trigger the browser print dialog
    window.print();

    // Restore the original title
    document.title = originalTitle;
  }, 100);
}

export { printTemplate as handlePrint };
