

import { DocumentSnapshot } from 'firebase/firestore';
// Add this new export at the top of the file
export interface OnboardingFormValues {
  companyName: string;
  kvkNumber?: string;
  vatNumber?: string;
  website?: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
}

export interface FirestoreCartItem {
  recordId: string;
  quantity: number;
  distributorId: string;
}

export interface MasterRecord {
  id: string; // Firestore document ID, same as Discogs ID
  discogs_id: number;
  barcode?: string;
  title: string;
  artist: string;
  label?: string;
  year?: number;
  releasedDate?: string;
  genre?: string[];
  style?: string[];
  country?: string;
  formatDetails?: string;
  cover_url?: string;
  tracklist?: Track[];
  dataAiHint?: string;
  artistBio?: string;
  albumInfo?: string;
  lastFetchedAt: string; // ISO date string
}

export type SortOption = 
  | 'added_at_desc'
  | 'title_asc'
  | 'title_desc'
  | 'stock_shelves_desc'
  | 'stock_storage_desc';

export interface CardDisplaySettings {
  showTitle: boolean;
  showArtist: boolean;
  showYear: boolean;
  showCountry: boolean;
  showShelfStock: boolean;
  showStorageStock: boolean;
  showTotalStock: boolean;
  showFormat: boolean;
}

export interface ClientMenuSettings {
    showCollection: boolean;
    showWishlist: boolean;
    showScan: boolean;
    showDiscogs: boolean;
}

export interface WorkerPermissions {
  canViewPurchasingPrice: boolean;
  canEditPurchasingPrice: boolean;
  canViewSellingPrice: boolean;
  canEditSellingPrice: boolean;
  canEditSuppliers: boolean;
  canManageOrders: boolean;
  canManageLocations: boolean;
  canViewFinancialStats?: boolean;
}


export type UserRole = 'master' | 'worker' | 'viewer' | 'superadmin';
export type UserStatus = 'active' | 'on_hold';

export type SubscriptionTier = 'essential' | 'growth' | 'scale' | 'collector' | 'payg';

export const SubscriptionTiers: SubscriptionTier[] = ['essential', 'growth', 'scale', 'collector', 'payg'];

// Distributor-only tiers (used on pricing page and distributor registration)
export const DistributorTiers: SubscriptionTier[] = ['payg', 'essential', 'growth', 'scale'];

// Client-only tiers
export const ClientTiers: SubscriptionTier[] = ['collector'];

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';


export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  maxRecords: number;
  maxUsers: number;
  allowOrders: boolean;
  allowAiFeatures: boolean;
  price?: number;
  quarterlyPrice?: number;
  yearlyPrice?: number;
  discountedPrice?: number;
  description?: string;
  features?: string; // Newline-separated string
  // Whether new customers can select this plan. undefined = active (backward compat).
  // When false: hidden on /pricing, /, and register flow. Existing subscribers are unaffected.
  isActive?: boolean;
  // Platform transaction fee as a whole percent (e.g. 6 for 6%).
  // Source of truth for application_fee_amount on Stripe orders.
  // Undefined falls back to DEFAULT_FEES in stripe-helpers.
  transactionFeePercent?: number;
  // Stripe Product/Price IDs — source of truth for checkout after admin sync.
  // Populated on first save via read-only bootstrap from existing Stripe state.
  stripeProductId?: string;
  stripePriceIdMonthly?: string;
  stripePriceIdQuarterly?: string;
  stripePriceIdYearly?: string;
}

export interface Supplier {
  id: string; // Firestore document ID
  distributorId: string; // The ID of the distributor this supplier belongs to
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  notes?: string;
  createdAt: string; // ISO date string
}

export interface WeightOption {
    id: string;
    label: string; // e.g., "Single LP (180g)"
    weight: number; // e.g., 320
    isFixed: boolean; // If true, the weight is not editable on the record form
}

export interface ShippingRateTier {
  id: string;
  minWeightGrams: number;
  maxWeightGrams: number;
  price: number; // in euros
}

export interface ShippingZone {
  id: string;
  name: string;
  countries: string[];
  rateTiers: ShippingRateTier[];
}

export interface ShippingConfig {
  enabled: boolean;
  zones: ShippingZone[];
  freeShippingThreshold?: number; // in euros — free shipping when product subtotal >= this
  allowPickup?: boolean;
}

