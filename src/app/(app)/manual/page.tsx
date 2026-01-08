"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search, LayoutDashboard, ScanLine, BarChart3, Package, ShoppingCart,
  Users, Settings, Library, ListChecks, Heart, Bell, Boxes, Disc3,
  Truck, CreditCard, Building, Palette, Rocket, HelpCircle, FilePlus2
} from "lucide-react";

interface ManualSection {
  id: string;
  title: string;
  icon: React.ElementType;
  badge?: string;
  description: string;
  content: {
    title: string;
    text: string;
  }[];
}

const manualSections: ManualSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: Rocket,
    badge: "Start Here",
    description: "Quick start guide to get you up and running with Vinylogix.",
    content: [
      {
        title: "Welcome to Vinylogix",
        text: `Vinylogix is a comprehensive platform designed specifically for vinyl record distributors, store owners, and collectors. Whether you're managing thousands of records in a busy store environment or carefully curating your personal collection, Vinylogix provides the tools you need to stay organized and efficient.

The platform handles everything from initial record entry (via barcode scanning, AI cover recognition, or manual input) through to order processing and client management. Our goal is to eliminate spreadsheets and disconnected systems, giving you one place to manage your entire vinyl business.

Key capabilities include:
• Rapid inventory entry with barcode scanning and Discogs integration
• AI-powered cover recognition for quick cataloging
• Multi-location stock tracking (shop floor and storage)
• Client portal for browsing and ordering
• Integrated payment processing via Stripe Connect
• Comprehensive analytics and reporting`
      },
      {
        title: "First Steps After Signing Up",
        text: `After creating your account, follow these steps to get your operation running smoothly:

1. Complete Your Profile
Navigate to Settings and fill in your business details including company name, address, and contact information. This information appears on invoices and client communications.

2. Connect Payment Processing
Go to Settings > Payment Providers and connect your Stripe account. This enables you to accept card payments directly through the platform. The onboarding process typically takes 5-10 minutes and requires basic business information.

3. Configure Your Locations
Set up your stock locations in Settings > Inventory. Most businesses use at least two: "Shop Floor" for records on display and "Storage" for backroom inventory. You can create as many locations as needed.

4. Add Your First Records
Visit Scan / Add Record to begin building your inventory. Start with a few records to familiarize yourself with the workflow before doing bulk entry.

5. Invite Your First Client
Go to Clients and send an invitation to a test email address. This lets you experience the platform from a client's perspective.`
      },
      {
        title: "Understanding User Roles",
        text: `Vinylogix uses a role-based permission system to control what each user can see and do:

Master Account
The primary account with full administrative access. Masters can:
• Access all features without restriction
• Create and manage Worker accounts
• Configure all business settings
• View all pricing and financial information
• Manage payment provider connections
• Set up branding and client portal options

Worker Account (Operator)
Staff accounts with customizable permissions. Workers can:
• Add and edit inventory (based on permissions)
• Process orders
• View and manage clients
• Access features as permitted by the Master

Permissions for Workers include options like:
• Can view/edit purchasing prices
• Can view/edit selling prices
• Can manage suppliers
• Can manage stock locations

Viewer Account (Client)
Customer accounts for people who browse and purchase from your catalog. Clients can:
• Browse available inventory
• Add items to their cart and checkout
• Manage their wishlist
• Track their order history
• Save favorites for quick access

Each role sees a tailored interface showing only the features relevant to their access level.`
      }
    ]
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    description: "Your central hub for quick insights and recent activity.",
    content: [
      {
        title: "Dashboard Overview",
        text: `The Dashboard is your command center, providing an at-a-glance view of your business health. Each time you log in, you'll see key metrics and recent activity that helps you understand what needs attention.

The dashboard is designed to surface the most important information without overwhelming you with data. For deeper analysis, use the dedicated Analytics section.

What you see depends on your role:
• Masters and Workers see business metrics, order activity, and inventory stats
• Clients see their recent orders, favorites, and personalized recommendations`
      },
      {
        title: "Key Metrics Explained",
        text: `The dashboard displays several important numbers that update in real-time:

Total Inventory Count
The number of unique records currently in your catalog. This counts distinct items, not total stock quantity.

Total Inventory Value
The combined selling price of all records in stock. This helps you understand the value of your current holdings and track growth over time.

Records Added (This Period)
Shows how many new records were added during the selected time period. Useful for tracking cataloging productivity.

Pending Orders
Orders that have been placed but not yet processed. A high number here might indicate you need to prioritize order fulfillment.

Revenue (This Period)
Total sales value for the selected period. Compare across periods to identify trends and seasonality.

Recent Activity Feed
A chronological list of significant events: new orders, completed shipments, client registrations, and system notifications.`
      },
      {
        title: "Using Quick Actions",
        text: `The dashboard includes shortcuts to frequently used functions:

Add New Record
Jumps directly to the Scan / Add Record page. Use this when you have records to catalog.

View Pending Orders
Goes to the Orders page filtered to show only pending items. Use this to start your daily order processing.

Check Notifications
Opens the notification center showing alerts that need your attention.

Quick Search
Search across your entire inventory from the dashboard without navigating away.

These quick actions save clicks and help you maintain an efficient workflow. The specific actions shown may vary based on your role and current business state.`
      }
    ]
  },
  {
    id: "scan-add",
    title: "Scan / Add Record",
    icon: ScanLine,
    description: "Add records to your inventory using barcode scanning or manual entry.",
    content: [
      {
        title: "Overview of Record Entry Methods",
        text: `Vinylogix offers multiple ways to add records to your inventory, each suited to different situations:

Barcode Scanning (Camera)
Use your device's camera to scan the barcode on a record sleeve. The system automatically looks up the release on Discogs and pre-fills all available information. Best for: Mobile devices, occasional scanning.

Handheld Scanner Mode
Optimized for USB or Bluetooth barcode scanners. Opens a dedicated input field that receives scanner data and automatically processes each scan. Best for: High-volume entry, dedicated workstations.

AI Cover Recognition
Point your camera at the album cover and let AI identify the record. Useful when barcodes are missing, damaged, or for older releases without barcodes.

Manual Text Search
Search Discogs by artist name and/or album title. Returns matching results that you can select from.

Fully Manual Entry
Create a record from scratch without Discogs data. Use this for rare items, test pressings, or releases not in the Discogs database.`
      },
      {
        title: "Barcode Scanning in Detail",
        text: `The barcode scanner uses your device's camera to read UPC/EAN barcodes commonly found on vinyl record packaging.

How to Use:
1. Click "Scan Barcode" to activate your camera
2. Grant camera permission if prompted
3. Point the camera at the barcode, holding steady
4. The scanner will automatically detect and process the barcode
5. Wait while the system searches your inventory and Discogs

What Happens After Scanning:
• If the barcode matches a record already in your inventory, you'll be redirected to that record's page with the option to adjust stock
• If found on Discogs, you'll be taken to the Add Record page with details pre-filled
• If multiple Discogs releases share the barcode, you'll see a list to choose from
• If not found anywhere, you can add the barcode manually or search by text

Tips for Better Scanning:
• Ensure good lighting on the barcode
• Hold your device steady, about 6-8 inches from the barcode
• Make sure the entire barcode is visible in the camera frame
• Clean or damaged barcodes may need manual entry`
      },
      {
        title: "Using Handheld Scanner Mode",
        text: `Handheld Scanner Mode is designed for high-volume inventory entry using dedicated USB or Bluetooth barcode scanners. These devices work like keyboards, typing the barcode number and pressing Enter automatically.

Setting Up:
1. Connect your USB scanner or pair your Bluetooth scanner with your device
2. Click "Use Handheld Scanner" to open the scanner dialog
3. The input field will be automatically focused and ready to receive scans
4. Scan a barcode - it will be processed immediately and the field cleared for the next scan

Workflow Tips:
• Keep a stack of records ready to scan
• The scanner dialog stays open between scans for rapid processing
• If a record needs review (multiple Discogs matches), handle it and return to continue scanning
• Consider using the "Add & Scan Next" button when adding records to maintain flow

Compatible Scanners:
Most USB and Bluetooth barcode scanners work with Vinylogix. The scanner should be configured to:
• Output as keyboard input (HID mode)
• Send Enter/Return key after each scan
• Use the standard barcode symbologies (UPC-A, EAN-13)`
      },
      {
        title: "AI Cover Recognition",
        text: `The AI Cover Recognition feature uses artificial intelligence to identify records by their album artwork. This is particularly useful for records without barcodes or when the barcode is damaged.

How It Works:
1. Click "Scan Cover (AI)" to activate your camera
2. Frame the album cover in the viewfinder
3. Click "Take Photo of Cover" to capture the image
4. The AI analyzes the image and attempts to identify the artist and album
5. If successful, you'll be directed to the Add Record page with the identified information

Best Practices:
• Use good, even lighting - avoid glare on glossy covers
• Capture the full cover without cropping
• Hold the camera parallel to the cover to avoid perspective distortion
• Original pressings work better than bootlegs or unusual editions
• The AI works best with well-known releases

Limitations:
• Very rare or obscure releases may not be recognized
• Compilation albums with generic covers may be difficult to identify
• Severely damaged or faded covers reduce accuracy
• The AI identifies the album but you should verify the specific pressing/edition`
      },
      {
        title: "Manual Search by Artist/Title",
        text: `When barcode scanning isn't possible, you can search Discogs directly using text:

Using the Search:
1. Enter the artist name in the "Artist" field
2. Enter the album title in the "Title" field
3. Click "Search by Text"
4. Review the results and select the correct release

Search Tips:
• You can search by artist only, title only, or both
• Use the main artist name, not "Various Artists" for compilations
• If exact title doesn't work, try shortened versions
• Results show year, country, and format to help identify the correct release

Selecting the Right Release:
Discogs often has many versions of the same album. Pay attention to:
• Release year
• Country of origin
• Format details (LP, 2xLP, colored vinyl, etc.)
• Label and catalog number if visible on your copy

Selecting the wrong release means incorrect catalog data, so take a moment to verify.`
      }
    ]
  },
  {
    id: "add-record-form",
    title: "Adding a Record (Form Fields)",
    icon: FilePlus2,
    description: "Understanding all fields when adding or editing a record.",
    content: [
      {
        title: "Pre-filled Information from Discogs",
        text: `When you scan a barcode or select a release from search results, Vinylogix fetches detailed information from Discogs and pre-fills the form. This saves significant data entry time.

Information automatically retrieved includes:
• Album cover image
• Artist name
• Album title
• Record label
• Release year and date
• Genre(s) and style(s)
• Country of origin
• Format details (LP, 12", colored vinyl, etc.)
• Tracklist
• Discogs ID (for reference)

This pre-filled data appears in a summary card at the top of the form. The fields are locked because they come from Discogs - this ensures catalog consistency.

If you need to add a record not in Discogs, use the "Add Manually" option and all fields become editable.`
      },
      {
        title: "Record Condition Fields",
        text: `Accurately grading record condition is crucial for customer trust and pricing. Vinylogix uses the standard Goldmine grading scale:

Media Condition (the vinyl itself):
• Mint (M) - Perfect, unplayed condition
• Near Mint (NM) - Nearly perfect, minimal signs of handling
• Very Good Plus (VG+) - Shows some signs of play but no major defects
• Very Good (VG) - Surface noise evident, light scratches
• Good Plus (G+) - Significant wear, plays through with noise
• Good (G) - Heavy wear, may skip
• Fair (F) - Damaged but playable
• Poor (P) - Barely playable or not at all

Sleeve Condition (the cover/jacket):
Uses the same scale, assessing:
• Ring wear from the record
• Seam splits
• Writing, stickers, or price tags
• Corner bumps or creases
• General wear and aging

Grading Tips:
• Be conservative - it's better to undergrade than overgrade
• Check records under good light at an angle to see scratches
• Play-test if condition is uncertain
• Note any significant flaws in the Notes field`
      },
      {
        title: "Inventory Fields",
        text: `The inventory section tracks where your records are located and how many you have:

Stock (Shelves)
The quantity of this record currently on your shop floor or display area. This is what's immediately available for customer browsing.

Shelf Locations
Where on your shelves this record is located. You might use sections like "Rock A-F", "New Arrivals", or shelf numbers. You can:
• Select from existing locations
• Create new locations on the fly (Master accounts only)
• Assign multiple locations if stock is spread across your shop

Stock (Storage)
The quantity in your backroom, warehouse, or off-site storage. This inventory isn't immediately visible to customers but can be pulled when needed.

Storage Locations
Similar to shelf locations but for your storage areas. Examples: "Warehouse Bin 23", "Basement Shelf 4", "Offsite Storage".

Weight (grams)
The shipping weight of the record including packaging. This can be:
• Custom: Enter any weight in grams
• From a template: Select from predefined weight options (e.g., "Standard LP - 450g")
• Fixed template: A preset weight that can't be manually changed

Weight affects shipping cost calculations at checkout.`
      },
      {
        title: "Pricing & Sourcing Fields",
        text: `These fields track the financial aspects of your inventory:

Purchasing Price
What you paid to acquire this record. Enter the amount including any per-item shipping or import costs. This field may be hidden from Workers without price permissions.

Entering prices: Use your local format (e.g., "15,50" or "15.50" for €15.50). The system automatically formats it correctly.

Selling Price
Your retail price for this record. This is what customers will pay. Consider:
• Your purchasing cost and desired margin
• Market rates for similar condition copies
• Rarity and demand

Supplier
If you track where you source inventory, select the supplier from your list. This helps with:
• Analyzing which suppliers provide the best inventory
• Tracking purchase history
• Maintaining supplier relationships

Suppliers are managed in Settings > Suppliers.`
      },
      {
        title: "Notes Field",
        text: `The Notes field is a free-text area for any additional information about this specific copy:

What to Include:
• Condition details not captured by the grade (e.g., "Small name written on back cover")
• Provenance or history (e.g., "From the collection of...")
• Special features (e.g., "Includes original inner sleeve and insert")
• Any defects customers should know about
• Storage notes for your team

Best Practices:
• Be specific and honest about any issues
• Mention positives too - original shrink wrap, stickers, etc.
• Keep it professional - these notes may be visible to customers
• Use consistent terminology across your inventory

Notes are searchable, so you can find records by their special characteristics.`
      },
      {
        title: "Save Options",
        text: `After filling in the record details, you have two ways to save:

Add Record to Inventory (or Save)
Saves the record and takes you to its detail page. Use this when you want to review the listing or when you're done adding records.

Add & Scan Next
Saves the record and immediately returns you to the Scan page ready for the next barcode. This creates an efficient workflow for batch entry:

1. Scan barcode
2. Review/adjust details
3. Click "Add & Scan Next"
4. Repeat

This can significantly speed up inventory entry sessions. The system confirms each successful add with a notification.`
      }
    ]
  },
  {
    id: "inventory",
    title: "Inventory",
    icon: Boxes,
    description: "View, edit, and manage all your vinyl records.",
    content: [
      {
        title: "Browsing Your Inventory",
        text: `The Inventory page displays all records in your catalog in a searchable, sortable list. This is where you go to find specific records, check stock levels, or make updates.

The List View shows:
• Album cover thumbnail
• Artist and title
• Format and condition
• Stock levels (shelves/storage)
• Selling price
• Location

Searching:
Use the search bar to find records by artist, title, or any other text. Search looks across all fields including notes.

Filtering:
Narrow down your view with filters:
• Condition (show only NM, VG+, etc.)
• Genre
• Price range
• Stock status (in stock, low stock, out of stock)
• Location

Sorting:
Click column headers to sort by that field. Options include artist, title, price, date added, and more. Click again to reverse the sort order.`
      },
      {
        title: "Managing Stock Locations",
        text: `Vinylogix supports tracking inventory across multiple physical locations. This is essential for stores with separate display and storage areas, or businesses with multiple sites.

Setting Up Locations:
1. Go to Settings > Inventory
2. Add locations for your shelf areas (where customers browse)
3. Add locations for storage areas (backroom, warehouse, etc.)

Using Locations:
When adding or editing a record, assign it to one or more locations. The inventory list shows where each record is located.

Moving Stock:
To move stock between locations:
1. Open the record detail page
2. Click "Adjust Stock"
3. Decrease quantity in one location
4. Increase in another
5. Save changes

Location Reports:
Analytics includes reports showing stock value and count by location, helping you understand inventory distribution.`
      },
      {
        title: "Bulk Operations",
        text: `For efficiency, you can perform actions on multiple records at once:

Selecting Records:
• Click the checkbox next to individual records
• Use "Select All" to select everything on the current page
• Your selection persists while you paginate

Available Bulk Actions:
After selecting records, choose from:

Update Prices - Apply a price change to all selected records. Options include setting a specific price, applying a percentage increase/decrease, or calculating from purchasing price with a margin.

Change Location - Move selected records to a different location.

Export to CSV - Download selected records as a spreadsheet for external use, backup, or analysis.

Delete - Remove selected records from inventory. This is permanent and cannot be undone.

Bulk actions are powerful but should be used carefully. Always double-check your selection before applying changes.`
      },
      {
        title: "Record Detail Page",
        text: `Clicking any record opens its detail page with comprehensive information:

Cover Image
Full-size album cover with zoom capability.

Record Information
All catalog data: artist, title, label, year, genres, country, format, and tracklist.

Condition & Notes
Current grading and any notes about this specific copy.

Stock Information
Current quantities by location with quick-adjust buttons.

Pricing
Purchasing and selling prices (based on permissions).

History
Timeline of changes: when added, price updates, stock adjustments, and sales.

Actions Available:
• Edit - Modify any editable field
• Adjust Stock - Quick stock level changes
• Duplicate - Create a copy (useful for different pressings)
• Delete - Remove from inventory

From here you can also see related information like which orders included this record and performance metrics.`
      }
    ]
  },
  {
    id: "orders",
    title: "Orders",
    icon: ShoppingCart,
    description: "Process and manage customer orders.",
    content: [
      {
        title: "Order Management Overview",
        text: `The Orders page is your fulfillment hub. Here you track every order from the moment a customer checks out until delivery is confirmed.

Order List Columns:
• Order number and date
• Customer name
• Number of items
• Order total
• Current status
• Payment status

Quick Status Indicators:
Orders are color-coded by status for easy scanning:
• Yellow - Pending (needs attention)
• Blue - Processing (being prepared)
• Purple - Shipped (in transit)
• Green - Completed (delivered)
• Red - Cancelled

Filtering Orders:
Use filters to focus your view:
• By status (most commonly "Pending" for daily processing)
• By date range
• By customer
• By payment method

The default view shows pending orders first, as these typically need the most attention.`
      },
      {
        title: "Processing an Order Step by Step",
        text: `When a new order comes in, here's the typical workflow:

1. Review the Order
Click the order to see full details:
• Items ordered with quantities
• Customer shipping address
• Payment confirmation
• Any customer notes

2. Check Stock
Verify all items are available and locate them in your inventory.

3. Update to "Processing"
Change the status to indicate you're working on this order. The customer receives a notification.

4. Pick and Pack
Gather the records, inspect condition, and package securely.

5. Generate Shipping Label (if integrated)
Use the shipping integration to create a label and get tracking.

6. Add Tracking Information
Enter the tracking number. The customer will be able to track their package.

7. Mark as Shipped
Update status to "Shipped". Another notification goes to the customer.

8. Complete the Order
Once delivery is confirmed, mark as "Completed".

Throughout this process, you can communicate with the customer via the order messaging system.`
      },
      {
        title: "Understanding Order Statuses",
        text: `Each order moves through defined statuses that both you and the customer can see:

Pending
The initial status after successful checkout. Payment has been received (or is expected for non-prepaid methods). Action required: Begin processing.

Processing
You've acknowledged the order and are preparing it. The customer knows their order is being worked on. Items are being picked and packed.

Shipped
The package has been handed to the carrier. Tracking information should be added at this point. The customer can now track their delivery.

Completed
The order has been delivered successfully. No further action needed. This status may be set automatically when tracking shows delivery, or manually by you.

Cancelled
The order was cancelled. This could be customer-requested or due to stock issues. If payment was received, a refund should be processed.

On Hold
Special status for orders that need attention before proceeding. Use for address verification issues, suspected fraud, or items temporarily out of stock.`
      },
      {
        title: "Handling Refunds and Returns",
        text: `When a customer needs a refund, Vinylogix handles the process through your payment provider:

Initiating a Refund:
1. Open the order detail page
2. Click "Process Refund"
3. Choose full or partial refund
4. For partial refunds, specify the amount
5. Add a reason for your records
6. Confirm the refund

What Happens:
• The refund is processed through Stripe or PayPal
• Customer receives notification
• Order status updates to reflect the refund
• Inventory is automatically restored if applicable

Partial Refunds:
Useful when:
• One item was damaged
• Part of an order is being returned
• You're offering a discount to resolve an issue

Refund Timeline:
Processing time depends on the payment method and the customer's bank. Typically:
• Card refunds: 5-10 business days
• PayPal: 3-5 business days

Document refund reasons for your own records and to identify patterns that might need addressing.`
      }
    ]
  },
  {
    id: "clients",
    title: "Clients",
    icon: Users,
    description: "Manage your customer relationships and invitations.",
    content: [
      {
        title: "Client Management Overview",
        text: `The Clients page shows everyone who has access to your catalog, along with their activity and purchase history.

Client List Information:
• Name and email
• Registration date
• Total orders placed
• Total spent
• Last active date
• Account status

Client Categories:
Active - Has placed an order in the last 90 days
Inactive - Registered but no recent orders
Pending - Invitation sent but not yet accepted
Blocked - Temporarily or permanently restricted

From this view you can quickly identify your most valuable customers, see who might need re-engagement, and manage access to your catalog.`
      },
      {
        title: "Inviting New Clients",
        text: `Vinylogix uses an invitation system for new clients. This ensures only people you approve can access your catalog and prices.

Sending an Invitation:
1. Click "Invite Client"
2. Enter the person's email address
3. Optionally add their name
4. Click "Send Invitation"

What the Client Receives:
An email with:
• Your business name
• A personalized invitation message
• A link to create their account
• Instructions for getting started

The invitation link is unique and expires after 7 days. You can resend if needed.

After They Accept:
The client appears in your list as an active member. They can immediately browse your catalog, add items to their cart, and place orders.

Invitation Tips:
• Personalize with a brief note about why you're inviting them
• Follow up if they haven't accepted after a few days
• Consider a welcome discount for new clients`
      },
      {
        title: "Client Permissions and Access",
        text: `You control what each client can see and do within your catalog:

Default Permissions:
All clients can:
• Browse your inventory
• See selling prices
• Add items to cart
• Place orders
• Manage their wishlist
• Save favorites

What Clients Cannot See:
• Your purchasing prices
• Stock quantities (they see "In Stock" or "Out of Stock")
• Supplier information
• Internal notes (unless you choose to show them)
• Other clients' information

Special Client Features:
You can enable or disable features for your client portal:
• Wishlist functionality
• Collection management
• Discogs integration
• Price visibility for out-of-stock items

These settings are managed in Settings > Branding under "Client Experience".`
      },
      {
        title: "Client Detail View",
        text: `Click any client to see comprehensive information:

Profile Information:
Name, email, shipping addresses, and account status.

Order History:
Complete list of every order placed, with status and totals.

Purchase Analytics:
• Total lifetime spending
• Average order value
• Most purchased genres/artists
• Order frequency

Communication:
View past messages and send new communications.

Actions:
• Edit client information
• Reset their password
• Block/unblock access
• View their cart (if items are saved)

This detail view helps you understand individual customers and provide better service.`
      }
    ]
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    description: "Track performance with detailed reports and insights.",
    content: [
      {
        title: "Analytics Overview",
        text: `The Analytics section provides deep insights into your business performance. Unlike the dashboard which shows quick metrics, Analytics offers detailed reports and trend analysis.

Available Report Types:
• Sales Analytics - Revenue, order volume, and trends
• Inventory Reports - Stock value, turnover, and aging
• Client Insights - Customer behavior and value
• Product Performance - Best sellers and slow movers

Time Period Selection:
All reports can be filtered by date range:
• Last 7 days
• Last 30 days
• Last 90 days
• Year to date
• Custom range

Export Options:
Reports can be exported as:
• PDF for sharing and archiving
• CSV for spreadsheet analysis
• Charts can be saved as images`
      },
      {
        title: "Sales Analytics",
        text: `Sales Analytics helps you understand your revenue patterns:

Revenue Over Time
A chart showing daily, weekly, or monthly sales. Identify trends, seasonal patterns, and the impact of marketing efforts.

Order Volume
Number of orders per period. Compare with revenue to understand average order size trends.

Payment Method Breakdown
See what percentage of sales come through Stripe vs PayPal, helping you understand customer preferences.

Top Selling Records
Which specific records generate the most revenue. Use this to inform purchasing decisions.

Genre Performance
Revenue by genre. Understand which categories drive your business and where you might expand.

Geographic Distribution
Where your customers are located. Helpful for shipping optimization and targeted marketing.

Profit Margin Analysis
If you track purchasing prices, see your overall margin and how it varies by category.`
      },
      {
        title: "Inventory Reports",
        text: `Inventory reports help you manage stock effectively:

Inventory Value
Total value of current stock at selling price. Track how this changes over time.

Stock by Location
Value and count breakdown by shelf and storage locations. Ensure balanced distribution.

Inventory Turnover
How quickly stock sells. Higher turnover means better cash flow. Identify slow-moving categories.

Aging Analysis
How long items have been in inventory. Records sitting too long may need price adjustments or promotion.

Low Stock Alerts
Items at or below reorder thresholds. Don't miss sales due to stockouts.

Dead Stock
Items with no sales in 90+ days. Consider clearance pricing or returning to suppliers.

Category Distribution
How your inventory breaks down by genre, format, or condition.`
      },
      {
        title: "Client Insights",
        text: `Understanding your customers helps you serve them better:

Customer Lifetime Value (CLV)
Average total spending per customer. Higher is better - focus on retention.

Acquisition Trends
New client registrations over time. Track growth of your customer base.

Purchase Frequency
How often customers order. Identify opportunities to increase engagement.

Average Order Value
Typical order size. Look for ways to increase through recommendations or bundles.

Top Customers
Your most valuable clients by total spending. Consider VIP treatment.

Retention Rate
Percentage of customers who make repeat purchases. A key health metric.

Inactive Customers
Clients who haven't ordered recently. Candidates for re-engagement campaigns.

These insights help you make informed decisions about customer acquisition, retention, and service.`
      }
    ]
  },
  {
    id: "collection",
    title: "My Collection",
    icon: Library,
    badge: "Collectors",
    description: "Personal collection management for vinyl enthusiasts.",
    content: [
      {
        title: "Personal Collection vs. Store Inventory",
        text: `Vinylogix distinguishes between your business inventory (records for sale) and your personal collection (records you own and want to keep).

Your personal collection:
• Is completely separate from store inventory
• Isn't visible to clients or available for sale
• Has its own value tracking
• Can include records you don't have physically yet (wish tracking)

This separation is important for record store owners who are also collectors - you can manage both without mixing them up.

Who Can Use This:
All account types can maintain a personal collection, including:
• Masters and Workers (alongside business inventory)
• Clients (their own collection only)

The collection features may be disabled by distributors who don't want to offer this to clients.`
      },
      {
        title: "Adding Records to Your Collection",
        text: `Building your collection in Vinylogix follows a similar process to inventory entry:

From Scanning:
When on the Scan page, you can choose to add a scanned record to your collection instead of inventory.

From Inventory (Store Owners):
When viewing store inventory, you can add a copy to your personal collection. Useful when you're keeping a copy for yourself.

Manual Entry:
Add records that you own but weren't scanned through the system.

Collection-Specific Details:
For each record in your collection, you can track:
• Date acquired
• Purchase price (what you paid)
• Source/where you got it
• Personal notes
• Your own condition assessment
• Listen count/last played

This helps you maintain a complete history of your collecting journey.`
      },
      {
        title: "Collection Value and Statistics",
        text: `Vinylogix helps you understand the value and composition of your collection:

Total Collection Value
Estimated total value based on current market prices. This uses Discogs marketplace data and your condition grades.

Value Over Time
Chart showing how your collection value has changed. Vinyl can be an investment, and this helps you track that.

Collection Statistics:
• Total record count
• Breakdown by genre
• Breakdown by decade
• Most represented artists
• Condition distribution

Individual Record Values:
Each record shows its estimated current value, and the difference from what you paid (if tracked).

Note: Market values are estimates based on recent sales data. Actual sale prices may vary based on specific pressing, condition, and market conditions at time of sale.`
      }
    ]
  },
  {
    id: "wishlist",
    title: "My Wishlist",
    icon: ListChecks,
    badge: "Collectors",
    description: "Track records you want to acquire.",
    content: [
      {
        title: "Building Your Wishlist",
        text: `Your wishlist is a personal tracking list for records you want to find and acquire:

Adding to Wishlist:
• Search for any record on Discogs
• Click "Add to Wishlist"
• The record is saved to your personal list

Wishlist Details:
For each wishlist item you can set:
• Priority level (High, Medium, Low)
• Maximum price you're willing to pay
• Notes about what pressing/condition you want
• Date added

Managing Your Wishlist:
Review periodically to:
• Remove items you've acquired elsewhere
• Update priorities based on changing interests
• Adjust max prices based on market changes

Your wishlist is private and only visible to you.`
      },
      {
        title: "Wishlist Notifications",
        text: `The real power of the wishlist is automatic notifications when wanted records become available:

How It Works:
When a distributor adds a record to their inventory, the system checks against all wishlists. If there's a match, the wishlist owner receives a notification.

Notification Contents:
• Record title and artist
• Distributor offering it
• Price
• Condition
• Link to view and purchase

You'll Be Notified Via:
• In-app notification (bell icon)
• Email (if enabled in your settings)

Acting on Notifications:
Wishlist items can sell quickly, especially rare records. When you get a notification:
1. Click through to view the record
2. Verify it's the pressing/edition you want
3. Add to cart and checkout promptly

This feature helps you find records without constant manual searching.`
      }
    ]
  },
  {
    id: "favorites",
    title: "Favorites",
    icon: Heart,
    badge: "Collectors",
    description: "Bookmark records from catalogs for later.",
    content: [
      {
        title: "Using Favorites",
        text: `Favorites are bookmarks for records you're interested in but not ready to purchase immediately:

Adding Favorites:
While browsing any distributor's catalog, click the heart icon on any record to add it to your favorites.

Why Use Favorites:
• Save records to consider later
• Track price changes on items you're interested in
• Create a shopping list for your next order
• Remember records you've seen but need to research

Favorites vs. Wishlist:
• Favorites are for specific records already in a catalog
• Wishlist is for any record you're seeking, regardless of availability

Your favorites are private - distributors can't see who has favorited their records.`
      },
      {
        title: "Managing Your Favorites",
        text: `The Favorites page shows all records you've bookmarked:

View Options:
• List view - Compact, scannable format
• Grid view - Shows album covers prominently

For Each Favorite:
• Current price (updates if the distributor changes it)
• Stock status
• Distributor name
• Quick "Add to Cart" button

Filtering:
• By distributor
• By price range
• By availability

Actions:
• Add to cart directly from favorites
• Remove from favorites
• Move to wishlist (if removed from catalog)

Consider reviewing favorites before making purchases - you might have saved something you'd forgotten about.`
      }
    ]
  },
  {
    id: "discogs",
    title: "Discogs Integration",
    icon: Disc3,
    description: "Leverage the Discogs database for record information.",
    content: [
      {
        title: "How Discogs Integration Works",
        text: `Vinylogix integrates with Discogs, the largest music database, to streamline record cataloging:

What We Get From Discogs:
When you scan a barcode or search, we retrieve:
• Cover art
• Artist name
• Album title
• Record label
• Release year and date
• Tracklist
• Genre and style tags
• Country of origin
• Format details

This saves enormous time compared to manual entry and ensures consistent, accurate catalog data.

Discogs ID:
Each record from Discogs has a unique ID. We store this to:
• Link to the correct Discogs page
• Ensure accurate matching for future lookups
• Enable market price estimates`
      },
      {
        title: "Important Notes About Discogs",
        text: `While Discogs integration is powerful, there are some important things to understand:

Your Data is Separate:
Vinylogix inventory is completely independent from any Discogs Marketplace listings you may have. We use Discogs as a data source, not as a sales platform.

You don't need a Discogs account to use Vinylogix, though having one can be helpful for research.

Pricing is Independent:
Your selling prices in Vinylogix are yours to set. We don't sync prices with Discogs Marketplace. You can price based on your own strategy.

Cover Images:
We fetch cover images from Discogs for display. These are used under their terms of service for catalog purposes.

Data Accuracy:
Discogs is community-maintained. Occasionally there may be errors or missing information. Always verify critical details for valuable records.

Not Found on Discogs:
Very rare, very new, or very obscure releases might not be in Discogs yet. In these cases, use manual entry.`
      }
    ]
  },
  {
    id: "shipping",
    title: "Shipping",
    icon: Truck,
    description: "Configure shipping options and rates.",
    content: [
      {
        title: "Setting Up Shipping Methods",
        text: `Vinylogix supports flexible shipping configuration to match your business model:

Shipping Methods:
Create different methods for different needs:
• Standard - Regular mail/courier, lower cost
• Express - Faster delivery, higher cost
• Local Pickup - No shipping cost, customer collects

For Each Method, Configure:
• Name (what customers see)
• Description
• Price (flat rate or calculated)
• Estimated delivery time
• Geographic availability

Rate Calculation Options:
• Flat rate - Same price regardless of order
• Per-item - Price multiplied by number of records
• Weight-based - Uses the weight you've set on each record
• Tiered - Different rates based on order total

Geographic Zones:
Set different rates for:
• Domestic shipping
• European Union
• International

This allows realistic pricing based on actual shipping costs.`
      },
      {
        title: "Shipping Workflow and Tracking",
        text: `When an order is ready to ship:

1. Package the Records
Use appropriate mailers to protect vinyl during transit.

2. Create Shipping Label
If using integrated shipping, generate the label directly from the order page. Otherwise, use your carrier's system.

3. Add Tracking Number
Enter the tracking number in the order. This is crucial for customer communication.

4. Mark as Shipped
Update the order status. The customer receives notification with tracking info.

Tracking Updates:
If using integrated carriers, tracking status updates automatically. Customers can follow their package without contacting you.

Carrier Integrations:
Vinylogix can integrate with major carriers for label printing and tracking. Check Settings > Shipping for available options.

Tips for Vinyl Shipping:
• Use record mailers, not padded envelopes
• Add stiffeners for single records
• Mark packages "Do Not Bend"
• Consider insurance for valuable items
• Ship quickly - vinyl can be affected by temperature extremes`
      }
    ]
  },
  {
    id: "payments",
    title: "Payments",
    icon: CreditCard,
    description: "Payment processing and financial settings.",
    content: [
      {
        title: "Stripe Connect Setup",
        text: `Stripe Connect is our primary payment processing solution, enabling you to accept card payments directly:

Setting Up Stripe:
1. Go to Settings > Payment Providers
2. Click "Connect with Stripe"
3. You'll be redirected to Stripe's onboarding
4. Fill in your business details
5. Provide bank account information
6. Complete identity verification
7. Return to Vinylogix

The process takes about 5-10 minutes. You'll need:
• Business information (or personal if sole proprietor)
• Bank account details for payouts
• ID verification (passport, driver's license, etc.)

How Payments Flow:
1. Customer pays at checkout
2. Stripe processes the payment
3. Funds go to your Stripe account (minus fees)
4. You receive payouts to your bank on your schedule

Stripe Dashboard:
You maintain full access to your Stripe dashboard for detailed transaction history, payout schedules, and account management.`
      },
      {
        title: "Understanding Fees",
        text: `There are two types of fees on transactions:

Vinylogix Platform Fee: 4%
This fee is calculated on the item subtotal (not shipping). It covers platform development, maintenance, and support.

Example: €100 in records = €4 platform fee

Payment Processing Fee (Stripe):
Stripe charges approximately 1.5% + €0.25 per transaction for European cards. Rates may vary by card type and region.

Example on a €115 order (€100 items + €15 shipping):
• Stripe fee: €1.98 (1.5% of €115 + €0.25)
• Vinylogix fee: €4.00 (4% of €100)
• Total fees: €5.98
• You receive: €109.02

Fee Visibility:
You can see fee breakdowns in:
• Individual order details
• Analytics > Financial reports
• Your Stripe dashboard

Fees are automatically deducted - you receive the net amount.`
      },
      {
        title: "Payouts and Financial Management",
        text: `Stripe handles getting money from your sales into your bank account:

Payout Schedule:
Configure in your Stripe dashboard. Common options:
• Daily - Every business day
• Weekly - Once per week
• Monthly - Once per month

Faster payouts are available in some regions for a small fee.

Payout Timing:
After a payment is processed, funds are typically available for payout after 2-7 days depending on your region and account history. New accounts may have longer initial holding periods.

In Vinylogix:
Track your financial position:
• Pending balance (processed but not yet paid out)
• Available balance (ready for payout)
• Recent payouts

Reconciliation:
Match your bank deposits to Vinylogix orders using:
• Payout reference numbers
• Date and amount matching
• Detailed Stripe reports

For accounting purposes, both Vinylogix and Stripe provide exportable transaction histories.`
      }
    ]
  },
  {
    id: "settings",
    title: "Settings",
    icon: Settings,
    description: "Configure your account and preferences.",
    content: [
      {
        title: "Profile Settings",
        text: `Your profile contains information about you and your business:

Personal Information:
• First and last name
• Email address (used for login)
• Phone number

Business Information:
• Company/store name
• Business address
• Tax ID/VAT number (if applicable)
• Logo upload

This information is used for:
• Invoice generation
• Client communications
• Legal compliance
• Your public catalog header

Keeping this updated ensures professional communications and proper documentation.`
      },
      {
        title: "Notification Settings",
        text: `Control what notifications you receive and how:

Notification Types:
• New orders - When a client places an order
• Order updates - Status changes on existing orders
• Low stock alerts - When items reach reorder threshold
• Client activity - New registrations, significant actions
• System updates - Platform news and maintenance notices

Delivery Methods:
For each notification type, choose:
• In-app only (bell icon notifications)
• Email
• Both
• None

Email Frequency:
• Instant - Each notification sends immediately
• Daily digest - Summary email once per day
• Weekly digest - Summary email once per week

Finding the right balance prevents notification fatigue while keeping you informed of important events.`
      },
      {
        title: "Theme and Display",
        text: `Customize how Vinylogix looks for you:

Theme Options:
• Light - Bright background, dark text. Good for well-lit environments.
• Dark - Dark background, light text. Easier on eyes in low light.
• Black - True black background. Best for OLED screens, maximum contrast.

Your theme preference is saved to your account and applies across all devices.

Language:
Select your preferred language for the interface.

Display Density:
Some views offer compact vs. comfortable spacing options.

Currency:
Set your display currency for prices. Note: This affects display only - actual pricing is set per record.

These settings are personal - they don't affect what your clients see.`
      },
      {
        title: "Workers and Permissions",
        text: `Masters can create Worker accounts for staff:

Creating a Worker:
1. Go to Settings > Team
2. Click "Invite Worker"
3. Enter their email address
4. Set their permissions
5. Send invitation

Permission Options:
• Can view purchasing prices - See what you paid for records
• Can edit purchasing prices - Change purchasing prices
• Can view selling prices - See retail prices
• Can edit selling prices - Change retail prices
• Can manage suppliers - Add/edit supplier list
• Can manage locations - Create new stock locations
• Can process orders - View and update order status
• Can manage clients - View client list and details

Start with minimal permissions and add as trust develops. You can modify permissions at any time.

Managing Workers:
• View login activity
• Temporarily suspend access
• Remove from account
• Reset their password`
      }
    ]
  },
  {
    id: "branding",
    title: "Branding",
    icon: Palette,
    badge: "Master",
    description: "Customize the look and feel for your clients.",
    content: [
      {
        title: "Custom Branding Options",
        text: `Make Vinylogix feel like your own platform:

Your Logo:
Upload your business logo. It appears:
• In the client portal header
• On invoices and receipts
• In email communications

Recommended format: PNG with transparent background, at least 400px wide.

Business Name:
Your store name appears prominently in the client portal.

Color Accent (if available):
Some elements can be tinted to match your brand colors.

Branding helps clients feel they're interacting with your business, not a generic platform.`
      },
      {
        title: "Client Portal Configuration",
        text: `Control what features are available in your client portal:

Feature Toggles:
Enable or disable for your clients:
• Collection management - Can clients track their own collections?
• Wishlist - Can clients maintain wishlists?
• Discogs links - Show links to Discogs pages?
• Price visibility - Show prices on out-of-stock items?

Communication Settings:
• Welcome message for new clients
• Footer text on client portal
• Support contact information

These settings let you tailor the client experience to your business model. A minimal portal might just offer browsing and purchasing, while a full-featured portal offers collection management and wishlists.`
      }
    ]
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: Bell,
    description: "Stay updated with real-time alerts.",
    content: [
      {
        title: "Notification Center",
        text: `The notification center keeps you informed of important events:

Accessing Notifications:
Click the bell icon in the header to see recent notifications. A badge shows unread count.

Notification Contents:
Each notification includes:
• What happened
• When it happened
• Link to relevant page
• Action buttons (if applicable)

Notification History:
Scroll through past notifications to review activity. Mark individual notifications as read, or use "Mark All Read" to clear the badge.

Real-Time Updates:
New notifications appear instantly without refreshing the page. You'll hear a subtle sound (if enabled) for important alerts.`
      },
      {
        title: "Types of Notifications",
        text: `You'll receive notifications for various events:

Order Notifications:
• New order placed - A client has purchased
• Payment received - Confirmation of payment
• Refund requested - Customer has asked for refund
• Order shipped - Confirmation of shipment

Inventory Notifications:
• Low stock alert - Item below threshold
• Out of stock - Item has sold out

Client Notifications:
• New client registered - Someone accepted your invitation
• Wishlist match - A client wants something you have

System Notifications:
• Platform updates - New features or changes
• Maintenance notices - Scheduled downtime
• Security alerts - Important account notifications

Priority Levels:
Some notifications are flagged as high priority (new orders, payment issues) and are styled to stand out.`
      }
    ]
  }
];

