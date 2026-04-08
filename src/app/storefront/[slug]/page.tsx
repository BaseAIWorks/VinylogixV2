import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAdminDb } from "@/lib/firebase-admin";
import StorefrontHeader from "@/components/storefront/storefront-header";
import StorefrontCatalog from "@/components/storefront/storefront-catalog";
import StorefrontGate from "./storefront-gate";

interface StorefrontPageProps {
  params: Promise<{ slug: string }>;
}

// Cached per-request so generateMetadata and StorefrontPage share one Firestore read
const getDistributorBySlug = cache(async (slug: string) => {
  const adminDb = getAdminDb();
  if (!adminDb) return null;

  const snapshot = await adminDb
    .collection("distributors")
    .where("slug", "==", slug)
    .limit(1)
    .get();

  if (snapshot.empty) return null;

  const doc = snapshot.docs[0];
  const data = doc.data();

  return {
    id: doc.id,
    name: data.name as string,
    companyName: data.companyName as string | undefined,
    logoUrl: data.logoUrl as string | undefined,
    slug: data.slug as string,
    visibility: (data.visibility || "private") as "open" | "private" | "invite_only",
    storefrontSettings: data.storefrontSettings || undefined,
    cardDisplaySettings: data.cardDisplaySettings || undefined,
  };
});

async function getInitialCatalog(distributorId: string, limit = 25) {
  const adminDb = getAdminDb();
  if (!adminDb) return { records: [], hasMore: false, nextCursor: null };

  const snapshot = await adminDb
    .collection("vinylRecords")
    .where("distributorId", "==", distributorId)
    .where("isInventoryItem", "==", true)
    .orderBy("added_at", "desc")
    .limit(limit + 1)
    .get();

  const hasMore = snapshot.docs.length > limit;
  const docs = snapshot.docs.slice(0, limit);

  const records = docs.map((doc) => {
    const d = doc.data();
    const totalStock = (d.stock_shelves || 0) + (d.stock_storage || 0);
    let stockStatus: "in_stock" | "low_stock" | "out_of_stock" = "in_stock";
    if (totalStock === 0) stockStatus = "out_of_stock";
    else if (totalStock <= 3) stockStatus = "low_stock";

    return {
      id: doc.id,
      title: d.title,
      artist: d.artist,
      year: d.year,
      genre: d.genre,
      style: d.style,
      format: d.format,
      formatDetails: d.formatDetails,
      country: d.country,
      media_condition: d.media_condition,
      sleeve_condition: d.sleeve_condition,
      cover_url: d.cover_url,
      label: d.label,
      stockStatus,
      // No prices in server-rendered initial load (anonymous)
    };
  });

  const nextCursor = hasMore && docs.length > 0 ? docs[docs.length - 1].id : null;

  return { records, hasMore, nextCursor };
}

export async function generateMetadata({ params }: StorefrontPageProps): Promise<Metadata> {
  const { slug } = await params;
  const distributor = await getDistributorBySlug(slug);

  if (!distributor) {
    return { title: "Not Found" };
  }

  const displayName = distributor.companyName || distributor.name;
  return {
    title: `${displayName} | Vinylogix`,
    description: distributor.storefrontSettings?.description ||
      `Browse the vinyl record catalog of ${displayName}`,
    openGraph: {
      title: `${displayName} - Vinyl Record Catalog`,
      description: distributor.storefrontSettings?.description ||
        `Browse the vinyl record catalog of ${displayName}`,
      ...(distributor.logoUrl && { images: [distributor.logoUrl] }),
    },
  };
}

export default async function StorefrontPage({ params }: StorefrontPageProps) {
  const { slug } = await params;
  const distributor = await getDistributorBySlug(slug);

  if (!distributor) {
    notFound();
  }

  // For open storefronts, pre-fetch the initial catalog server-side
  let initialCatalog = { records: [] as any[], hasMore: false, nextCursor: null as string | null };
  if (distributor.visibility === "open") {
    initialCatalog = await getInitialCatalog(distributor.id);
  }

  return (
    <>
      <StorefrontHeader
        name={distributor.name}
        slug={slug}
        companyName={distributor.companyName}
        logoUrl={distributor.logoUrl}
        headline={distributor.storefrontSettings?.headline}
        description={distributor.storefrontSettings?.description}
      />
      <StorefrontGate
        visibility={distributor.visibility}
        slug={slug}
        distributorId={distributor.id}
      >
        <StorefrontCatalog
          distributorId={distributor.id}
          slug={slug}
          storefrontSettings={distributor.storefrontSettings}
          cardDisplaySettings={distributor.cardDisplaySettings}
          initialRecords={initialCatalog.records}
          initialHasMore={initialCatalog.hasMore}
          initialNextCursor={initialCatalog.nextCursor}
        />
      </StorefrontGate>
    </>
  );
}
