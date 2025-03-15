# police-uk-api-mcp-server

A Python-based MCP server providing tools to access and interact with the [police.uk API](https://data.police.uk/), offering data on crimes, police forces, neighbourhoods, and stop-and-search incidents.

## Features

- 21 distinct tools for querying police.uk API endpoints.
- Retrieve street-level crimes, neighbourhood details, force information, stop-and-search records, and more.
- Built with `FastMCP` for easy integration into MCP-compatible systems.
- Error handling and clear documentation for each tool.

## Prerequisites

- Python 3.6+
- Required packages: `mcp`, `requests`

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/dwain-barnes/police-uk-api-mcp-server.git
   cd police-uk-api-mcp-server
   ```

2. Install dependencies:
```bash
  pip install mcp requests
```
##Usage
Run the server:
 ```bash
python server.py
```
###Configuration
To integrate with an MCP ecosystem, update your server configuration 
 ```bash
{
  "mcpServers": {
    "police-uk-api-tools": {
      "command": "python",
      "args": ["path/to/police-uk-api-mcp-server/server.py"],
      "host": "127.0.0.1",
      "port": 8080,
      "timeout": 30000
    }
  }
}




