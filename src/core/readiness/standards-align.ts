/** Normalize standards id for comparison (ISO-29148, iso29148 → ISO-29148). */
export function normalizeStandardId(id: string): string {
  return id.trim().toUpperCase().replace(/\s+/g, "-");
}

export function extractCriteriaStandardIds(standards: unknown[] | undefined): string[] {
  if (!standards?.length) return [];
  const ids: string[] = [];
  for (const entry of standards) {
    if (typeof entry === "string") {
      ids.push(normalizeStandardId(entry));
    } else if (entry && typeof entry === "object" && "id" in entry) {
      const id = (entry as { id?: string }).id;
      if (id) ids.push(normalizeStandardId(id));
    }
  }
  return ids;
}

export interface StandardsAlignment {
  /** Tags declared in docflow.config.json readiness.standards (project intent). */
  configDeclared: string[];
  /** Standard ids embedded in the active readiness-criteria file (assess source of truth). */
  criteriaFile: string[];
  /** Config tags with no match in the criteria file — assess still runs; alignment is informational. */
  unmatchedInCriteria: string[];
  note: string;
}

export function checkStandardsAlignment(
  configStandards: string[] | undefined,
  criteriaStandards: unknown[] | undefined,
): StandardsAlignment {
  const configDeclared = (configStandards ?? []).map(normalizeStandardId);
  const criteriaFile = extractCriteriaStandardIds(criteriaStandards);
  const criteriaSet = new Set(criteriaFile);
  const unmatchedInCriteria = configDeclared.filter((id) => !criteriaSet.has(id));

  let note =
    "docflow.config readiness.standards declares project intent; readiness_assess scores against doc-types/*/readiness-criteria.json.";
  if (unmatchedInCriteria.length > 0) {
    note +=
      ` Config tags not found in criteria file: ${unmatchedInCriteria.join(", ")} — update config or criteria standards list.`;
  }

  return { configDeclared, criteriaFile, unmatchedInCriteria, note };
}
