import type { OpenAPIV3 } from "openapi-types";
import { inlineRefs } from "./ref-inliner.js";
import type { OperationRecord } from "./operations.js";
import { toolName } from "./naming.js";

const MAX_DESCRIPTION_FALLBACK_LENGTH = 120;

export type ToolDescriptor = {
  name: string;
  description: string;
  inputSchema: { type: "object"; properties: Record<string, never> };
  call(): string;
};

export type ToolCatalog = {
  list(): Array<{ name: string; description: string; inputSchema: ToolDescriptor["inputSchema"] }>;
  call(name: string): string | undefined;
};

export function buildToolCatalog(spec: OpenAPIV3.Document, records: OperationRecord[]): ToolCatalog {
  const taken = new Set<string>();
  const tools: ToolDescriptor[] = records.map((record) => {
    const originalName = record.operation.operationId;
    const name = toolName(originalName, record.method, record.path, taken);
    if (originalName && name !== originalName) {
      console.error(
        `[openapi-schema-mcp] tool name collision or sanitization: '${originalName}' → '${name}'`,
      );
    }
    return {
      name,
      description: buildDescription(record),
      inputSchema: { type: "object", properties: {} },
      call() {
        const inlined = inlineRefs(spec, record.operation);
        return JSON.stringify(inlined, null, 2);
      },
    };
  });

  const byName = new Map(tools.map((tool) => [tool.name, tool] as const));

  return {
    list() {
      return tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      }));
    },
    call(name) {
      const tool = byName.get(name);
      return tool ? tool.call() : undefined;
    },
  };
}

function buildDescription(record: OperationRecord): string {
  const { operation, method, path } = record;
  const summary = operation.summary?.trim();
  const head = summary && summary.length > 0
    ? summary
    : truncate(operation.description?.trim() ?? "", MAX_DESCRIPTION_FALLBACK_LENGTH);
  const tail = `${method.toUpperCase()} ${path}`;
  return head.length > 0 ? `${head} — ${tail}` : tail;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}
