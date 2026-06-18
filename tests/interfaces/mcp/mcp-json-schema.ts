import { toJsonSchemaCompat } from "@modelcontextprotocol/sdk/server/zod-json-schema-compat.js";
import { normalizeObjectSchema } from "@modelcontextprotocol/sdk/server/zod-compat.js";
import type { z } from "zod";

/** Same JSON Schema conversion Cursor receives from list_tools. */
export function toMcpInputJsonSchema(schema: z.ZodObject<z.ZodRawShape>) {
  const obj = normalizeObjectSchema(schema.shape);
  return toJsonSchemaCompat(obj, { strictUnions: true, pipeStrategy: "input" });
}

/** Collect string enum values from a JSON Schema property (enum or anyOf with enum). */
export function collectStringEnums(prop: unknown): string[] {
  if (!prop || typeof prop !== "object") return [];
  const p = prop as Record<string, unknown>;
  if (Array.isArray(p.enum)) {
    return p.enum.filter((v): v is string => typeof v === "string");
  }
  if (Array.isArray(p.anyOf)) {
    return p.anyOf.flatMap((branch) => collectStringEnums(branch));
  }
  return [];
}

/** True when JSON Schema oneOf/anyOf includes a branch with properties.kind.const === value. */
export function planUnionIncludesKind(schema: unknown, kind: string): boolean {
  if (!schema || typeof schema !== "object") return false;
  const s = schema as Record<string, unknown>;

  const props = s.properties as Record<string, unknown> | undefined;
  const kindProp = props?.kind as Record<string, unknown> | undefined;
  if (kindProp?.const === kind) return true;

  for (const key of ["oneOf", "anyOf"] as const) {
    const branches = s[key] as unknown[] | undefined;
    if (Array.isArray(branches) && branches.some((branch) => planUnionIncludesKind(branch, kind))) {
      return true;
    }
  }
  return false;
}
