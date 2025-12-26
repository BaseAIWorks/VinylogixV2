# Invoices and Order History Management

## Overview

Vinylogix provides comprehensive order tracking and invoice management for both **buyers (clients/viewers)** and **sellers (distributors)**. The platform currently supports PDF invoice generation and maintains complete order history with detailed tracking capabilities.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Client (Buyer) Experience](#client-buyer-experience)
3. [Distributor (Seller) Experience](#distributor-seller-experience)
4. [Invoice System](#invoice-system)
5. [Order History Features](#order-history-features)
6. [Stripe Integration](#stripe-integration)
7. [Current Limitations](#current-limitations)
8. [Recommended Enhancements](#recommended-enhancements)

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER & INVOICE SYSTEM                        │
└─────────────────────────────────────────────────────────────────┘

DATABASE (Firestore):
├─ orders/
│  ├─ Order documents with full payment details
│  ├─ Status tracking (7 states)
│  └─ Payment metadata (Stripe IDs, fees, timestamps)
│
└─ notifications/
   └─ Order notifications for distributors

CLIENT VIEWS:
├─ /my-orders (List view)
└─ [No detail view - enhancement needed]

DISTRIBUTOR VIEWS:
├─ /orders (List view with filtering)
├─ /orders/[id] (Detailed order view)
├─ PDF Invoice generation
└─ Packing slip generation

STRIPE DASHBOARD:
├─ Payment receipts (automatic)
├─ Invoice history
├─ Payout history
└─ Transaction details
```

---

## Client (Buyer) Experience

### 1. Order History Page (`/my-orders`)

**Location**: [src/app/my-orders/page.tsx](src/app/my-orders/page.tsx)

**Access**: Only for users with role `viewer` (clients)

#### Features:

```
┌──────────────────────────────────────────────────────────┐
│  My Order History                                         │
├──────────────────────────────────────────────────────────┤
│                                                           │
│  Order #      Date           Status        Total         │
│  ─────────────────────────────────────────────────────   │
│  ORD-00001   26 Dec 2025    Paid ✓        €100.00      │
│  ORD-00002   25 Dec 2025    Shipped       €45.50       │
│  ORD-00003   24 Dec 2025    Processing    €78.00       │
│                                                           │
└──────────────────────────────────────────────────────────┘
```

#### Data Displayed:

```typescript
// Client order list view
{
  orderNumber: "ORD-00001",           // Human-readable ID
  createdAt: "2025-12-26T10:30:00Z",  // Order date
  status: "paid",                     // Current status
  totalAmount: 100.00                 // Total paid
}
```

#### Status Colors:

```typescript
const statusColors: Record<OrderStatus, string> = {
  pending: 'Yellow (Pending)',
  awaiting_payment: 'Blue (Awaiting Payment)',
  paid: 'Green (Paid ✓)',
  processing: 'Purple (Processing)',
  shipped: 'Indigo (Shipped)',
  on_hold: 'Orange (On Hold)',
  cancelled: 'Red (Cancelled)',
};
```

#### Current Limitations:

❌ **No order detail view** - Clients can only see list view
❌ **No invoice download** - Clients cannot download their invoices
❌ **No tracking information** - No shipping tracking numbers displayed
❌ **No order items preview** - Items not shown in list view
❌ **Not clickable** - Rows don't link to detail page

### 2. Stripe Receipt (Automatic)

**Source**: Stripe automatically sends email receipts after successful payment

**Contents**:
- Receipt number
- Payment amount
- Card used (last 4 digits)
- Timestamp
- Merchant name (Vinylogix or Distributor)
- Link to Stripe receipt page

**Example Email**:
```
Subject: Receipt from Vinylogix [€100.00]

Payment Details:
├─ Amount paid: €100.00
├─ Date: Dec 26, 2025
├─ Payment method: •••• 4242
└─ Receipt: https://stripe.com/receipts/payment/xxx
```

### 3. Client Order Flow

```
STEP 1: Place Order
  └─ Redirected to Stripe Checkout
      ├─ Payment processed
      └─ Automatic receipt sent to client's email

STEP 2: Return to Platform
  └─ Success page confirmation
      └─ Can navigate to "My Orders"

STEP 3: View Order History
  └─ /my-orders
      ├─ See all orders
      ├─ Status updates in real-time
      └─ [Cannot view details or download invoice]

STEP 4: Check Email
  └─ Stripe receipt in inbox
      └─ Can view/download from Stripe
```

---

## Distributor (Seller) Experience

### 1. Incoming Orders Page (`/orders`)

**Location**: [src/app/(app)/orders/page.tsx](src/app/(app)/orders/page.tsx)

**Access**: Master users + Workers with `canManageOrders` permission

#### Features:

```
┌──────────────────────────────────────────────────────────────────┐
│  Incoming Orders                                                  │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Order #    Client              Date         Status    Total     │
│  ───────────────────────────────────────────────────────────────│
│  ORD-00001  client@email.com   26 Dec 2025  Paid ✓   €100.00   │
│  ORD-00002  buyer@test.com     25 Dec 2025  Shipped  €45.50    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Click any row** → Navigate to order detail page

#### Status Filtering:

```typescript
// URL-based filtering
/orders?status=paid          // Show only paid orders
/orders?status=processing    // Show only processing orders
/orders?status=shipped       // Show only shipped orders
```

### 2. Order Detail Page (`/orders/[id]`)

**Location**: [src/app/(app)/orders/[id]/page.tsx](src/app/(app)/orders/[id]/page.tsx:1-340)

#### Page Layout:

```
┌────────────────────────────────────────────────────────────────┐
│  [← Back to All Orders]                                         │
│                                                                 │
│  Order #ORD-00001                                              │
│  Details for order placed on December 26, 2025                 │
│                                                                 │
│  [Download Invoice] [Print Packing Slip] [Mark as Shipped]    │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ITEMS IN THIS ORDER            │  ORDER STATUS               │
│  ─────────────────────────────  │  ──────────────            │
│  [Image] Pink Floyd             │  ✓ Paid                    │
│          Dark Side of the Moon  │  Last updated: 10:30 AM    │
│          Qty: 1   €35.00        │                            │
│                                  │  CUSTOMER DETAILS          │
│  [Image] The Beatles            │  ──────────────           │
│          Abbey Road             │  John Doe                  │
│          Qty: 1   €30.00        │  client@email.com         │
│                                  │  +31 6 12345678           │
│  Total: €100.00                 │                            │
│  Weight: 0.96 kg                │  SHIPPING ADDRESS          │
│                                  │  Kerkstraat 123           │
│                                  │  Amsterdam 1012 AB        │
│                                  │  Netherlands               │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

#### Available Actions:

```typescript
// Status-based action buttons
switch (order.status) {
  case 'pending':
  case 'awaiting_payment':
    // Show: [Mark as Paid] button
    break;

  case 'paid':
    // Show: [Start Processing] button
    break;

  case 'processing':
    // Show: [Mark as Shipped] button
    break;

  default:
    // Show: [Cancel Order] button (if not already cancelled)
}

// Always available:
// - [Download Invoice] button
// - [Print Packing Slip] button
```

#### Order Status Management:

```typescript
// Automatic status transitions
pending → paid → processing → shipped

// Manual transitions available:
// - Any non-cancelled status → cancelled
// - pending → paid (manual payment confirmation)
// - awaiting_payment → paid (payment received)
```

#### Payment Details Display:

```typescript
// When Stripe Connect payment exists
{
  paymentStatus: "paid",
  stripePaymentIntentId: "pi_xxx",
  stripeCheckoutSessionId: "cs_xxx",
  paidAt: "2025-12-26T10:30:00Z",
  platformFeeAmount: 400  // €4.00 in cents
}

// Displayed to distributor:
// - Subtotal: €100.00
// - Platform Fee (4%): €4.00
// - Your Payout: €96.00
// - Stripe Payment ID: pi_xxxxxxxxxxxxx
```

**Note**: Currently payment details are NOT displayed on the order detail page. This is a recommended enhancement.

---

## Invoice System

### 1. PDF Invoice Generation

**Technology**: jsPDF library with autoTable plugin

**Location**: [src/app/(app)/orders/[id]/page.tsx:124-189](src/app/(app)/orders/[id]/page.tsx#L124-L189)

#### Invoice Contents:

```
┌─────────────────────────────────────────────────────────┐
│                                              INVOICE     │
│                                   Order #: ORD-00001    │
│                                   Date: Dec 26, 2025    │
│                                                         │
│  Bill To:                                               │
│  John Doe                                               │
│  Kerkstraat 123                                         │
│  1012 AB Amsterdam                                      │
│  Netherlands                                            │
│                                                         │
│  Status: [Paid]                                         │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ # │ Item              │ Qty │ Price │ Total    │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ 1 │ Dark Side of Moon │  1  │ €35.00│ €35.00  │  │
│  │   │ Pink Floyd        │     │       │         │  │
│  ├─────────────────────────────────────────────────┤  │
│  │ 2 │ Abbey Road        │  1  │ €30.00│ €30.00  │  │
│  │   │ The Beatles       │     │       │         │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│                                      Total: €100.00     │
│                                                         │
│              Thank you for your order!                  │
└─────────────────────────────────────────────────────────┘
```

#### Invoice Code:

```typescript
const generateInvoicePdf = () => {
  if (!order) return;

  const doc = new jsPDF();

  // Header with order number and date
  doc.setFontSize(22);
  doc.text("INVOICE", 150, 20);
  doc.text(`Order #: ${order.orderNumber}`, 150, 28);
  doc.text(`Date: ${format(new Date(order.createdAt), 'PPP')}`, 150, 34);

  // Customer information
  doc.text("Bill To:", 14, 50);
  doc.text(order.customerName, 14, 56);
  doc.text(order.shippingAddress.split('\n'), 14, 62);

  // Status badge
  doc.text(statusConfig[order.status].label, 19, 87);

  // Order items table
  const tableRows = order.items.map((item, index) => [
    index + 1,
    `${item.title}\n${item.artist}`,
    item.quantity,
    `€${formatPriceForDisplay(item.priceAtTimeOfOrder)}`,
    `€${formatPriceForDisplay(item.priceAtTimeOfOrder * item.quantity)}`
  ]);

  doc.autoTable({
    head: [["#", "Item", "Qty", "Unit Price", "Total"]],
    body: tableRows,
    startY: 95,
    theme: 'striped',
  });

  // Total
  doc.text("Total:", 150, finalY + 15);
  doc.text(`€${formatPriceForDisplay(order.totalAmount)}`, 200, finalY + 15);

  // Save as PDF
  doc.save(`Invoice-${order.orderNumber}.pdf`);
};
```

#### Filename Format:
```
Invoice-ORD-00001.pdf
Invoice-ORD-00042.pdf
```

#### Who Can Generate:
✅ Distributor (Master/Worker with permissions)
❌ Client (not implemented - enhancement needed)

### 2. Packing Slip Generation

**Purpose**: Help distributors pick and pack orders efficiently

**Location**: [src/app/(app)/orders/[id]/page.tsx:99-122](src/app/(app)/orders/[id]/page.tsx#L99-L122)

#### Packing Slip Dialog:

```
┌────────────────────────────────────────────────────────────┐
│  Packing Slip for Order #ORD-00001                         │
│  Items and their locations for picking.                    │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Item              Qty  Shelf Locations  Storage Locations │
│  ──────────────────────────────────────────────────────────│
│  Dark Side of Moon  1   A1, A2           WH-001           │
│  Pink Floyd                                                │
│                                                             │
│  Abbey Road         1   B3               WH-002           │
│  The Beatles                                               │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

#### Data Fetched:

```typescript
const generatePackingSlip = async () => {
  // Fetch each record to get location data
  const itemsWithLocations = await Promise.all(
    order.items.map(async (item) => {
      const record = await getRecordById(item.recordId);
      return {
        recordId: item.recordId,
        title: item.title,
        artist: item.artist,
        quantity: item.quantity,
        shelf_locations: record?.shelf_locations,      // Array
        storage_locations: record?.storage_locations,  // Array
      };
    })
  );
};
```

#### Features:
- Shows exact shelf locations (e.g., "A1, A2, B3")
- Shows storage locations (e.g., "WH-001, WH-002")
- Helps warehouse staff locate items quickly
- Dialog format (can be printed from browser)

---

## Order History Features

### Order Data Structure

```typescript
interface Order {
  // Identification
  id: string;                              // Firestore document ID
  orderNumber: string;                     // Human-readable (ORD-00001)
  distributorId: string;                   // FK to distributor

  // Customer
  viewerId: string;                        // FK to user
  viewerEmail: string;
  customerName: string;
  phoneNumber?: string;

  // Addresses
  shippingAddress: string;                 // Formatted multi-line
  billingAddress?: string;

  // Items
  items: OrderItem[];                      // Array of purchased records

  // Amounts
  totalAmount: number;                     // Total in euros
  totalWeight?: number;                    // Total weight in grams

  // Status
  status: OrderStatus;                     // 7 possible states
  createdAt: string;                       // ISO timestamp
  updatedAt: string;                       // ISO timestamp

  // Stripe Connect Payment (NEW)
  paymentStatus?: 'unpaid' | 'paid' | 'refunded' | 'failed';
  stripePaymentIntentId?: string;          // pi_xxxxx
  stripeCheckoutSessionId?: string;        // cs_xxxxx
  paidAt?: string;                         // ISO timestamp
  platformFeeAmount?: number;              // 4% fee in cents
}

interface OrderItem {
  recordId: string;
  title: string;
  artist: string;
  cover_url?: string;
  priceAtTimeOfOrder: number;              // Locked price
  quantity: number;
}
```

### Order Status Lifecycle

```
┌─────────────────────────────────────────────────────────────┐
│                    ORDER STATUS FLOW                         │
└─────────────────────────────────────────────────────────────┘

1. PENDING (Yellow)
   ├─ Order created but not paid
   └─ Manual: Mark as Paid

2. AWAITING_PAYMENT (Blue)
   ├─ Checkout initiated, payment pending
   └─ Auto/Manual: Payment received

3. PAID (Green) ✓
   ├─ Payment confirmed
   ├─ Stock deducted (automatic)
   └─ Manual: Start Processing

4. PROCESSING (Purple)
   ├─ Being prepared for shipment
   └─ Manual: Mark as Shipped

5. SHIPPED (Indigo)
   ├─ Order sent to customer
   └─ [Final state - success]

6. ON_HOLD (Orange)
   ├─ Temporary pause
   └─ Manual: Resume processing

7. CANCELLED (Red)
   ├─ Order cancelled
   ├─ Stock restored (if was paid)
   └─ [Final state - cancelled]
```

### Status Update Logic

**Location**: [src/services/order-service.ts:88-129](src/services/order-service.ts#L88-L129)

```typescript
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  actingUser: User
): Promise<Order | null> {

  const orderData = await getOrder(orderId);
  const oldStatus = orderData.status;

  // STOCK DEDUCTION: When marking as paid
  if (status === 'paid' && oldStatus !== 'paid') {
    await deductStockForOrder(orderData.items, orderData.distributorId);
  }

  // STOCK RESTORATION: If paid order is cancelled
  if (status === 'cancelled' && oldStatus === 'paid') {
    await restoreStockForOrder(orderData.items);
  }

  // Update status in Firestore
  await updateDoc(orderDocRef, {
    status: status,
    updatedAt: Timestamp.now(),
  });

  return updatedOrder;
}
```

### Querying Orders

#### Client Orders:
```typescript
// Get all orders for a specific client
export async function getOrdersByViewerId(viewerId: string): Promise<Order[]> {
  const q = query(
    collection(db, 'orders'),
    where("viewerId", "==", viewerId)
  );
  const orders = await getDocs(q);
  return orders.sort((a,b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
```

#### Distributor Orders:
```typescript
// Get all orders for a distributor
export async function getOrders(user: User): Promise<Order[]> {
  const q = query(
    collection(db, 'orders'),
    where("distributorId", "==", user.distributorId)
  );
  const orders = await getDocs(q);
  return orders.sort((a,b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}
```

---

## Stripe Integration

### Payment Receipts

**Automatic Receipt Email**:
- Sent by Stripe immediately after payment
- Goes to customer's email
- Contains:
  - Receipt URL
  - Payment amount
  - Payment method (card last 4 digits)
  - Merchant name
  - Date and time

**Accessing Receipts**:
```
Client:
├─ Email inbox → Click link in Stripe receipt email
└─ Opens: https://stripe.com/receipts/payment/xxx

Distributor:
├─ Stripe Dashboard → Payments → [Payment] → Receipt
└─ Can send receipt to customer manually
```

### Stripe Dashboard - Distributor View

**Location**: dashboard.stripe.com

**Order Information Available**:

```
PAYMENTS TAB:
├─ All successful payments
├─ Payment amount (gross)
├─ Platform fee (4%)
├─ Net amount
├─ Customer email
├─ Payment method
└─ Metadata: {distributorId, platformFeeAmount, orderNumber}

PAYOUTS TAB:
├─ Scheduled payouts
├─ Payout amount
├─ Payout date
├─ Bank account destination
└─ Individual transaction breakdown

CUSTOMERS TAB:
├─ Customer list (if saved)
├─ Payment history per customer
├─ Email addresses
└─ Total amount spent
```

### Linking Stripe Payments to Orders

```typescript
// Orders in Vinylogix reference Stripe
{
  stripePaymentIntentId: "pi_xxx",        // Links to Stripe Payment
  stripeCheckoutSessionId: "cs_xxx",      // Links to Checkout Session
}

// Stripe metadata references Orders
{
  metadata: {
    distributorId: "dist123",              // Links back to Vinylogix
    platformFeeAmount: "400",              // Fee in cents
    // Could add: orderNumber, orderId
  }
}
```

**Recommendation**: Add `orderId` and `orderNumber` to Stripe metadata for better cross-referencing.

---

## Current Limitations

### For Clients (Buyers):

❌ **No Order Detail View**
- Clients can only see list view of orders
- Cannot view items, status history, or full details
- Must email distributor for order information

❌ **No Invoice Download**
- Clients cannot download invoices themselves
- Only distributor has invoice generation capability
- Clients rely on Stripe receipt email

❌ **No Tracking Information**
- No shipping tracking numbers displayed
- No carrier information
- No estimated delivery date

❌ **Limited Order Information**
- List view doesn't show:
  - Items in order
  - Quantity
  - Individual prices
  - Cover images

❌ **No Order History Search/Filter**
- Cannot filter by status
- Cannot search by date range
- Cannot search by order number

❌ **No Email Notifications**
- No order confirmation email from platform
- No status update emails
- Only Stripe receipt email

### For Distributors (Sellers):

❌ **No Batch Operations**
- Cannot mark multiple orders as shipped
- Cannot export orders to CSV
- Cannot bulk print packing slips

❌ **No Payment Details on Order Page**
- Platform fee not displayed
- Net payout not shown
- Stripe payment link not clickable

❌ **No Advanced Filtering**
- No date range filter
- No customer search
- No amount range filter

❌ **No Sales Analytics**
- No revenue dashboard
- No popular items report
- No customer analytics

❌ **Manual Invoice Process**
- Must click "Download Invoice" for each order
- Cannot automatically send invoice to customer
- No invoice templates or customization

---

## Recommended Enhancements

### Priority 1: Client Order Detail Page

**Create**: `/my-orders/[id]`

**Features**:
```typescript
// Client order detail page
{
  // Order summary
  orderNumber: "ORD-00001",
  status: "Shipped",
  trackingNumber: "1Z999AA10123456784",
  estimatedDelivery: "Dec 28, 2025",

  // Items with images
  items: [
    {
      cover_url: "...",
      title: "Dark Side of the Moon",
      artist: "Pink Floyd",
      quantity: 1,
      price: 35.00
    }
  ],

  // Actions
  actions: [
    "Download Invoice",
    "Contact Seller",
    "Request Cancellation" (if pending/processing)
  ]
}
```

### Priority 2: Email Notifications

**Implementation**: Use Resend API (already configured)

**Email Types**:

1. **Order Confirmation** (Client)
   ```
   Subject: Order Confirmation #ORD-00001

   Hi John,

   Thank you for your order!

   Order #: ORD-00001
   Date: December 26, 2025
   Total: €100.00

   Items:
   - Pink Floyd - Dark Side of the Moon (1x €35.00)
   - The Beatles - Abbey Road (1x €30.00)

   Your order will be processed within 1-2 business days.

   [View Order] [Download Invoice]
   ```

2. **Order Status Update** (Client)
   ```
   Subject: Your order #ORD-00001 has shipped!

   Hi John,

   Good news! Your order is on its way.

   Tracking Number: 1Z999AA10123456784
   Carrier: PostNL
   Estimated Delivery: Dec 28, 2025

   [Track Shipment]
   ```

3. **New Order Alert** (Distributor)
   ```
   Subject: New order #ORD-00001 received

   You have a new paid order!

   Order #: ORD-00001
   Customer: John Doe (client@email.com)
   Total: €100.00
   Payout: €96.00 (after 4% platform fee)

   [View Order] [Print Packing Slip]
   ```

### Priority 3: Enhanced Invoice System

**Features**:

1. **Client Invoice Download**
   ```typescript
   // Add to /my-orders/[id]
   <Button onClick={downloadInvoice}>
     Download Invoice
   </Button>
   ```

2. **Automatic Invoice Delivery**
   ```typescript
   // After order creation
   await sendOrderConfirmationEmail({
     to: customer.email,
     orderNumber: order.orderNumber,
     invoicePdf: generateInvoicePdf(order),
   });
   ```

3. **Invoice Customization**
   ```typescript
   // Distributor settings
   {
     invoiceLogoUrl: "https://...",
     invoiceFooterText: "Thank you for your business!",
     invoiceTerms: "Payment within 30 days",
     taxId: "NL123456789B01",
     companyAddress: "..."
   }
   ```

4. **Tax Information**
   ```typescript
   // Enhanced invoice
   {
     subtotal: 100.00,
     vatRate: 0.21,           // 21% Dutch VAT
     vatAmount: 21.00,
     total: 121.00
   }
   ```

### Priority 4: Payment Details Display

**Add to Order Detail Page**:

```typescript
// Payment Information Card
<Card>
  <CardHeader>
    <CardTitle>Payment Details</CardTitle>
  </CardHeader>
  <CardContent>
    <div>
      <p>Subtotal: €{order.totalAmount.toFixed(2)}</p>
      <p>Platform Fee (4%): €{(order.platformFeeAmount / 100).toFixed(2)}</p>
      <p className="font-bold">
        Your Payout: €{(order.totalAmount - (order.platformFeeAmount / 100)).toFixed(2)}
      </p>
    </div>
    <Separator />
    <div className="text-sm text-muted-foreground">
      <p>Payment ID: {order.stripePaymentIntentId}</p>
      <p>Paid: {format(new Date(order.paidAt), 'PPP')}</p>
      <a href={`https://dashboard.stripe.com/payments/${order.stripePaymentIntentId}`}>
        View in Stripe →
      </a>
    </div>
  </CardContent>
</Card>
```

### Priority 5: Tracking Information

**Database Enhancement**:
```typescript
interface Order {
  // ... existing fields

  // Shipping fields (NEW)
  carrier?: 'postnl' | 'dhl' | 'ups' | 'fedex' | 'other';
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string;
  estimatedDeliveryDate?: string;
}
```

**UI Enhancement**:
```typescript
// Tracking information card
<Card>
  <CardHeader>
    <CardTitle>Shipping Information</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Carrier: {order.carrier}</p>
    <p>Tracking: {order.trackingNumber}</p>
    <a href={order.trackingUrl}>Track Package →</a>
    <p>Estimated Delivery: {order.estimatedDeliveryDate}</p>
  </CardContent>
</Card>
```

### Priority 6: Order Search & Filtering

**Client Side** (`/my-orders`):
```typescript
// Add filtering options
const [filterStatus, setFilterStatus] = useState<OrderStatus | 'all'>('all');
const [searchQuery, setSearchQuery] = useState('');
const [dateRange, setDateRange] = useState<{start: Date, end: Date}>();

// Filter orders
const filteredOrders = orders.filter(order => {
  const matchesStatus = filterStatus === 'all' || order.status === filterStatus;
  const matchesSearch = order.orderNumber.includes(searchQuery) ||
                       order.items.some(item =>
                         item.title.toLowerCase().includes(searchQuery.toLowerCase())
                       );
  const matchesDate = !dateRange ||
                     (new Date(order.createdAt) >= dateRange.start &&
                      new Date(order.createdAt) <= dateRange.end);
  return matchesStatus && matchesSearch && matchesDate;
});
```

**Distributor Side** (`/orders`):
```typescript
// Enhanced filtering
{
  status: 'paid' | 'processing' | 'shipped' | null,
  customer: string,                    // Search by email/name
  dateRange: { start: Date, end: Date },
  amountRange: { min: number, max: number },
  sortBy: 'date' | 'amount' | 'customer'
}
```

### Priority 7: Bulk Operations (Distributor)

```typescript
// Select multiple orders
const [selectedOrders, setSelectedOrders] = useState<string[]>([]);

// Bulk actions
<Button onClick={() => bulkUpdateStatus(selectedOrders, 'shipped')}>
  Mark Selected as Shipped
</Button>

<Button onClick={() => exportOrdersToCSV(selectedOrders)}>
  Export to CSV
</Button>

<Button onClick={() => bulkPrintPackingSlips(selectedOrders)}>
  Print All Packing Slips
</Button>
```

### Priority 8: Sales Analytics Dashboard

**Create**: `/analytics` or add to `/dashboard`

```typescript
// Analytics data
{
  // Revenue metrics
  totalRevenue: 12450.00,
  monthlyRevenue: 3200.00,
  avgOrderValue: 85.50,

  // Order metrics
  totalOrders: 145,
  pendingOrders: 5,
  completedOrders: 138,

  // Top products
  topSellingRecords: [
    { title: "Abbey Road", units: 45, revenue: 1350.00 },
    { title: "Dark Side", units: 38, revenue: 1330.00 }
  ],

  // Customer insights
  repeatCustomers: 42,
  newCustomers: 18,
  topCustomers: [...]
}
```

---

## Implementation Code Examples

### 1. Client Order Detail Page

**File**: `/src/app/my-orders/[id]/page.tsx` (NEW)

```typescript
"use client";

import { useParams } from "next/navigation";
import { useState, useEffect } from "react";
import { getOrderById } from "@/services/order-service";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Download, Truck } from "lucide-react";
import { generateClientInvoicePdf } from "@/lib/invoice-utils";

export default function MyOrderDetailPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [order, setOrder] = useState<Order | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      const fetchedOrder = await getOrderById(orderId);
      // Verify this order belongs to current user
      if (fetchedOrder && fetchedOrder.viewerId === user.uid) {
        setOrder(fetchedOrder);
      }
    };
    fetchOrder();
  }, [orderId]);

  if (!order) return <div>Loading...</div>;

  return (
    <div className="space-y-6">
      <h1>Order #{order.orderNumber}</h1>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Order Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Badge>{order.status}</Badge>
          {order.trackingNumber && (
            <div className="mt-4">
              <p className="flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Tracking: {order.trackingNumber}
              </p>
              <a href={order.trackingUrl} className="text-primary">
                Track Package →
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Items Card */}
      <Card>
        <CardHeader>
          <CardTitle>Order Items</CardTitle>
        </CardHeader>
        <CardContent>
          {order.items.map(item => (
            <div key={item.recordId} className="flex gap-4 mb-4">
              <Image
                src={item.cover_url || '/placeholder.png'}
                width={80}
                height={80}
              />
              <div className="flex-grow">
                <p className="font-medium">{item.title}</p>
                <p className="text-muted-foreground">{item.artist}</p>
                <p>Qty: {item.quantity} × €{item.priceAtTimeOfOrder}</p>
              </div>
              <p className="font-medium">
                €{(item.quantity * item.priceAtTimeOfOrder).toFixed(2)}
              </p>
            </div>
          ))}
          <Separator />
          <div className="text-right pt-4">
            <p className="text-lg font-bold">
              Total: €{order.totalAmount.toFixed(2)}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4">
        <Button onClick={() => generateClientInvoicePdf(order)}>
          <Download className="mr-2 h-4 w-4" />
          Download Invoice
        </Button>
      </div>
    </div>
  );
}
```

### 2. Email Notification Service

**File**: `/src/services/email-service.ts` (NEW)

```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendOrderConfirmation(order: Order) {
  await resend.emails.send({
    from: 'orders@vinylogix.com',
    to: order.viewerEmail,
    subject: `Order Confirmation #${order.orderNumber}`,
    html: `
      <h1>Thank you for your order!</h1>
      <p>Order #: ${order.orderNumber}</p>
      <p>Date: ${format(new Date(order.createdAt), 'PPP')}</p>
      <p>Total: €${order.totalAmount.toFixed(2)}</p>

      <h2>Items:</h2>
      <ul>
        ${order.items.map(item => `
          <li>${item.title} - ${item.artist} (${item.quantity}x €${item.priceAtTimeOfOrder})</li>
        `).join('')}
      </ul>

      <p>Your order will be processed within 1-2 business days.</p>

      <a href="${process.env.NEXT_PUBLIC_SITE_URL}/my-orders/${order.id}">
        View Order
      </a>
    `,
  });
}

export async function sendShippingNotification(order: Order) {
  await resend.emails.send({
    from: 'orders@vinylogix.com',
    to: order.viewerEmail,
    subject: `Your order #${order.orderNumber} has shipped!`,
    html: `
      <h1>Good news! Your order is on its way.</h1>
      <p>Order #: ${order.orderNumber}</p>
      <p>Tracking Number: ${order.trackingNumber}</p>
      <p>Carrier: ${order.carrier}</p>
      <p>Estimated Delivery: ${order.estimatedDeliveryDate}</p>

      <a href="${order.trackingUrl}">Track Shipment</a>
    `,
  });
}
```

### 3. Enhanced Order Creation with Email

**Update**: `/src/services/server-order-service.ts`

```typescript
export async function createOrderFromCheckout(
  session: Stripe.Checkout.Session
): Promise<Order> {

  // ... existing order creation logic ...

  const order = await orderDocRef.get();

  // Send confirmation email
  try {
    await sendOrderConfirmation(order);
  } catch (error) {
    console.error('Failed to send order confirmation email:', error);
    // Don't fail order creation if email fails
  }

  return order;
}
```

---

## Summary

### Current State:

**Clients (Buyers)**:
- ✅ Can view order history list
- ✅ See order numbers, dates, statuses, totals
- ✅ Receive Stripe payment receipts
- ❌ Cannot view order details
- ❌ Cannot download invoices
- ❌ No tracking information
- ❌ No platform email notifications

**Distributors (Sellers)**:
- ✅ View all incoming orders
- ✅ See detailed order information
- ✅ Generate PDF invoices
- ✅ Print packing slips with locations
- ✅ Update order status
- ✅ Track payment details in Stripe
- ❌ No payment breakdown on order page
- ❌ No batch operations
- ❌ No sales analytics
- ❌ Manual invoice delivery

### Recommended Priorities:

**Phase 1 (Essential)**:
1. Client order detail page
2. Client invoice download
3. Email notifications (order confirmation, shipping)
4. Display payment details on distributor order page

**Phase 2 (Important)**:
5. Tracking number integration
6. Order search and filtering
7. Enhanced invoice customization with tax

**Phase 3 (Nice to Have)**:
8. Bulk operations for distributors
9. Sales analytics dashboard
10. CSV export functionality

The platform has a solid foundation with comprehensive order tracking and basic invoicing. The main gaps are in the client experience (detail page, invoices) and automated communications (emails).
