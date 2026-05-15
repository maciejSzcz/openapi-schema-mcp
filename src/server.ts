import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { OpenAPIV3 } from "openapi-types";
import { buildCatalog } from "./catalog.js";

export type ServerOptions = {
  name: string;
  version: string;
  spec: OpenAPIV3.Document;
};

export function createServer(options: ServerOptions): Server {
  const catalog = buildCatalog(options.spec);
  const server = new Server(
    { name: options.name, version: options.version },
    { capabilities: { resources: {} } },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: catalog.list(),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const contents = catalog.read(request.params.uri);
    if (!contents) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return { contents: [contents] };
  });

  return server;
}

export async function startServer(server: Server, transport: Transport): Promise<void> {
  await server.connect(transport);
}
