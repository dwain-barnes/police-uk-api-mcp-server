#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
// Helper function to make API requests to police.uk
async function makeApiRequest(endpoint, params) {
    const baseUrl = 'https://data.police.uk/api';
    const url = `${baseUrl}/${endpoint}`;
    try {
        const response = await axios.get(url, { params, timeout: 10000 });
        return response.data;
    }
    catch (error) {
        console.error(`API request failed: ${error}`);
        return null;
    }
}
// Define tool schemas
const tools = [
    {
        name: 'get_street_level_crimes',
        description: 'Retrieve street-level crimes by lat/lng or custom polygon area',
        inputSchema: {
            type: 'object',
            properties: {
                lat: { type: 'number', description: 'Latitude of the requested crime area' },
                lng: { type: 'number', description: 'Longitude of the requested crime area' },
                poly: { type: 'string', description: 'The lat/lng pairs defining the boundary of the custom area' },
                date: { type: 'string', description: 'Limit results to a specific month (YYYY-MM)' },
                category: { type: 'string', description: 'The crime category', default: 'all-crime' }
            }
        }
    },
    {
        name: 'get_street_level_outcomes',
        description: 'Retrieve outcomes by lat/lng, custom polygon, or location ID',
        inputSchema: {
            type: 'object',
            properties: {
                lat: { type: 'number', description: 'Latitude of the requested area' },
                lng: { type: 'number', description: 'Longitude of the requested area' },
                poly: { type: 'string', description: 'The lat/lng pairs defining the boundary of the custom area' },
                location_id: { type: 'number', description: 'The ID of the location' },
                date: { type: 'string', description: 'Limit results to a specific month (YYYY-MM)' }
            }
        }
    },
    {
        name: 'get_crimes_at_location',
        description: 'Retrieve crimes at a specific location by ID or nearest to lat/lng',
        inputSchema: {
            type: 'object',
            properties: {
                lat: { type: 'number', description: 'Latitude of the requested crime area' },
                lng: { type: 'number', description: 'Longitude of the requested crime area' },
                location_id: { type: 'number', description: 'The ID of the location' },
                date: { type: 'string', description: 'Limit results to a specific month (YYYY-MM)' }
            }
        }
    },
    {
        name: 'get_crimes_no_location',
        description: 'Retrieve crimes that could not be mapped to a location',
        inputSchema: {
            type: 'object',
            properties: {
                category: { type: 'string', description: 'The category of the crimes' },
                force: { type: 'string', description: 'Specific police force' },
                date: { type: 'string', description: 'Limit results to a specific month (YYYY-MM)' }
            },
            required: ['category', 'force']
        }
    },
    {
        name: 'get_crime_categories',
        description: 'Retrieve valid crime categories for a given date',
        inputSchema: {
            type: 'object',
            properties: {
                date: { type: 'string', description: 'Specific month (YYYY-MM)' }
            }
        }
    },
    {
        name: 'get_last_updated',
        description: 'Retrieve the date when crime data was last updated',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'get_outcomes_for_crime',
        description: 'Retrieve outcomes for a specific crime by persistent ID',
        inputSchema: {
            type: 'object',
            properties: {
                persistent_id: { type: 'string', description: 'The 64-character unique identifier for the crime' }
            },
            required: ['persistent_id']
        }
    },
    {
        name: 'get_list_of_forces',
        description: 'Retrieve a list of all police forces',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'get_force_details',
        description: 'Retrieve details for a specific police force',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' }
            },
            required: ['force_id']
        }
    },
    {
        name: 'get_senior_officers',
        description: 'Retrieve senior officers for a specific police force',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' }
            },
            required: ['force_id']
        }
    },
    {
        name: 'get_neighbourhoods',
        description: 'Retrieve a list of neighbourhoods for a specific police force',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' }
            },
            required: ['force_id']
        }
    },
    {
        name: 'get_neighbourhood_details',
        description: 'Retrieve details for a specific neighbourhood within a force',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                neighbourhood_id: { type: 'string', description: 'The unique identifier for the neighbourhood' }
            },
            required: ['force_id', 'neighbourhood_id']
        }
    },
    {
        name: 'get_neighbourhood_boundary',
        description: 'Retrieve the boundary coordinates for a specific neighbourhood',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                neighbourhood_id: { type: 'string', description: 'The unique identifier for the neighbourhood' }
            },
            required: ['force_id', 'neighbourhood_id']
        }
    },
    {
        name: 'get_neighbourhood_team',
        description: 'Retrieve the team members for a specific neighbourhood',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                neighbourhood_id: { type: 'string', description: 'The unique identifier for the neighbourhood' }
            },
            required: ['force_id', 'neighbourhood_id']
        }
    },
    {
        name: 'get_neighbourhood_events',
        description: 'Retrieve events scheduled for a specific neighbourhood',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                neighbourhood_id: { type: 'string', description: 'The unique identifier for the neighbourhood' }
            },
            required: ['force_id', 'neighbourhood_id']
        }
    },
    {
        name: 'get_neighbourhood_priorities',
        description: 'Retrieve policing priorities for a specific neighbourhood',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                neighbourhood_id: { type: 'string', description: 'The unique identifier for the neighbourhood' }
            },
            required: ['force_id', 'neighbourhood_id']
        }
    },
    {
        name: 'locate_neighbourhood',
        description: 'Find the neighbourhood policing team for a given latitude and longitude',
        inputSchema: {
            type: 'object',
            properties: {
                lat: { type: 'number', description: 'Latitude of the location' },
                lng: { type: 'number', description: 'Longitude of the location' }
            },
            required: ['lat', 'lng']
        }
    },
    {
        name: 'get_stop_searches_by_area',
        description: 'Retrieve stop and searches within a 1-mile radius or custom area',
        inputSchema: {
            type: 'object',
            properties: {
                lat: { type: 'number', description: 'Latitude of the centre point' },
                lng: { type: 'number', description: 'Longitude of the centre point' },
                poly: { type: 'string', description: 'Lat/lng pairs defining a polygon' },
                date: { type: 'string', description: 'Specific month (YYYY-MM)' }
            }
        }
    },
    {
        name: 'get_stop_searches_by_location',
        description: 'Retrieve stop and searches at a specific location by ID',
        inputSchema: {
            type: 'object',
            properties: {
                location_id: { type: 'number', description: 'The ID of the location' },
                date: { type: 'string', description: 'Specific month (YYYY-MM)' }
            },
            required: ['location_id']
        }
    },
    {
        name: 'get_stop_searches_no_location',
        description: 'Retrieve stop and searches that could not be mapped to a location',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                date: { type: 'string', description: 'Specific month (YYYY-MM)' }
            },
            required: ['force_id']
        }
    },
    {
        name: 'get_stop_searches_by_force',
        description: 'Retrieve stop and searches reported by a specific force',
        inputSchema: {
            type: 'object',
            properties: {
                force_id: { type: 'string', description: 'The unique identifier for the force' },
                date: { type: 'string', description: 'Specific month (YYYY-MM)' }
            },
            required: ['force_id']
        }
    }
];
// Tool implementation functions
async function getStreetLevelCrimes(args) {
    const { lat, lng, poly, date, category = 'all-crime' } = args;
    const params = {};
    if (date)
        params.date = date;
    if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
    }
    else if (poly) {
        params.poly = poly;
    }
    else {
        return [];
    }
    const endpoint = `crimes-street/${category}`;
    return await makeApiRequest(endpoint, params) || [];
}
async function getStreetLevelOutcomes(args) {
    const { lat, lng, poly, location_id, date } = args;
    const params = {};
    if (date)
        params.date = date;
    if (location_id) {
        params.location_id = location_id;
    }
    else if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
    }
    else if (poly) {
        params.poly = poly;
    }
    else {
        return [];
    }
    return await makeApiRequest('outcomes-at-location', params) || [];
}
async function getCrimesAtLocation(args) {
    const { lat, lng, location_id, date } = args;
    const params = {};
    if (date)
        params.date = date;
    if (location_id) {
        params.location_id = location_id;
    }
    else if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
    }
    else {
        return [];
    }
    return await makeApiRequest('crimes-at-location', params) || [];
}
async function getCrimesNoLocation(args) {
    const { category, force, date } = args;
    const params = { category, force };
    if (date)
        params.date = date;
    return await makeApiRequest('crimes-no-location', params) || [];
}
async function getCrimeCategories(args) {
    const { date } = args;
    const params = date ? { date } : {};
    return await makeApiRequest('crime-categories', params) || [];
}
async function getLastUpdated() {
    const data = await makeApiRequest('crime-last-updated');
    return data?.date || '';
}
async function getOutcomesForCrime(args) {
    const { persistent_id } = args;
    const endpoint = `outcomes-for-crime/${persistent_id}`;
    return await makeApiRequest(endpoint) || {};
}
async function getListOfForces() {
    return await makeApiRequest('forces') || [];
}
async function getForceDetails(args) {
    const { force_id } = args;
    const endpoint = `forces/${force_id}`;
    return await makeApiRequest(endpoint) || {};
}
async function getSeniorOfficers(args) {
    const { force_id } = args;
    const endpoint = `forces/${force_id}/people`;
    return await makeApiRequest(endpoint) || [];
}
async function getNeighbourhoods(args) {
    const { force_id } = args;
    const endpoint = `${force_id}/neighbourhoods`;
    return await makeApiRequest(endpoint) || [];
}
async function getNeighbourhoodDetails(args) {
    const { force_id, neighbourhood_id } = args;
    const endpoint = `${force_id}/${neighbourhood_id}`;
    return await makeApiRequest(endpoint) || {};
}
async function getNeighbourhoodBoundary(args) {
    const { force_id, neighbourhood_id } = args;
    const endpoint = `${force_id}/${neighbourhood_id}/boundary`;
    return await makeApiRequest(endpoint) || [];
}
async function getNeighbourhoodTeam(args) {
    const { force_id, neighbourhood_id } = args;
    const endpoint = `${force_id}/${neighbourhood_id}/people`;
    return await makeApiRequest(endpoint) || [];
}
async function getNeighbourhoodEvents(args) {
    const { force_id, neighbourhood_id } = args;
    const endpoint = `${force_id}/${neighbourhood_id}/events`;
    return await makeApiRequest(endpoint) || [];
}
async function getNeighbourhoodPriorities(args) {
    const { force_id, neighbourhood_id } = args;
    const endpoint = `${force_id}/${neighbourhood_id}/priorities`;
    return await makeApiRequest(endpoint) || [];
}
async function locateNeighbourhood(args) {
    const { lat, lng } = args;
    const params = { q: `${lat},${lng}` };
    return await makeApiRequest('locate-neighbourhood', params) || {};
}
async function getStopSearchesByArea(args) {
    const { lat, lng, poly, date } = args;
    const params = {};
    if (date)
        params.date = date;
    if (lat !== undefined && lng !== undefined) {
        params.lat = lat;
        params.lng = lng;
    }
    else if (poly) {
        params.poly = poly;
    }
    else {
        return [];
    }
    return await makeApiRequest('stops-street', params) || [];
}
async function getStopSearchesByLocation(args) {
    const { location_id, date } = args;
    const params = { location_id };
    if (date)
        params.date = date;
    return await makeApiRequest('stops-at-location', params) || [];
}
async function getStopSearchesNoLocation(args) {
    const { force_id, date } = args;
    const params = { force: force_id };
    if (date)
        params.date = date;
    return await makeApiRequest('stops-no-location', params) || [];
}
async function getStopSearchesByForce(args) {
    const { force_id, date } = args;
    const params = { force: force_id };
    if (date)
        params.date = date;
    return await makeApiRequest('stops-force', params) || [];
}
// Tool function mapping
const toolFunctions = {
    get_street_level_crimes: getStreetLevelCrimes,
    get_street_level_outcomes: getStreetLevelOutcomes,
    get_crimes_at_location: getCrimesAtLocation,
    get_crimes_no_location: getCrimesNoLocation,
    get_crime_categories: getCrimeCategories,
    get_last_updated: getLastUpdated,
    get_outcomes_for_crime: getOutcomesForCrime,
    get_list_of_forces: getListOfForces,
    get_force_details: getForceDetails,
    get_senior_officers: getSeniorOfficers,
    get_neighbourhoods: getNeighbourhoods,
    get_neighbourhood_details: getNeighbourhoodDetails,
    get_neighbourhood_boundary: getNeighbourhoodBoundary,
    get_neighbourhood_team: getNeighbourhoodTeam,
    get_neighbourhood_events: getNeighbourhoodEvents,
    get_neighbourhood_priorities: getNeighbourhoodPriorities,
    locate_neighbourhood: locateNeighbourhood,
    get_stop_searches_by_area: getStopSearchesByArea,
    get_stop_searches_by_location: getStopSearchesByLocation,
    get_stop_searches_no_location: getStopSearchesNoLocation,
    get_stop_searches_by_force: getStopSearchesByForce
};
// Create server
const server = new Server({
    name: 'police-uk-api-tools',
    version: '1.0.0',
    capabilities: {
        tools: {}
    }
});
// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: tools
    };
});
// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
        const toolFunction = toolFunctions[name];
        if (!toolFunction) {
            throw new Error(`Unknown tool: ${name}`);
        }
        const result = await toolFunction(args);
        return {
            content: [
                {
                    type: 'text',
                    text: JSON.stringify(result, null, 2)
                }
            ]
        };
    }
    catch (error) {
        return {
            content: [
                {
                    type: 'text',
                    text: `Error: ${error instanceof Error ? error.message : String(error)}`
                }
            ],
            isError: true
        };
    }
});
// Start server
const transport = new StdioServerTransport();
server.connect(transport);
console.error('Police UK API MCP Server running on stdio');
//# sourceMappingURL=index.js.map