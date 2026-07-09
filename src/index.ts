#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const BASE_URL = 'https://data.police.uk/api';
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Perform a GET request against the police.uk API.
 *
 * `path` MUST already contain only trusted, URL-encoded segments (see the
 * `enc()` helper and the zod validation on each tool). On any non-2xx
 * response or network/timeout error this throws an Error with an
 * actionable message, so the calling tool handler surfaces `isError: true`.
 */
async function makeApiRequest(
  path: string,
  query?: Record<string, string | number | undefined>
): Promise<unknown> {
  const url = new URL(`${BASE_URL}/${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new Error(
        `Request to the police.uk API timed out after ${REQUEST_TIMEOUT_MS / 1000}s (${url.pathname}). ` +
          `Try a smaller area or a specific month (date=YYYY-MM).`
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Network error contacting the police.uk API (${url.pathname}): ${message}`);
  }

  if (!response.ok) {
    switch (response.status) {
      case 404:
        throw new Error(
          `No data found (HTTP 404). The police.uk API returns 404 when there are no results for the given ` +
            `parameters (for example no crimes/outcomes for that location or month), or when an id does not exist. ` +
            `Check the id and try a different date (YYYY-MM).`
        );
      case 429:
        throw new Error(
          `Rate limited (HTTP 429). Too many requests to the police.uk API. Wait a moment and retry.`
        );
      case 503:
        throw new Error(
          `Area too large (HTTP 503). The police.uk API refuses requests whose custom area or point contains more ` +
            `than 10,000 results. Use a smaller polygon/radius or narrow the request with a specific month (date=YYYY-MM).`
        );
      default: {
        let body = '';
        try {
          body = (await response.text()).slice(0, 300);
        } catch {
          /* ignore body read errors */
        }
        throw new Error(
          `The police.uk API returned HTTP ${response.status} ${response.statusText} for ${url.pathname}.` +
            (body ? ` Response: ${body}` : '')
        );
      }
    }
  }

  return response.json();
}

/** URL-encode a single path segment (validated ids are still encoded defensively). */
function enc(segment: string): string {
  return encodeURIComponent(segment);
}

/**
 * Serialize a tool result to text. Arrays longer than 1000 items are truncated
 * with a note. Small results (<50 array items, or any object) are pretty-printed;
 * larger results are compact to save tokens.
 */
function formatResult(result: unknown): string {
  let value = result;
  let note = '';
  if (Array.isArray(result) && result.length > 1000) {
    value = result.slice(0, 1000);
    note = `\n...truncated 1000 of ${result.length} items`;
  }
  const isSmall = Array.isArray(value) ? value.length < 50 : true;
  return JSON.stringify(value, null, isSmall ? 2 : 0) + note;
}

function textResult(result: unknown) {
  return { content: [{ type: 'text' as const, text: formatResult(result) }] };
}

// ---------------------------------------------------------------------------
// Reusable validators
// ---------------------------------------------------------------------------

const lat = z
  .number()
  .min(-90)
  .max(90)
  .describe('Latitude, between -90 and 90');
const lng = z
  .number()
  .min(-180)
  .max(180)
  .describe('Longitude, between -180 and 180');
const dateMonth = z
  .string()
  .regex(/^\d{4}-\d{2}$/, 'date must be in YYYY-MM format')
  .describe('Limit results to a specific month, formatted as YYYY-MM');
const forceId = z
  .string()
  .regex(/^[a-zA-Z0-9-]+$/, 'force id may only contain letters, digits and dashes')
  .describe('Police force identifier, e.g. "metropolitan" or "avon-and-somerset"');
const categoryId = z
  .string()
  .regex(/^[a-zA-Z0-9-]+$/, 'category may only contain letters, digits and dashes')
  .describe('Crime category slug, e.g. "all-crime" or "burglary"');
const neighbourhoodId = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, 'neighbourhood id may only contain letters, digits, dashes and underscores')
  .describe('Neighbourhood identifier within the force');
const persistentId = z
  .string()
  .regex(/^[a-fA-F0-9]{64}$/, 'persistent_id must be 64 hexadecimal characters')
  .describe('The 64-character hexadecimal unique identifier for the crime');
const poly = z
  .string()
  .describe('lat/lng pairs defining a polygon boundary, e.g. "52.2,0.1:52.3,0.2:52.1,0.15"');
const locationId = z.number().int().describe('The numeric ID of an anonymised location');

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: 'police-uk-api-tools',
  version: '1.1.0',
});

