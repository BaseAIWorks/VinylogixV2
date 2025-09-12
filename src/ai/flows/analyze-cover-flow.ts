'use server';
/**
 * @fileOverview An AI flow to analyze an album cover image and identify the artist and title.
 *
 * - analyzeCover - A function that takes an image and returns the artist and title.
 * - AnalyzeCoverInput - The input type for the function.
 * - AnalyzeCoverOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AnalyzeCoverInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo of a vinyl record cover, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  distributorId: z.string().optional().describe('The ID of the distributor making the request for logging purposes.'),
});
export type AnalyzeCoverInput = z.infer<typeof AnalyzeCoverInputSchema>;

const AnalyzeCoverOutputSchema = z.object({
  artist: z.string().describe('The name of the primary musical artist identified from the cover.'),
  title: z.string().describe('The title of the album identified from the cover.'),
});
export type AnalyzeCoverOutput = z.infer<typeof AnalyzeCoverOutputSchema>;

export async function analyzeCover(input: AnalyzeCoverInput): Promise<AnalyzeCoverOutput> {
  return analyzeCoverFlow(input);
}

const prompt = ai.definePrompt({
  name: 'analyzeCoverPrompt',
  input: {schema: AnalyzeCoverInputSchema},
  output: {schema: AnalyzeCoverOutputSchema},
  prompt: `You are an expert music archivist specializing in identifying vinyl records from their cover art.
Given an image of an album cover, identify the primary artist and the album title.

- Return ONLY the artist and title.
- If you cannot confidently identify the artist or title, return an empty string for that field.

Photo: {{media url=photoDataUri}}`,
});

const analyzeCoverFlow = ai.defineFlow(
  {
    name: 'analyzeCoverFlow',
    inputSchema: AnalyzeCoverInputSchema,
    outputSchema: AnalyzeCoverOutputSchema,
  },
  async (input) => {
    // Note: We are not logging this specific AI call to avoid double-counting if the user proceeds
    // to generate full record info, but you could add logApiCall('gemini', input.distributorId) here if desired.
    const {output} = await prompt(input);
    if (!output) {
      throw new Error("Failed to get a response from the language model for cover analysis.");
    }
    return output;
  }
);
