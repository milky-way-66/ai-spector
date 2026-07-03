import type { DocopsConfig } from "../docops/types.js";
import type { DocflowConfig, LanguageConfig } from "./types.js";
import { assertSupportedLanguageCode } from "./types.js";

/** Resolve primary language code from docops contract fields. */
export function primaryLanguageCodeFromDocops(
  config: Partial<Pick<DocopsConfig, "primaryLanguage" | "languages">>,
): string {
  const explicit = config.primaryLanguage?.trim().toLowerCase();
  const languages = config.languages ?? [];
  const known = new Set(languages.map((l) => l.code.trim().toLowerCase()).filter(Boolean));
  if (explicit && (!known.size || known.has(explicit))) {
    return explicit;
  }
  return languages[0]?.code?.trim().toLowerCase() || explicit || "en";
}

export function languagesFromDocopsPartial(
  docopsRaw: Partial<DocopsConfig>,
): LanguageConfig[] | null {
  if (!Array.isArray(docopsRaw.languages) || docopsRaw.languages.length === 0) {
    return null;
  }
  return docopsRaw.languages.map((l) => ({
    code: assertSupportedLanguageCode(String(l.code ?? "").trim().toLowerCase()),
    label: String(l.label ?? l.code ?? "").trim() || String(l.code),
  }));
}

/** Place the primary language first — DocflowConfig uses languages[0] as primary. */
export function orderLanguagesPrimaryFirst(
  languages: LanguageConfig[],
  primaryCode: string,
): LanguageConfig[] {
  const normalizedPrimary = primaryCode.trim().toLowerCase() as LanguageConfig["code"];
  const idx = languages.findIndex((l) => l.code === normalizedPrimary);
  if (idx <= 0) {
    return languages;
  }
  const ordered = [...languages];
  const [primary] = ordered.splice(idx, 1);
  return [primary, ...ordered];
}

/** When docops contract exists, its language fields override legacy docflow.config.json. */
export function applyDocopsLanguageOverlay(
  config: DocflowConfig,
  docopsRaw: Partial<DocopsConfig>,
): DocflowConfig {
  const fromDocops = languagesFromDocopsPartial(docopsRaw);
  if (!fromDocops) {
    return config;
  }

  const primaryCode = primaryLanguageCodeFromDocops(docopsRaw);
  const languages = orderLanguagesPrimaryFirst(fromDocops, primaryCode);
  const languageCodes = new Set(languages.map((l) => l.code));

  let internalLanguage: DocflowConfig["internalLanguage"];
  if (docopsRaw.internalLanguage) {
    try {
      const code = assertSupportedLanguageCode(docopsRaw.internalLanguage.trim().toLowerCase());
      if (languageCodes.has(code)) {
        internalLanguage = code;
      }
    } catch {
      // unsupported code — skip
    }
  } else if (config.internalLanguage && languageCodes.has(config.internalLanguage)) {
    internalLanguage = config.internalLanguage;
  }

  let clientLanguage: DocflowConfig["clientLanguage"];
  if (docopsRaw.clientLanguage) {
    try {
      const code = assertSupportedLanguageCode(docopsRaw.clientLanguage.trim().toLowerCase());
      if (languageCodes.has(code)) {
        clientLanguage = code;
      }
    } catch {
      // unsupported code — skip
    }
  } else if (config.clientLanguage && languageCodes.has(config.clientLanguage)) {
    clientLanguage = config.clientLanguage;
  }

  return {
    ...config,
    languages,
    ...(internalLanguage ? { internalLanguage } : {}),
    ...(clientLanguage ? { clientLanguage } : {}),
  };
}

export function legacyDocflowLanguageDiffersFromDocops(
  docopsRaw: Partial<DocopsConfig>,
  legacyRaw: Partial<DocflowConfig>,
): { docopsPrimary: string; docopsCodes: string[]; legacyCodes: string[] } | null {
  const fromDocops = languagesFromDocopsPartial(docopsRaw);
  if (!fromDocops) {
    return null;
  }

  const docopsPrimary = primaryLanguageCodeFromDocops(docopsRaw);
  const docopsCodes = fromDocops.map((l) => l.code);

  const legacyLangs = Array.isArray(legacyRaw.languages) ? legacyRaw.languages : [];
  const legacyCodes = legacyLangs
    .map((l) => String(l.code ?? "").trim().toLowerCase())
    .filter(Boolean) as LanguageConfig["code"][];

  const docopsSet = [...new Set(docopsCodes)].sort().join(",");
  const legacySet = [...new Set(legacyCodes)].sort().join(",");
  const legacyPrimary = legacyCodes[0] ?? "en";

  if (docopsSet === legacySet && docopsPrimary === legacyPrimary) {
    return null;
  }

  return { docopsPrimary, docopsCodes, legacyCodes };
}
