import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { formatPriceForDisplay } from "./utils";
import type { Order, OrderStatus, Distributor } from "@/types";

const statusConfig: Record<OrderStatus, { label: string }> = {
  pending: { label: 'Pending' },
  awaiting_payment: { label: 'Awaiting Payment' },
  paid: { label: 'Paid' },
  processing: { label: 'Processing' },
  shipped: { label: 'Shipped' },
  on_hold: { label: 'On Hold' },
  cancelled: { label: 'Cancelled' },
};

// Color scheme matching the reference invoice
const COLORS = {
  primary: [38, 34, 43] as [number, number, number],       // Dark text
  secondary: [107, 114, 128] as [number, number, number],  // Gray text
  accent: [214, 158, 46] as [number, number, number],      // Gold/orange accent
  lightGray: [249, 250, 251] as [number, number, number],  // Light background
  border: [229, 231, 235] as [number, number, number],     // Border color
  success: [34, 197, 94] as [number, number, number],      // Green for paid
  text: [17, 24, 39] as [number, number, number],          // Dark text
  white: [255, 255, 255] as [number, number, number],      // White
};

export interface InvoiceOptions {
  downloadName?: string;
  notes?: string;
  footerText?: string;
  showPaymentInfo?: boolean;
}

/**
 * Generates a professional invoice PDF with distributor branding
 */
