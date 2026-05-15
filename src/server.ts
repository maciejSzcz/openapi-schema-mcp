import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { OpenAPIV3 } from "openapi-types";
import { inlineRefs } from "./spec-loader.js";
import { buildResources } from "./resources.js";

export type ServerOptions = {
  name: string;
  version: string;
  spec: OpenAPIV3.Document;
};

export function createServer(options: ServerOptions): Server {
  const resources = buildResources(options.spec);
  const server = new Server(
    { name: options.name, version: options.version },
    { capabilities: { resources: {} } },
  );

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: resources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = resources.find((r) => r.uri === request.params.uri);
    if (!resource) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    const inlined = inlineRefs(options.spec, resource.operation);
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: JSON.stringify(inlined, null, 2),
        },
      ],
    };
  });

  return server;
}

export async function startServer(server: Server, transport: Transport): Promise<void> {
  await server.connect(transport);
}
