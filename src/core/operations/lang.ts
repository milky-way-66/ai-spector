import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import { primaryDocumentNodes, wireTranslationDocNode } from "../graph/translation.js";
import { addLangToPendingJobs, reconcileTranslationQueue } from "../lang/queue.js";
import { pathExists, readJson, writeJson } from "../util/fs.js";
import type { LanguageConfig } from "../config/types.js";
import { assertSupportedLanguageCode } from "../config/types.js";

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
  label?: string;
}

export interface LangAddResult {
  code: string;
  label: string;
  alreadyExists: boolean;
  srsDirCreated: boolean;
  basicDesignDirCreated: boolean;
  translationEdgesRegistered: boolean;
  queuePending?: number;
  queueEnqueued?: number;
}

export async function runLangAdd(code: string, opts: LangAddOptions = {}): Promise<LangAddResult> {
  const { root: projectRoot, config, configFile } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );

  const existing = config.languages.find((l) => l.code === code);
  if (existing) {
    return { code, label: existing.label, alreadyExists: true, srsDirCreated: false, basicDesignDirCreated: false, translationEdgesRegistered: false };
  }

  const label = opts.label ?? LANGUAGE_LABELS[code] ?? code;
  const newLang: LanguageConfig = { code: assertSupportedLanguageCode(code), label };
  const primary = config.languages[0];
  void primary; // used for context; translation edges handle wiring

  for (const docType of ["srs", "basic-design"]) {
    await mkdir(join(projectRoot, `docs/${docType}/${code}`), { recursive: true });
    const gitkeep = join(projectRoot, `docs/${docType}/${code}/.gitkeep`);
    if (!(await pathExists(gitkeep))) await writeFile(gitkeep, "");
  }

  const raw = await readJson<Record<string, unknown>>(configFile);
  const languages = Array.isArray(raw.languages) ? [...raw.languages, newLang] : [newLang];
  await writeJson(configFile, { ...raw, languages });

  const existingLangCodes = config.languages.map((l) => l.code);
  await registerTranslationEdges(projectRoot, config.paths.graph, newLang, existingLangCodes);

  const updatedConfig = { ...config, languages: [...config.languages, newLang] };
  await addLangToPendingJobs(projectRoot, code, updatedConfig);
  const queueResult = await reconcileTranslationQueue(projectRoot, updatedConfig);

  return {
    code,
    label,
    alreadyExists: false,
    srsDirCreated: true,
    basicDesignDirCreated: true,
    translationEdgesRegistered: true,
    queuePending: queueResult.skipped ? undefined : queueResult.pendingCount,
    queueEnqueued: queueResult.skipped ? undefined : queueResult.enqueued,
  };
}

async function registerTranslationEdges(
  projectRoot: string,
  graphRelPath: string,
  lang: LanguageConfig,
  existingLangCodes: string[],
): Promise<void> {
  const graphPath = join(projectRoot, graphRelPath);
  if (!(await pathExists(graphPath))) return;

  const allLangCodes = [...existingLangCodes, lang.code];
  const graphMem = await loadInMemoryGraph(graphPath);
  const primaryDocNodes = primaryDocumentNodes(graphMem, allLangCodes);
  if (primaryDocNodes.length === 0) return;

  for (const primary of primaryDocNodes) {
    wireTranslationDocNode(graphMem, primary, lang);
  }
  await writeJson(graphPath, graphMem.toTraceabilityGraph());
}
