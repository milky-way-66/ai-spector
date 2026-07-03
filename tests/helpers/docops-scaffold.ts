import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { DOCOPS_CONFIG_REL } from "@/core/docops/paths.js";
import { ENGINE_CONFIG_REL } from "@/core/engine/paths.js";
import { writeJson } from "@/core/util/fs.js";

export const MIN_DOCOPS = {
  schemaVersion: "1.0",
  languages: [{ code: "en", label: "English" }],
  capabilities: {
    review: false,
    comments: true,
    prototype: true,
    graph: true,
    generate: true,
    translate: false,
  },
  docTypes: {
    srs: {
      enabled: true,
      path: "docs/srs",
      label: "SRS",
      templatesPath: ".docops/templates/srs",
    },
    basicDesign: {
      enabled: true,
      path: "docs/basic-design",
      label: "Basic Design",
      templatesPath: ".docops/templates/basic-design",
    },
  },
};

export const MIN_ENGINE = {
  schemaVersion: 1,
  artifacts: {
    graph: ".ai-spector/graph/traceability.graph.json",
    registry: ".ai-spector/registry/section-registry.json",
    impactRules: ".ai-spector/rules/impact.json",
    tasks: ".ai-spector/.docflow/tasks",
    context: ".ai-spector/.docflow/context",
    knowledge: ".ai-spector/.docflow/knowledge",
    extracted: ".ai-spector/.docflow/extracted",
  },
  readiness: { profile: "general" },
};

/** Sync docops contract languages (source of truth when docops exists). */
export async function syncDocopsLanguages(
  root: string,
  langs: Array<{ code: string; label: string }>,
  extra?: {
    primaryLanguage?: string;
    internalLanguage?: string;
    clientLanguage?: string;
  },
): Promise<void> {
  const configPath = join(root, DOCOPS_CONFIG_REL);
  const existing = JSON.parse(await readFile(configPath, "utf8")) as typeof MIN_DOCOPS;
  await writeFile(
    configPath,
    JSON.stringify({
      ...existing,
      languages: langs,
      ...(extra?.primaryLanguage ? { primaryLanguage: extra.primaryLanguage } : {}),
      ...(extra?.internalLanguage ? { internalLanguage: extra.internalLanguage } : {}),
      ...(extra?.clientLanguage ? { clientLanguage: extra.clientLanguage } : {}),
    }),
    "utf8",
  );
}

/** Minimal Writer contract + engine layout for check/task tests. */
export async function scaffoldDocopsMinimal(root: string): Promise<void> {
  await mkdir(join(root, ".docops"), { recursive: true });
  await writeFile(join(root, DOCOPS_CONFIG_REL), JSON.stringify(MIN_DOCOPS), "utf8");
  await mkdir(join(root, ".ai-spector"), { recursive: true });
  await writeJson(join(root, ENGINE_CONFIG_REL), MIN_ENGINE);
  await mkdir(join(root, "docs/data-source"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/config"), { recursive: true });
  await mkdir(join(root, ".docops/templates/srs"), { recursive: true });
  await mkdir(join(root, ".docops/templates/basic-design"), { recursive: true });
  await writeFile(join(root, ".docops/templates/srs/01.md"), "# srs\n", "utf8");
  await writeFile(join(root, ".docops/templates/basic-design/01.md"), "# bd\n", "utf8");
  await mkdir(join(root, ".ai-spector/.docflow/context"), { recursive: true });
  await mkdir(join(root, "docs/srs/en"), { recursive: true });
  await mkdir(join(root, ".ai-spector/.docflow/tasks"), { recursive: true });
  await writeJson(join(root, ".ai-spector/.docflow/tasks/index.json"), {
    version: 1,
    active: {},
    recent: [],
  });
}

/** Writer-ready docops contract (templates + review capability files). */
export async function scaffoldDocopsWriterReady(root: string): Promise<void> {
  await scaffoldDocopsMinimal(root);
  const configPath = join(root, DOCOPS_CONFIG_REL);
  const config = JSON.parse(await readFile(configPath, "utf8")) as typeof MIN_DOCOPS;
  config.capabilities.review = true;
  await writeFile(configPath, JSON.stringify(config), "utf8");
  await writeJson(join(root, ".docops/review.config.json"), {
    schemaVersion: "1.0",
    extends: "kaopiz-default",
  });
  await mkdir(join(root, ".docops/review-queue"), { recursive: true });
  await writeJson(join(root, ".docops/review-queue/registry.json"), {
    version: 3,
    documents: {},
  });
}
