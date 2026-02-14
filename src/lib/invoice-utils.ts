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

// Color scheme
const COLORS = {
  primary: [38, 34, 43] as [number, number, number],      // Dark header color
  secondary: [107, 114, 128] as [number, number, number], // Gray text
  accent: [59, 130, 246] as [number, number, number],     // Blue accent
  lightGray: [243, 244, 246] as [number, number, number], // Light background
  border: [229, 231, 235] as [number, number, number],    // Border color
  success: [34, 197, 94] as [number, number, number],     // Green for paid
  text: [17, 24, 39] as [number, number, number],         // Dark text
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
  // HEADER SECTION - Logo and Company Info
  // ============================================

  // Try to load and add logo
  let logoLoaded = false;
  let logoWidth = 0;
  if (distributor.logoUrl) {
    try {
      const logoBase64 = await loadImageAsBase64(distributor.logoUrl);
      if (logoBase64) {
        // Create an image element to get natural dimensions
        const img = new Image();
        await new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.src = logoBase64;
        });

        // Calculate dimensions maintaining aspect ratio
        const maxHeight = 18; // Max height in mm
        const maxWidth = 45; // Max width in mm
        let width = img.naturalWidth;
        let height = img.naturalHeight;

        if (width > 0 && height > 0) {
          const aspectRatio = width / height;

          // Scale to fit within max dimensions
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
          logoWidth = width + 5; // Add some spacing
        }
      }
    } catch (error) {
      console.warn('Could not load logo for invoice:', error);
    }
  }

  // ============================================
  // LEFT SIDE - Distributor/Seller Info
  // ============================================

  const companyInfoX = logoLoaded ? margin + logoWidth : margin;
  const companyName = distributor.companyName || distributor.name;
  const labelWidth = 18; // Width for labels

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(companyName, companyInfoX, currentY + 6);

  // Company details with labels
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);

  let detailY = currentY + 12;

  // Address
  const fullAddress = [
    distributor.addressLine1,
    distributor.addressLine2,
    [distributor.postcode, distributor.city].filter(Boolean).join(' '),
    distributor.country
  ].filter(Boolean).join(', ');

  if (fullAddress) {
    doc.setFont("helvetica", "bold");
    doc.text("ADDRESS:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    // Split address if too long
    const addressLines = doc.splitTextToSize(fullAddress, 70);
    doc.text(addressLines, companyInfoX + labelWidth, detailY);
    detailY += (addressLines.length * 3.5);
  }

  if (distributor.phoneNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("TEL:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.phoneNumber, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.contactEmail) {
    doc.setFont("helvetica", "bold");
    doc.text("E-MAIL:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.contactEmail, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.website) {
    doc.setFont("helvetica", "bold");
    doc.text("WEB:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.website, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.chamberOfCommerce) {
    doc.setFont("helvetica", "bold");
    doc.text("KVK:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.chamberOfCommerce, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.iban) {
    doc.setFont("helvetica", "bold");
    doc.text("IBAN:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.iban, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.bic) {
    doc.setFont("helvetica", "bold");
    doc.text("BIC:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.bic, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.vatNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("TAX:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.vatNumber, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  if (distributor.taxId && distributor.taxId !== distributor.vatNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("NIF:", companyInfoX, detailY);
    doc.setFont("helvetica", "normal");
    doc.text(distributor.taxId, companyInfoX + labelWidth, detailY);
    detailY += 3.5;
  }

  // ============================================
  // RIGHT SIDE - Invoice Title & Client Info
  // ============================================

  const rightColumnX = pageWidth / 2 + 10;
  let rightY = currentY;

  // INVOICE title
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text("INVOICE", pageWidth - margin, rightY + 6, { align: 'right' });

  rightY += 14;

  // Client info header
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.secondary);
  doc.text("BILL TO:", rightColumnX, rightY);

  rightY += 5;

  // Customer name
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(order.customerName, rightColumnX, rightY);
  rightY += 4;

  // Customer company name (if available)
  if (order.customerCompanyName) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(order.customerCompanyName, rightColumnX, rightY);
    rightY += 3.5;
  }

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);

  // Shipping address
  const clientAddressLines = order.shippingAddress.split('\n');
  clientAddressLines.forEach((line) => {
    if (line.trim()) {
      doc.text(line.trim(), rightColumnX, rightY);
      rightY += 3.5;
    }
  });

  // Customer contact info with labels
  if (order.viewerEmail) {
    doc.setFont("helvetica", "bold");
    doc.text("E-MAIL:", rightColumnX, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(order.viewerEmail, rightColumnX + labelWidth, rightY);
    rightY += 3.5;
  }
  if (order.phoneNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("TEL:", rightColumnX, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(order.phoneNumber, rightColumnX + labelWidth, rightY);
    rightY += 3.5;
  }

  // Customer VAT number (if available)
  if (order.customerVatNumber) {
    doc.setFont("helvetica", "bold");
    doc.text("VAT:", rightColumnX, rightY);
    doc.setFont("helvetica", "normal");
    doc.text(order.customerVatNumber, rightColumnX + labelWidth, rightY);
    rightY += 3.5;
  }

  // Calculate the maximum Y position from both columns
  currentY = Math.max(detailY, rightY) + 8;

  // ============================================
  // DIVIDER LINE
  // ============================================

  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 8;

  // ============================================
  // INVOICE DETAILS (below separator)
  // ============================================

  const invoiceNumber = order.orderNumber || order.id.slice(0, 8).toUpperCase();
  const statusText = statusConfig[order.status].label;
  const isPaid = order.status === 'paid' || order.paymentStatus === 'paid';

  doc.setFontSize(10);
  doc.setTextColor(...COLORS.text);

  // Invoice number on left
  doc.setFont("helvetica", "bold");
  doc.text("Invoice #:", margin, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(invoiceNumber, margin + 22, currentY);

  // Date in center
  const dateText = format(new Date(order.createdAt), 'dd MMM yyyy');
  doc.setFont("helvetica", "bold");
  doc.text("Date:", pageWidth / 2 - 20, currentY);
  doc.setFont("helvetica", "normal");
  doc.text(dateText, pageWidth / 2 - 5, currentY);

  // Status on right
  doc.setFont("helvetica", "bold");
  doc.text("Status:", pageWidth - margin - 35, currentY);
  if (isPaid) {
    doc.setTextColor(...COLORS.success);
    doc.setFont("helvetica", "bold");
    doc.text("PAID", pageWidth - margin - 15, currentY);
  } else {
    doc.setTextColor(...COLORS.secondary);
    doc.setFont("helvetica", "normal");
    doc.text(statusText, pageWidth - margin - 15, currentY);
  }

  currentY += 10;

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
      fontSize: 10,
      cellPadding: 5,
      lineColor: COLORS.border,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: COLORS.lightGray,
      textColor: COLORS.text,
      fontStyle: 'bold',
      halign: 'left',
    },
    columnStyles: {
      0: { cellWidth: 'auto', halign: 'left' },
      1: { cellWidth: 25, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' },
    },
    alternateRowStyles: {
      fillColor: [255, 255, 255],
    },
    didParseCell: (data: any) => {
      // Style the totals column
      if (data.column.index === 3) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 10;

  // ============================================
  // TOTALS SECTION
  // ============================================

  const totalsX = pageWidth - margin - 70;

  // Subtotal
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Subtotal:", totalsX, currentY);
  doc.setTextColor(...COLORS.text);
  doc.text(`€ ${formatPriceForDisplay(order.totalAmount)}`, pageWidth - margin, currentY, { align: 'right' });

  currentY += 8;

  // Divider
  doc.setDrawColor(...COLORS.border);
  doc.line(totalsX - 5, currentY - 2, pageWidth - margin, currentY - 2);

  // Total
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text("Total:", totalsX, currentY + 5);
  doc.text(`€ ${formatPriceForDisplay(order.totalAmount)}`, pageWidth - margin, currentY + 5, { align: 'right' });

  currentY += 20;

  // ============================================
  // PAYMENT TERMS (from distributor settings)
  // ============================================

  const paymentTerms = distributor.invoicePaymentTerms;
  if (paymentTerms && order.paymentStatus !== 'paid') {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text("Payment Terms:", totalsX - 40, currentY);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    const termsLines = doc.splitTextToSize(paymentTerms, 80);
    doc.text(termsLines, totalsX - 40, currentY + 5);
    currentY += (termsLines.length * 5) + 10;
  }

  // ============================================
  // PAYMENT INFO (if paid)
  // ============================================

  if ((options?.showPaymentInfo !== false) && order.paymentStatus === 'paid' && order.paidAt) {
    doc.setFillColor(...COLORS.lightGray);
    doc.roundedRect(margin, currentY, pageWidth - (margin * 2), 20, 3, 3, 'F');

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.success);
    doc.text(
      `Payment received on ${format(new Date(order.paidAt), 'dd MMM yyyy')}` +
      (order.paymentMethod ? ` via ${order.paymentMethod}` : ''),
      margin + 8,
      currentY + 12
    );

    currentY += 30;
  }

  // ============================================
  // BANK DETAILS (from distributor settings)
  // ============================================

  if (distributor.invoiceShowBankDetails && distributor.invoiceBankDetails && order.paymentStatus !== 'paid') {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text("BANK DETAILS", margin, currentY);

    currentY += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);

    const bankLines = distributor.invoiceBankDetails.split('\n');
    bankLines.forEach((line) => {
      if (line.trim()) {
        doc.text(line.trim(), margin, currentY);
        currentY += 4;
      }
    });

    currentY += 6;
  }

  // ============================================
  // NOTES SECTION (from options or distributor settings)
  // ============================================

  const notesText = options?.notes || distributor.invoiceNotes;
  if (notesText) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text("NOTES", margin, currentY);

    currentY += 6;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.text);

    // Split notes into lines that fit the page width
    const maxWidth = pageWidth - (margin * 2);
    const notesLines = doc.splitTextToSize(notesText, maxWidth);
    doc.text(notesLines, margin, currentY);

    currentY += (notesLines.length * 5) + 10;
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerY = pageHeight - 20;

  // Footer line
  doc.setDrawColor(...COLORS.border);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY - 8, pageWidth - margin, footerY - 8);

  // Footer text
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);

  const footerMessage = options?.footerText || distributor.invoiceFooterText || "Thank you for your business!";
  doc.text(footerMessage, pageWidth / 2, footerY, { align: 'center' });

  // Contact info in footer
  const contactParts: string[] = [];
  if (distributor.contactEmail) contactParts.push(distributor.contactEmail);
  if (distributor.phoneNumber) contactParts.push(distributor.phoneNumber);
  if (distributor.website) contactParts.push(distributor.website);

  if (contactParts.length > 0) {
    doc.setFontSize(8);
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
