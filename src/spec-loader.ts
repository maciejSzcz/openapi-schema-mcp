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
