import type { OpenAPIV3 } from "openapi-types";
import { inlineRefs } from "./ref-inliner.js";

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export type OperationResource = {
  uri: string;
  name: string;
  description: string;
  mimeType: "application/json";
  path: string;
  method: HttpMethod;
  operation: OpenAPIV3.OperationObject;
};

export type ResourceListing = {
  uri: string;
  name: string;
  description: string;
  mimeType: "application/json";
};

export type ResourceContents = {
  uri: string;
  mimeType: "application/json";
  text: string;
};

export type Catalog = {
  list(): ResourceListing[];
  read(uri: string): ResourceContents | undefined;
};

export function buildCatalog(spec: OpenAPIV3.Document): Catalog {
  const resources = buildResources(spec);
  const byUri = new Map(resources.map((r) => [r.uri, r] as const));

  return {
    list() {
      return resources.map((r) => ({
        uri: r.uri,
        name: r.name,
        description: r.description,
        mimeType: r.mimeType,
      }));
    },
    read(uri) {
      const resource = byUri.get(uri);
      if (!resource) return undefined;
      const inlined = inlineRefs(spec, resource.operation);
      return {
        uri: resource.uri,
        mimeType: resource.mimeType,
        text: JSON.stringify(inlined, null, 2),
      };
    },
  };
}

function buildResources(spec: OpenAPIV3.Document): OperationResource[] {
  const paths = spec.paths ?? {};
  const resources: OperationResource[] = [];
  for (const [rawPath, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    const displayPath = stripApiPrefix(rawPath);
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      resources.push({
        uri: toUri(displayPath, method),
        name: `${method.toUpperCase()} ${displayPath}`,
        description: extractDescription(operation),
        mimeType: "application/json",
        path: rawPath,
        method,
        operation,
      });
    }
  }
  resources.sort((a, b) => a.uri.localeCompare(b.uri));
  return resources;
}

function stripApiPrefix(path: string): string {
  if (path.startsWith("/api/")) return path.slice(4);
  if (path === "/api") return "/";
  return path;
}

function toUri(displayPath: string, method: HttpMethod): string {
  let normalized = displayPath.startsWith("/") ? displayPath.slice(1) : displayPath;
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  return `openapi://${normalized}/${method}`;
}

function extractDescription(operation: OpenAPIV3.OperationObject): string {
  if (operation.summary?.trim()) return operation.summary.trim();
  if (operation.description?.trim()) return operation.description.trim();
  return "";
}