export async function generateInvoicePdf(
  order: Order,
  distributor: Distributor,
  options?: InvoiceOptions
): Promise<void> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  // Helper function to load image as base64
  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => resolve(null);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  // ============================================
  // HEADER - Company Name + INVOICE
  // ============================================

  const companyName = distributor.companyName || distributor.name;

  // Try to load logo, otherwise show company name
  let logoLoaded = false;
  if (distributor.logoUrl) {
    try {
      const logoBase64 = await loadImageAsBase64(distributor.logoUrl);
      if (logoBase64) {
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = logoBase64;
        });

        const maxHeight = 14;
        const maxWidth = 50;
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > 0 && height > 0) {
          const aspectRatio = width / height;
          if (height > maxHeight) {
            height = maxHeight;
            width = height * aspectRatio;
          }
          if (width > maxWidth) {
            width = maxWidth;
            height = width / aspectRatio;
          }
          doc.addImage(logoBase64, 'AUTO', margin, currentY, width, height);
          logoLoaded = true;
        }
      }
    } catch (error) {
      console.warn('Could not load logo for invoice:', error);
    }
  }

  // Company name (if no logo)
  if (!logoLoaded) {
    doc.setFontSize(20);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(companyName, margin, currentY + 10);
  }

  // "INVOICE" title - right aligned, gold/orange color
  doc.setFontSize(28);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("INVOICE", pageWidth - margin, currentY + 10, { align: 'right' });

  currentY += 25;

  // ============================================
  // FROM and BILL TO sections
  // ============================================

  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 5;
  const columnWidth = (pageWidth - margin * 2) / 2 - 5;

  // FROM header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.secondary);
  doc.text("FROM", leftColumnX, currentY);

  // BILL TO header
  doc.text("BILL TO", rightColumnX, currentY);

  currentY += 2;

  // Underlines
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(leftColumnX, currentY, leftColumnX + columnWidth - 10, currentY);
  doc.line(rightColumnX, currentY, rightColumnX + columnWidth - 10, currentY);

  currentY += 6;

  // ---- FROM content (left column) ----
  let leftY = currentY;

  // Company name
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(companyName, leftColumnX, leftY);
  leftY += 5;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);

  // Address line
  const addressParts = [
    distributor.addressLine1,
    [distributor.postcode, distributor.city].filter(Boolean).join(' '),
    distributor.country
  ].filter(Boolean);

  if (addressParts.length > 0) {
    const addressText = addressParts.join(', ');
    const addressLines = doc.splitTextToSize(addressText, columnWidth - 15);
    doc.text(addressLines, leftColumnX, leftY);
    leftY += addressLines.length * 4;
  }

  // Phone and email on same line
  const contactLine = [distributor.phoneNumber, distributor.contactEmail].filter(Boolean).join(' · ');
  if (contactLine) {
    doc.text(contactLine, leftColumnX, leftY);
    leftY += 4;
  }

  // KVK and NIF/VAT on same line
  const regParts = [];
  if (distributor.chamberOfCommerce) regParts.push(`KVK: ${distributor.chamberOfCommerce}`);
  if (distributor.taxId) regParts.push(`NIF: ${distributor.taxId}`);
  else if (distributor.vatNumber) regParts.push(`VAT: ${distributor.vatNumber}`);

  if (regParts.length > 0) {
    doc.text(regParts.join(' · '), leftColumnX, leftY);
    leftY += 4;
  }

  // ---- BILL TO content (right column) ----
  let rightY = currentY;

  // Customer company name first (if available), otherwise personal name
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);

  if (order.customerCompanyName) {
    doc.text(order.customerCompanyName, rightColumnX, rightY);
    rightY += 4;
    // Personal name below company name
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    doc.text(order.customerName, rightColumnX, rightY);
    rightY += 4;
  } else {
    doc.text(order.customerName, rightColumnX, rightY);
    rightY += 5;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);

  // Shipping address
  const clientAddressLines = order.shippingAddress.split('\n');
  clientAddressLines.forEach((line) => {
    if (line.trim()) {
      doc.text(line.trim(), rightColumnX, rightY);
      rightY += 4;
    }
  });

  // Email
  if (order.viewerEmail) {
    doc.text(order.viewerEmail, rightColumnX, rightY);
    rightY += 4;
  }

  // Phone
  if (order.phoneNumber) {
    doc.text(order.phoneNumber, rightColumnX, rightY);
    rightY += 4;
  }

  // Customer VAT
  if (order.customerVatNumber) {
    doc.text(`VAT: ${order.customerVatNumber}`, rightColumnX, rightY);
    rightY += 4;
  }

  currentY = Math.max(leftY, rightY) + 8;

  // ============================================
  // INVOICE DETAILS BOXES
  // ============================================

  const boxWidth = (pageWidth - margin * 2) / 3;
  const boxHeight = 8;
  const invoiceNumber = order.orderNumber || order.id.slice(0, 8).toUpperCase();
  const dateText = format(new Date(order.createdAt), 'dd MMM yyyy');
  const statusText = statusConfig[order.status].label;
  const isPaid = order.status === 'paid' || order.paymentStatus === 'paid';

  // Draw boxes
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);

  // Box 1 - Invoice #
  doc.rect(margin, currentY, boxWidth, boxHeight);
  // Box 2 - Date
  doc.rect(margin + boxWidth, currentY, boxWidth, boxHeight);
  // Box 3 - Status
  doc.rect(margin + boxWidth * 2, currentY, boxWidth, boxHeight);

  // Box content - label and value inline
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.secondary);
  doc.setFont("helvetica", "normal");
  doc.text("Invoice #", margin + 3, currentY + 5);
  doc.text("Date", margin + boxWidth + 3, currentY + 5);
  doc.text("Status", margin + boxWidth * 2 + 3, currentY + 5);

  // Box values - positioned after labels
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(invoiceNumber, margin + 22, currentY + 5);
  doc.text(dateText, margin + boxWidth + 15, currentY + 5);

  // Status with color
  if (isPaid) {
    doc.setTextColor(...COLORS.success);
  } else {
    doc.setTextColor(...COLORS.accent);
  }
  doc.text(statusText, margin + boxWidth * 2 + 17, currentY + 5);

  currentY += boxHeight + 10;

  // ============================================
  // ORDER ITEMS TABLE
  // ============================================

  const tableColumn = ["Item", "Qty", "Unit Price", "Total"];
  const tableRows = order.items.map((item) => [
    `${item.title}\n${item.artist}`,
    item.quantity.toString(),
    `€ ${formatPriceForDisplay(item.priceAtTimeOfOrder)}`,
    `€ ${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}`
  ]);

  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
      lineColor: COLORS.border,
      lineWidth: 0,
      textColor: COLORS.text,
    },
    headStyles: {
      fillColor: COLORS.accent,
      textColor: COLORS.white,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: { top: 3, right: 3, bottom: 3, left: 3 },
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 32, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: COLORS.white,
    },
    bodyStyles: {
      lineWidth: 0,
    },
    didParseCell: (data: any) => {
      // Add bottom border to each row
      if (data.section === 'body') {
        data.cell.styles.lineWidth = { bottom: 0.1 };
        data.cell.styles.lineColor = COLORS.border;
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 8;

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsX = pageWidth - margin - 55;

  // Subtotal
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Subtotal:", totalsX, currentY);
  doc.setTextColor(...COLORS.text);
  doc.text(`€ ${formatPriceForDisplay(order.totalAmount)}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 6;

  // Divider line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.3);
  doc.line(totalsX - 5, currentY, pageWidth - margin, currentY);

  currentY += 6;

  // Total (larger, gold/orange)
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Total:", totalsX, currentY);
  doc.setTextColor(...COLORS.accent);
  doc.text(`€ ${formatPriceForDisplay(order.totalAmount)}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 15;

  // ============================================
  // PAYMENT TERMS (if unpaid)
  // ============================================

  const paymentTerms = distributor.invoicePaymentTerms;
  if (paymentTerms && order.paymentStatus !== 'paid') {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text("Payment Terms:", margin, currentY);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    const termsLines = doc.splitTextToSize(paymentTerms, pageWidth - margin * 2 - 30);
    doc.text(termsLines, margin + 28, currentY);
    currentY += (termsLines.length * 4) + 6;
  }

  // ============================================
  // BANK DETAILS (if unpaid and enabled)
  // ============================================

  if (distributor.invoiceShowBankDetails && order.paymentStatus !== 'paid') {
    const hasBankDetails = distributor.iban || distributor.bic || distributor.bankName;
    if (hasBankDetails) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text("Bank Details:", margin, currentY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);

      const bankParts = [];
      if (distributor.bankName) bankParts.push(distributor.bankName);
      if (distributor.iban) bankParts.push(`IBAN: ${distributor.iban}`);
      if (distributor.bic) bankParts.push(`BIC: ${distributor.bic}`);

      doc.text(bankParts.join(' · '), margin + 24, currentY);
      currentY += 8;
    }
  }

  // ============================================
  // NOTES SECTION
  // ============================================

  const notesText = options?.notes || distributor.invoiceNotes;
  if (notesText) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text("Notes:", margin, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    const notesLines = doc.splitTextToSize(notesText, pageWidth - margin * 2);
    doc.text(notesLines, margin, currentY + 5);
    currentY += (notesLines.length * 4) + 10;
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 18;

  // Gold/orange footer line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(1);
  doc.line(margin, footerY - 6, pageWidth - margin, footerY - 6);

  // Footer message
  const footerMessage = options?.footerText || distributor.invoiceFooterText || "Thank you for your business!";
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(footerMessage, pageWidth / 2, footerY, { align: 'center' });

  // Contact info
  const contactParts: string[] = [];
  if (distributor.contactEmail) contactParts.push(distributor.contactEmail);
  if (distributor.phoneNumber) contactParts.push(distributor.phoneNumber);
  if (distributor.website) contactParts.push(distributor.website);

  if (contactParts.length > 0) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    doc.text(contactParts.join('  |  '), pageWidth / 2, footerY + 5, { align: 'center' });
  }

  // ============================================
  // DOWNLOAD PDF
  // ============================================

  const filename = options?.downloadName || `Invoice-${invoiceNumber}.pdf`;
  doc.save(filename);
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use generateInvoicePdf with distributor parameter instead
 */
export function generateInvoicePdfLegacy(order: Order, options?: {
  downloadName?: string;
  logoUrl?: string;
  companyName?: string;
  companyAddress?: string;
  taxId?: string;
  footerText?: string;
}) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("INVOICE", 150, 20);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Order #: ${order.orderNumber || order.id.slice(0, 8)}`, 150, 28);
  doc.text(`Date: ${format(new Date(order.createdAt), 'PPP')}`, 150, 34);

  // Company info (if provided)
  if (options?.companyName) {
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(options.companyName, 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    if (options.companyAddress) {
      const addressLines = options.companyAddress.split('\n');
      addressLines.forEach((line, i) => {
        doc.text(line, 14, 26 + (i * 5));
      });
    }
    if (options.taxId) {
      doc.text(`Tax ID: ${options.taxId}`, 14, 26 + ((options.companyAddress?.split('\n').length || 0) * 5));
    }
  }

  // Client Info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("Bill To:", 14, 50);
  doc.setFont("helvetica", "normal");
  doc.text(order.customerName, 14, 56);
  doc.text(order.shippingAddress.split('\n'), 14, 62);

  // Status Badge
  doc.setFillColor(230, 230, 230);
  doc.setDrawColor(150, 150, 150);
  const statusText = statusConfig[order.status].label;
  const statusWidth = doc.getStringUnitWidth(statusText) * doc.getFontSize() / doc.internal.scaleFactor + 10;
  doc.roundedRect(14, 80, statusWidth, 10, 3, 3, 'FD');
  doc.text(statusText, 19, 87);

  // Order Items Table
  const tableColumn = ["#", "Item", "Qty", "Unit Price", "Total"];
  const tableRows = order.items.map((item, index) => [
    index + 1,
    `${item.title}\n${item.artist}`,
    item.quantity,
    `€${formatPriceForDisplay(item.priceAtTimeOfOrder)}`,
    `€${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}`
  ]);

  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: 95,
    theme: 'striped',
    headStyles: { fillColor: [38, 34, 43] },
  });

  // Totals
  const finalY = (doc as any).lastAutoTable.finalY || 150;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Total:", 150, finalY + 15, { align: 'right' });
  doc.text(`€${formatPriceForDisplay(order.totalAmount)}`, 200, finalY + 15, { align: 'right' });

  // Payment info if paid
  if (order.paymentStatus === 'paid' && order.paidAt) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Payment received on ${format(new Date(order.paidAt), 'PPP')}`, 14, finalY + 25);
  }

  // Footer
  doc.setFontSize(10);
  doc.setTextColor(150);
  const footerMessage = options?.footerText || "Thank you for your order!";
  doc.text(footerMessage, 105, 285, { align: 'center' });

  // Download
  const filename = options?.downloadName || `Invoice-${order.orderNumber || order.id.slice(0, 8)}.pdf`;
  doc.save(filename);
}
