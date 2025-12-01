"use client";

import { getFunctions, httpsCallableFromURL } from "firebase/functions";
import { app, auth } from "@/lib/firebase";
import type { User } from "@/types";

// ⬅️ VUL HIER JE EIGEN URL IN (uit de getAllUsers function details)
const GET_ALL_USERS_URL =
  "https://getallusers-vutitwednq-ez.a.run.app";

export async function getAllUsers(): Promise<User[]> {
  try {
    // Zorg dat de ID-token (met custom claims) vers is
    if (auth.currentUser) {
      await auth.currentUser.getIdToken(true);
    }

    // Je mag hier 'europe-west4' laten staan, dat is prima
    const functions = getFunctions(app, "europe-west4");

    // Gebruik de volledige URL i.p.v. alleen de functienaam
    const callable = httpsCallableFromURL<unknown, User[]>(
      functions,
      GET_ALL_USERS_URL
    );

    const result = await callable();
    return result.data;
  } catch (error) {
    console.error(
      "UserService: Error calling getAllUsers Cloud Function:",
      error
    );
    throw new Error(
      `Failed to fetch users from the server: ${
        (error as Error).message || String(error)
      }`
    );
  }
}