server.registerTool(
  'get_street_level_crimes',
  {
    description:
      'Retrieve street-level crimes at a point (lat/lng, 1-mile radius) or within a custom polygon area. Provide either lat AND lng, or poly.',
    inputSchema: {
      lat: lat.optional(),
      lng: lng.optional(),
      poly: poly.optional(),
      date: dateMonth.optional(),
      category: categoryId.default('all-crime'),
    },
    annotations: READ_ONLY,
  },
  async ({ lat, lng, poly, date, category }) => {
    const query: Record<string, string | number | undefined> = { date };
    if (lat !== undefined && lng !== undefined) {
      query.lat = lat;
      query.lng = lng;
    } else if (poly !== undefined) {
      query.poly = poly;
    } else {
      throw new Error('Provide either lat and lng, or poly, to locate the crimes.');
    }
    return textResult(await makeApiRequest(`crimes-street/${enc(category)}`, query));
  }
);

server.registerTool(
  'get_street_level_outcomes',
  {
    description:
      'Retrieve street-level outcomes by location ID, point (lat/lng), or custom polygon. Provide location_id, or lat AND lng, or poly.',
    inputSchema: {
      lat: lat.optional(),
      lng: lng.optional(),
      poly: poly.optional(),
      location_id: locationId.optional(),
      date: dateMonth.optional(),
    },
    annotations: READ_ONLY,
  },
  async ({ lat, lng, poly, location_id, date }) => {
    const query: Record<string, string | number | undefined> = { date };
    if (location_id !== undefined) {
      query.location_id = location_id;
    } else if (lat !== undefined && lng !== undefined) {
      query.lat = lat;
      query.lng = lng;
    } else if (poly !== undefined) {
      query.poly = poly;
    } else {
      throw new Error('Provide location_id, or lat and lng, or poly.');
    }
    return textResult(await makeApiRequest('outcomes-at-location', query));
  }
);

server.registerTool(
  'get_crimes_at_location',
  {
    description:
      'Retrieve crimes at a specific anonymised location by ID, or at the location nearest to a point (lat/lng). Provide location_id, or lat AND lng.',
    inputSchema: {
      lat: lat.optional(),
      lng: lng.optional(),
      location_id: locationId.optional(),
      date: dateMonth.optional(),
    },
    annotations: READ_ONLY,
  },
  async ({ lat, lng, location_id, date }) => {
    const query: Record<string, string | number | undefined> = { date };
    if (location_id !== undefined) {
      query.location_id = location_id;
    } else if (lat !== undefined && lng !== undefined) {
      query.lat = lat;
      query.lng = lng;
    } else {
      throw new Error('Provide location_id, or lat and lng.');
    }
    return textResult(await makeApiRequest('crimes-at-location', query));
  }
);

server.registerTool(
  'get_crimes_no_location',
  {
    description: 'Retrieve crimes for a force and category that could not be mapped to a location.',
    inputSchema: {
      category: categoryId.describe('Crime category slug, or "all-crime"'),
      force: forceId,
      date: dateMonth.optional(),
    },
    annotations: READ_ONLY,
  },
  async ({ category, force, date }) => {
    return textResult(await makeApiRequest('crimes-no-location', { category, force, date }));
  }
);

server.registerTool(
  'get_crime_categories',
  {
    description: 'Retrieve the valid crime categories for a given month.',
    inputSchema: { date: dateMonth.optional() },
    annotations: READ_ONLY,
  },
  async ({ date }) => {
    return textResult(await makeApiRequest('crime-categories', { date }));
  }
);

server.registerTool(
  'get_last_updated',
  {
    description: 'Retrieve the date when street-level crime data was last updated.',
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () => {
    return textResult(await makeApiRequest('crime-last-updated'));
  }
);

server.registerTool(
  'get_outcomes_for_crime',
  {
    description: 'Retrieve the outcomes (case history) for a specific crime by its persistent ID.',
    inputSchema: { persistent_id: persistentId },
    annotations: READ_ONLY,
  },
  async ({ persistent_id }) => {
    return textResult(await makeApiRequest(`outcomes-for-crime/${enc(persistent_id)}`));
  }
);

server.registerTool(
  'get_list_of_forces',
  {
    description: 'Retrieve a list of all police forces.',
    inputSchema: {},
    annotations: READ_ONLY,
  },
  async () => {
    return textResult(await makeApiRequest('forces'));
  }
);

server.registerTool(
  'get_force_details',
  {
    description: 'Retrieve details for a specific police force.',
    inputSchema: { force_id: forceId },
    annotations: READ_ONLY,
  },
  async ({ force_id }) => {
    return textResult(await makeApiRequest(`forces/${enc(force_id)}`));
  }
);

server.registerTool(
  'get_senior_officers',
  {
    description: 'Retrieve the senior officers for a specific police force.',
    inputSchema: { force_id: forceId },
    annotations: READ_ONLY,
  },
  async ({ force_id }) => {
    return textResult(await makeApiRequest(`forces/${enc(force_id)}/people`));
  }
);

server.registerTool(
  'get_neighbourhoods',
  {
    description: 'Retrieve a list of neighbourhoods for a specific police force.',
    inputSchema: { force_id: forceId },
    annotations: READ_ONLY,
  },
  async ({ force_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/neighbourhoods`));
  }
);

server.registerTool(
  'get_neighbourhood_details',
  {
    description: 'Retrieve details for a specific neighbourhood within a force.',
    inputSchema: { force_id: forceId, neighbourhood_id: neighbourhoodId },
    annotations: READ_ONLY,
  },
  async ({ force_id, neighbourhood_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/${enc(neighbourhood_id)}`));
  }
);

