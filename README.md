# openapi-schema-mcp

Exposes OpenAPI operations as deferred MCP **tools** — keyword-discoverable in your client, but the schema itself only loads into context when you invoke the tool.

Most OpenAPI ↔ MCP bridges either (a) eagerly load every operation's schema into the client's context, or (b) hide operations behind passive resources that aren't searchable. This server takes the middle path: each operation is published as an MCP **tool** with a short `name` and a one-line `description` (the operation summary + path + method). Clients that support deferred tool loading — like Claude Code — can fuzzy-match the tool list without loading any schemas. When you actually call a tool, the server returns the full, self-contained operation JSON (with `$ref`s inlined). No HTTP requests are made; this server is a schema browser, not a proxy.

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
| `--server-version <string>` | Server version advertised to MCP clients. Default: the package version. |

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

## Tool shape

Each operation becomes a tool:

- **Name:** the operation's `operationId`, sanitized to `^[a-zA-Z0-9_-]{1,64}$`. If no `operationId` is set, a name is derived from method + path, e.g. `get_users_by_id` for `GET /users/{id}`. Collisions are resolved with a numeric suffix (`name_2`, `name_3`, …) and a warning on stderr.
- **Description:** `"<summary> — <METHOD> <path>"`, e.g. `"List compute block jobs — GET /ds-state-api/cb-job/"`. When `summary` is missing, the operation's `description` is used (truncated to 120 chars).
- **Input schema:** empty (`{ "type": "object", "properties": {} }`). Calling the tool takes no arguments.
- **Output:** a single text content block containing the operation object as pretty-printed JSON, with all local `$ref`s inlined. Cycles are broken with `{ "$ref": "...", "_cycle": true }`; unresolvable refs are marked `_unresolved`.

`tools/list` returns every operation in the spec.

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
