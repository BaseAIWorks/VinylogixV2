
"use client";

import { auth } from '@/lib/firebase';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
}

export async function inviteClient(email: string, distributorId: string, name?: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch('/api/clients/invite', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ email, distributorId, name }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'An unknown error occurred');
    }

    return result;
  } catch (error) {
    console.error("Error in inviteClient service:", error);
    throw error;
  }
}

export async function removeClientAccess(clientUid: string, distributorId: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch('/api/clients/remove', {
      method: 'POST',
      headers: await getAuthHeaders(),
      body: JSON.stringify({ clientUid, distributorId }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'An unknown error occurred');
    }

    return result;
  } catch (error) {
    console.error("Error in removeClientAccess service:", error);
    throw error;
  }
}
