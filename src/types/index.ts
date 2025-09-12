

import { DocumentSnapshot } from 'firebase/firestore';
// Add this new export at the top of the file
export interface OnboardingFormValues {
  companyName: string;
  kvkNumber?: string;
  vatNumber?: string;
  website?: string;
  contactPerson: string;
  email: string;
  password?: string;
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
}


export type UserRole = 'master' | 'worker' | 'viewer' | 'superadmin';
export type UserStatus = 'active' | 'on_hold';

export type SubscriptionTier = 'essential' | 'growth' | 'scale';

export const SubscriptionTiers: SubscriptionTier[] = ['essential', 'growth', 'scale'];

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';


export interface SubscriptionInfo {
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  maxRecords: number;
  maxUsers: number;
  allowOrders: boolean;
  allowAiFeatures: boolean;
  price?: number;
  discountedPrice?: number;
  yearlyPrice?: number;
  description?: string;
  features?: string; // Newline-separated string
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

export interface Distributor {
  id: string; // Firestore document ID
  name: string;
  slug?: string; // Unique URL identifier
  slugLastUpdatedAt?: string; // ISO date string
  contactEmail: string;
  masterUserUid?: string; // UID of the master account for this distributor
  creatorUid?: string; // UID of the superadmin who created it
  status: 'active' | 'inactive' | 'pending';
  createdAt: string; // ISO date string
  addressLine1?: string;
  addressLine2?: string;
  phoneNumber?: string;
  website?: string;
  chamberOfCommerce?: string;
  vatNumber?: string;
  subscription?: SubscriptionInfo;
  companyName?: string; // Custom branding name
  logoUrl?: string; // Custom branding logo URL
  lowStockNotificationsEnabled?: boolean;
  lowStockThreshold?: number;
  shelfLocations?: string[];
  storageLocations?: string[];
  cardDisplaySettings?: CardDisplaySettings;
  clientMenuSettings?: ClientMenuSettings;
  suppliers?: Supplier[]; // This can be deprecated in the future
  weightOptions?: WeightOption[];
  isSubscriptionExempt?: boolean;
  orderCounter?: number;
  orderIdPrefix?: string;
  stripeAccountId?: string; // For Stripe Connect
  stripeAccountStatus?: 'pending' | 'verified' | 'restricted';
  stripeCustomerId?: string; // For Stripe Billing
  subscriptionId?: string; // For Stripe Billing
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
  billingAddress?: string; 
  useDifferentBillingAddress?: boolean;
  chamberOfCommerce?: string;
  vatNumber?: string;
  eoriNumber?: string;
  notes?: string;
  discogsUsername?: string;
  discogsUserId?: number;
  permissions?: WorkerPermissions;
  stripeCustomerId?: string; // For Stripe Billing
  subscriptionStatus?: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  profileComplete?: boolean; // New flag for client onboarding
};

export type MediaCondition = "Mint (M)" | "Near Mint (NM)" | "Very Good Plus (VG+)" | "Very Good (VG)" | "Good Plus (G+)" | "Good (G)" | "Fair (F)" | "Poor (P)";

export const MediaConditions: MediaCondition[] = ["Mint (M)", "Near Mint (NM)", "Very Good Plus (VG+)", "Very Good (VG)", "Good Plus (G+)", "Good (G)", "Fair (F)", "Poor (P)"];

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

  // Supplier info
  supplierId?: string;

  // Search field
  searchableKeywords?: string[];
  catno?: string;
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

// User data stored in Firestore 'users' collection
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
  billingAddress?: string;
  useDifferentBillingAddress?: boolean;
  chamberOfCommerce?: string;
  vatNumber?: string;
  eoriNumber?: string;
  notes?: string;
  discogsUsername?: string;
  discogsUserId?: number;
  permissions?: WorkerPermissions;
  stripeCustomerId?: string;
  subscriptionStatus?: SubscriptionStatus;
  subscriptionTier?: SubscriptionTier;
  profileComplete?: boolean; // New flag for client onboarding
}

// ===================================
// Sales/Orders
// ===================================

export type OrderStatus = 'pending' | 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'cancelled' | 'on_hold';

export const OrderStatuses: OrderStatus[] = ['pending', 'awaiting_payment', 'paid', 'processing', 'shipped', 'cancelled', 'on_hold'];


export interface OrderItem {
  recordId: string;
  title: string;
  artist: string;
  cover_url?: string;
  priceAtTimeOfOrder: number;
  quantity: number;
}

export interface Order {
  id: string; // Firestore doc ID
  distributorId: string; // The ID of the distributor this order belongs to
  viewerId: string;
  viewerEmail: string;
  customerName: string;
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
}

// ===================================
// Notifications
// ===================================
export interface AppNotification {
  id: string;
  distributorId?: string;
  type: 'low_stock' | 'new_order';
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

