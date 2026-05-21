const MAX_LENGTH = 64;
const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

export function sanitizeToolName(raw: string): string {
  const replaced = raw.replace(/[^a-zA-Z0-9_-]+/g, "_");
  const collapsed = replaced.replace(/_+/g, "_");
  const trimmed = collapsed.replace(/^[_-]+|[_-]+$/g, "");
  return trimmed;
}

export function derivedName(method: string, path: string): string {
  const segments = path
    .split("/")
    .filter((segment) => segment.length > 0)
    .map((segment) => {
      const paramMatch = /^\{(.+)\}$/.exec(segment);
      if (paramMatch) return `by_${paramMatch[1]}`;
      return segment;
    });
  const base = [method.toLowerCase(), ...segments].join("_");
  return sanitizeToolName(base);
}

export function toolName(
  operationId: string | undefined,
  method: string,
  path: string,
  taken: Set<string>,
): string {
  const fromOperationId = operationId ? sanitizeToolName(operationId) : "";
  const base = fromOperationId.length > 0 ? fromOperationId : derivedName(method, path);
  const ensured = base.length > 0 ? base : sanitizeToolName(`${method}_op`);
  const finalBase = ensured.length > 0 ? ensured : "op";
  return disambiguate(finalBase, taken);
}

function disambiguate(base: string, taken: Set<string>): string {
  const truncatedBase = truncate(base, MAX_LENGTH);
  if (!taken.has(truncatedBase)) {
    taken.add(truncatedBase);
    return truncatedBase;
  }
  let suffix = 2;
  while (true) {
    const suffixStr = `_${suffix}`;
    const candidate = `${truncate(base, MAX_LENGTH - suffixStr.length)}${suffixStr}`;
    if (!taken.has(candidate)) {
      taken.add(candidate);
      return candidate;
    }
    suffix += 1;
  }
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return value.slice(0, max);
}

export function isValidToolName(name: string): boolean {
  return name.length > 0 && name.length <= MAX_LENGTH && VALID_NAME.test(name);
}