server.registerTool(
  'get_neighbourhood_boundary',
  {
    description:
      'Retrieve the boundary (list of lat/lng coordinates) for a specific neighbourhood. Can be large.',
    inputSchema: { force_id: forceId, neighbourhood_id: neighbourhoodId },
    annotations: READ_ONLY,
  },
  async ({ force_id, neighbourhood_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/${enc(neighbourhood_id)}/boundary`));
  }
);

server.registerTool(
  'get_neighbourhood_team',
  {
    description: 'Retrieve the team members for a specific neighbourhood.',
    inputSchema: { force_id: forceId, neighbourhood_id: neighbourhoodId },
    annotations: READ_ONLY,
  },
  async ({ force_id, neighbourhood_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/${enc(neighbourhood_id)}/people`));
  }
);

server.registerTool(
  'get_neighbourhood_events',
  {
    description: 'Retrieve events scheduled for a specific neighbourhood.',
    inputSchema: { force_id: forceId, neighbourhood_id: neighbourhoodId },
    annotations: READ_ONLY,
  },
  async ({ force_id, neighbourhood_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/${enc(neighbourhood_id)}/events`));
  }
);

server.registerTool(
  'get_neighbourhood_priorities',
  {
    description: 'Retrieve policing priorities for a specific neighbourhood.',
    inputSchema: { force_id: forceId, neighbourhood_id: neighbourhoodId },
    annotations: READ_ONLY,
  },
  async ({ force_id, neighbourhood_id }) => {
    return textResult(await makeApiRequest(`${enc(force_id)}/${enc(neighbourhood_id)}/priorities`));
  }
);

server.registerTool(
  'locate_neighbourhood',
  {
    description: 'Find the neighbourhood policing team responsible for a given latitude and longitude.',
    inputSchema: { lat, lng },
    annotations: READ_ONLY,
  },
  async ({ lat, lng }) => {
    return textResult(await makeApiRequest('locate-neighbourhood', { q: `${lat},${lng}` }));
  }
);

server.registerTool(
  'get_stop_searches_by_area',
  {
    description:
      'Retrieve stop-and-searches at a point (lat/lng, 1-mile radius) or within a custom polygon. Provide either lat AND lng, or poly.',
    inputSchema: {
      lat: lat.optional(),
      lng: lng.optional(),
      poly: poly.optional(),
      date: dateMonth.optional(),
    },
    annotations: READ_ONLY,
  },
  async ({ lat, lng, poly, date }) => {
    const query: Record<string, string | number | undefined> = { date };
    if (lat !== undefined && lng !== undefined) {
      query.lat = lat;
      query.lng = lng;
    } else if (poly !== undefined) {
      query.poly = poly;
    } else {
      throw new Error('Provide either lat and lng, or poly.');
    }
    return textResult(await makeApiRequest('stops-street', query));
  }
);

server.registerTool(
  'get_stop_searches_by_location',
  {
    description: 'Retrieve stop-and-searches at a specific anonymised location by ID.',
    inputSchema: { location_id: locationId, date: dateMonth.optional() },
    annotations: READ_ONLY,
  },
  async ({ location_id, date }) => {
    return textResult(await makeApiRequest('stops-at-location', { location_id, date }));
  }
);

server.registerTool(
  'get_stop_searches_no_location',
  {
    description: 'Retrieve stop-and-searches for a force that could not be mapped to a location.',
    inputSchema: { force_id: forceId, date: dateMonth.optional() },
    annotations: READ_ONLY,
  },
  async ({ force_id, date }) => {
    return textResult(await makeApiRequest('stops-no-location', { force: force_id, date }));
  }
);

server.registerTool(
  'get_stop_searches_by_force',
  {
    description: 'Retrieve stop-and-searches reported by a specific force.',
    inputSchema: { force_id: forceId, date: dateMonth.optional() },
    annotations: READ_ONLY,
  },
  async ({ force_id, date }) => {
    return textResult(await makeApiRequest('stops-force', { force: force_id, date }));
  }
);

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Police UK API MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error starting Police UK API MCP Server:', error);
  process.exit(1);
});
