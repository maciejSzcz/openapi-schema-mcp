# openapi-schema-mcp

Exposes OpenAPI operations as MCP resources (not tools) — context-light, browse-and-fetch access to large specs.

Most OpenAPI ↔ MCP bridges turn every operation into a tool, which forces the client to load the full tool list (and its schemas) into context up front. This server takes the opposite approach: each operation is published as an MCP **resource** under `openapi://<path>/<method>`. Clients call `resources/list` to see what's available, then `resources/read` to pull only the operations they actually need.

## Install

Run directly with `npx` (no install needed):

```bash
npx openapi-schema-mcp --openapi-spec https://example.com/openapi.json
```

Or install globally:

```bash
npm install -g openapi-schema-mcp
openapi-schema-mcp --openapi-spec https://example.com/openapi.json
```

Requires Node.js >= 18.

## Usage

The server speaks MCP over stdio. Point it at a spec via one of:

```bash
# From a URL
npx openapi-schema-mcp --openapi-spec https://example.com/openapi.json

# From a local file (JSON or YAML)
npx openapi-schema-mcp --openapi-spec ./openapi.yaml

# From stdin
cat openapi.json | npx openapi-schema-mcp --spec-from-stdin

# Inline string
npx openapi-schema-mcp --spec-inline '{"openapi":"3.0.0", ...}'
```

### Flags

| Flag | Description |
|---|---|
| `--openapi-spec <url-or-path>` | URL or file path to the OpenAPI spec. |
| `--spec-from-stdin` | Read the spec from stdin. |
| `--spec-inline <string>` | Pass the spec content directly as a string. |
| `--name <string>` | Server name advertised to MCP clients. Default: `openapi-schema-mcp`. |
| `--server-version <string>` | Server version advertised to MCP clients. Default: `0.1.0`. |

Exactly one of `--openapi-spec`, `--spec-from-stdin`, `--spec-inline` is required.

## MCP client configuration

Example for Claude Code / any MCP client that accepts a stdio command:

```json
{
  "mcpServers": {
    "openapi": {
      "command": "npx",
      "args": [
        "-y",
        "openapi-schema-mcp",
        "--openapi-spec",
        "https://example.com/openapi.json"
      ]
    }
  }
}
```

## Resource shape

Each operation becomes a resource:

- **URI:** `openapi://<path>/<method>` — e.g. `openapi://users/{id}/get`. A leading `/api/` prefix in the spec is stripped to keep URIs short.
- **Name:** `GET /users/{id}`
- **Description:** the operation's `summary`, falling back to `description`.
- **MIME type:** `application/json`
- **Body:** the operation object as JSON, with all local `$ref`s inlined so the client gets a self-contained schema. Cycles are broken with `{ "$ref": "...", "_cycle": true }`; unresolvable refs are marked `_unresolved`.

`resources/list` returns every operation in the spec, sorted by URI.

## Development

The project is developed with [Bun](https://bun.sh) and bundled into a single Node-ready file with `bun build`.

```bash
bun install        # install dependencies
bun start --openapi-spec ./openapi.yaml   # run from source
bun run typecheck  # type-check
bun test           # run tests
bun run build      # bundle to dist/cli.js (Node-ready)
```

## License

MIT
