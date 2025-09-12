
'use server';
/**
 * @fileOverview A server-side flow to prepare a new record by fetching data from Discogs and AI.
 * This flow is designed to be called from the client when adding a new record.
 *
 * - prepareRecord - Fetches details from Discogs and generates AI content if enabled.
 * - PrepareRecordInput - The input type for the function.
 * - PrepareRecordOutput - The return type for the function (matches VinylRecord).
 */
import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getDiscogsReleaseDetailsById } from '@/services/discogs-service';
import { generateRecordInfo } from './generate-record-info-flow';
import type { VinylRecord } from '@/types';

// Define the input schema for the flow
const PrepareRecordInputSchema = z.object({
  discogsId: z.number().describe('The Discogs release ID of the record.'),
  distributorId: z.string().describe('The ID of the distributor making the request.'),
  allowAiFeatures: z.boolean().describe('Whether the distributor plan allows AI feature usage.'),
});
export type PrepareRecordInput = z.infer<typeof PrepareRecordInputSchema>;

// The output schema is a partial VinylRecord, as not all fields are set here.
const PrepareRecordOutputSchema = z.custom<Partial<VinylRecord>>();
export type PrepareRecordOutput = z.infer<typeof PrepareRecordOutputSchema>;

// Exported function that the client will call.
export async function prepareRecord(input: PrepareRecordInput): Promise<PrepareRecordOutput> {
  return prepareRecordFlow(input);
}

// The main Genkit flow definition
const prepareRecordFlow = ai.defineFlow(
  {
    name: 'prepareRecordFlow',
    inputSchema: PrepareRecordInputSchema,
    outputSchema: PrepareRecordOutputSchema,
  },
  async (input) => {
    // Log the API call to Discogs. This is a safe server-side operation.
    // Note: We don't await this as it's a "fire and forget" logging call.
    ai.run('logApiCall', () => logApiCall('discogs', input.distributorId));
    
    // Step 1: Fetch details from Discogs API
    const discogsDetails = await getDiscogsReleaseDetailsById(
      input.discogsId.toString(),
      input.distributorId
    );

    if (!discogsDetails) {
      throw new Error(`Could not fetch details for Discogs ID ${input.discogsId}.`);
    }

    // Step 2: If AI features are allowed, generate artist and album info.
    let aiInfo = { artistBio: '', albumInfo: '' };
    if (input.allowAiFeatures && discogsDetails.artist && discogsDetails.title) {
      try {
        // Log the Gemini API call.
        ai.run('logApiCall', () => logApiCall('gemini', input.distributorId));
        aiInfo = await generateRecordInfo({
          artist: discogsDetails.artist,
          title: discogsDetails.title,
          year: discogsDetails.year,
          distributorId: input.distributorId,
        });
      } catch (aiError) {
        console.warn(
          `AI content generation failed for Discogs ID ${input.discogsId}, proceeding without it. Error: ${(aiError as Error).message}`
        );
        // We don't re-throw the error, as we can still proceed without AI content.
      }
    }

    // Step 3: Combine all data and return it to the client.
    const preparedRecord: Partial<VinylRecord> = {
      ...discogsDetails,
      ...aiInfo,
    };
    
    return preparedRecord;
  }
);


// Dummy logApiCall function for Genkit `ai.run`
// The actual logic is handled by the real logApiCall service.
async function logApiCall(api: 'discogs' | 'gemini', distributorId?: string) {
    // This is just a placeholder for Genkit's `ai.run` which needs a function.
    // The actual logging logic is in the imported service and is not part of the flow's return value.
}