export interface StorefrontSettings {
  headline?: string;
  description?: string;
  showSearch?: boolean;
  showGenreFilter?: boolean;
  showFormatFilter?: boolean;
  catalogLayout?: 'grid' | 'compact';
  showRecordCount?: boolean;
  featuredRecordIds?: string[];
}

export interface Distributor {
  id: string; // Firestore document ID
  name: string;
  slug?: string; // Unique URL identifier
  slugLastUpdatedAt?: string; // ISO date string
  contactEmail: string;
  masterUserUid?: string; // UID of the master account for this distributor
  creatorUid?: string; // UID of the superadmin who created it
  status: 'active' | 'inactive' | 'pending' | 'awaiting_approval';
  createdAt: string; // ISO date string
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postcode?: string;
  country?: string;
  phoneNumber?: string;
  website?: string;
  chamberOfCommerce?: string; // Business registration number (KVK, CIF, etc.)
  taxId?: string; // Tax Identification Number (TIN)
  isVatRegistered?: boolean;
  vatNumber?: string;
  vatCountry?: string;
  eoriNumber?: string; // EORI number for international trade
  subscription?: SubscriptionInfo;
  companyName?: string; // Custom branding name
  logoUrl?: string; // Custom branding logo URL
  lowStockNotificationsEnabled?: boolean;
  lowStockThreshold?: number;
  shelfLocations?: string[];
  storageLocations?: string[];
  cardDisplaySettings?: CardDisplaySettings;
  clientMenuSettings?: ClientMenuSettings;
  visibility?: 'open' | 'private' | 'invite_only';
  storefrontSettings?: StorefrontSettings;
  suppliers?: Supplier[]; // This can be deprecated in the future
  weightOptions?: WeightOption[];
  isSubscriptionExempt?: boolean;
  orderCounter?: number;
  orderIdPrefix?: string;
  allowOrderRequests?: boolean;

  // Payment link policy for Request Order approvals. Controls whether the
  // distributor automatically sends a Stripe Checkout link with the approval
  // email or offers an invoice-only path where the customer pays externally
  // (bank transfer, etc.) and the distributor manually marks as paid.
  //  - 'always'   : every approval sends a Stripe link (default, current behavior)
  //  - 'optional' : distributor picks per order at approval time
  //  - 'never'    : never sends a Stripe link, always invoice-only
  paymentLinkMode?: 'always' | 'optional' | 'never';

  // Shipping configuration
  shippingConfig?: ShippingConfig;

  // Tax configuration
  taxMode?: 'none' | 'manual' | 'stripe_tax';
  taxBehavior?: 'inclusive' | 'exclusive';
  manualTaxRate?: number;
  manualTaxLabel?: string;
  defaultTaxCode?: string;

  stripeAccountId?: string; // For Stripe Connect
  stripeAccountStatus?: 'pending' | 'verified' | 'in_review' | 'restricted' | 'details_needed';

  // Superadmin-only override for the platform fee percentage on this
  // distributor's orders. Range 0.0–6 (percentage, so 2 = 2%). When set,
  // overrides the tier-derived rate in getPlatformFeeRate — e.g. for
  // wholesale distributors on Scale tier (default 2%) we can bring the fee
  // down to 1% or 0% per customer-specific agreement.
  customPlatformFeePercent?: number | null;

  // When true, disables the Stripe Checkout path for this distributor:
  //  - storefront checkout hides the "Pay now via Stripe" option and
  //    only offers Request Order
  //  - /api/stripe/* order-payment routes reject requests (defense)
  //  - approval flow behaves as paymentLinkMode='never' (invoice-only)
  //  - customer's My Orders page does not show Pay Now
  // Only surfaced in settings for Scale tier or managed accounts
  // (isSubscriptionExempt === true) because lower tiers are assumed to
  // rely on Stripe as their main checkout.
  stripeCheckoutDisabled?: boolean;
  stripeCustomerId?: string; // For Stripe Billing
  subscriptionId?: string; // For Stripe Billing
  subscriptionStatus?: SubscriptionStatus; // For Stripe Billing
  subscriptionTier?: SubscriptionTier;
  billingCycle?: 'monthly' | 'quarterly' | 'yearly'; // <- Add this
  subscriptionCurrentPeriodEnd?: string; // ISO date string
  profileComplete?: boolean;

