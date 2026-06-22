import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { loadDocflowConfig } from "../config/load.js";
import { loadInMemoryGraph } from "../graph/loadGraph.js";
import {
  applyPrimaryLanguageOutputs,
  primaryDocumentNodes,
  wireTranslationDocNode,
} from "../graph/translation.js";
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

export interface LangSetClientOptions {
  root?: string;
}

export interface LangSetClientResult {
  code: string;
  label: string;
  previousCode: string | null;
}

export interface LangSetInternalOptions {
  root?: string;
}

export interface LangSetInternalResult {
  code: string;
  label: string;
  previousCode: string | null;
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

  for (const docType of ["srs", "basic-design"]) {
    await mkdir(join(projectRoot, `docs/${docType}/${code}`), { recursive: true });
    const gitkeep = join(projectRoot, `docs/${docType}/${code}/.gitkeep`);
    if (!(await pathExists(gitkeep))) await writeFile(gitkeep, "");
  }

  const raw = await readJson<Record<string, unknown>>(configFile);
  const languages = Array.isArray(raw.languages) ? [...raw.languages, newLang] : [newLang];
  await writeJson(configFile, { ...raw, languages });

  const existingLangCodes = config.languages.map((l) => l.code);
  await registerTranslationEdges(
    projectRoot,
    config.paths.graph,
    newLang,
    existingLangCodes,
    primary?.code ?? code,
  );

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
  primaryLangCode: string,
): Promise<void> {
  const graphPath = join(projectRoot, graphRelPath);
  if (!(await pathExists(graphPath))) return;

  const allLangCodes = [...existingLangCodes, lang.code];
  const graphMem = await loadInMemoryGraph(graphPath);
  applyPrimaryLanguageOutputs(graphMem, primaryLangCode, allLangCodes);
  const primaryDocNodes = primaryDocumentNodes(graphMem, allLangCodes);
  if (primaryDocNodes.length === 0) return;

  for (const primary of primaryDocNodes) {
    wireTranslationDocNode(graphMem, primary, lang, primaryLangCode);
  }
  await writeJson(graphPath, graphMem.toTraceabilityGraph());
}

export async function runLangSetClient(
  code: string,
  opts: LangSetClientOptions = {},
): Promise<LangSetClientResult> {
  const { config, configFile } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );

  const normalized = assertSupportedLanguageCode(code);
  const match = config.languages.find((l) => l.code === normalized);
  if (!match) {
    const configured = config.languages.map((l) => l.code).join(", ");
    throw new Error(
      `Language "${normalized}" is not configured. Add it first with: npx ai-spector lang add ${normalized}. ` +
        `Configured languages: ${configured || "(none)"}`,
    );
  }

  const previousCode = config.clientLanguage ?? null;
  const raw = await readJson<Record<string, unknown>>(configFile);
  await writeJson(configFile, { ...raw, clientLanguage: normalized });

  return {
    code: normalized,
    label: match.label,
    previousCode,
  };
}

export async function runLangSetInternal(
  code: string,
  opts: LangSetInternalOptions = {},
): Promise<LangSetInternalResult> {
  const { config, configFile } = await loadDocflowConfig(
    opts.root ? resolve(opts.root) : undefined,
  );

  const normalized = assertSupportedLanguageCode(code);
  const match = config.languages.find((l) => l.code === normalized);
  if (!match) {
    const configured = config.languages.map((l) => l.code).join(", ");
    throw new Error(
      `Language "${normalized}" is not configured. Add it first with: npx ai-spector lang add ${normalized}. ` +
        `Configured languages: ${configured || "(none)"}`,
    );
  }

  const previousCode = config.internalLanguage ?? null;
  const raw = await readJson<Record<string, unknown>>(configFile);
  await writeJson(configFile, { ...raw, internalLanguage: normalized });

  return {
    code: normalized,
    label: match.label,
    previousCode,
  };
}