export default function ManualPage() {
  const [searchTerm, setSearchTerm] = useState("");

  const filteredSections = manualSections.filter(section => {
    const searchLower = searchTerm.toLowerCase();
    return (
      section.title.toLowerCase().includes(searchLower) ||
      section.description.toLowerCase().includes(searchLower) ||
      section.content.some(
        c => c.title.toLowerCase().includes(searchLower) || c.text.toLowerCase().includes(searchLower)
      )
    );
  });

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">User Manual</h1>
        <p className="text-muted-foreground mt-2">
          Complete guide to using Vinylogix. Search or browse the sections below to learn about every feature.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search the manual..."
          className="pl-10 h-12"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Quick Links */}
      {!searchTerm && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Quick Links</h2>
          <div className="flex flex-wrap gap-2">
            {manualSections.slice(0, 8).map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 text-sm transition-colors"
              >
                <section.icon className="h-4 w-4" />
                {section.title}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Manual Sections */}
      <div className="space-y-6">
        {filteredSections.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results found</h3>
              <p className="text-muted-foreground">
                Try different keywords or browse all sections below.
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredSections.map((section) => (
            <Card key={section.id} id={section.id} className="scroll-mt-20">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2.5">
                    <section.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-xl">{section.title}</CardTitle>
                      {section.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {section.badge}
                        </Badge>
                      )}
                    </div>
                    <CardDescription className="mt-1">{section.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="w-full">
                  {section.content.map((item, index) => (
                    <AccordionItem key={index} value={`${section.id}-${index}`}>
                      <AccordionTrigger className="text-left hover:no-underline font-medium">
                        {item.title}
                      </AccordionTrigger>
                      <AccordionContent className="text-muted-foreground whitespace-pre-line leading-relaxed">
                        {item.text}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Footer Help */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>Can&apos;t find what you&apos;re looking for?</p>
        <p className="mt-1">
          Visit our{" "}
          <a href="/help" className="text-primary hover:underline">
            Help Center & FAQ
          </a>{" "}
          or{" "}
          <a href="/contact" className="text-primary hover:underline">
            contact support
          </a>
          .
        </p>
      </div>
    </div>
  );
}