  // PayPal Commerce Platform
  paypalMerchantId?: string; // PayPal merchant account ID
  paypalEmail?: string; // PayPal account email
  paypalAccountStatus?: 'pending' | 'verified' | 'restricted';

  // Marketing Settings
  invitationEmailCustomText?: string; // Personal message added to client invitation emails (max 500 chars, supports markdown)

  // Invoice Settings
  invoicePaymentTerms?: string; // e.g., "Payment due within 14 days"
  invoiceNotes?: string; // Default notes to include on invoices
  invoiceFooterText?: string; // Custom footer message
  invoiceBankDetails?: string; // Bank account details for wire transfers (legacy/notes)
  invoiceShowBankDetails?: boolean; // Whether to show bank details on invoices
  invoiceCustomTextPosition?: 'above_items' | 'below_items'; // Where to place payment terms/notes

  // Bank Details (structured) - legacy single account
  iban?: string;
  bic?: string;
  bankName?: string;

  // Multiple payment accounts
  paymentAccounts?: PaymentAccount[];

  // Weekly financial digest email (Monday 09:00). Opt-in; off by default.
  weeklyDigestOptIn?: boolean;
  weeklyDigestLastSentAt?: string; // ISO
}

export type PaymentAccountType = 'bank' | 'paypal' | 'other';

export interface PaymentAccount {
  id: string;
  type: PaymentAccountType;
  label?: string; // e.g. "Main Business Account", "PayPal Sales"
  // Bank fields
  iban?: string;
  bic?: string;
  bankName?: string;
  accountHolder?: string;
  // PayPal fields
  paypalEmail?: string;
  // Other
  details?: string; // free-text for custom payment methods
}

export interface BrandingSettings {
  companyName: string;
  logoUrl: string;
}

export interface CartItem {
  record: VinylRecord;
  quantity: number;
  distributorId: string; // ID of the distributor this cart item belongs to
}

export type User = {
  uid: string; // Firebase Auth UID
  email: string | null; // Firebase Auth email
  role: UserRole;
  status?: UserStatus; // For master/worker roles
  // For master/worker: The primary distributor they belong to.
  // For viewer: Can be their "home" or default distributor, but access is governed by accessibleDistributorIds.
  distributorId?: string; 
  // For viewers: A list of distributor IDs they have been granted access to.
  accessibleDistributorIds?: string[];
  disabledForDistributors?: string[]; // For viewers: A list of distributor IDs for which their access is on hold
  favorites?: string[]; // Array of record IDs
  cart?: FirestoreCartItem[];
  createdAt?: string; // ISO date string
  lastLoginAt?: string; // ISO date string
  loginHistory?: string[];
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode?: string;
  city?: string;
  country?: string;
  billingAddress?: string; // legacy free-text
  useDifferentBillingAddress?: boolean;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingPostcode?: string;
  billingCity?: string;
  billingCountry?: string;
  chamberOfCommerce?: string;
  vatNumber?: string;
  vatValidated?: boolean;
  vatValidatedAt?: string; // ISO date string
  vatValidatedName?: string; // Company name returned by VIES
  eoriNumber?: string;
  website?: string;
  notes?: string;
  discogsUsername?: string;
  discogsUserId?: number;
  permissions?: WorkerPermissions;
  stripeCustomerId?: string; // For Stripe Billing
  subscriptionStatus?: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  profileComplete?: boolean; // New flag for client onboarding
  unreadChangelogs?: boolean; // New flag for changelog notifications
  invitedAt?: string; // ISO string — when the invite was sent
  invitedByDistributorId?: string; // Which distributor sent the invite
  invitedByUid?: string; // UID of the master who invited
  originType?: 'invited' | 'access_request' | 'self_signup' | 'admin_created';
  originDistributorId?: string;
  originDistributorName?: string;
};

// Readonly tuple so `z.enum(MediaConditions)` and other consumers get the
// full literal union at type-level. MediaCondition is derived from the tuple
// so the list and the type can't drift apart.
export const MediaConditions = [
  "Mint (M)",
  "Near Mint (NM)",
  "Very Good Plus (VG+)",
  "Very Good (VG)",
  "Good Plus (G+)",
  "Good (G)",
  "Fair (F)",
  "Poor (P)",
] as const;

