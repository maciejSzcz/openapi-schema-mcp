import { expect, test } from "bun:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { OpenAPIV3 } from "openapi-types";
import { createServer } from "../src/server.js";

const SPEC: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: { title: "Test API", version: "1.0.0" },
  paths: {
    "/api/users/{id}": {
      get: {
        summary: "Get a user",
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
              },
            },
          },
        },
      },
    },
    "/health": {
      get: { description: "Health check", responses: { "200": { description: "ok" } } },
    },
  },
  components: {
    schemas: {
      User: {
        type: "object",
        properties: { id: { type: "string" }, name: { type: "string" } },
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

test("lists every operation as a resource, sorted by URI", async () => {
  const client = await connectedClient(SPEC);
  const { resources } = await client.listResources();

  expect(resources.map((r) => r.uri)).toEqual([
    "openapi://health/get",
    "openapi://users/{id}/get",
  ]);
});

test("strips /api/ prefix and uses summary as description", async () => {
  const client = await connectedClient(SPEC);
  const { resources } = await client.listResources();

  const user = resources.find((r) => r.uri === "openapi://users/{id}/get");
  expect(user?.name).toBe("GET /users/{id}");
  expect(user?.description).toBe("Get a user");
  expect(user?.mimeType).toBe("application/json");
});

test("falls back to description when summary is absent", async () => {
  const client = await connectedClient(SPEC);
  const { resources } = await client.listResources();

  const health = resources.find((r) => r.uri === "openapi://health/get");
  expect(health?.description).toBe("Health check");
});

test("reads an operation with local $refs inlined", async () => {
  const client = await connectedClient(SPEC);
  const result = await client.readResource({ uri: "openapi://users/{id}/get" });

  const [content] = result.contents;
  expect(content?.mimeType).toBe("application/json");
  if (!content || !("text" in content)) throw new Error("expected text content");
  const body = JSON.parse(content.text);
  expect(body.responses["200"].content["application/json"].schema).toEqual({
    type: "object",
    properties: { id: { type: "string" }, name: { type: "string" } },
  });
});

test("rejects an unknown resource URI", async () => {
  const client = await connectedClient(SPEC);
  let threw = false;
  try {
    await client.readResource({ uri: "openapi://nope/get" });
  } catch {
    threw = true;
  }
  expect(threw).toBe(true);
});
