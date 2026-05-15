import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { loadSpec, type SpecSource } from "./spec-loader.js";
import { createServer, startServer } from "./server.js";

async function main() {
  const argv = await yargs(hideBin(process.argv))
    .option("openapi-spec", {
      type: "string",
      description: "URL or file path to the OpenAPI spec",
    })
    .option("spec-from-stdin", {
      type: "boolean",
      description: "Read OpenAPI spec from stdin",
      default: false,
    })
    .option("spec-inline", {
      type: "string",
      description: "Provide OpenAPI spec content directly as a string",
    })
    .option("name", {
      type: "string",
      description: "Server name advertised to MCP clients",
      default: "openapi-schema-mcp",
    })
    .option("server-version", {
      type: "string",
      description: "Server version advertised to MCP clients",
      default: "0.1.0",
    })
    .strict()
    .help()
    .parseAsync();

  const source = resolveSpecSource(argv);
  const spec = await loadSpec(source);
  const server = createServer({
    name: argv.name,
    version: argv["server-version"],
    spec,
  });
  await startServer(server, new StdioServerTransport());
}

function resolveSpecSource(argv: {
  "openapi-spec"?: string;
  "spec-from-stdin": boolean;
  "spec-inline"?: string;
}): SpecSource {
  const sources = [
    argv["openapi-spec"] !== undefined,
    argv["spec-from-stdin"],
    argv["spec-inline"] !== undefined,
  ].filter(Boolean).length;

  if (sources === 0) {
    throw new Error(
      "Provide an OpenAPI spec via --openapi-spec, --spec-from-stdin, or --spec-inline",
    );
  }
  if (sources > 1) {
    throw new Error("Use exactly one of --openapi-spec, --spec-from-stdin, --spec-inline");
  }

  if (argv["spec-from-stdin"]) return { kind: "stdin" };
  if (argv["spec-inline"] !== undefined) return { kind: "inline", value: argv["spec-inline"] };
  const value = argv["openapi-spec"];
  if (value === undefined) throw new Error("unreachable");
  return value.startsWith("http://") || value.startsWith("https://")
    ? { kind: "url", value }
    : { kind: "file", value };
}

main().catch((error) => {
  console.error("[openapi-schema-mcp]", error instanceof Error ? error.message : error);
  process.exit(1);
});
