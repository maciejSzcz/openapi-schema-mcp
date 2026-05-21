import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { OpenAPIV3 } from "openapi-types";
import { createServer } from "../src/server.js";

const SPEC: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/health": {
      get: {
        operationId: "healthCheck",
        summary: "Health check",
        responses: { "200": { description: "ok" } },
      },
    },
  },
};

async function connectedClient(spec: OpenAPIV3.Document): Promise<Client> {
  const server = createServer({ name: "test", version: "0.0.0", spec });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

test("tools/list returns the catalog", async () => {
  const client = await connectedClient(SPEC);
  const { tools } = await client.listTools();
  expect(tools.map((t) => t.name)).toEqual(["healthCheck"]);
  expect(tools[0]?.description).toBe("Health check — GET /health");
  expect(tools[0]?.inputSchema).toEqual({ type: "object", properties: {} });
});

test("tools/call returns inlined operation JSON as text", async () => {
  const client = await connectedClient(SPEC);
  const result = await client.callTool({ name: "healthCheck", arguments: {} });
  expect(result.isError).toBeFalsy();
  const content = (result.content as Array<{ type: string; text: string }>)[0];
  expect(content?.type).toBe("text");
  const body = JSON.parse(content!.text);
  expect(body.summary).toBe("Health check");
});

test("tools/call returns isError for an unknown tool", async () => {
  const client = await connectedClient(SPEC);
  const result = await client.callTool({ name: "nope", arguments: {} });
  expect(result.isError).toBe(true);
});