export type MediaCondition = typeof MediaConditions[number];

export interface Track {
  position: string;
  type_: string; // 'track' or 'heading'
  title: string;
  duration?: string;
  previewUrl?: string;
}

export interface VinylRecord {
  id: string; // Firestore document ID
  ownerUid: string; // UID of the user who owns this record entry
  distributorId?: string; // The ID of the distributor this record belongs to
  discogs_id?: number;
  barcode?: string;
  title: string;
  artist: string;
  label?: string;
  year?: number;
  releasedDate?: string;
  genre?: string[];
  style?: string[];
  country?: string;
  formatDetails?: string; // e.g., "Vinyl, LP, Album, Reissue"
  cover_url?: string;
  media_condition: MediaCondition;
  sleeve_condition: MediaCondition;
  notes?: string;
  price?: number;
  purchasingPrice?: number;
  sellingPrice?: number;
  stock_shelves?: number;
  stock_storage?: number;
  // Count of items held by open orders (awaiting_approval / awaiting_payment).
  // Visible stock for customers = (stock_shelves + stock_storage) - reserved.
  // Cleared when the order is paid (converted to stock deduction) or cancelled (released).
  reserved?: number;
  shelf_location?: string;
  storage_location?: string;
  shelf_locations?: string[];
  storage_locations?: string[];
  weight?: number; // Weight in grams
  weightOptionId?: string; // ID of the selected weight option from distributor settings
  tracklist?: Track[];
  added_at: string; // ISO date string
  added_by_email?: string | null; // Email of user who added
  last_modified_at?: string; // ISO date string
  last_modified_by_email?: string | null; // Email of user who last modified
  dataAiHint?: string;

  // Personalization Fields
  isForSale?: boolean;
  isWishlist?: boolean;
  userRating?: number; // 0-5 stars
  tags?: string[];
  isInventoryItem?: boolean; // True if part of merchant inventory
  
  // AI Generated Content
  artistBio?: string;
  albumInfo?: string;

  // Discogs Community Stats
  discogsCommunity?: {
    have: number;
    want: number;
    rating?: {
      count: number;
      average: number;
    };
  };

  // Discogs Marketplace Stats
  discogsMarketplace?: {
    numForSale?: number;
    lowestPrice?: { value: number; currency: string };
    medianPrice?: { value: number; currency: string };
  };

  // Supplier info
  supplierId?: string;

  // Search field
  searchableKeywords?: string[];
  catno?: string;
}

export interface ArtistProfile {
  name: string;
  bio: string;
  genres: string[];
  activeYears?: string;
  origin?: string;
  funFact?: string;
  relatedArtists?: string[];
}

export interface SearchResult {
    id: string;
    title: string;
    artist: string;
    cover_url?: string;
}

export interface DiscogsFormat {
  name: string;
  qty?: string;
  text?: string; // Sometimes used for free-text description
  descriptions?: string[];
}

export interface DiscogsReleaseApiResponse {
  id: number;
  title: string;
  artists?: { name: string; anv?: string; join?: string; role?: string; tracks?: string; id?: number; resource_url?: string }[];
  labels?: { name: string; catno: string; entity_type?: string; entity_type_name?: string; id?: number; resource_url?: string }[];
  year?: number;
  genres?: string[];
  styles?: string[];
  country?: string;
  formats?: DiscogsFormat[];
  thumb?: string;
  images?: { type: string; uri: string; resource_url: string; uri150: string; width: number; height: number }[];
  lowest_price?: number | null;
  community?: {
    have: number;
    want: number;
    rating?: { count: number; average: number };
    submitter?: { username: string; resource_url: string };
    contributors?: { username: string; resource_url: string }[];
  };
  catno?: string;
  released?: string;
  tracklist?: Track[];
  identifiers?: { type: string; value: string; description?: string }[];
}

export interface DiscogsReleaseSearchResult {
  id: number;
  master_id?: number;
  title: string;
  year?: string;
  label?: string[];
  genre?: string[];
  format?: string[]; // Often an array of strings like ["Vinyl", "LP", "Album"]
  style?: string[];
  country?: string;
  barcode?: string[];
  catno?: string;
  cover_image?: string;
  thumb?: string;
}

