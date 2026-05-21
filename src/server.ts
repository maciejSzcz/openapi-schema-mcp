import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { OpenAPIV3 } from "openapi-types";
import { extractOperations } from "./operations.js";
import { buildToolCatalog } from "./tools.js";

export type ServerOptions = {
  name: string;
  version: string;
  spec: OpenAPIV3.Document;
};

export function createServer(options: ServerOptions): Server {
  const operations = extractOperations(options.spec);
  const catalog = buildToolCatalog(options.spec, operations);
  const server = new Server(
    { name: options.name, version: options.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: catalog.list(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const text = catalog.call(request.params.name);
    if (text === undefined) {
      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
      };
    }
    return {
      content: [{ type: "text", text }],
    };
  });

  return server;
}

export async function startServer(server: Server, transport: Transport): Promise<void> {
  await server.connect(transport);
}
