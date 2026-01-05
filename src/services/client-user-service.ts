
"use client";

export async function inviteClient(email: string, distributorId: string, invitedBy: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch('/api/clients/invite', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, distributorId, invitedBy }),
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

export async function removeClientAccess(clientUid: string, distributorId: string, requestedBy: string): Promise<{ success: boolean, message: string }> {
  try {
    const response = await fetch('/api/clients/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ clientUid, distributorId, requestedBy }),
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
