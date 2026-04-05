import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db } from '../db/db';

export interface PDFOptions {
  title: string;
  filename: string;
  columns: string[];
  data: any[][];
  totals?: { label: string; value: string }[];
}

export async function generatePDF(options: PDFOptions) {
  const { title, filename, columns, data, totals } = options;
  const doc = new jsPDF();
  const settings = await db.settings.get(1);

  // Header
  doc.setFontSize(18);
  doc.setTextColor(44, 62, 80);
  doc.text(settings?.pharmacyName || 'Pharmacy Name', 105, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(settings?.address || 'Address', 105, 22, { align: 'center' });
  doc.text(`Contact: ${settings?.phone || 'Phone'}`, 105, 27, { align: 'center' });

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(15, 32, 195, 32);

  // Page Title
  doc.setFontSize(14);
  doc.setTextColor(0, 0, 0);
  doc.text(title, 15, 42);
  doc.setFontSize(9);
  doc.text(`Date: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 195, 42, { align: 'right' });

  // Table
  autoTable(doc, {
    startY: 48,
    head: [columns],
    body: data,
    theme: 'striped',
    headStyles: { fillColor: [44, 62, 80], textColor: [255, 255, 255], fontSize: 9 },
    bodyStyles: { fontSize: 8 },
    margin: { top: 48 },
    didDrawPage: (data: any) => {
      // Footer
      const str = "Page " + (doc as any).getNumberOfPages();
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(str, 195, doc.internal.pageSize.height - 10, { align: 'right' });
    }
  });

  // Totals
  if (totals && totals.length > 0) {
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(10);
    totals.forEach((total, index) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${total.label}:`, 140, finalY + (index * 7));
      doc.setFont('helvetica', 'normal');
      doc.text(total.value, 195, finalY + (index * 7), { align: 'right' });
    });
  }

  return doc;
}

export async function downloadPDF(options: PDFOptions) {
  const doc = await generatePDF(options);
  doc.save(`${options.filename}.pdf`);
}

export async function sharePDFViaWhatsApp(options: PDFOptions) {
  const doc = await generatePDF(options);
  const pdfBlob = doc.output('blob');
  const filename = `${options.filename}.pdf`;
  const file = new File([pdfBlob], filename, { type: 'application/pdf' });

  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: options.title,
        text: `Sharing ${options.title} from ${options.filename}`,
      });
    } catch (error) {
      console.error('Error sharing PDF:', error);
      // Fallback if sharing fails
      doc.save(filename);
      alert('Sharing failed. The PDF has been downloaded instead.');
    }
  } else {
    // Fallback for desktop or unsupported browsers
    doc.save(filename);
    alert('Sharing files is not supported on this device/browser. The PDF has been downloaded instead. You can now manually share it via WhatsApp.');
  }
}