export interface FirestoreUser {
  email: string;
  role: UserRole;
  status?: UserStatus; // For master/worker roles
  distributorId?: string; 
  accessibleDistributorIds?: string[];
  disabledForDistributors?: string[]; // For viewers: a list of distributor IDs for which their access is on hold
  favorites?: string[]; // Array of record IDs
  cart?: FirestoreCartItem[];
  createdAt?: import('firebase/firestore').Timestamp;
  lastLoginAt?: import('firebase/firestore').Timestamp; // Store as Firestore Timestamp
  loginHistory?: import('firebase/firestore').Timestamp[];
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phoneNumber?: string;
  mobileNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  postcode?: string;
  city?: string;
  country?: string;
  billingAddress?: string; // legacy free-text
  useDifferentBillingAddress?: boolean;
  billingAddressLine1?: string;
  billingAddressLine2?: string;
  billingPostcode?: string;
  billingCity?: string;
  billingCountry?: string;
  chamberOfCommerce?: string;
  vatNumber?: string;
  vatValidated?: boolean;
  vatValidatedAt?: string; // ISO date string
  vatValidatedName?: string; // Company name returned by VIES
  eoriNumber?: string;
  website?: string;
  notes?: string;
  discogsUsername?: string;
  discogsUserId?: number;
  permissions?: WorkerPermissions;
  stripeCustomerId?: string; // For Stripe Billing
  subscriptionStatus?: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  profileComplete?: boolean; // New flag for client onboarding
  unreadChangelogs?: boolean; // Flag for changelog notifications
  invitedAt?: import('firebase/firestore').Timestamp | any; // Firestore Timestamp (admin or client SDK)
  invitedByDistributorId?: string;
  invitedByUid?: string;
  originType?: 'invited' | 'access_request' | 'self_signup' | 'admin_created';
  originDistributorId?: string;
  originDistributorName?: string;
}


// ===================================
// Sales/Orders
// ===================================

export type OrderStatus = 'awaiting_approval' | 'pending' | 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'cancelled' | 'on_hold';

