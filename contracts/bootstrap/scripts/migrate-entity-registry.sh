#!/usr/bin/env bash
# Migrate legacy path-keyed docops artifacts to entity registry (ID-keyed).
# Run from repository root. Requires Node.js (npx ai-spector).
#
# Usage:
#   migrate-entity-registry.sh [--dry-run] [--skip-screen-map] [--skip-comments] [--skip-review]
#
set -euo pipefail

DRY_RUN=""
SKIP_SCREEN_MAP=""
SKIP_COMMENTS=""
SKIP_REVIEW=""

for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN="--dry-run" ;;
    --skip-screen-map) SKIP_SCREEN_MAP="--skip-screen-map" ;;
    --skip-comments) SKIP_COMMENTS=1 ;;
    --skip-review) SKIP_REVIEW=1 ;;
    -h|--help)
      sed -n '2,8p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown option: $arg" >&2
      exit 1
      ;;
  esac
done

if ! command -v npx >/dev/null 2>&1; then
  echo "npx is required (Node.js)." >&2
  exit 1
fi

if [[ ! -f .docops/docops.config.json ]]; then
  echo "Missing .docops/docops.config.json — complete contract migration first (see MIGRATION.md)." >&2
  exit 1
fi

echo "==> docops registry sync"
npx ai-spector docops registry sync $DRY_RUN $SKIP_SCREEN_MAP

if [[ -z "${SKIP_COMMENTS}" ]]; then
  echo "==> docops comments migrate"
  npx ai-spector docops comments migrate $DRY_RUN
fi

if [[ -z "${SKIP_REVIEW}" ]]; then
  echo "==> docops review-registry migrate"
  npx ai-spector docops review-registry migrate $DRY_RUN
fi

echo "Done. See ENTITY_REGISTRY_MIGRATION.md for verification steps."
