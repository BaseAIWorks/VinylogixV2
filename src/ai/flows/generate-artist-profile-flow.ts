
'use server';

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateArtistProfileInputSchema = z.object({
  artist: z.string().describe('The name of the musical artist.'),
  genres: z.array(z.string()).describe('Known genres of the artist from their catalog.'),
  inventoryArtists: z.array(z.string()).describe('List of all artist names available in the inventory for related artist matching.'),
});
export type GenerateArtistProfileInput = z.infer<typeof GenerateArtistProfileInputSchema>;

const GenerateArtistProfileOutputSchema = z.object({
  activeYears: z.string().describe('The period the artist was/is active, e.g. "1962–present" or "1975–1995".'),
  origin: z.string().describe('City and country of origin, e.g. "Liverpool, United Kingdom".'),
  funFact: z.string().describe('One interesting, lesser-known fact about the artist. Keep it to 1-2 sentences.'),
  relatedArtists: z.array(z.string()).describe('Up to 5 similar/related artists. ONLY include names that appear in the inventoryArtists list. If none match, return an empty array.'),
});
export type GenerateArtistProfileOutput = z.infer<typeof GenerateArtistProfileOutputSchema>;

export async function generateArtistProfile(input: GenerateArtistProfileInput): Promise<GenerateArtistProfileOutput> {
  return generateArtistProfileFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateArtistProfilePrompt',
  input: { schema: GenerateArtistProfileInputSchema },
  output: { schema: GenerateArtistProfileOutputSchema },
  prompt: `You are a music historian and encyclopedia. Given an artist name and their known genres, provide factual metadata.

Artist: {{{artist}}}
Known Genres: {{#each genres}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Available artists in the inventory (ONLY suggest related artists from this exact list):
{{#each inventoryArtists}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Provide:
1. Active years (e.g., "1962–present" or "1975–1995")
2. Origin city and country (e.g., "Liverpool, United Kingdom")
3. One lesser-known fun fact (1-2 sentences)
4. Up to 5 related/similar artists — ONLY include names that appear EXACTLY in the inventory list above. If no matches, return empty array.
`,
});

const generateArtistProfileFlow = ai.defineFlow(
  {
    name: 'generateArtistProfileFlow',
    inputSchema: GenerateArtistProfileInputSchema,
    outputSchema: GenerateArtistProfileOutputSchema,
  },
  async (input) => {
    const { output } = await prompt(input);
    if (!output) {
      throw new Error("Failed to generate artist profile.");
    }
    return output;
  }
);
