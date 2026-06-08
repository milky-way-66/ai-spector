// ---------------------------------------------------------------------------
// Pack manifest validation (no JSON Schema library — manual checks only)
// ---------------------------------------------------------------------------

const PACK_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Minimal shape we need to validate
interface RawDocument {
  documentId?: unknown;
  template?: unknown;
  output?: unknown;
  outputPattern?: unknown;
  perDomain?: unknown;
}

/**
 * Validate a pack `manifest.json` loaded as unknown JSON.
 * Returns `{ valid, errors }` — callers print errors and exit non-zero on failure.
 */
export function validatePackManifest(manifest: unknown): ValidationResult {
  const errors: string[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return { valid: false, errors: ["manifest must be a JSON object"] };
  }

  const m = manifest as Record<string, unknown>;

  // packName
  if (typeof m["packName"] !== "string" || m["packName"].length === 0) {
    errors.push("`packName` must be a non-empty string");
  } else if (!PACK_NAME_RE.test(m["packName"] as string)) {
    errors.push(
      "`packName` must match /^[a-z0-9][a-z0-9-]*$/ (lowercase letters, digits, hyphens only, must start with letter or digit)",
    );
  }

  // templatesDir (optional)
  if ("templatesDir" in m && typeof m["templatesDir"] !== "string") {
    errors.push("`templatesDir` must be a string when provided");
  }

  // documents
  if (!Array.isArray(m["documents"]) || (m["documents"] as unknown[]).length === 0) {
    errors.push("`documents` must be a non-empty array");
    return { valid: errors.length === 0, errors };
  }

  const docs = m["documents"] as RawDocument[];
  const seenIds = new Set<string>();

  for (let i = 0; i < docs.length; i++) {
    const doc = docs[i]!;
    const prefix = `documents[${i}]`;

    if (typeof doc.documentId !== "string" || doc.documentId.length === 0) {
      errors.push(`${prefix}.documentId must be a non-empty string`);
    } else {
      if (seenIds.has(doc.documentId)) {
        errors.push(`${prefix}.documentId "${doc.documentId}" is duplicated`);
      }
      seenIds.add(doc.documentId);
    }

    if (typeof doc.template !== "string" || doc.template.length === 0) {
      errors.push(`${prefix}.template must be a non-empty string`);
    }

    const hasOutput = typeof doc.output === "string" && doc.output.length > 0;
    const hasOutputPattern =
      typeof doc.outputPattern === "string" && doc.outputPattern.length > 0;

    if (hasOutput && hasOutputPattern) {
      errors.push(`${prefix}: cannot have both \`output\` and \`outputPattern\``);
    } else if (!hasOutput && !hasOutputPattern) {
      errors.push(`${prefix}: must have either \`output\` or \`outputPattern\``);
    }

    if ("perDomain" in doc && doc.perDomain !== undefined) {
      if (typeof doc.perDomain !== "string" || doc.perDomain.length === 0) {
        errors.push(`${prefix}.perDomain must be a non-empty string when provided`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