export const OrderStatuses: OrderStatus[] = ['awaiting_approval', 'pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'cancelled', 'on_hold'];


export type OrderItemStatus = 'available' | 'not_available' | 'out_of_stock' | 'back_order';

export interface OrderItem {
  recordId: string;
  title: string;
  artist: string;
  cover_url?: string;
  priceAtTimeOfOrder: number;
  quantity: number;
  itemStatus?: OrderItemStatus;
}

export interface Order {
  id: string; // Firestore doc ID
  distributorId: string; // The ID of the distributor this order belongs to
  viewerId: string;
  viewerEmail: string;
  customerName: string;
  customerCompanyName?: string; // Client's company name
  customerVatNumber?: string; // Client's VAT number
  customerEoriNumber?: string; // Client's EORI number
  customerChamberOfCommerce?: string; // Client's chamber of commerce / KVK
  shippingAddress: string;
  billingAddress?: string;
  phoneNumber?: string;
  items: OrderItem[];
  status: OrderStatus;
  totalAmount: number;
  totalWeight?: number; // Total weight of the order in grams
  createdAt: string; // ISO String
  updatedAt: string; // ISO String
  orderNumber?: string;

  // Payment Fields
  paymentMethod?: 'stripe' | 'paypal' | 'pending' | 'bank_transfer' | 'cash' | 'paypal_external' | 'stripe_external' | 'other';
  paymentReference?: string; // Bank transaction ID / memo / external reference (for manual payments)
  paymentNotes?: string; // Internal notes about the payment (distributor-only)
  paidBy?: string; // uid of the user who marked the order paid (manual) or 'stripe-webhook'/'paypal-webhook' for automated
  paymentStatus?: 'unpaid' | 'paid' | 'refunded' | 'partially_refunded' | 'failed';
  paidAt?: string; // ISO String
  platformFeeAmount?: number; // Platform fee in cents (varies by tier)
  appliedFeePercentage?: number; // Fee rate applied at order creation (e.g., 0.04 for 4%)

  // Tax Fields
  subtotalAmount?: number;
  taxAmount?: number;
  taxRate?: number;
  taxInclusive?: boolean;
  taxLabel?: string;
  isReverseCharge?: boolean;
  taxBreakdown?: Array<{ rate: number; amount: number; jurisdiction: string }>;

  // Discount applied by the distributor during approval. Discount is applied
  // to the items subtotal BEFORE tax (EU standard). Shipping is never
  // discounted. Capped at items-subtotal (100% off).
  // - discountType: 'fixed' = discountValue is € amount; 'percent' = 0-100
  // - discountValue: the raw input from the distributor (for re-editing)
  // - discountAmount: the actual € reduction applied, in the SAME tax
  //   convention as priceAtTimeOfOrder (inclusive or exclusive per distributor)
  discountType?: 'fixed' | 'percent';
  discountValue?: number;
  discountAmount?: number;

  // Shipping Fields
  shippingCost?: number;
  shippingZoneName?: string;
  shippingMethod?: 'shipping' | 'pickup';
  freeShippingApplied?: boolean;

  // Stripe Connect Payment Fields
  stripePaymentIntentId?: string;
  stripeCheckoutSessionId?: string;

  // PayPal Payment Fields
  paypalOrderId?: string;
  paypalCaptureId?: string;

  // Order Request Fields
  paymentLink?: string;
  paymentLinkExpiresAt?: string;
  paymentLinkCreatedAt?: string; // ISO — set on every (re)create so UI can detect a stale link
  approvedAt?: string;
  approvedBy?: string;
  rejectionReason?: string;

  // Populated if the webhook detects that the customer paid via a Stripe session
  // whose amount_total does not match the current order.totalAmount (e.g. they
  // paid a stale link after items were adjusted). The order is moved to on_hold
  // so a human can reconcile (partial refund / credit note / etc.).
  paymentAmountMismatch?: {
    sessionAmountCents: number;
    expectedAmountCents: number;
    currency: string;
    stripeSessionId: string;
    detectedAt: string; // ISO
  };

  // Item status adjustment
  originalTotalAmount?: number; // Preserved when items are marked unavailable
  originalSubtotalAmount?: number;

  // Stock reservation state machine.
  // - 'reserved': order created and stock is held (awaiting_approval / awaiting_payment)
  // - 'deducted': order paid and stock was physically decremented
  // - 'none' or missing: no stock claim (cancelled / rejected, or legacy pre-reservation orders)
  stockState?: 'none' | 'reserved' | 'deducted';

  // Customer-facing notification tracking (for resend UX)
  itemChangesNotifiedAt?: string; // ISO — last time the "items updated" email was sent
  itemChangesNotifiedCount?: number;
  invoiceEmailedAt?: string; // ISO — last time the invoice PDF was emailed to the customer
  invoiceEmailedCount?: number;

  // Shipping Tracking Fields
  carrier?: 'postnl' | 'dhl' | 'ups' | 'fedex' | 'dpd' | 'gls' | 'other';
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: string; // ISO String
  estimatedDeliveryDate?: string; // ISO String

  // Customer self-service tracking token — unguessable URL slug for /t/[token]
  trackingToken?: string;

  // Payment reminder tracking (for awaiting_payment dunning)
  lastPaymentReminderAt?: string; // ISO
  paymentReminderCount?: number;

  // Refunds — partial or full. Empty/missing when nothing refunded.
  refunds?: Array<{
    id: string;
    amount: number;        // € refunded, subset of totalAmount
    reason?: string;
    method?: string;       // 'stripe' | 'paypal' | 'bank_transfer' | 'cash' | 'other'
    stripeRefundId?: string;
    refundedAt: string;    // ISO
    refundedBy: string;    // uid
    notes?: string;
  }>;
}

// ===================================
// Notifications
// ===================================
export interface AppNotification {
  id: string;
  distributorId?: string;
  type: 'low_stock' | 'new_order' | 'access_request';
  message: string;
  isRead: boolean;
  createdAt: string; // ISO string

  // For low_stock
  recordId?: string;
  recordTitle?: string;
  remainingStock?: number;

  // For new_order
  orderId?: string;
  orderTotal?: number;
  customerEmail?: string;

  // For access_request
  requesterUid?: string;
  requesterEmail?: string;
  requesterName?: string;
  requesterCompanyName?: string;
  requesterPhone?: string;
  requesterCity?: string;
  requesterCountry?: string;
  requesterVatNumber?: string;
  requestStatus?: 'pending' | 'approved' | 'denied';
}

export interface ChangelogEntry {
  id: string;
  version: string;
  createdAt: string; // ISO date string
  title: string;
  notes: string; // Markdown content
}


// ===================================
// Discogs Marketplace
// ===================================
export interface DiscogsMarketplaceStats {
  num_for_sale?: number;
  lowest_price?: {
    value: number;
    currency: string;
  };
  median_price?: {
    value: number;
    currency: string;
  };
  blocked_from_sale?: boolean;
}


// ===================================
// Discogs User Data
// ===================================

export interface DiscogsPagination {
  page: number;
  pages: number;
  per_page: number;
  items: number;
  urls: {
    last?: string;
    next?: string;
  };
}

export interface DiscogsBasicInformation {
  id: number;
  master_id: number;
  master_url: string;
  resource_url: string;
  thumb: string;
  cover_image: string;
  title: string;
  year: number;
  formats: {
    name: string;
    qty: string;
    descriptions?: string[];
  }[];
  artists: {
    name: string;
    anv: string;
    join: string;
    role: string;
    tracks: string;
    id: number;
    resource_url: string;
  }[];
  labels: {
    name: string;
    catno: string;
    entity_type: string;
    entity_type_name: string;
    id: number;
    resource_url: string;
  }[];
}

export interface DiscogsCollectionRelease {
  id: number;
  instance_id: number;
  date_added: string;
  rating: number;
  basic_information: DiscogsBasicInformation;
}

export interface DiscogsWant {
  id: number;
  resource_url: string;
  date_added: string;
  rating: number;
  basic_information: DiscogsBasicInformation;
}

export interface DiscogsCollectionResponse {
  pagination: DiscogsPagination;
  releases: DiscogsCollectionRelease[];
}

export interface DiscogsWantlistResponse {
  pagination: DiscogsPagination;
  wants: DiscogsWant[];
}


export interface DiscogsListing {
  id: number;
  status: string;
  price: {
    value: number;
    currency: string;
  };
  sleeve_condition: string;
  condition: string;
  posted: string;
  ships_from: string;
  comments: string;
  release: {
    id: number;
    description: string;
    thumbnail: string;
    artist: string;
    title: string;
    year: number;
    format: string;
  };
}

export interface DiscogsInventoryResponse {
  pagination: DiscogsPagination;
  listings: DiscogsListing[];
}

export type ApiName = 'discogs' | 'gemini';

export interface ApiLog {
    id: string;
    api: ApiName;
    timestamp: string; // ISO string
    distributorId?: string;
}

// ===================================
// User Activity Tracking
// ===================================
export type ActivityAction =
  | 'session_start'
  | 'collection_browse'
  | 'cart_update'
  | 'order_placed'
  | 'order_status_change'
  | 'settings_update'
  | 'record_added'
  | 'record_edited'
  | 'client_invited'
  | 'access_request'
  | 'import_completed';

export interface UserActivity {
  id: string;
  userId: string;
  userEmail: string;
  userRole: string;
  sessionId: string;
  action: ActivityAction;
  details?: string;
  metadata?: {
    distributorId?: string;
    distributorName?: string;
    orderId?: string;
    recordCount?: number;
    page?: string;
  };
  createdAt: string; // ISO string
}

// ===================================
// System Monitoring
// ===================================
export type SystemLogType = 'api_call' | 'api_error' | 'webhook_event' | 'webhook_error' | 'email_error' | 'email_sent' | 'system_alert' | 'admin_action';
export type SystemLogSource = 'stripe_webhook' | 'paypal_webhook' | 'stripe_checkout' | 'paypal_checkout' | 'email_service' | 'vies_api' | 'system' | 'subscription_tiers_sync';
export type SystemLogStatus = 'success' | 'error' | 'warning';

export interface SystemLog {
  id: string;
  type: SystemLogType;
  source: SystemLogSource;
  status: SystemLogStatus;
  message: string;
  // User context (when available)
  userId?: string;
  userEmail?: string;
  userRole?: string;
  // Page context (for client-initiated actions)
  page?: string;
  metadata?: {
    endpoint?: string;
    statusCode?: number;
    errorMessage?: string;
    distributorId?: string;
    orderId?: string;
    duration?: number;
    // subscription_tiers_sync fields
    mode?: string;
    actionCount?: number;
    tierKeys?: string[];
  };
  createdAt: string; // ISO string
  resolvedAt?: string;
  isResolved?: boolean;
}
