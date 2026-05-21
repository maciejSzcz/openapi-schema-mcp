import { expect, test } from "bun:test";
import type { OpenAPIV3 } from "openapi-types";
import { buildToolCatalog } from "../src/tools.js";
import { extractOperations } from "../src/operations.js";

const SPEC: OpenAPIV3.Document = {
  openapi: "3.0.0",
  info: { title: "T", version: "1" },
  paths: {
    "/cb-job/": {
      get: {
        operationId: "listCbJobs",
        summary: "List compute block jobs",
        responses: {
          "200": {
            description: "ok",
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Job" } },
            },
          },
        },
      },
    },
    "/users/{id}": {
      delete: {
        description: "Remove the user identified by id from the directory permanently. Cannot be undone.",
        responses: { "204": { description: "no content" } },
      },
    },
  },
  components: {
    schemas: {
      Job: { type: "object", properties: { id: { type: "string" } } },
    },
  },
};

test("tool name comes from sanitized operationId when present", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  expect(catalog.list().map((t) => t.name)).toContain("listCbJobs");
});

test("tool name falls back to derived form when operationId missing", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  expect(catalog.list().map((t) => t.name)).toContain("delete_users_by_id");
});

test("description format is 'summary — METHOD path'", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  const tool = catalog.list().find((t) => t.name === "listCbJobs");
  expect(tool?.description).toBe("List compute block jobs — GET /cb-job/");
});

test("description falls back to truncated description when summary missing", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  const tool = catalog.list().find((t) => t.name === "delete_users_by_id");
  expect(tool?.description.startsWith("Remove the user identified by id")).toBe(true);
  expect(tool?.description.endsWith("DELETE /users/{id}")).toBe(true);
});

test("inputSchema is empty object schema", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  for (const tool of catalog.list()) {
    expect(tool.inputSchema).toEqual({ type: "object", properties: {} });
  }
});

test("call returns inlined JSON for the operation", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  const text = catalog.call("listCbJobs");
  expect(text).toBeDefined();
  const body = JSON.parse(text!);
  expect(body.responses["200"].content["application/json"].schema).toEqual({
    type: "object",
    properties: { id: { type: "string" } },
  });
});

test("call returns undefined for unknown tool", () => {
  const catalog = buildToolCatalog(SPEC, extractOperations(SPEC));
  expect(catalog.call("nope")).toBeUndefined();
});
