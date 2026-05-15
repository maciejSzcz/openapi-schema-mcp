import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import type { OpenAPIV3 } from "openapi-types";

export type SpecSource =
  | { kind: "url"; value: string }
  | { kind: "file"; value: string }
  | { kind: "stdin" }
  | { kind: "inline"; value: string };

export async function loadSpec(source: SpecSource): Promise<OpenAPIV3.Document> {
  const raw = await readRaw(source);
  if (!raw.trim()) {
    throw new Error("OpenAPI spec is empty");
  }
  return parseSpec(raw);
}

async function readRaw(source: SpecSource): Promise<string> {
  switch (source.kind) {
    case "url": {
      const res = await fetch(source.value);
      if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source.value}`);
      return res.text();
    }
    case "file":
      return readFile(source.value, "utf-8");
    case "stdin":
      return readStdin();
    case "inline":
      return source.value;
  }
}

function readStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    let buf = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      buf += chunk;
    });
    process.stdin.on("end", () => resolve(buf));
    process.stdin.on("error", reject);
    process.stdin.resume();
  });
}

function parseSpec(raw: string): OpenAPIV3.Document {
  try {
    return JSON.parse(raw) as OpenAPIV3.Document;
  } catch {
    const parsed = yaml.load(raw, { schema: yaml.CORE_SCHEMA });
    if (!parsed || typeof parsed !== "object") {
      throw new Error("OpenAPI spec is neither valid JSON nor YAML");
    }
    return parsed as OpenAPIV3.Document;
  }
}

const REF_PATTERN = /^#\/(.+)$/;

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export function inlineRefs(spec: OpenAPIV3.Document, node: unknown): JsonValue {
  return walk(spec, node, new Set());
}

function walk(spec: OpenAPIV3.Document, node: unknown, visiting: Set<string>): JsonValue {
  if (node === null || typeof node !== "object") {
    return node as JsonValue;
  }

  if (Array.isArray(node)) {
    return node.map((item) => walk(spec, item, visiting));
  }

  const obj = node as Record<string, unknown>;
  const refValue = obj["$ref"];
  if (typeof refValue === "string") {
    return resolveRef(spec, refValue, visiting);
  }

  const out: Record<string, JsonValue> = {};
  for (const [key, value] of Object.entries(obj)) {
    out[key] = walk(spec, value, visiting);
  }
  return out;
}

function resolveRef(
  spec: OpenAPIV3.Document,
  ref: string,
  visiting: Set<string>,
): JsonValue {
  if (visiting.has(ref)) {
    return { $ref: ref, _cycle: true };
  }
  const match = REF_PATTERN.exec(ref);
  const pointer = match?.[1];
  if (!pointer) {
    return { $ref: ref, _unresolved: "non-local ref" };
  }
  const target = pointerLookup(spec, pointer);
  if (target === undefined) {
    return { $ref: ref, _unresolved: "not found" };
  }
  const next = new Set(visiting);
  next.add(ref);
  return walk(spec, target, next);
}

function pointerLookup(spec: OpenAPIV3.Document, pointer: string): unknown {
  const segments = pointer.split("/").map(decodeJsonPointerSegment);
  let current: unknown = spec;
  for (const segment of segments) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function decodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll("~1", "/").replaceAll("~0", "~");
}
