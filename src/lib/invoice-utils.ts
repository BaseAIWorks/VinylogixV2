import jsPDF from "jspdf";
import "jspdf-autotable";
import { format } from "date-fns";
import { formatPriceForDisplay } from "./utils";
import type { Order, OrderStatus } from "@/types";

const statusConfig: Record<OrderStatus, { label: string }> = {
  pending: { label: 'Pending' },
  awaiting_payment: { label: 'Awaiting Payment' },
  paid: { label: 'Paid' },
  processing: { label: 'Processing' },
  shipped: { label: 'Shipped' },
  on_hold: { label: 'On Hold' },
  cancelled: { label: 'Cancelled' },
};

export function generateInvoicePdf(order: Order, options?: {
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
