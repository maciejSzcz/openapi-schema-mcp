import { expect, test } from "bun:test";
import type { OpenAPIV3 } from "openapi-types";
import { extractOperations } from "../src/operations.js";

test("extracts every method on every path", () => {
  const spec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    paths: {
      "/health": { get: { responses: { "200": { description: "ok" } } } },
      "/users/{id}": {
        get: { responses: { "200": { description: "ok" } } },
        put: { responses: { "200": { description: "ok" } } },
        delete: { responses: { "200": { description: "ok" } } },
      },
    },
  };
  const ops = extractOperations(spec);
  expect(ops.map((o) => `${o.method} ${o.path}`)).toEqual([
    "get /health",
    "get /users/{id}",
    "put /users/{id}",
    "delete /users/{id}",
  ]);
});

test("returns empty list when paths is missing or empty", () => {
  const empty: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    paths: {},
  };
  expect(extractOperations(empty)).toEqual([]);

  const noPaths = { openapi: "3.0.0", info: { title: "T", version: "1" } } as OpenAPIV3.Document;
  expect(extractOperations(noPaths)).toEqual([]);
});

test("skips path items without operations", () => {
  const spec: OpenAPIV3.Document = {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    paths: {
      "/empty": {},
      "/has-get": { get: { responses: { "200": { description: "ok" } } } },
    },
  };
  expect(extractOperations(spec).map((o) => o.path)).toEqual(["/has-get"]);
});
