import { expect, test } from "bun:test";
import type { OpenAPIV3 } from "openapi-types";
import { inlineRefs } from "../src/ref-inliner.js";

function spec(extra: Partial<OpenAPIV3.Document>): OpenAPIV3.Document {
  return {
    openapi: "3.0.0",
    info: { title: "T", version: "1" },
    paths: {},
    ...extra,
  };
}

test("inlines a local $ref to its target", () => {
  const s = spec({
    components: { schemas: { User: { type: "object", properties: { id: { type: "string" } } } } },
  });
  const result = inlineRefs(s, { schema: { $ref: "#/components/schemas/User" } });
  expect(result).toEqual({ schema: { type: "object", properties: { id: { type: "string" } } } });
});

test("breaks a self-referential cycle with _cycle marker", () => {
  const s = spec({
    components: {
      schemas: {
        Node: {
          type: "object",
          properties: { next: { $ref: "#/components/schemas/Node" } },
        },
      },
    },
  });
  const result = inlineRefs(s, { $ref: "#/components/schemas/Node" }) as Record<string, unknown>;
  const next = (result.properties as Record<string, unknown>).next;
  expect(next).toEqual({ $ref: "#/components/schemas/Node", _cycle: true });
});

test("marks a non-local $ref as unresolved", () => {
  const result = inlineRefs(spec({}), { $ref: "https://other.example/schema.json#/Foo" });
  expect(result).toEqual({
    $ref: "https://other.example/schema.json#/Foo",
    _unresolved: "non-local ref",
  });
});

test("marks a missing pointer target as unresolved", () => {
  const result = inlineRefs(spec({}), { $ref: "#/components/schemas/DoesNotExist" });
  expect(result).toEqual({
    $ref: "#/components/schemas/DoesNotExist",
    _unresolved: "not found",
  });
});

test("decodes ~1 and ~0 in JSON pointer segments", () => {
  const s = spec({
    components: {
      schemas: {
        // key contains a literal "/" and "~", which a pointer must escape as ~1 and ~0
        "weird/name~here": { type: "boolean" } as OpenAPIV3.SchemaObject,
      },
    },
  });
  const result = inlineRefs(s, { $ref: "#/components/schemas/weird~1name~0here" });
  expect(result).toEqual({ type: "boolean" });
});

test("recurses through arrays", () => {
  const s = spec({
    components: { schemas: { A: { type: "string" } } },
  });
  const result = inlineRefs(s, [{ $ref: "#/components/schemas/A" }, { type: "number" }]);
  expect(result).toEqual([{ type: "string" }, { type: "number" }]);
});

test("passes primitives through untouched", () => {
  expect(inlineRefs(spec({}), 42)).toBe(42);
  expect(inlineRefs(spec({}), null)).toBe(null);
  expect(inlineRefs(spec({}), "hello")).toBe("hello");
});
