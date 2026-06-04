import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { LanguageConfig } from "../config/types.js";

const LANGUAGE_LABELS: Record<string, string> = {
  en: "English",
  jp: "Japanese",
  ja: "Japanese",
  vi: "Vietnamese",
  zh: "Chinese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
  pt: "Portuguese",
};

export interface LangAddOptions {
  root?: string;
  /** Optional display label; inferred from built-in map if omitted. */
  label?: string;
}

export async function runLangAdd(code: string, opts: LangAddOptions = {}): Promise<void> {
  const { root: projectRoot, config, configFile } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );

  const existing = config.languages.find((l) => l.code === code);
  if (existing) {
    console.log(`Language "${code}" is already configured.`);
    return;
  }

  const label = opts.label ?? LANGUAGE_LABELS[code] ?? code;
  const newLang: LanguageConfig = { code, label };
  const primary = config.languages[0];

  // Create doc folders
  const docTypes = ["srs", "basic-design"];
  for (const docType of docTypes) {
    await mkdir(join(projectRoot, `docs/${docType}/${code}`), { recursive: true });
    const gitkeep = join(projectRoot, `docs/${docType}/${code}/.gitkeep`);
    if (!(await pathExists(gitkeep))) {
      await writeFile(gitkeep, "");
    }
  }

  // Append to config
  const raw = await readJson<Record<string, unknown>>(configFile);
  const languages = Array.isArray(raw.languages) ? [...raw.languages, newLang] : [newLang];
  await writeJson(configFile, { ...raw, languages });

  // Add translationOf edges to graph
  const existingLangCodes = config.languages.map((l) => l.code);
  await registerTranslationEdges(projectRoot, config.paths.graph, code, existingLangCodes);

  console.log(`Added language: ${label} (${code})`);
  console.log(`  docs/srs/${code}/`);
  console.log(`  docs/basic-design/${code}/`);
  console.log(`  translationOf edges registered in graph`);
  console.log(`Run 'npx ai-spector index' to refresh the full graph.`);
}

async function registerTranslationEdges(
  projectRoot: string,
  graphRelPath: string,
  langCode: string,
  existingLangCodes: string[],
): Promise<void> {
  const graphPath = join(projectRoot, graphRelPath);
  if (!(await pathExists(graphPath))) {
    return;
  }

  const graph = await readJson<{
    version: number;
    nodes: Array<{ id: string; type: string; lang?: string }>;
    edges: Array<{ type: string; from: string; to: string }>;
  }>(graphPath);

  // Primary doc nodes are identified by NOT having a "doc:{langCode}:" prefix.
  // Using ID-prefix matching is reliable; the `lang` attribute is not (may be absent on primary nodes).
  const allLangCodes = [...existingLangCodes, langCode];
  const translationPrefixes = allLangCodes.map((c) => `doc:${c}:`);
  const primaryDocNodes = graph.nodes.filter(
    (n) => n.type === "document" && !translationPrefixes.some((p) => n.id.startsWith(p)),
  );

  const newEdges: Array<{ type: string; from: string; to: string }> = [];
  const newNodes: Array<{ id: string; type: string; lang: string }> = [];

  for (const primary of primaryDocNodes) {
    const translatedId = `doc:${langCode}:${primary.id}`;
    const alreadyExists = graph.nodes.some((n) => n.id === translatedId);
    if (!alreadyExists) {
      newNodes.push({ id: translatedId, type: "document", lang: langCode });
    }
    const edgeExists = graph.edges.some(
      (e) => e.type === "translationOf" && e.from === translatedId && e.to === primary.id,
    );
    if (!edgeExists) {
      newEdges.push({ type: "translationOf", from: translatedId, to: primary.id });
    }
  }

  if (newNodes.length > 0 || newEdges.length > 0) {
    graph.nodes.push(...newNodes);
    graph.edges.push(...newEdges);
    await writeJson(graphPath, graph);
  }
}
