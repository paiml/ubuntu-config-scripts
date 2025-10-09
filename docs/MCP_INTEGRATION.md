# MCP Integration for Ubuntu Config Scripts

This document explains how to integrate Ubuntu Config Scripts with Claude Desktop via the Model Context Protocol (MCP).

## Overview

The MCP server exposes three powerful tools for discovering and querying Ubuntu configuration scripts:

1. **search_scripts** - Natural language semantic search
2. **list_scripts** - Browse all available scripts
3. **get_script** - Get detailed information about a specific script

## Prerequisites

1. **Database seeded** - Run `make seed-db` first to populate the script database
2. **Environment configured** - `.env` file with Turso and OpenAI credentials
3. **Claude Desktop** - MCP is supported in Claude Desktop app

## Configuration

### Step 1: Set up Environment

Create a `.env` file in the project root:

```bash
# Required
TURSO_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-auth-token-here
OPENAI_API_KEY=sk-your-api-key-here

# Optional (defaults shown)
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_DIMENSIONS=1536
```

### Step 2: Seed the Database

```bash
make seed-db
```

This indexes all scripts with metadata and vector embeddings.

### Step 3: Configure Claude Desktop

Add to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "ubuntu-scripts": {
      "command": "deno",
      "args": [
        "run",
        "--allow-env",
        "--allow-net",
        "--allow-read",
        "/home/YOUR_USERNAME/src/ubuntu-config-scripts/scripts/mcp-server.ts"
      ],
      "env": {
        "TURSO_URL": "libsql://your-database.turso.io",
        "TURSO_AUTH_TOKEN": "your-auth-token-here",
        "OPENAI_API_KEY": "sk-your-api-key-here"
      }
    }
  }
}
```

**Important**:
- Replace `/home/YOUR_USERNAME/src/ubuntu-config-scripts` with your actual path
- Replace credentials with your actual values
- Restart Claude Desktop after configuration changes

### Step 4: Verify Installation

1. Restart Claude Desktop
2. Start a new conversation
3. You should see `ubuntu-scripts` in the available MCP servers
4. Try a query: "Search for audio configuration scripts"

## Usage Examples

### Semantic Search

Ask Claude:
```
Search for scripts related to "fixing microphone issues"
```

Claude will use the `search_scripts` tool with your natural language query.

### List Scripts by Category

Ask Claude:
```
Show me all system configuration scripts
```

Claude will use the `list_scripts` tool with category filter.

### Get Script Details

Ask Claude:
```
Tell me more about the configure-speakers script
```

Claude will use the `get_script` tool to retrieve full details.

## Available Tools

### 1. search_scripts

Search for scripts using natural language queries.

**Parameters**:
- `query` (required): Natural language search query
- `category` (optional): Filter by 'audio', 'system', or 'dev'
- `limit` (optional): Max results to return (default: 5)
- `minSimilarity` (optional): Minimum similarity score 0.0-1.0 (default: 0.0)

**Example Response**:
```json
{
  "found": 3,
  "results": [
    {
      "name": "configure-speakers.ts",
      "path": "./scripts/audio/configure-speakers.ts",
      "category": "audio",
      "description": "Configure external speakers and audio output devices",
      "usage": "make audio-speakers",
      "tags": ["audio", "speakers", "configuration"],
      "similarity": "0.892"
    }
  ]
}
```

### 2. list_scripts

List all available scripts, optionally filtered by category.

**Parameters**:
- `category` (optional): Filter by 'audio', 'system', or 'dev'
- `limit` (optional): Max scripts to return (default: 50)

**Example Response**:
```json
{
  "count": 15,
  "scripts": [
    {
      "name": "configure-speakers.ts",
      "path": "./scripts/audio/configure-speakers.ts",
      "category": "audio",
      "description": "Configure external speakers and audio output devices",
      "usage": "make audio-speakers",
      "tags": ["audio", "speakers"]
    }
  ]
}
```

### 3. get_script

Get detailed information about a specific script.

**Parameters**:
- `name` (required): Script name or path fragment

**Example Response**:
```json
{
  "name": "configure-speakers.ts",
  "path": "./scripts/audio/configure-speakers.ts",
  "category": "audio",
  "description": "Configure external speakers and audio output devices",
  "usage": "make audio-speakers",
  "tags": ["audio", "speakers", "pulseaudio"],
  "dependencies": ["pactl", "pacmd"],
  "created_at": "2024-10-09T10:00:00Z",
  "updated_at": "2024-10-09T10:00:00Z"
}
```

## Integration with pforge

For advanced use cases, you can integrate pforge (Rust/Deno bridge) to:

1. **Expose Rust functionality** from pforge to the MCP server
2. **Enhance performance** with native Rust code for search operations
3. **Add new capabilities** like file system operations or system queries

Example integration:
```typescript
import { pforge } from "pforge-bridge";

// Use pforge to enhance MCP tools
const rustSearch = pforge.search(query);
```

See [pforge documentation](https://github.com/paiml/pforge) for details.

## Troubleshooting

### MCP Server Not Appearing

1. Check Claude Desktop config file syntax (valid JSON)
2. Verify path to mcp-server.ts is absolute and correct
3. Ensure Deno is installed and in PATH
4. Restart Claude Desktop completely

### Search Returns No Results

1. Verify database was seeded: `make seed-db`
2. Check .env file has correct credentials
3. Test search directly: `make search QUERY="test"`

### Permission Errors

Ensure the MCP server has required Deno permissions:
- `--allow-env`: Read environment variables
- `--allow-net`: Connect to Turso database and OpenAI API
- `--allow-read`: Read script files

### Database Connection Errors

1. Verify TURSO_URL and TURSO_AUTH_TOKEN are correct
2. Test connection: `make test-db` (if available)
3. Check network connectivity to Turso cloud

## Testing the MCP Server Locally

```bash
# Start the MCP server in test mode
deno run --allow-env --allow-net --allow-read scripts/mcp-server.ts

# In another terminal, send a test request
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}' | \
  deno run --allow-env --allow-net --allow-read scripts/mcp-server.ts
```

## Security Considerations

1. **API Keys**: Store in .env file, never commit to git
2. **Network Access**: MCP server requires network access for Turso and OpenAI
3. **File Access**: Server only reads from scripts directory
4. **Credentials in Config**: Claude Desktop config is stored locally and encrypted

## Advanced Configuration

### Custom Search Parameters

Modify the MCP server to add custom search defaults:

```typescript
// In scripts/mcp-server.ts
const DEFAULT_SEARCH_LIMIT = 10;
const DEFAULT_MIN_SIMILARITY = 0.7;
```

### Adding New Tools

Follow this pattern to add new MCP tools:

```typescript
{
  name: "my_new_tool",
  description: "What this tool does",
  inputSchema: {
    type: "object",
    properties: {
      param: { type: "string", description: "Parameter description" }
    },
    required: ["param"]
  }
}
```

Then implement in `executeTool()` function.

## Related Documentation

- [Semantic Search Documentation](../README.md#semantic-search)
- [MCP Protocol Specification](https://modelcontextprotocol.io/)
- [pforge Integration](https://github.com/paiml/pforge)
- [CLAUDE.md](../CLAUDE.md) - Project conventions

## Support

For issues or questions:
- GitHub Issues: [ubuntu-config-scripts/issues](https://github.com/paiml/ubuntu-config-scripts/issues)
- MCP Documentation: [modelcontextprotocol.io](https://modelcontextprotocol.io/)
