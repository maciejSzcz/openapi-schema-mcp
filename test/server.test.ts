import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { OpenAPIV3 } from "openapi-types";
import { createServer } from "../src/server.js";

// Catalog and ref-inlining behaviour is covered directly in catalog.test.ts /
// ref-inliner.test.ts. These tests only assert the MCP protocol wiring.

const SPEC: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/health": {
      get: { description: "Health check", responses: { "200": { description: "ok" } } },
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

test("resources/list returns the catalog listing", async () => {
  const client = await connectedClient(SPEC);
  const { resources } = await client.listResources();
  expect(resources.map((r) => r.uri)).toEqual(["openapi://health/get"]);
});

test("resources/read returns the catalog contents", async () => {
  const client = await connectedClient(SPEC);
  const result = await client.readResource({ uri: "openapi://health/get" });
  const [content] = result.contents;
  expect(content?.mimeType).toBe("application/json");
  if (!content || !("text" in content)) throw new Error("expected text content");
  expect(JSON.parse(content.text).description).toBe("Health check");
});

test("resources/read rejects an unknown resource URI", async () => {
  const client = await connectedClient(SPEC);
  let threw = false;
  try {
    await client.readResource({ uri: "openapi://nope/get" });
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});
