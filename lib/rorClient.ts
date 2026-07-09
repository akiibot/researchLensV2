/**
 * @file ROR API Client
 *
 * Looks up normalized institution metadata from the Research Organization Registry.
 * Use this for affiliation cleanup and country matching in faculty workflows.
 */

import axios from 'axios';

const ROR_BASE = 'https://api.ror.org/v2/organizations';

export interface RorOrganization {
  id: string;
  name: string;
  country: string | null;
  website: string | null;
  types: string[];
}

export async function searchRorOrganizations(query: string): Promise<RorOrganization[]> {
  try {
    const response = await axios.get(ROR_BASE, {
      params: {
        query,
        page: 1,
      },
      timeout: 10000,
    });

    const items = response.data?.items;
    if (!Array.isArray(items)) return [];

    return items.slice(0, 5).map((item): RorOrganization => {
      const name = item.names?.find((entry: { types?: string[]; value?: string }) =>
        entry.types?.includes('ror_display')
      )?.value;
      const country = item.locations?.[0]?.geonames_details?.country_name || null;

      return {
        id: String(item.id || ''),
        name: String(name || item.names?.[0]?.value || ''),
        country,
        website: item.links?.find((link: { type?: string; value?: string }) => link.type === 'website')?.value || null,
        types: Array.isArray(item.types) ? item.types.map(String) : [],
      };
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.warn(`ROR lookup failed for "${query}":`, error.response?.status, error.message);
    } else {
      console.warn(`ROR lookup failed for "${query}":`, error);
    }
    return [];
  }
}
