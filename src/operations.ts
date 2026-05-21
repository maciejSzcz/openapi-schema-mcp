import type { OpenAPIV3 } from "openapi-types";

const HTTP_METHODS = ["get", "put", "post", "delete", "options", "head", "patch", "trace"] as const;
export type HttpMethod = (typeof HTTP_METHODS)[number];

export type OperationRecord = {
  path: string;
  method: HttpMethod;
  operation: OpenAPIV3.OperationObject;
};

export function extractOperations(spec: OpenAPIV3.Document): OperationRecord[] {
  const paths = spec.paths ?? {};
  const records: OperationRecord[] = [];
  for (const [path, pathItem] of Object.entries(paths)) {
    if (!pathItem) continue;
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation) continue;
      records.push({ path, method, operation });
    }
  }
  return records;
}
