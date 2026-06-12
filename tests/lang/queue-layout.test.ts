import { describe, expect, it } from "vitest";
import {
  dateFolder,
  failedJobFileName,
  historyEntryFileName,
  jobIdMatchesFileName,
  resolvedJobFileName,
  safeTimestamp,
} from "@/core/lang/queue-layout.js";

describe("queue-layout", () => {
  it("partitions timestamps by date folder", () => {
    expect(dateFolder("2026-06-05T14:30:22.456Z")).toBe("2026-06-05");
  });

  it("produces filesystem-safe timestamp segments", () => {
    expect(safeTimestamp("2026-06-05T14:30:22.456Z")).toBe("2026-06-05T14-30-22-456Z");
  });

  it("names archive files with timestamp prefix for sort order", () => {
    const id = "abc-123-def";
    expect(resolvedJobFileName("2026-06-05T14:30:22.456Z", id)).toBe(
      "2026-06-05T14-30-22-456Z_abc-123-def.json",
    );
    expect(failedJobFileName("2026-06-05T15:00:00.000Z", id)).toBe(
      "2026-06-05T15-00-00-000Z_abc-123-def.json",
    );
    expect(historyEntryFileName("2026-06-05T14:30:22.456Z", 2, "en", id)).toBe(
      "2026-06-05T14-30-22-456Z_002_en_abc-123-.json",
    );
  });

  it("matches job id against archive filenames", () => {
    const file = "2026-06-05T14-30-22-456Z_abc-123-def.json";
    expect(jobIdMatchesFileName(file, "abc-123-def")).toBe(true);
    expect(jobIdMatchesFileName(file, "abc-123")).toBe(true);
    expect(jobIdMatchesFileName(file, "other-id")).toBe(false);
  });
});
