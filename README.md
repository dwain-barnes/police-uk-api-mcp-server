# MCP Server Police UK

[![npm version](https://badge.fury.io/js/mcp-server-police-uk.svg)](https://badge.fury.io/js/mcp-server-police-uk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![GitHub](https://img.shields.io/badge/GitHub-dwain--barnes-blue)](https://github.com/dwain-barnes/mcp-server-police-uk)

A Model Context Protocol (MCP) server providing tools to access and interact with the police.uk API, offering comprehensive data on crimes, police forces, neighbourhoods, and stop-and-search incidents across the UK.

## Features

- **21 distinct tools** for querying police.uk API endpoints
- Retrieve street-level crimes, neighbourhood details, force information, stop-and-search records, and more
- Built with the official MCP TypeScript SDK
- Easy integration with MCP-compatible systems
- Comprehensive error handling and type safety

## Installation

Install directly from npm:

```bash
npm install -g mcp-server-police-uk
```

Or use with npx (no installation required):

```bash
npx mcp-server-police-uk
```

## Usage

### With Claude Desktop

Add to your Claude Desktop configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "police-uk": {
      "command": "npx",
      "args": ["mcp-server-police-uk"]
    }
  }
}
```

### Development

To contribute or run locally:

```bash
# Clone the repository
git clone https://github.com/dwain-barnes/mcp-server-police-uk.git
cd mcp-server-police-uk

# Install dependencies
npm install

# Build the project
npm run build

# Run locally
npm start
```

### With other MCP clients

```bash
npx mcp-server-police-uk
```

## Available Tools

### Crime Data
- `get_street_level_crimes` - Retrieve street-level crimes by location or area
- `get_crimes_at_location` - Get crimes at a specific location
- `get_crimes_no_location` - Retrieve crimes that couldn't be mapped to a location
- `get_crime_categories` - Get valid crime categories
- `get_last_updated` - Get the date when crime data was last updated
- `get_outcomes_for_crime` - Get outcomes for a specific crime
- `get_street_level_outcomes` - Retrieve outcomes by location or area

### Police Forces
- `get_list_of_forces` - Get all police forces
- `get_force_details` - Get details for a specific police force
- `get_senior_officers` - Get senior officers for a police force

### Neighbourhoods
- `get_neighbourhoods` - Get neighbourhoods for a police force
- `get_neighbourhood_details` - Get details for a specific neighbourhood
- `get_neighbourhood_boundary` - Get boundary coordinates for a neighbourhood
- `get_neighbourhood_team` - Get team members for a neighbourhood
- `get_neighbourhood_events` - Get scheduled events for a neighbourhood
- `get_neighbourhood_priorities` - Get policing priorities for a neighbourhood
- `locate_neighbourhood` - Find neighbourhood team for given coordinates

### Stop and Search
- `get_stop_searches_by_area` - Get stop and searches within an area
- `get_stop_searches_by_location` - Get stop and searches at a specific location
- `get_stop_searches_no_location` - Get stop and searches with no location
- `get_stop_searches_by_force` - Get stop and searches by police force

## Examples

### Get crimes near a location
```typescript
// Get crimes within 1 mile of coordinates
get_street_level_crimes({
  lat: 51.5074,
  lng: -0.1278,
  date: "2024-01"
})
```

### Find your local police team
```typescript
// Find neighbourhood team for coordinates
locate_neighbourhood({
  lat: 51.5074,
  lng: -0.1278
})
```

### Get force information
```typescript
// Get details about Metropolitan Police
get_force_details({
  force_id: "metropolitan"
})
```

## API Rate Limits

This server respects the police.uk API rate limits. The API is free to use but has usage limits in place to ensure fair access for all users.

## Data Source

All data is sourced from the official police.uk API, which provides open data about policing in England, Wales, and Northern Ireland. The data is typically updated monthly.

## Contributing

Contributions are welcome! Please feel free to:
- Report issues on [GitHub Issues](https://github.com/dwain-barnes/mcp-server-police-uk/issues)
- Submit Pull Requests
- Suggest new features or improvements

## Repository

- **GitHub**: https://github.com/dwain-barnes/mcp-server-police-uk
- **npm**: https://www.npmjs.com/package/mcp-server-police-uk

## License

MIT License - see [LICENSE](https://github.com/dwain-barnes/mcp-server-police-uk/blob/main/LICENSE) file for details.

## Support

If you encounter any issues or have questions:
- File an issue on [GitHub Issues](https://github.com/dwain-barnes/mcp-server-police-uk/issues)
- Check the [police.uk API documentation](https://data.police.uk/docs/) for API-specific questions

## Author

Created by [Dwain Barnes](https://github.com/dwain-barnes)
