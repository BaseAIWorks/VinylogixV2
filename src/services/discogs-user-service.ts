
"use client";

import type { DiscogsCollectionResponse, DiscogsWantlistResponse, DiscogsInventoryResponse, DiscogsListing } from '@/types';

const DISCOGS_API_BASE_URL = 'https://api.discogs.com';
const DISCOGS_TOKEN = process.env.NEXT_PUBLIC_DISCOGS_API_TOKEN;

interface RequestOptions {
  method?: string;
  headers: HeadersInit;
}

export const getRequestOptions = (): RequestOptions => {
  const headers: HeadersInit = { 'User-Agent': 'Vinylogix/1.0' };
  if (DISCOGS_TOKEN && DISCOGS_TOKEN !== "YOUR_DISCOGS_TOKEN_HERE") {
    headers['Authorization'] = `Discogs token=${DISCOGS_TOKEN}`;
  }
  return { headers };
};

async function handleDiscogsError(response: Response, context: string): Promise<never> {
    const errorBody = await response.text();
    console.error(`Discogs API error (${context}): ${response.status} ${response.statusText}`, errorBody);
    let message: string;
    switch(response.status) {
        case 401: message = "Discogs API authentication failed. The provided token is likely invalid."; break;
        case 403: message = "Access denied by Discogs. This usually means your API token is invalid/missing OR the user's collection is private. Please double-check your .env.local file and the user's privacy settings on Discogs. Also, ensure your server has been restarted after changing the .env.local file."; break;
        case 404: message = "The requested resource (e.g., user or collection) was not found on Discogs."; break;
        case 429: message = "Discogs API rate limit exceeded. Please wait a few minutes before trying again."; break;
        default: message = `Discogs API returned status ${response.status}. Please check console for details.`;
    }
    throw new Error(message);
}


export async function verifyDiscogsUser(username: string, distributorId?: string): Promise<{id: number; resource_url: string} | null> {
    const url = `${DISCOGS_API_BASE_URL}/users/${username}`;
    try {
        const response = await fetch(url, getRequestOptions());
        if (!response.ok) {
            if (response.status === 404) return null; // User not found is a valid, non-error outcome here.
            await handleDiscogsError(response, `verify user ${username}`);
        }
        const data = await response.json();
        return { id: data.id, resource_url: data.resource_url };
    } catch (error) {
        console.error(`Error verifying Discogs user ${username}:`, error);
        throw error;
    }
}


export async function getDiscogsCollectionPage(username: string, page: number = 1, distributorId?: string): Promise<DiscogsCollectionResponse> {
  const url = `${DISCOGS_API_BASE_URL}/users/${username}/collection/folders/0/releases?page=${page}&per_page=100`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
      await handleDiscogsError(response, `collection page ${page} for ${username}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Discogs collection for ${username}:`, error);
    throw error;
  }
}


export async function getDiscogsWantlistPage(username: string, page: number = 1, distributorId?: string): Promise<DiscogsWantlistResponse> {
  const url = `${DISCOGS_API_BASE_URL}/users/${username}/wants?page=${page}&per_page=100`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
       await handleDiscogsError(response, `wantlist page ${page} for ${username}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Discogs wantlist for ${username}:`, error);
    throw error;
  }
}

export async function getDiscogsInventoryPage(username: string, page: number = 1, distributorId?: string): Promise<DiscogsInventoryResponse> {
  const url = `${DISCOGS_API_BASE_URL}/users/${username}/inventory?page=${page}&per_page=100`;
  try {
    const response = await fetch(url, getRequestOptions());
    if (!response.ok) {
      await handleDiscogsError(response, `inventory page ${page} for ${username}`);
    }
    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching Discogs inventory for ${username}:`, error);
    throw error;
  }
}

export async function fetchAllDiscogsInventory(username: string, distributorId?: string): Promise<DiscogsListing[]> {
    let allListings: DiscogsListing[] = [];
    let page = 1;
    let totalPages = 1;

    do {
        try {
            const data = await getDiscogsInventoryPage(username, page, distributorId);
            if (data && data.listings) {
                allListings = [...allListings, ...data.listings];
            }
            if (data && data.pagination) {
                totalPages = data.pagination.pages;
            } else {
                break;
            }
            page++;
        } catch (error) {
            console.error(`Failed to fetch page ${page} of Discogs inventory for ${username}. Stopping fetch.`, error);
            break; // Stop fetching if a page fails
        }
    } while (page <= totalPages);
    
    return allListings;
};
