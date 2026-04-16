import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { formatPriceForDisplay } from "./utils";
import type { Order, OrderStatus, Distributor } from "@/types";

const statusConfig: Record<OrderStatus, { label: string }> = {
  awaiting_approval: { label: 'Awaiting Approval' },
  pending: { label: 'Pending' },
  awaiting_payment: { label: 'Awaiting Payment' },
  paid: { label: 'Paid' },
  processing: { label: 'Processing' },
  shipped: { label: 'Shipped' },
  on_hold: { label: 'On Hold' },
  cancelled: { label: 'Cancelled' },
};

const COLORS = {
  primary: [38, 34, 43] as [number, number, number],
  secondary: [107, 114, 128] as [number, number, number],
  accent: [214, 158, 46] as [number, number, number],
  lightGray: [249, 250, 251] as [number, number, number],
  border: [229, 231, 235] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  text: [17, 24, 39] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

export interface InvoiceOptions {
  downloadName?: string;
  notes?: string;
  footerText?: string;
  showPaymentInfo?: boolean;
}

// Items that are counted on the invoice: excludes items marked not_available or out_of_stock,
// matching how order totals are recalculated in order-service.updateOrderItemStatuses.
export function getInvoiceActiveItems(order: Order) {
  return (order.items || []).filter(item => {
    const status = item.itemStatus || 'available';
    return status === 'available' || status === 'back_order';
  });
}

async function buildInvoicePdfDoc(
  order: Order,
  distributor: Distributor,
  options?: InvoiceOptions
): Promise<{ doc: jsPDF; filename: string }> {
  const customerCompanyName = order.customerCompanyName;
  const customerVatNumber = order.customerVatNumber;
  const customerEoriNumber = order.customerEoriNumber;
  const customerChamberOfCommerce = order.customerChamberOfCommerce;
  const customerPhone = order.phoneNumber;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let currentY = margin;

  const cleanMarkdown = (text: string) => text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1');

  const loadImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const contentType = response.headers.get('content-type') || 'image/png';
      const arrayBuffer = await response.arrayBuffer();

      // Browser path: keep using FileReader on the Blob so we don't change behavior for downloads
      if (typeof FileReader !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([arrayBuffer], { type: contentType });
        return await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
      }

      // Node path: encode via Buffer
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return `data:${contentType};base64,${base64}`;
    } catch {
      return null;
    }
  };

  // Environment-agnostic image dimension reader. In the browser we defer to the
  // native Image element (exact parsing); in Node we parse PNG / JPEG headers manually
  // so we don't need to add a dependency just for logo sizing on the server.
  const getImageDimensions = async (base64DataUri: string): Promise<{ w: number; h: number } | null> => {
    if (typeof Image !== 'undefined') {
      return await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.naturalWidth > 0 && img.naturalHeight > 0
          ? { w: img.naturalWidth, h: img.naturalHeight }
          : null);
        img.onerror = () => resolve(null);
        img.src = base64DataUri;
      });
    }
    try {
      const comma = base64DataUri.indexOf(',');
      const rawBase64 = comma >= 0 ? base64DataUri.slice(comma + 1) : base64DataUri;
      const buf = Buffer.from(rawBase64, 'base64');
      // PNG: 89 50 4E 47 0D 0A 1A 0A, IHDR width at bytes 16..19, height at 20..23 (big-endian)
      if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47) {
        return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
      }
      // JPEG: starts with FF D8; scan for an SOFn marker to read dimensions
      if (buf[0] === 0xFF && buf[1] === 0xD8) {
        let i = 2;
        while (i + 9 < buf.length) {
          if (buf[i] !== 0xFF) break;
          const marker = buf[i + 1];
          const isSof = marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
          if (isSof) {
            const h = buf.readUInt16BE(i + 5);
            const w = buf.readUInt16BE(i + 7);
            return { w, h };
          }
          const segmentSize = buf.readUInt16BE(i + 2);
          i += 2 + segmentSize;
        }
      }
      return null;
    } catch {
      return null;
    }
  };

  // Page break helper
  const footerReserved = 40;
  const checkPageBreak = (neededSpace: number) => {
    if (currentY + neededSpace > pageHeight - footerReserved) {
      doc.addPage();
      currentY = margin;
    }
  };

  // ============================================
  // HEADER
  // ============================================

  const companyName = distributor.companyName || distributor.name;

  let logoLoaded = false;
  if (distributor.logoUrl) {
    try {
      const logoBase64 = await loadImageAsBase64(distributor.logoUrl);
      if (logoBase64) {
        const dims = await getImageDimensions(logoBase64);
        const maxH = 20, maxW = 65;
        if (dims && dims.w > 0 && dims.h > 0) {
          let { w, h } = dims;
          const r = w / h;
          if (h > maxH) { h = maxH; w = h * r; }
          if (w > maxW) { w = maxW; h = w / r; }
          doc.addImage(logoBase64, 'AUTO', margin, currentY, w, h);
          logoLoaded = true;
        } else {
          // Unknown dimensions (unsupported format) — render at max height preserving generous width
          doc.addImage(logoBase64, 'AUTO', margin, currentY, 50, 20);
          logoLoaded = true;
        }
      }
    } catch { /* skip logo */ }
  }

  if (!logoLoaded) {
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text(companyName, margin, currentY + 10);
  }

  doc.setFontSize(26);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.accent);
  doc.text("INVOICE", pageWidth - margin, currentY + 10, { align: 'right' });

  currentY += 20;

  // ============================================
  // FROM and BILL TO
  // ============================================

  const leftColumnX = margin;
  const rightColumnX = pageWidth / 2 + 5;
  const columnWidth = (pageWidth - margin * 2) / 2 - 5;

  // Helper: render a contact block
  const renderContactBlock = (
    x: number, startY: number, maxW: number,
    data: {
      header: string;
      companyName?: string;
      personName?: string;
      addressLines: string[];
      contactParts: string[];
      regParts: string[];
    }
  ): number => {
    let y = startY;

    // Header
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.secondary);
    doc.text(data.header, x, y);
    y += 2;
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.5);
    doc.line(x, y, x + maxW - 10, y);
    y += 5;

    // Company name (bold, larger)
    if (data.companyName) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text(data.companyName, x, y);
      y += 4;
    }

    // Person name
    if (data.personName) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);
      doc.text(data.personName, x, y);
      y += 4;
    }

    // Address lines
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    for (const line of data.addressLines) {
      if (line.trim()) {
        doc.text(line.trim(), x, y);
        y += 3.5;
      }
    }

    // Contact (phone, email)
    if (data.contactParts.length > 0) {
      y += 1;
      const contactText = data.contactParts.join('  \u00B7  ');
      const lines = doc.splitTextToSize(contactText, maxW - 10);
      doc.text(lines, x, y);
      y += lines.length * 3.5;
    }

    // Registration (CRN, VAT, EORI)
    if (data.regParts.length > 0) {
      const regText = data.regParts.join('  \u00B7  ');
      const lines = doc.splitTextToSize(regText, maxW - 10);
      doc.text(lines, x, y);
      y += lines.length * 3.5;
    }

    return y;
  };

  // FROM
  const distAddressLines: string[] = [];
  if (distributor.addressLine1) distAddressLines.push(distributor.addressLine1);
  const distCityLine = [
    [distributor.postcode, distributor.city].filter(Boolean).join(' '),
    distributor.country
  ].filter(Boolean).join(', ');
  if (distCityLine) distAddressLines.push(distCityLine);

  const distContact: string[] = [];
  if (distributor.phoneNumber) distContact.push(`Tel: ${distributor.phoneNumber}`);
  if (distributor.contactEmail) distContact.push(distributor.contactEmail);

  const distReg: string[] = [];
  if (distributor.chamberOfCommerce) distReg.push(`CRN: ${distributor.chamberOfCommerce}`);
  if (distributor.taxId) distReg.push(`NIF: ${distributor.taxId}`);
  else if (distributor.vatNumber) distReg.push(`VAT: ${distributor.vatNumber}`);
  if (distributor.eoriNumber) distReg.push(`EORI: ${distributor.eoriNumber}`);

  const leftEndY = renderContactBlock(leftColumnX, currentY, columnWidth, {
    header: 'FROM',
    companyName,
    addressLines: distAddressLines,
    contactParts: distContact,
    regParts: distReg,
  });

  // BILL TO
  const shippingAddr = order.shippingAddress || '';
  const billingAddr = order.billingAddress || '';
  const hasSeparateBilling = billingAddr && billingAddr !== shippingAddr;
  const billToAddress = hasSeparateBilling ? billingAddr : shippingAddr;
  const clientAddressLines = billToAddress.split('\n').map(l => l.trim()).filter(Boolean);

  const clientContact: string[] = [];
  if (customerPhone) clientContact.push(`Tel: ${customerPhone}`);
  if (order.viewerEmail) clientContact.push(order.viewerEmail);

  const clientReg: string[] = [];
  if (customerChamberOfCommerce) clientReg.push(`CRN: ${customerChamberOfCommerce}`);
  if (customerVatNumber) clientReg.push(`VAT: ${customerVatNumber}`);
  if (customerEoriNumber) clientReg.push(`EORI: ${customerEoriNumber}`);

  // Determine name display: company name as primary, or customer name if no company
  let rightEndY = renderContactBlock(rightColumnX, currentY, columnWidth, {
    header: 'BILL TO',
    companyName: customerCompanyName || order.customerName,
    personName: customerCompanyName ? order.customerName : undefined,
    addressLines: clientAddressLines,
    contactParts: clientContact,
    regParts: clientReg,
  });

  // SHIP TO (if different from billing)
  if (hasSeparateBilling) {
    rightEndY += 3;
    const shipLines = shippingAddr.split('\n').map(l => l.trim()).filter(Boolean);
    rightEndY = renderContactBlock(rightColumnX, rightEndY, columnWidth, {
      header: 'SHIP TO',
      addressLines: shipLines,
      contactParts: [],
      regParts: [],
    });
  }

  currentY = Math.max(leftEndY, rightEndY) + 6;

  // ============================================
  // INVOICE DETAILS (inline, no boxes)
  // ============================================

  const invoiceNumber = order.orderNumber || (order.id || 'UNKNOWN').slice(0, 8).toUpperCase();
  let dateText = '';
  try { dateText = format(new Date(order.createdAt), 'dd MMM yyyy'); } catch { dateText = 'N/A'; }
  const statusText = statusConfig[order.status]?.label || order.status || 'Unknown';
  const isPaid = order.status === 'paid' || order.paymentStatus === 'paid';

  // Thin accent line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, currentY, pageWidth - margin, currentY);
  currentY += 5;

  doc.setFontSize(8);

  // Invoice # | Date | Status — evenly spaced
  const thirdW = (pageWidth - margin * 2) / 3;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Invoice #", margin, currentY);
  doc.text("Date", margin + thirdW, currentY);
  doc.text("Status", margin + thirdW * 2, currentY);

  currentY += 4;

  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.text);
  doc.text(invoiceNumber, margin, currentY);
  doc.text(dateText, margin + thirdW, currentY);

  if (isPaid) doc.setTextColor(...COLORS.success);
  else doc.setTextColor(...COLORS.accent);
  doc.text(statusText, margin + thirdW * 2, currentY);

  currentY += 6;

  // ============================================
  // PAYMENT TERMS + PAYMENT DETAILS (two columns)
  // ============================================

  const paymentTerms = distributor.invoicePaymentTerms;
  const hasPaymentTerms = !!paymentTerms;
  const accounts = distributor.invoiceShowBankDetails && order.paymentStatus !== 'paid'
    ? (distributor.paymentAccounts?.length
      ? distributor.paymentAccounts
      : (distributor.iban || distributor.bic || distributor.bankName)
        ? [{ id: 'legacy', type: 'bank' as const, bankName: distributor.bankName, iban: distributor.iban, bic: distributor.bic }]
        : [])
    : [];
  const hasPaymentDetails = accounts.length > 0;

  if (hasPaymentTerms || hasPaymentDetails) {
    checkPageBreak(25);

    const useTwoColumns = hasPaymentTerms && hasPaymentDetails;
    const leftW = useTwoColumns ? columnWidth : pageWidth - margin * 2;
    const rightX = useTwoColumns ? rightColumnX : margin;
    const rightW = useTwoColumns ? columnWidth : pageWidth - margin * 2;

    let termsEndY = currentY;
    let detailsEndY = currentY;

    // Left column: Payment Terms
    if (hasPaymentTerms) {
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text("Payment Terms", leftColumnX, currentY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...COLORS.secondary);
      const cleanTerms = cleanMarkdown(paymentTerms!);
      const termsLines = doc.splitTextToSize(cleanTerms, leftW - 5);
      doc.text(termsLines, leftColumnX, currentY + 4);
      termsEndY = currentY + 4 + (termsLines.length * 3.5);
    }

    // Right column (or below if no terms): Payment Details
    if (hasPaymentDetails) {
      const detailsStartY = useTwoColumns ? currentY : termsEndY + 4;
      const detailsX = useTwoColumns ? rightX : leftColumnX;

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...COLORS.text);
      doc.text("Payment Details", detailsX, detailsStartY);

      let dy = detailsStartY + 5;

      for (const account of accounts) {
        // Page break check per account (~20mm per account)
        if (dy + 20 > pageHeight - footerReserved) {
          doc.addPage();
          dy = margin;
        }
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...COLORS.secondary);

        if (account.type === 'bank') {
          const label = account.label || account.bankName || 'Bank Account';
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.text);
          doc.setFontSize(8);
          doc.text(label, detailsX, dy);
          dy += 3.5;

          doc.setFont("helvetica", "normal");
          doc.setTextColor(...COLORS.secondary);
          if (account.accountHolder) {
            doc.text(`Attn: ${account.accountHolder}`, detailsX, dy);
            dy += 3.5;
          }
          if (account.iban) {
            doc.text(`IBAN: ${account.iban}`, detailsX, dy);
            dy += 3.5;
          }
          if (account.bic) {
            doc.text(`BIC: ${account.bic}`, detailsX, dy);
            dy += 3.5;
          }
        } else if (account.type === 'paypal') {
          const label = account.label || 'PayPal';
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.text);
          doc.text(label, detailsX, dy);
          dy += 3.5;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...COLORS.secondary);
          if (account.paypalEmail) {
            doc.text(account.paypalEmail, detailsX, dy);
            dy += 3.5;
          }
        } else if (account.type === 'other') {
          const label = account.label || 'Payment';
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...COLORS.text);
          doc.text(label, detailsX, dy);
          dy += 3.5;
          doc.setFont("helvetica", "normal");
          doc.setTextColor(...COLORS.secondary);
          if (account.details) {
            const lines = doc.splitTextToSize(account.details, rightW - 5);
            doc.text(lines, detailsX, dy);
            dy += lines.length * 3.5;
          }
        }
        dy += 2; // space between accounts
      }
      detailsEndY = dy;
    }

    currentY = Math.max(termsEndY, detailsEndY) + 4;
  }

  // ============================================
  // ORDER ITEMS TABLE
  // ============================================

  const activeItems = getInvoiceActiveItems(order);
  const tableColumn = ["Item", "Qty", "Unit Price", "Total"];
  const tableRows = activeItems.map((item) => [
    `${item.artist} \u2013 ${item.title}`,
    item.quantity.toString(),
    `\u20AC ${formatPriceForDisplay(item.priceAtTimeOfOrder)}`,
    `\u20AC ${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}`
  ]);

  (doc as any).autoTable({
    head: [tableColumn],
    body: tableRows,
    startY: currentY,
    theme: 'plain',
    styles: {
      fontSize: 8,
      cellPadding: { top: 2.5, right: 3, bottom: 2.5, left: 3 },
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
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 28, halign: 'right' },
      3: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: [252, 252, 253],
    },
    bodyStyles: {
      lineWidth: 0,
    },
    didParseCell: (data: any) => {
      if (data.section === 'body') {
        data.cell.styles.lineWidth = { bottom: 0.1 };
        data.cell.styles.lineColor = COLORS.border;
      }
    },
  });

  currentY = (doc as any).lastAutoTable.finalY + 6;

  // ============================================
  // TOTAL
  // ============================================

  checkPageBreak(order.taxAmount ? 28 : 16);

  const totalsX = pageWidth - margin - 55;

  // Tax breakdown (if tax data present)
  if (order.taxAmount !== undefined && order.subtotalAmount !== undefined) {
    const taxLabel = order.taxLabel || 'VAT';

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    doc.text(`Subtotal excl. ${taxLabel}:`, totalsX, currentY);
    doc.setTextColor(...COLORS.text);
    doc.text(`\u20AC ${formatPriceForDisplay(order.subtotalAmount)}`, pageWidth - margin, currentY, { align: 'right' });
    currentY += 4;

    // Shipping line — shown above VAT so VAT is calculated on subtotal + shipping
    if (order.shippingCost !== undefined && order.shippingCost > 0) {
      doc.setTextColor(...COLORS.secondary);
      doc.text(`Shipping${order.shippingZoneName ? ` (${order.shippingZoneName})` : ''}:`, totalsX, currentY);
      doc.setTextColor(...COLORS.text);
      doc.text(`\u20AC ${formatPriceForDisplay(order.shippingCost)}`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 4;
    } else if (order.freeShippingApplied) {
      doc.setTextColor(...COLORS.secondary);
      doc.text('Shipping:', totalsX, currentY);
      doc.setTextColor(...COLORS.text);
      doc.text('Free', pageWidth - margin, currentY, { align: 'right' });
      currentY += 4;
    } else if (order.shippingMethod === 'pickup') {
      doc.setTextColor(...COLORS.secondary);
      doc.text('Pickup (no shipping)', totalsX, currentY);
      currentY += 4;
    }

    // Tax line(s)
    if (order.taxBreakdown && order.taxBreakdown.length > 0) {
      for (const tax of order.taxBreakdown) {
        doc.setTextColor(...COLORS.secondary);
        doc.text(`${taxLabel} ${tax.rate}%${tax.jurisdiction ? ` (${tax.jurisdiction})` : ''}:`, totalsX, currentY);
        doc.setTextColor(...COLORS.text);
        doc.text(`\u20AC ${formatPriceForDisplay(tax.amount)}`, pageWidth - margin, currentY, { align: 'right' });
        currentY += 4;
      }
    } else {
      const rateText = order.isReverseCharge ? '0% (Reverse charge)' : `${order.taxRate || 0}%`;
      doc.setTextColor(...COLORS.secondary);
      doc.text(`${taxLabel} ${rateText}:`, totalsX, currentY);
      doc.setTextColor(...COLORS.text);
      doc.text(`\u20AC ${formatPriceForDisplay(order.taxAmount)}`, pageWidth - margin, currentY, { align: 'right' });
      currentY += 4;
    }

    // Divider
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(totalsX - 5, currentY, pageWidth - margin, currentY);
    currentY += 5;
  } else {
    // No tax data — simple divider
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.3);
    doc.line(totalsX - 5, currentY, pageWidth - margin, currentY);
    currentY += 5;
  }

  // Total
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...COLORS.secondary);
  doc.text("Total:", totalsX, currentY);
  doc.setTextColor(...COLORS.accent);
  doc.text(`\u20AC ${formatPriceForDisplay(order.totalAmount)}`, pageWidth - margin, currentY, { align: 'right' });

  // Reverse charge notice
  if (order.isReverseCharge) {
    currentY += 5;
    doc.setFontSize(7);
    doc.setFont("helvetica", "italic");
    doc.setTextColor(...COLORS.secondary);
    doc.text('* Reverse charge — VAT to be accounted for by the recipient.', margin, currentY);
  }

  // Total items (excludes items marked not_available / out_of_stock)
  const totalQty = activeItems.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  currentY += 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  doc.text(`Total items: ${totalQty}`, pageWidth - margin, currentY, { align: 'right' });

  // Total weight
  if (order.totalWeight && order.totalWeight > 0) {
    currentY += 4;
    doc.text(`Total weight: ${(order.totalWeight / 1000).toFixed(2)} kg`, pageWidth - margin, currentY, { align: 'right' });
  }

  currentY += 8;

  // ============================================
  // NOTES (below total)
  // ============================================

  const notesText = options?.notes || distributor.invoiceNotes;
  if (notesText) {
    checkPageBreak(15);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...COLORS.text);
    doc.text("Notes", margin, currentY);
    currentY += 4;

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...COLORS.secondary);
    const cleanNotes = cleanMarkdown(notesText);
    const notesLines = doc.splitTextToSize(cleanNotes, pageWidth - margin * 2);
    doc.text(notesLines, margin, currentY);
    currentY += (notesLines.length * 3.5) + 4;
  }

  // ============================================
  // FOOTER
  // ============================================

  const footerMessage = options?.footerText || distributor.invoiceFooterText || "Thank you for your business!";
  const maxFooterWidth = pageWidth - margin * 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  const footerLines: string[] = doc.splitTextToSize(footerMessage, maxFooterWidth);
  const clampedFooterLines = footerLines.slice(0, 3);
  const footerLineHeight = 3.5;
  const footerTextHeight = clampedFooterLines.length * footerLineHeight;

  const contactParts: string[] = [];
  if (distributor.contactEmail) contactParts.push(distributor.contactEmail);
  if (distributor.phoneNumber) contactParts.push(distributor.phoneNumber);
  if (distributor.website) contactParts.push(distributor.website);
  const hasContact = contactParts.length > 0;

  const footerBottomMargin = 8;
  const contactHeight = hasContact ? 5 : 0;
  let lineY = pageHeight - footerBottomMargin - contactHeight - footerTextHeight - 5;

  if (currentY > lineY - 2) {
    doc.addPage();
    lineY = pageHeight - footerBottomMargin - contactHeight - footerTextHeight - 5;
  }

  // Footer line
  doc.setDrawColor(...COLORS.accent);
  doc.setLineWidth(0.8);
  doc.line(margin, lineY, pageWidth - margin, lineY);

  // Footer text (normal weight, centered)
  let footerTextY = lineY + 5;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...COLORS.secondary);
  clampedFooterLines.forEach((line: string) => {
    doc.text(line, pageWidth / 2, footerTextY, { align: 'center' });
    footerTextY += footerLineHeight;
  });

  // Contact info
  if (hasContact) {
    doc.setFontSize(7);
    doc.text(contactParts.join('  |  '), pageWidth / 2, footerTextY + 1, { align: 'center' });
  }

  // ============================================
  // RETURN
  // ============================================

  const filename = options?.downloadName || `Invoice-${invoiceNumber}.pdf`;
  return { doc, filename };
}

/**
 * Generates a professional invoice PDF with distributor branding and triggers a browser download.
 */
export async function generateInvoicePdf(
  order: Order,
  distributor: Distributor,
  options?: InvoiceOptions
): Promise<void> {
  const { doc, filename } = await buildInvoicePdfDoc(order, distributor, options);
  doc.save(filename);
}

/**
 * Builds the same invoice PDF and returns it as a base64 string (without the data URI prefix),
 * plus the filename. Used to attach the invoice to an email sent to the customer.
 */
export async function getInvoicePdfBase64(
  order: Order,
  distributor: Distributor,
  options?: InvoiceOptions
): Promise<{ base64: string; filename: string }> {
  const { doc, filename } = await buildInvoicePdfDoc(order, distributor, options);
  const dataUri = doc.output('datauristring');
  const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;
  return { base64, filename };
}
