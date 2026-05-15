import { expect, test } from "bun:test";
import type { OpenAPIV3 } from "openapi-types";
import { buildCatalog } from "../src/catalog.js";

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
              "application/json": { schema: { $ref: "#/components/schemas/User" } },
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
      User: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } },
    },
  },
};

test("lists every operation, sorted by URI, with /api/ stripped", () => {
  const catalog = buildCatalog(SPEC);
  expect(catalog.list().map((r) => r.uri)).toEqual([
    "openapi://health/get",
    "openapi://users/{id}/get",
  ]);
});

test("uses summary as description, falling back to description", () => {
  const catalog = buildCatalog(SPEC);
  const listing = catalog.list();
  expect(listing.find((r) => r.uri === "openapi://users/{id}/get")?.description).toBe("Get a user");
  expect(listing.find((r) => r.uri === "openapi://health/get")?.description).toBe("Health check");
});

test("read() inlines local $refs into self-contained JSON", () => {
  const contents = buildCatalog(SPEC).read("openapi://users/{id}/get");
  expect(contents?.mimeType).toBe("application/json");
  const body = JSON.parse(contents!.text);
  expect(body.responses["200"].content["application/json"].schema).toEqual({
    type: "object",
    properties: { id: { type: "string" }, name: { type: "string" } },
  });
});

test("read() returns undefined for an unknown URI", () => {
  expect(buildCatalog(SPEC).read("openapi://nope/get")).toBeUndefined();
});
