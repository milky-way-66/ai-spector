import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TaskCreateSchema,
  TaskListSchema,
  TaskUpdateSchema,
  TaskApprovePlanSchema,
  TemplateScanSchema,
  TemplateInferSchema,
  TemplateInstallSchema,
  TaskApproveImportPlanSchema,
  TaskApprovePackDesignSchema,
  TaskKindEnum,
  BuiltinWorkflowIdEnum,
} from "@/interfaces/mcp/schemas.js";
import { MCP_TOOL_NAMES, TEMPLATE_IMPORT_MCP_TOOLS } from "@/interfaces/mcp/tool-names.js";
import {
  collectStringEnums,
  planUnionIncludesKind,
  toMcpInputJsonSchema,
} from "./mcp-json-schema.js";

const serverSource = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../../src/interfaces/mcp/server.ts"),
  "utf8",
);

function registeredToolNames(): string[] {
  return [...serverSource.matchAll(/server\.registerTool\(\s*\n\s*"([^"]+)"/g)].map((m) => m[1]);
}

describe("MCP task/import schema JSON (list_tools parity)", () => {
  it("TaskKindEnum includes import", () => {
    expect(TaskKindEnum.options).toContain("import");
  });

  it("BuiltinWorkflowIdEnum includes template-import", () => {
    expect(BuiltinWorkflowIdEnum.options).toContain("template-import");
  });

  it("task_create exposes import kind and template-import workflow in JSON Schema", () => {
    const json = toMcpInputJsonSchema(TaskCreateSchema);
    expect(collectStringEnums(json.properties?.kind)).toContain("import");
    expect(collectStringEnums(json.properties?.workflow)).toContain("template-import");
  });

  it("task_list filters and bootstrap expose import / template-import", () => {
    const json = toMcpInputJsonSchema(TaskListSchema);
    expect(collectStringEnums(json.properties?.kind)).toContain("import");
    expect(collectStringEnums(json.properties?.workflow)).toContain("template-import");
    const bootstrap = json.properties?.bootstrap as Record<string, unknown> | undefined;
    const bootstrapProps = bootstrap?.properties as Record<string, unknown> | undefined;
    expect(collectStringEnums(bootstrapProps?.kind)).toContain("import");
    expect(collectStringEnums(bootstrapProps?.workflow)).toContain("template-import");
  });

  it("StoredPlanSchema import branch appears in task_approve_plan and task_update", () => {
    const approve = toMcpInputJsonSchema(TaskApprovePlanSchema);
    const planApprove = approve.properties?.plan as Record<string, unknown> | undefined;
    expect(planUnionIncludesKind(planApprove, "import")).toBe(true);

    const update = toMcpInputJsonSchema(TaskUpdateSchema);
    const patch = update.properties?.patch as Record<string, unknown> | undefined;
    const patchProps = patch?.properties as Record<string, unknown> | undefined;
    const planUpdate = patchProps?.plan as Record<string, unknown> | undefined;
    expect(planUnionIncludesKind(planUpdate, "import")).toBe(true);
  });

  it("template-import pipeline tools have input schemas", () => {
    for (const schema of [
      TemplateScanSchema,
      TemplateInferSchema,
      TemplateInstallSchema,
      TaskApproveImportPlanSchema,
      TaskApprovePackDesignSchema,
    ]) {
      const json = toMcpInputJsonSchema(schema);
      expect(json.type).toBe("object");
      expect(json.properties).toBeTruthy();
    }
  });

  it("task_approve_import_plan plan union includes import kind", () => {
    const json = toMcpInputJsonSchema(TaskApproveImportPlanSchema);
    const plan = json.properties?.plan as Record<string, unknown> | undefined;
    expect(planUnionIncludesKind(plan, "import")).toBe(true);
  });
});

describe("MCP server tool registration parity", () => {
  it("registerTool count matches MCP_TOOL_NAMES", () => {
    const registered = registeredToolNames();

    expect(registered).toHaveLength(MCP_TOOL_NAMES.length);
    expect(new Set(registered).size).toBe(registered.length);

    const missingFromRegistry = registered.filter((name) => !MCP_TOOL_NAMES.includes(name as never));
    const missingFromServer = MCP_TOOL_NAMES.filter((name) => !registered.includes(name));
    expect(missingFromRegistry).toEqual([]);
    expect(missingFromServer).toEqual([]);

    for (const tool of TEMPLATE_IMPORT_MCP_TOOLS) {
      expect(registered).toContain(tool);
    }
  });
});
