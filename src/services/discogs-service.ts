
import type { VinylRecord, DiscogsReleaseApiResponse, DiscogsReleaseSearchResult, DiscogsFormat, Track, DiscogsMarketplaceStats } from '@/types';

const DISCOGS_API_BASE_URL = 'https://api.discogs.com';
const USER_AGENT = 'VinylogixApp/1.0'; 
const DISCOGS_TOKEN = process.env.NEXT_PUBLIC_DISCOGS_API_TOKEN;

interface RequestOptions {
  method?: string;
  headers: HeadersInit;
}

const getRequestOptions = (): RequestOptions => {
  const headers: HeadersInit = { 'User-Agent': USER_AGENT };
  if (DISCOGS_TOKEN && DISCOGS_TOKEN !== "YOUR_DISCOGS_TOKEN_HERE") {
    headers['Authorization'] = `Discogs token=${DISCOGS_TOKEN}`;
  }
  return { headers };
};

function mapDiscogsReleaseToVinylRecord(release: DiscogsReleaseApiResponse): Partial<VinylRecord> {
  let formatDetailsString;
  if (release.formats && release.formats.length > 0) {
    const primaryFormat = release.formats[0]; // Assuming the first format is most relevant
    const segments: string[] = [];

    // Part 1: Quantity and Name (e.g., "2 x Vinyl")
    if (primaryFormat.name) {
        if (primaryFormat.qty && parseInt(primaryFormat.qty, 10) > 1) {
            segments.push(`${primaryFormat.qty} x ${primaryFormat.name}`);
        } else {
            segments.push(primaryFormat.name);
        }
    }

    // Part 2: Descriptions (e.g., "LP", "Album", "Reissue")
    if (primaryFormat.descriptions && primaryFormat.descriptions.length > 0) {
        segments.push(...primaryFormat.descriptions);
    }

    // Part 3: Free text (if any and not redundant)
    if (primaryFormat.text) {
        // A simple check to avoid adding text if it's likely part of the descriptions or name already.
        const lowerCaseSegmentsString = segments.join(' ').toLowerCase();
        const lowerCaseText = primaryFormat.text.toLowerCase();
        let isRedundant = false;
        for (const segment of segments) {
            if (segment.toLowerCase().includes(lowerCaseText)) {
                isRedundant = true;
                break;
            }
        }
        if (!isRedundant) {
             segments.push(primaryFormat.text);
        }
    }
    formatDetailsString = segments.filter(s => s && s.trim() !== "").join(', ');
  }

  // More robust barcode finding
  const barcodeIdentifier = release.identifiers?.find(id => id.type.toLowerCase() === 'barcode');

  return {
    title: release.title,
    artist: release.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
    label: release.labels?.length ? release.labels[0].name : undefined,
    year: release.year,
    releasedDate: release.released,
    genre: release.genres,
    style: release.styles,
    country: release.country,
    formatDetails: formatDetailsString,
    cover_url: release.images?.find(img => img.type === 'primary')?.uri || release.images?.[0]?.uri || release.thumb,
    discogs_id: release.id,
    barcode: barcodeIdentifier?.value ? barcodeIdentifier.value.replace(/[\s-]/g, '') : undefined,
    dataAiHint: "album cover",
    tracklist: release.tracklist,
    discogsCommunity: release.community ? {
        have: release.community.have,
        want: release.community.want,
        rating: release.community.rating,
    } : undefined,
    // Note: Weight is not reliably available from Discogs API main release endpoint
  };
}

async function handleDiscogsError(response: Response, context: string): Promise<never> {
    const errorBody = await response.text();
    console.error(`Discogs API error (${context}): ${response.status} ${response.statusText}`, errorBody);
    let message: string;
    switch(response.status) {
        case 401: message = "Discogs API authentication failed. Your token is likely invalid or expired."; break;
        case 403: message = "Access denied by Discogs. This usually means your API token is invalid/missing OR the user's collection is private. Please double-check your .env.local file and the user's privacy settings on Discogs. Also, ensure your server has been restarted after changing the .env.local file."; break;
        case 404: message = "The requested resource was not found on Discogs."; break;
        case 429: message = "Discogs API rate limit exceeded. Please wait a few minutes before trying again."; break;
        default: message = `Discogs API returned status ${response.status}. Check console for details.`;
    }
    throw new Error(message);
}

export async function searchDiscogsByBarcode(barcode: string, distributorId?: string): Promise<DiscogsReleaseSearchResult[] | null> {
  const normalizedBarcode = barcode.replace(/[\s-]/g, '');
  const url = `${DISCOGS_API_BASE_URL}/database/search?barcode=${encodeURIComponent(normalizedBarcode)}&type=release`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
      await handleDiscogsError(response, `barcode search for ${normalizedBarcode}`);
    }
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results as DiscogsReleaseSearchResult[];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Discogs data for barcode ${normalizedBarcode}:`, error);
    throw error;
  }
}

export async function searchDiscogsByArtistTitle(artist: string, title: string, distributorId?: string): Promise<DiscogsReleaseSearchResult[] | null> {
  const url = `${DISCOGS_API_BASE_URL}/database/search?type=release&artist=${encodeURIComponent(artist)}&release_title=${encodeURIComponent(title)}`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
      await handleDiscogsError(response, `text search for ${artist} - ${title}`);
    }
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return data.results as DiscogsReleaseSearchResult[];
    }
    return null;
  } catch (error) {
    console.error(`Error fetching Discogs data for ${artist} - ${title}:`, error);
    throw error;
  }
}

export async function getDiscogsReleaseDetailsById(discogsId: string, distributorId?: string): Promise<Partial<VinylRecord> | null> {
  if (!discogsId || isNaN(parseInt(discogsId, 10))) {
    console.error("Invalid Discogs ID provided:", discogsId);
    return null;
  }
  
  const url = `${DISCOGS_API_BASE_URL}/releases/${discogsId}`;
  
  const response = await fetch(url, getRequestOptions());
  
  if (!response.ok) {
    await handleDiscogsError(response, `release details for ID ${discogsId}`);
  }
  const data: DiscogsReleaseApiResponse = await response.json();
  const mappedData = mapDiscogsReleaseToVinylRecord(data);

  return mappedData;
}


export async function getDiscogsMarketplaceStats(releaseId: string, distributorId?: string): Promise<DiscogsMarketplaceStats | null> {
  const url = `${DISCOGS_API_BASE_URL}/marketplace/stats/${releaseId}`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
        if (response.status === 404) {
            console.log(`No marketplace stats found for release ${releaseId}.`);
            return null;
        }
        await handleDiscogsError(response, `marketplace stats for ID ${releaseId}`);
    }
    const data: DiscogsMarketplaceStats = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Discogs marketplace stats for ID ${releaseId}:`, error);
    throw error;
  }
}
